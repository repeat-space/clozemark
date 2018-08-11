#!/usr/bin/env node

'use strict';

const fs = require('fs');
const globby = require('globby');
const remark = require('remark');
const prompts = require('prompts');
const diff = require('diff');
const chalk = require('chalk');
const { highlight } = require('cli-highlight');

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

async function main() {
  const config = readConfig();

  const pattern = config.files || '**/*.md';
  const files = globby.sync(pattern, { absolute: true });
  if (files.length === 0) {
    console.error(`no results for "${pattern}"`);
    process.exit(1);
  }

  const data = readData();
  const resources = readMarkdown(files);

  for (let i = 0 ; i < 1 ; i++) {
    await showRandom(resources);
  }

  saveData(data);
}

async function showRandom(resources) {
  const resourceIndex = Math.random() * resources.length | 0;
  const resource = resources[resourceIndex];

  const lines = resource.code.split('\n');
  const lineIndex = Math.random() * lines.length | 0;

  const linesWithCloze = [
    ...lines.slice(0, lineIndex),
    '// =====???=====',
    ...lines.slice(lineIndex + 1)
  ];

  console.log(`\n${resource.heading || 'unnamed'} (${resource.file.replace(process.cwd(), '')})\n`);
  console.log(highlight(linesWithCloze.join('\n'), { language: resource.language }));
  console.log('\n');

  const { answer } = await prompts({
    type: 'text',
    name: 'answer',
    message: 'missing line'
  });

  if (typeof answer === 'undefined') {
    console.error('no answer');
    return;
  }

  if (answer !== lines[lineIndex]) {
    const lineDiff = diff.diffChars(lines[lineIndex], answer).map(part => {
      if (part.added) return chalk.green(part.value);
      if (part.removed) return chalk.red(part.value);
      return chalk.gray(part.value);
    }).join('');

    console.log(`  ${chalk.green('expected')}`);
    console.log(`  ${chalk.red('actual')}\n`);

    console.log(lineDiff);
    console.log('\n')

    console.log(highlight(resource.code, { language: resource.language }));
  } else {
    console.log(chalk.green('correct'));
  }
}

function readMarkdown(files) {
  return files.reduce((acc, file) => {
    const content = fs.readFileSync(file, 'utf-8');
    const ast = remark.parse(content);

    let currHeading;
    let index = 0;

    ast.children.forEach(child => {
      if (child.type === 'heading') {
        currHeading = remark.stringify(child);
      } else if (child.type === 'code') {
        acc.push({
          file,
          index: index++,
          heading: currHeading,
          code: child.value,
          language: child.lang
        });
      }
    });

    return acc;

  }, []);
}

function readConfig() {
  if (!fs.existsSync('.clozerc')) {
    console.error(`.clozerc doesn't exist in cwd`);
    process.exit(1);
  }

  return JSON.parse(fs.readFileSync('.clozerc', 'utf-8'));
}

function readData() {
  if (fs.existsSync('cloze.json')) {
    return JSON.parse(fs.readFileSync('cloze.json', 'utf-8'));
  }

  return {
    code: {}
  };
}

function saveData(data) {
  fs.writeFileSync('cloze.json', JSON.stringify(data, null, 2));
}
