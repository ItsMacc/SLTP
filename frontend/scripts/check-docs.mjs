// check-docs.mjs — Validates the docs content that ships with the app.
//
// The pages are typed blocks, so the checks run against the real tree instead of
// a second copy: Vite's SSR loader imports DOCS_GROUPS, this script walks the
// prose in it, and reports banned wording and overlong sentences by page.
//
// Run with: npm run check-docs
import { createServer } from 'vite';

const BANNED = [
  'seamless',
  'robust',
  'powerful',
  'leverage',
  'utilize',
  'comprehensive',
  'crucial',
  'essential',
  'ensure',
  'facilitate',
  'streamline',
  'delve',
  'dive into',
  'journey',
  'landscape',
  'ecosystem',
  'under the hood',
  'plays a key role',
  'it is important to note',
  'it is worth noting',
  'simply',
  'just',
  'easily',
  'effortlessly',
  'in order to',
  'a variety of',
  'various',
  'numerous',
  'serves as',
  'acts as',
  'designed to',
  'aims to',
  'allows you to',
  'this page explains',
  'in this section',
  'in this page',
  "let's",
];

const BANNED_RE = BANNED.map((phrase) => ({
  phrase,
  re: new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')}\\b`, 'i'),
}));

const MAX_SENTENCE_WORDS = 28;
const THIN_PAGE_WORDS = 120;
const MAX_EM_DASHES = 1;

/** Flatten a JSX tree into its visible text. */
function textOf(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(' ');
  if (typeof node === 'object' && node.props) return textOf(node.props.children);
  return '';
}

/** Collect the prose from a block list, skipping headings and code. */
function proseFrom(blocks, out = []) {
  for (const block of blocks) {
    switch (block.kind) {
      case 'p':
        out.push(textOf(block.text));
        break;
      case 'callout':
        out.push(textOf(block.title ?? ''), textOf(block.text));
        break;
      case 'ul':
      case 'ol':
        for (const item of block.items) out.push(textOf(item));
        break;
      case 'table':
        for (const row of block.rows) for (const cell of row) out.push(textOf(cell));
        break;
      case 'params':
        for (const row of block.rows) out.push(textOf(row.description));
        break;
      case 'cards':
        for (const item of block.items) out.push(textOf(item.title), textOf(item.text));
        break;
      case 'tabs':
        for (const tab of block.tabs) proseFrom(tab.blocks, out);
        break;
      default:
        break;
    }
  }
  return out;
}

function splitSentences(text) {
  // Keep decimals and e.g. from splitting a sentence in two.
  const guarded = text
    .replace(/\b(e\.g|i\.e)\./gi, (match) => match.replace('.', '<dot>'))
    .replace(/(\d)\.(\d)/g, '$1<dot>$2');
  return guarded
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.replaceAll('<dot>', '.').trim())
    .filter(Boolean);
}

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const server = await createServer({
  configFile: false,
  root: process.cwd(),
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true },
});

let groups;
try {
  ({ DOCS_GROUPS: groups } = await server.ssrLoadModule('/src/docs/index.ts'));
} finally {
  await server.close();
}

const failures = [];
const warnings = [];
const seen = new Set();
let pageCount = 0;

if (!Array.isArray(groups)) {
  console.error('FAIL: could not load DOCS_GROUPS from src/docs/index.ts');
  process.exit(1);
}

for (const group of groups) {
  for (const page of group.pages) {
    pageCount += 1;
    const label = `${group.title} / ${page.title}`;

    if (!page.title || !page.title.trim()) failures.push(`${label}: missing title`);
    if (!page.lead || !page.lead.trim()) failures.push(`${label}: missing lead`);

    if (seen.has(page.slug)) failures.push(`${label}: duplicate slug "${page.slug}"`);
    seen.add(page.slug);

    // Each paragraph, list item and table cell is its own unit. Joining them
    // first would invent sentences that span two cells and fail on length.
    const prose = proseFrom(page.blocks);
    const units = [page.lead, ...prose].filter((unit) => unit && unit.trim());
    const body = units.join(' ');
    const words = units.reduce((total, unit) => total + wordCount(unit), 0);
    if (words < THIN_PAGE_WORDS) warnings.push(`${label}: ${words} prose words`);

    for (const unit of units) {
      for (const sentence of splitSentences(unit)) {
        const length = wordCount(sentence);
        if (length > MAX_SENTENCE_WORDS) {
          failures.push(`${label}: ${length}-word sentence: "${sentence}"`);
        }
      }
    }

    const emDashes = (body.match(/—/g) ?? []).length;
    if (emDashes > MAX_EM_DASHES) {
      failures.push(`${label}: ${emDashes} em dashes, limit ${MAX_EM_DASHES}`);
    }

    for (const { phrase, re } of BANNED_RE) {
      const match = re.exec(body);
      if (match) {
        const start = Math.max(0, match.index - 40);
        const excerpt = body.slice(start, match.index + match[0].length + 40).replace(/\s+/g, ' ');
        failures.push(`${label}: banned "${phrase}" — …${excerpt}…`);
      }
    }
  }
}

if (pageCount !== 39) failures.push(`expected 39 pages, found ${pageCount}`);

for (const warning of warnings) console.warn(`WARN ${warning}`);

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  console.error(`\n${failures.length} failure(s) across ${pageCount} pages, ${groups.length} groups.`);
  process.exit(1);
}

console.log(`OK: ${pageCount} pages, ${groups.length} groups`);
