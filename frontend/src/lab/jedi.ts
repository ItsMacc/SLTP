// jedi.ts — the editor's Python intelligence, answered by the interpreter that
// is already running the reader's code.
//
// Jedi is a Python package, so it needs no worker of its own, no typeshed and no
// stub files: `analyze()` in the Python worker hands it the project and asks.
// That is why completion here knows the real installed sltp and numpy rather
// than a generated description of them, and why the editor works the same in
// every browser.
//
// Pyflakes provides what jedi does not: name and syntax errors. Together they
// cover completion, hover, signatures, go-to-definition and error squiggles.
import type * as MonacoNs from 'monaco-editor';
import { analyze } from './pythonRunner';

export type Monaco = typeof MonacoNs;
export type TextModel = MonacoNs.editor.ITextModel;

export interface JediTarget {
  monaco: Monaco;
  model: TextModel;
  /** Workspace-relative path, e.g. "workspace/macoon.py". */
  path: string;
}

interface CompletionItem {
  label: string;
  insertText?: string;
  kind?: string;
  detail?: string;
  documentation?: string;
}

interface HoverInfo {
  name: string;
  type: string;
  description?: string;
  doc?: string;
}

export interface DefinitionInfo {
  path: string | null;
  external: boolean;
  line: number;
  column: number;
  name: string;
}

interface ImportCandidate {
  label: string;
  kind?: string;
  detail?: string;
  statement: string;
}

interface SignatureInfo {
  label: string;
  params: string[];
  doc?: string;
}

interface DiagnosticItem {
  line: number;
  column: number;
  message: string;
  severity: number;
}

type Status = 'active' | 'failed';
let statusListener: ((status: Status, reason?: string) => void) | null = null;

/** Told when analysis starts working, and when it cannot. */
export function setJediStatusListener(listener: ((status: Status, reason?: string) => void) | null): void {
  statusListener = listener;
}

let target: JediTarget | null = null;
let projectFiles: Record<string, string> = {};
let registeredFor: Monaco | null = null;
let diagnosticTimer: number | null = null;
let changeListener: { dispose(): void } | null = null;

const SEVERITY = { error: 8, warning: 4, info: 2, hint: 1 };

function report(status: Status, reason?: string): void {
  statusListener?.(status, reason);
}

