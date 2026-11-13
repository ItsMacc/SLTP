// check-learn-ledger.mjs — Checks that every glossary term is taught before it
// is used, that every introduced term has a definition and appears, and that
// watch-list vocabulary is in the glossary.

import { createServer } from 'vite';

const server = await createServer({
  root: process.cwd(),
  configFile: false,
  logLevel: 'error',
  server: { middlewareMode: true },
  appType: 'custom',
});

const { LEVELS } = await server.ssrLoadModule('/src/learn/curriculum.ts');
const { LEARN_GLOSSARY } = await server.ssrLoadModule('/src/learn/learnGlossary.ts');
const { glossaryKeysIn } = await server.ssrLoadModule('/src/learn/termMatch.ts');

const glossaryKeys = Object.keys(LEARN_GLOSSARY);
const errors = [];
const introduced = new Set();

const WATCH = [
  'drawdown', 'volatility', 'benchmark', 'Sharpe', 'alpha', 'beta', 'correlation',
  'overfitting', 'slippage', 'spread', 'liquidity', 'leverage', 'hedge', 'rebalancing',
  'expectancy', 'regime', 'universe', 'equity curve', 'annualised', 'z-score',
  'standard deviation', 'out-of-sample', 'walk-forward', 'look-ahead', 'survivorship',
];

const textFor = (lesson) => {
  const content = lesson.content;
  if (!content) return '';
  const blockText = content.blocks
    .map((block) => {
      if ('text' in block) return block.text;
      if (block.kind === 'list') return block.items.join(' ');
      if (block.kind === 'terms') return block.items.map((item) => `${item.term} ${item.text}`).join(' ');
      if (block.kind === 'formula') return [block.title, ...block.rows.flatMap((row) => [row.label, row.expression, row.note ?? ''])].filter(Boolean).join(' ');
      return '';
    })
    .join(' ');
  const quizText = content.check
    .map((question) => [question.prompt, ...question.options, question.explanation, question.hint ?? ''].join(' '))
    .join(' ');
  return [
    lesson.title,
    lesson.summary,
    lesson.badgeDescription,
    ...content.objectives,
    blockText,
    ...content.recap,
    quizText,
  ].join(' ');
};

for (const level of LEVELS) {
  for (const lesson of level.parts.flatMap((part) => part.lessons)) {
    if (lesson.status !== 'live' || !lesson.content) continue;
    const text = textFor(lesson);
    const keys = glossaryKeysIn(text, glossaryKeys);

    for (const key of keys) {
      if (!introduced.has(key) && !lesson.introduces.includes(key)) {
        errors.push(`${lesson.id}: uses "${key}" before it is introduced`);
      }
    }

    for (const term of lesson.introduces) {
      if (!LEARN_GLOSSARY[term]) errors.push(`${lesson.id}: introduces "${term}" with no glossary entry`);
      if (introduced.has(term)) errors.push(`${lesson.id}: introduces "${term}" more than once`);
      if (!keys.includes(term)) errors.push(`${lesson.id}: introduces "${term}" but never uses it`);
    }

    for (const term of lesson.assumes) {
      if (!introduced.has(term)) errors.push(`${lesson.id}: assumes "${term}" before it is introduced`);
    }

    for (const word of WATCH) {
      const found = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text);
      if (found && !glossaryKeys.some((key) => key === word || key.includes(word))) {
        errors.push(`${lesson.id}: watch-list word "${word}" is not a glossary term`);
      }
    }

    for (const term of lesson.introduces) introduced.add(term);
  }
}

await server.close();

if (errors.length) {
  for (const error of errors) console.error(`error: ${error}`);
  console.error(`\n${errors.length} term-ledger errors.`);
  process.exit(1);
}
console.log(`Term ledger passed. ${introduced.size} terms introduced.`);
