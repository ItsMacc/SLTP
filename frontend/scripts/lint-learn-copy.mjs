// lint-learn-copy.mjs — Checks every visible Learn string for the brief's
// banned characters, words, constructions, paragraph length and sentence length.
// Run with: npm run lint:learn-copy

import { createServer } from 'vite';

const server = await createServer({
  root: process.cwd(),
  configFile: false,
  logLevel: 'error',
  server: { middlewareMode: true },
  appType: 'custom',
});

const { LEVELS, WORKSHOPS } = await server.ssrLoadModule('/src/learn/curriculum.ts');
const { LEARN_GLOSSARY } = await server.ssrLoadModule('/src/learn/learnGlossary.ts');

const errors = [];
const warnings = [];

const BANNED_WORDS = [
  'delve', 'dive into', 'unlock', 'journey', 'master', 'leverage', 'empower',
  'seamless', 'robust', 'crucial', 'pivotal', 'navigate', 'landscape', 'realm',
  'game-changer', 'cutting-edge', 'supercharge', 'elevate', 'unleash', 'demystify',
  'embark', 'myriad', 'plethora', 'tapestry', "in today's", "it's important to note",
  "it's worth noting", 'worth remembering', 'essentially', 'fundamentally', 'ultimately',
  'at its core', 'simply put', 'in short', 'in essence', 'the truth is', 'honestly',
  "let's", 'imagine', 'picture this', 'think of', "whether you're", "here's",
  'pro tip', 'buckle up', 'level up', "you've got this", 'great job', 'nice work',
  'congrats', "don't worry", 'have you ever wondered',
];

const BANNED_PATTERNS = [
  { name: 'em dash or en dash', regex: /[\u2013\u2014]/g },
  { name: 'exclamation mark', regex: /!/g },
  { name: 'emoji', regex: /[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu },
  { name: 'not just X but Y', regex: /\bnot just\b[^.!?]{1,100}\bbut\b/gi },
  { name: 'not only X but Y', regex: /\bnot only\b[^.!?]{1,100}\bbut\b/gi },
  { name: "It's not X, it's Y", regex: /\bit(?:'s| is) not\b[^.!?]{1,100}\bit(?:'s| is)\b/gi },
  { name: 'sentence opens with Now, So, Next, Then or Finally', regex: /(?:^|[.!?]\s+)(?:Now|So|Next|Then|Finally),/g },
  { name: '"price returns" used as a verb phrase', regex: /\bprice\s+returns?\b/gi },
];

const wordPatterns = BANNED_WORDS.map((word) => ({
  name: word,
  regex: new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'),
}));

const sentenceSplit = (text) => text.split(/(?<=[.!?])\s+/).map((value) => value.trim()).filter(Boolean);
const wordCount = (text) => (text.match(/\b[\w'-]+\b/g) ?? []).length;

function checkText(text, where, { body = true } = {}) {
  if (!text) return;
  for (const pattern of BANNED_PATTERNS) {
    pattern.regex.lastIndex = 0;
    if (pattern.regex.test(text)) errors.push(`${where}: ${pattern.name}`);
  }
  for (const pattern of wordPatterns) {
    pattern.regex.lastIndex = 0;
    if (pattern.regex.test(text)) errors.push(`${where}: banned word "${pattern.name}"`);
  }
  const sentences = sentenceSplit(text);
  if (body && sentences.length > 3) {
    errors.push(`${where}: paragraph has ${sentences.length} sentences`);
  }
  for (const sentence of sentences) {
    const count = wordCount(sentence);
    if (count > 28) errors.push(`${where}: sentence has ${count} words`);
    if (body && /\?$/.test(sentence)) errors.push(`${where}: body sentence ends with a question mark`);
  }
}

function blocksText(blocks) {
  return blocks
    .map((block) => {
      if ('text' in block) return block.text;
      if (block.kind === 'list') return block.items.join(' ');
      if (block.kind === 'terms') return block.items.map((item) => `${item.term} ${item.text}`);
      if (block.kind === 'formula') return [block.title, ...block.rows.flatMap((row) => [row.label, row.expression, row.note ?? ''])].filter(Boolean);
      return '';
    })
    .flat()
    .filter(Boolean);
}

for (const level of LEVELS) {
  checkText(level.lead, `${level.id}: level lead`);
  for (const outcome of level.outcomes) checkText(outcome, `${level.id}: outcome`);
  for (const lesson of level.parts.flatMap((part) => part.lessons)) {
    if (lesson.status !== 'live' || !lesson.content) continue;
    const where = `${lesson.id}`;
    checkText(lesson.title, `${where}: title`, { body: false });
    checkText(lesson.summary, `${where}: summary`);
    checkText(lesson.badgeDescription, `${where}: badge description`);
    for (const objective of lesson.content.objectives) checkText(objective, `${where}: objective`);
    for (const text of blocksText(lesson.content.blocks)) checkText(text, `${where}: body`);
    for (const text of lesson.content.recap) checkText(text, `${where}: recap`);
    for (const question of lesson.content.check) {
      checkText(question.prompt, `${where}: quiz prompt`, { body: false });
      for (const option of question.options) checkText(option, `${where}: quiz option`, { body: false });
      checkText(question.explanation, `${where}: quiz explanation`);
      if (question.hint) checkText(question.hint, `${where}: quiz hint`);
    }
    for (const question of level.quiz) {
      checkText(question.prompt, `${where}: level quiz prompt`, { body: false });
      for (const option of question.options) checkText(option, `${where}: level quiz option`, { body: false });
      checkText(question.explanation, `${where}: level quiz explanation`);
      if (question.hint) checkText(question.hint, `${where}: level quiz hint`);
    }
    const bodyStrings = blocksText(lesson.content.blocks).concat(lesson.content.recap);
    const triples = bodyStrings.reduce(
      (count, text) => count + (text.match(/\b[\w$-]+,\s+[\w$-]+,\s+(?:and|or)\s+[\w$-]+/g)?.length ?? 0),
      0,
    );
    if (triples > 2) warnings.push(`${lesson.id}: ${triples} three-item comma lists`);
    for (const text of bodyStrings) {
      if (/^(And|But|Or|So|Because|Although|While)\b/.test(text)) {
        warnings.push(`${lesson.id}: paragraph starts with a conjunction`);
        break;
      }
    }
    const openings = bodyStrings.map((text) => sentenceSplit(text)[0]?.split(/\s+/).slice(0, 2).join(' ').toLowerCase());
    for (let index = 2; index < openings.length; index += 1) {
      if (openings[index] && openings[index] === openings[index - 1] && openings[index] === openings[index - 2]) {
        warnings.push(`${lesson.id}: the same sentence opening appears three times in a row`);
        break;
      }
    }
  }
}

for (const [term, data] of Object.entries(LEARN_GLOSSARY)) {
  checkText(data.definition, `glossary: ${term} definition`);
  if (data.example) checkText(data.example, `glossary: ${term} example`);
}
for (const workshop of WORKSHOPS) {
  checkText(workshop.title, `workshop: ${workshop.id} title`, { body: false });
  checkText(workshop.summary, `workshop: ${workshop.id} summary`);
}

await server.close();

for (const warning of warnings) console.warn(`warning: ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`error: ${error}`);
  console.error(`\n${errors.length} copy errors.`);
  process.exit(1);
}
console.log(`Copy linter passed. ${warnings.length} warnings.`);