function currentPath(): string {
  if (!target) return 'workspace/untitled.py';
  const fromModel = target.model.uri.path.replace(/^\//, '');
  return target.path || fromModel || 'workspace/untitled.py';
}

function filesForAnalysis(): { name: string; content: string }[] {
  const names = new Set(Object.keys(projectFiles));
  if (target) names.add(currentPath());
  return [...names].map((name) => ({
    name,
    content: name === currentPath() && target ? target.model.getValue() : projectFiles[name] ?? '',
  }));
}

function ask(
  method: 'complete' | 'hover' | 'signature' | 'define' | 'diagnostics' | 'imports',
  position: MonacoNs.Position,
) {
  if (!target) return null;
  return analyze({
    method,
    code: target.model.getValue(),
    path: currentPath(),
    line: position.lineNumber,
    column: position.column - 1,
    files: filesForAnalysis(),
  }).then((reply) => {
    // A timeout means the interpreter was busy, usually with a run of your own.
    // Reporting that as a failure is what made the status bar announce broken
    // analysis in the middle of a perfectly normal long backtest.
    if (!reply.ok && !(reply.error ?? '').includes('timed out')) report('failed', reply.error);
    else report('active');
    return reply;
  });
}

let fileOpener: ((path: string, line: number, column: number) => void) | null = null;

/** Called when the definition lives in another project file. */
export function setJediFileOpener(
  opener: ((path: string, line: number, column: number) => void) | null,
): void {
  fileOpener = opener;
}

/**
 * The edit that adds an import. A matching `from x import a, b` line is
 * extended in place, the way an IDE does, so a file keeps one import per
 * module instead of growing a new line every time a name is used.
 */
function importEdit(
  monaco: Monaco,
  model: TextModel,
  statement: string,
): MonacoNs.languages.TextEdit | null {
  const parsed = /^from\s+([\w.]+)\s+import\s+(.+)$/.exec(statement);
  if (parsed) {
    const [, moduleName, names] = parsed;
    const wanted = names.split(',').map((name) => name.trim()).filter(Boolean);
    const escaped = moduleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = new RegExp(`^from\\s+${escaped}\\s+import\\s+(.+)$`);
    const limit = Math.min(model.getLineCount(), 400);
    for (let index = 1; index <= limit; index += 1) {
      const line = model.getLineContent(index);
      const found = matches.exec(line);
      if (!found) continue;
      const imported = found[1].trim();
      // A parenthesised or continued import is not worth rewriting blind.
      if (imported.startsWith('(')) continue;
      const beforeComment = imported.replace(/\s*#.*$/, '').replace(/\\$/, '').trim();
      const present = beforeComment.split(',').map((name) => name.trim().split(/\s+as\s+/)[0]);
      const missing = wanted.filter((name) => !present.includes(name.split(/\s+as\s+/)[0]));
      if (!missing.length) return null;
      // Insert before a trailing comment, not after it, and without leaving
      // the extra space that was padding it.
      let column = model.getLineMaxColumn(index);
      let tail = '';
      const commentAt = line.indexOf('#');
      if (commentAt >= 0) {
        let at = commentAt;
        while (at > 0 && line[at - 1] === ' ') at -= 1;
        column = at + 1;
        tail = ' ';
      }
      const separator = beforeComment.endsWith(',') ? ' ' : ', ';
      return {
        range: new monaco.Range(index, column, index, column),
        text: `${separator}${missing.join(', ')}${tail}`,
      };
    }
  }

  // Follow brackets so an import never lands inside a parenthesised one.
  let lastImport = 0;
  let depth = 0;
  let continued = false;
  const limit = Math.min(model.getLineCount(), 80);
  for (let index = 1; index <= limit; index += 1) {
    const line = model.getLineContent(index);
    const startsImport = /^\s*(from|import)\s/.test(line);
    if (startsImport && depth === 0) lastImport = index;
    for (const character of line) {
      if (character === '(' || character === '[' || character === '{') depth += 1;
      else if (character === ')' || character === ']' || character === '}') depth = Math.max(0, depth - 1);
    }
    if (startsImport && depth > 0) continued = true;
    else if (continued && depth === 0) {
      lastImport = index;
      continued = false;
    }
  }
  if (lastImport) {
    const column = model.getLineMaxColumn(lastImport);
    return {
      range: new monaco.Range(lastImport, column, lastImport, column),
      text: `\n${statement}`,
    };
  }
  return { range: new monaco.Range(1, 1, 1, 1), text: `${statement}\n` };
}

function wordRange(monaco: Monaco, model: TextModel, position: MonacoNs.Position) {
  const word = model.getWordUntilPosition(position);
  return new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
}

function completionKind(monaco: Monaco, type: string | undefined): MonacoNs.languages.CompletionItemKind {
  const kinds = monaco.languages.CompletionItemKind;
  switch (type) {
    case 'class':
      return kinds.Class;
    case 'function':
      return kinds.Function;
    case 'module':
      return kinds.Module;
    case 'keyword':
      return kinds.Keyword;
    case 'param':
      return kinds.Variable;
    case 'instance':
      return kinds.Variable;
    case 'statement':
      return kinds.Variable;
    default:
      return kinds.Text;
  }
}

function register(monaco: Monaco): void {
  if (registeredFor === monaco) return;
  registeredFor = monaco;

  monaco.languages.registerCompletionItemProvider('python', {
    triggerCharacters: ['.', '[', '"', "'"],
    provideCompletionItems: async (model, position) => {
      const reply = await ask('complete', position);
      const items = (reply?.data as { items?: CompletionItem[] } | null)?.items ?? [];
      const range = wordRange(monaco, model, position);
      const typed = model.getWordUntilPosition(position).word;
      const showPrivate = typed.startsWith('_');
      const suggestions: MonacoNs.languages.CompletionItem[] = items
        // jedi offers private members too; they belong behind a leading
        // underscore, not in the list a reader scans while typing.
        .filter((item) => showPrivate || !item.label.startsWith('_'))
        .map((item) => ({
          label: item.label,
          kind: completionKind(monaco, item.kind),
          detail: item.detail,
          documentation: item.documentation ? { value: item.documentation } : undefined,
          // The name, never jedi's `complete` field: that one carries only the
          // part of the word still missing, so accepting it on top of a typed
          // prefix ate the first letter ("B" became "acktester").
          insertText: item.label,
          range,
        }));

      // Names that exist but were never imported are offered too, with the
      // line that imports them attached, the way an IDE does. Only for a word
      // that is being typed: an empty prefix would offer the whole package.
      if (typed.length >= 2) {
        const known = new Set(suggestions.map((item) => String(item.label)));
        const replyImports = await ask('imports', position);
        const candidates = (replyImports?.data as { items?: ImportCandidate[] } | null)?.items ?? [];
        for (const candidate of candidates) {
          if (known.has(candidate.label)) continue;
          const alreadyImported = new RegExp(`^\\s*(from\\s+\\S+\\s+)?import\\s.*\\b${candidate.label}\\b`).test(
            model.getValue(),
          );
          if (alreadyImported) continue;
          known.add(candidate.label);
          const edit = importEdit(monaco, model, candidate.statement);
          suggestions.push({
            label: candidate.label,
            kind: completionKind(monaco, candidate.kind),
            detail: `import from ${candidate.statement.replace(/^from\s+/, '').split(' import ')[0]}`,
            insertText: candidate.label,
            range,
            additionalTextEdits: edit ? [edit] : [],
            sortText: `z${candidate.label}`,
          });
        }
      }

      // Nothing from jedi means nothing useful to offer; Monaco's own
      // word-based suggestions still fill the gap.
      return { suggestions };
    },
  });

  monaco.languages.registerHoverProvider('python', {
    provideHover: async (_model, position) => {
      const reply = await ask('hover', position);
      const info = reply?.data as HoverInfo | null;
      if (!info) return null;
      const signature = info.description || `${info.name}: ${info.type}`;
      const contents: MonacoNs.IMarkdownString[] = [{ value: `\`\`\`python\n${signature}\n\`\`\`` }];
      if (info.doc) contents.push({ value: info.doc });
      return { contents, range: undefined };
    },
  });

  monaco.languages.registerSignatureHelpProvider('python', {
    signatureHelpTriggerCharacters: ['(', ','],
    provideSignatureHelp: async (_model, position) => {
      const reply = await ask('signature', position);
      const data = reply?.data as { signatures?: SignatureInfo[]; active?: number } | null;
      if (!data?.signatures?.length) return null;
      return {
        value: {
          signatures: data.signatures.map((signature) => ({
            label: `${signature.label}(${signature.params.join(', ')})`,
            documentation: signature.doc ? { value: signature.doc } : undefined,
            parameters: signature.params.map((param) => ({ label: param })),
          })),
          activeSignature: 0,
          activeParameter: Math.min(data.active ?? 0, Math.max(data.signatures[0].params.length - 1, 0)),
        },
        dispose: () => undefined,
      };
    },
  });

  monaco.languages.registerDefinitionProvider('python', {
    provideDefinition: async (model, position) => {
      const reply = await ask('define', position);
      const definition = reply?.data as DefinitionInfo | null;
      if (!definition) return null;
      // A definition in another project file is handed to the page, which
      // opens that file and puts the cursor on the line.
      if (!definition.external && definition.path && definition.path !== currentPath()) {
        fileOpener?.(definition.path, definition.line, definition.column);
        return null;
      }
      if (definition.external) return null;
      return {
        uri: model.uri,
        range: {
          startLineNumber: definition.line,
          startColumn: definition.column,
          endLineNumber: definition.line,
          endColumn: definition.column + Math.max(definition.name.length, 1),
        },
      };
    },
  });
}

function scheduleDiagnostics(): void {
  if (diagnosticTimer) window.clearTimeout(diagnosticTimer);
  diagnosticTimer = window.setTimeout(() => {
    diagnosticTimer = null;
    void refreshDiagnostics();
  }, 650);
}

async function refreshDiagnostics(): Promise<void> {
  if (!target) return;
  const { monaco, model } = target;
  const reply = await ask('diagnostics', { lineNumber: 1, column: 1 } as MonacoNs.Position);
  if (reply?.ok === false) return;
  const items = ((reply?.data as { items?: DiagnosticItem[] } | null)?.items ?? []).filter(
    // Tidy-ups are noise while a file is being written; a name that does not
    // exist and a broken statement are not.
    (item) => !/imported but unused|assigned to but never used/i.test(item.message),
  );
  monaco.editor.setModelMarkers(
    model,
    'jedi',
    items.map((item) => ({
      severity: item.severity === 1 ? SEVERITY.error : SEVERITY.warning,
      message: item.message,
      startLineNumber: item.line,
      startColumn: item.column + 1,
      endLineNumber: item.line,
      endColumn: Math.max(item.column + 2, 2),
    })),
  );
}

/** Points the analyser at the file on screen and checks it straight away. */
export function setJediTarget(next: JediTarget | null): void {
  changeListener?.dispose();
  changeListener = null;
  target = next;
  if (!next) return;
  register(next.monaco);
  changeListener = next.model.onDidChangeContent(() => scheduleDiagnostics());
  scheduleDiagnostics();
}

/** The project's saved files, so imports between them resolve as they run. */
export function setJediProject(files: Record<string, string>): void {
  projectFiles = files;
  scheduleDiagnostics();
}
