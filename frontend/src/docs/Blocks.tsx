// Blocks.tsx — Renders the docs block model.
//
// One renderer for every page keeps the type scale, spacing and code treatment
// identical across the 39 pages. The Python highlighter is a small tokenizer
// rather than a library: these snippets are short and the build should not grow
// a syntax-highlighting dependency for them.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Check,
  CircleAlert,
  Copy,
  Info,
  Lightbulb,
  TriangleAlert,
} from 'lucide-react';
import type { Block, CalloutTone, ParamRow } from './types';

/* ---------- Inline pieces ---------- */

/** Inline code, for names and values inside a sentence. */
export function C({ children }: { children: ReactNode }) {
  return <code className="docs-inline-code">{children}</code>;
}

/** Strong emphasis, for the one word in a sentence that carries the rule. */
export function B({ children }: { children: ReactNode }) {
  return <strong className="docs-strong">{children}</strong>;
}

/* ---------- Python highlighting ---------- */

const TOKEN_PATTERN =
  /(#.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b(def|class|return|if|elif|else|for|while|in|not|and|or|is|None|True|False|import|from|as|with|try|except|finally|raise|lambda|pass|break|continue|yield|global|nonlocal|assert|del|async|await)\b|\b(\d+(?:\.\d+)?)\b|(@[A-Za-z_][\w.]*)/g;

function tokenClass(match: RegExpExecArray): string {
  if (match[1]) return 'tok-comment';
  if (match[2]) return 'tok-string';
  if (match[3]) return 'tok-keyword';
  if (match[4]) return 'tok-number';
  return 'tok-decorator';
}

/** Split one line into plain text and coloured tokens. */
function highlightLine(line: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  TOKEN_PATTERN.lastIndex = 0;

  let match = TOKEN_PATTERN.exec(line);
  while (match !== null) {
    if (match.index > cursor) parts.push(line.slice(cursor, match.index));
    parts.push(
      <span className={tokenClass(match)} key={key++}>
        {match[0]}
      </span>,
    );
    cursor = match.index + match[0].length;
    match = TOKEN_PATTERN.exec(line);
  }

  if (cursor < line.length) parts.push(line.slice(cursor));
  return parts;
}

/* ---------- Code block ---------- */

function CodeBlock({ code, file, language = 'python' }: { code: string; file?: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const [numbered, setNumbered] = useState(false);
  const timer = useRef<number | null>(null);
  const lines = code.replace(/\n$/, '').split('\n');

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard permission is the browser's call; the button simply does nothing.
    }
  };

  return (
    <div className="docs-code">
      <div className="docs-code-head">
        <span className="docs-code-file">{file ?? language}</span>
        <div className="docs-code-actions">
          <button
            type="button"
            className="docs-code-action"
            onClick={() => setNumbered((value) => !value)}
            aria-pressed={numbered}
          >
            {numbered ? 'Hide lines' : 'Lines'}
          </button>
          <button type="button" className="docs-code-action" onClick={copy} aria-label="Copy code">
            {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <pre className={numbered ? 'docs-code-pre is-numbered' : 'docs-code-pre'}>
        <code>
          {lines.map((line, index) => (
            <span className="docs-code-line" key={index}>
              {language === 'python' ? highlightLine(line) : line}
              {'\n'}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

/* ---------- Callout ---------- */

const CALLOUT_ICON = {
  note: Info,
  tip: Lightbulb,
  warning: TriangleAlert,
  danger: CircleAlert,
};

const CALLOUT_LABEL: Record<CalloutTone, string> = {
  note: 'Note',
  tip: 'Tip',
  warning: 'Warning',
  danger: 'Danger',
};

function Callout({ tone, title, children }: { tone: CalloutTone; title?: string; children: ReactNode }) {
  const Icon = CALLOUT_ICON[tone];
  return (
    <aside className={`docs-callout docs-callout-${tone}`}>
      <Icon className="docs-callout-icon" size={16} aria-hidden />
      <div className="docs-callout-body">
        <p className="docs-callout-title">{title ?? CALLOUT_LABEL[tone]}</p>
        <div className="docs-callout-text">{children}</div>
      </div>
    </aside>
  );
}

/* ---------- Table ---------- */

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="docs-table-wrap">
      <table className="docs-table">
        <thead>
          <tr>
            {head.map((cell) => (
              <th key={cell} scope="col">{cell}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, column) => (
                <td key={column}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Parameter table ---------- */

function Params({ rows }: { rows: ParamRow[] }) {
  return (
    <div className="docs-table-wrap">
      <table className="docs-table docs-table-params">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Type</th>
            <th scope="col">Default</th>
            <th scope="col">Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <td><code className="docs-inline-code">{row.name}</code></td>
              <td><span className="docs-type">{row.type}</span></td>
              <td>{row.fallback ? <code className="docs-inline-code">{row.fallback}</code> : <span className="docs-type">—</span>}</td>
              <td>{row.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Tabs ---------- */

function Tabs({ tabs }: { tabs: { label: string; blocks: Block[] }[] }) {
  const [active, setActive] = useState(0);
  const current = tabs[active] ?? tabs[0];

  return (
    <div className="docs-tabs">
      <div className="docs-tablist" role="tablist" aria-label="Variant">
        {tabs.map((tab, index) => (
          <button
            key={tab.label}
            type="button"
            role="tab"
            id={`tab-${index}`}
            aria-selected={index === active}
            aria-controls={`panel-${index}`}
            className={index === active ? 'docs-tab is-active' : 'docs-tab'}
            onClick={() => setActive(index)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        className="docs-tabpanel"
        role="tabpanel"
        id={`panel-${active}`}
        aria-labelledby={`tab-${active}`}
      >
        {current ? <BlockList blocks={current.blocks} slug="" /> : null}
      </div>
    </div>
  );
}

/* ---------- Cards ---------- */

function Cards({ items }: { items: { title: string; text: ReactNode; badge?: string }[] }) {
  return (
    <div className="docs-cards">
      {items.map((item) => (
        <div className="docs-card" key={item.title}>
          {item.badge ? <span className="docs-card-badge">{item.badge}</span> : null}
          <p className="docs-card-title">{item.title}</p>
          <p className="docs-card-text">{item.text}</p>
        </div>
      ))}
    </div>
  );
}

/* ---------- Renderer ---------- */

function Heading({ level, id, text, slug }: { level: 2 | 3; id: string; text: string; slug: string }) {
  const Tag = level === 2 ? 'h2' : 'h3';
  return (
    <Tag id={id} className={level === 2 ? 'docs-h2' : 'docs-h3'}>
      {text}
      <a className="docs-anchor" href={`#/docs/${slug}#${id}`} aria-label={`Link to ${text}`}>
        #
      </a>
    </Tag>
  );
}

export function BlockList({ blocks, slug }: { blocks: Block[]; slug: string }) {
  return (
    <>
      {blocks.map((block, index) => {
        switch (block.kind) {
          case 'h2':
          case 'h3':
            return <Heading key={index} level={block.kind === 'h2' ? 2 : 3} id={block.id} text={block.text} slug={slug} />;
          case 'p':
            return <p className="docs-p" key={index}>{block.text}</p>;
          case 'ul':
            return (
              <ul className="docs-list" key={index}>
                {block.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}
              </ul>
            );
          case 'ol':
            return (
              <ol className="docs-list docs-list-numbered" key={index}>
                {block.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}
              </ol>
            );
          case 'code':
            return <CodeBlock key={index} code={block.code} file={block.file} language={block.language} />;
          case 'callout':
            return <Callout key={index} tone={block.tone} title={block.title}>{block.text}</Callout>;
          case 'table':
            return <Table key={index} head={block.head} rows={block.rows} />;
          case 'params':
            return <Params key={index} rows={block.rows} />;
          case 'tabs':
            return <Tabs key={index} tabs={block.tabs} />;
          case 'cards':
            return <Cards key={index} items={block.items} />;
          default:
            return null;
        }
      })}
    </>
  );
}
