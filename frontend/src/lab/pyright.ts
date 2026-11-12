// pyright.ts — Pyright running in a Web Worker (monaco-pyright-lsp) for the Lab editor.
// Each project's files are handed to Pyright as type stubs under /typings, so
// the project's own modules resolve across files. The sltp engine rides along
// as a second virtual library (generated from the pinned server runtime),
// and numpy's real shipped stubs join when the project imports numpy. That
// covers the three import shapes strategies use: `from sltp import ...`,
// `import numpy as np`, and one project file importing another.
// Everything runs in the browser: no server call.
import type * as MonacoNs from 'monaco-editor';
import { MonacoPyrightProvider } from 'monaco-pyright-lsp';
import pyrightWorkerUrl from 'monaco-pyright-lsp/dist/worker.js?url';
import { numpyStubPack, sltpStubTree, usesNumpy } from './sltpStubs';

type PyrightFileTree = { [key: string]: PyrightFileTree | string | ArrayBuffer };

export type Monaco = typeof MonacoNs;
export type TextModel = MonacoNs.editor.ITextModel;

export interface DiagnosticsTarget {
  monaco: Monaco;
  model: TextModel;
}

// Missing-import rules are dropped. The browser knows sltp, numpy and the
// project's own files; anything outside those would report "could not be
// resolved" without being wrong, so those reports stay off. Every other rule
// (undefined names, wrong argument types, syntax errors) is reported.
const SUPPRESSED_RULES = new Set(['reportMissingImports', 'reportMissingModuleSource']);

// The library's own Monaco registration is switched off. The providers below are registered
// once and always call the current worker, so a rebuild does not add duplicates.
const NO_LIBRARY_FEATURES = {
  hover: false,
  completion: false,
  signatureHelp: false,
  diagnostic: false,
  rename: false,
  findDefinition: false,
};

let target: DiagnosticsTarget | null = null;
let active: MonacoPyrightProvider | null = null;
let providersRegistered = false;
let queue: Promise<void> = Promise.resolve();

// The engine's public names, so the editor can still complete them while
// Pyright is starting, after it fails, or where its import analysis returns
// nothing yet (an import line with no prefix typed). Kept in step with the
// re-exports in stubs/sltp/__init__.pyi.
const SLTP_EXPORTS: { label: string; kind: 'class' | 'function' | 'constant'; detail: string }[] = [
  { label: 'Backtester', kind: 'class', detail: 'Runs a strategy over a date range' },
  { label: 'CALENDAR', kind: 'constant', detail: 'The trading calendar' },
  { label: 'DateLabels', kind: 'class', detail: 'Date label container' },
  { label: 'Event', kind: 'class', detail: 'A dated market event' },
  { label: 'EventType', kind: 'class', detail: 'Kind of market event' },
  { label: 'Order', kind: 'class', detail: 'An order returned by on_signal' },
  { label: 'OrderSizing', kind: 'class', detail: 'How an order is sized' },
  { label: 'PortfolioManager', kind: 'class', detail: 'Tracks positions and equity' },
  { label: 'PositionType', kind: 'class', detail: 'Long or short' },
  { label: 'RebalanceFrequency', kind: 'class', detail: 'How often a book rebalances' },
  { label: 'StockData', kind: 'class', detail: 'One ticker, up to the current bar' },
  { label: 'Strategy', kind: 'class', detail: 'Base class for a strategy' },
  { label: 'Trade', kind: 'class', detail: 'A closed trade' },
  { label: 'label', kind: 'function', detail: 'Label one value' },
  { label: 'label_array', kind: 'function', detail: 'Label an array of values' },
  { label: 'labels_from_codes', kind: 'function', detail: 'Read labels from codes' },
  { label: 'register', kind: 'function', detail: 'Register a strategy' },
  { label: 'to_code', kind: 'function', detail: 'Code for a label' },
];

const PYTHON_BUILTINS = [
  'print', 'len', 'range', 'sum', 'min', 'max', 'abs', 'round', 'sorted', 'reversed',
  'enumerate', 'zip', 'any', 'all', 'open', 'dict', 'list', 'set', 'tuple', 'str',
  'int', 'float', 'bool', 'type', 'isinstance', 'repr',
];

/** Keywords and snippets that are useful even with no analysis behind them. */
const PYTHON_SNIPPETS: { label: string; detail: string; insertText: string }[] = [
  { label: 'def', detail: 'Define a function', insertText: 'def ${1:function_name}(${2:args}):\n    ${3:pass}' },
  { label: 'for', detail: 'Loop over an iterable', insertText: 'for ${1:item} in ${2:items}:\n    ${3:pass}' },
  { label: 'if', detail: 'Conditional block', insertText: 'if ${1:condition}:\n    ${2:pass}' },
  { label: 'ifmain', detail: 'Run only as a script', insertText: 'if __name__ == "__main__":\n    ${1:main()}' },
  { label: 'class', detail: 'Define a class', insertText: 'class ${1:Name}:\n    def __init__(self):\n        ${2:pass}' },
  { label: 'try', detail: 'Handle an error', insertText: 'try:\n    ${1:pass}\nexcept ${2:Exception} as error:\n    ${3:raise}' },
  { label: 'while', detail: 'Loop while true', insertText: 'while ${1:condition}:\n    ${2:pass}' },
  { label: 'with', detail: 'Use a context manager', insertText: 'with ${1:expr} as ${2:name}:\n    ${3:pass}' },
];

function completionRange(monaco: Monaco, model: TextModel, position: MonacoNs.Position) {
  const word = model.getWordUntilPosition(position);
  return new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
}

/** Suggestions that do not need Pyright: the engine's names, builtins, snippets. */
function fallbackSuggestions(
  monaco: Monaco,
  model: TextModel,
  position: MonacoNs.Position,
): MonacoNs.languages.CompletionList {
  const range = completionRange(monaco, model, position);
  const line = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
  const engineContext = /\bfrom\s+sltp\s+import\b|\bimport\s+sltp\b|\bsltp\s*\.$/.test(line);
  const suggestions: MonacoNs.languages.CompletionItem[] = [];
  const kinds = monaco.languages.CompletionItemKind;

  if (engineContext) {
    for (const name of SLTP_EXPORTS) {
      suggestions.push({
        label: name.label,
        kind: name.kind === 'class' ? kinds.Class : name.kind === 'function' ? kinds.Function : kinds.Constant,
        detail: name.detail,
        documentation: `sltp · ${name.detail}`,
        insertText: name.label,
        sortText: `0${name.label}`,
        range,
      });
    }
  }

  for (const name of PYTHON_BUILTINS) {
    suggestions.push({
      label: name,
      kind: kinds.Function,
      detail: 'Python builtin',
      insertText: name,
      sortText: `1${name}`,
      range,
    });
  }

  for (const snippet of PYTHON_SNIPPETS) {
    suggestions.push({
      label: snippet.label,
      kind: kinds.Snippet,
      detail: snippet.detail,
      insertText: snippet.insertText,
      insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      sortText: `2${snippet.label}`,
      range,
    });
  }

  return { suggestions };
}

/** Snippets, plus the engine's names on an import line, without repeating labels. */
function withSnippets(
  monaco: Monaco,
  model: TextModel,
  position: MonacoNs.Position,
  list: MonacoNs.languages.CompletionList,
): MonacoNs.languages.CompletionList {
  const range = completionRange(monaco, model, position);
  const seen = new Set(list.suggestions.map((item) => (typeof item.label === 'string' ? item.label : item.label.label)));

  // Pyright can return a list with nothing in it at all for `from sltp
  // import ` (no prefix typed yet), so the engine names are merged in here
  // rather than only being offered when the request comes back empty.
  const engine = fallbackSuggestions(monaco, model, position).suggestions.filter(
    (item) => String(item.sortText ?? '').startsWith('0') && !seen.has(String(item.label)),
  );
  for (const item of engine) seen.add(String(item.label));

  const extra = PYTHON_SNIPPETS.filter((snippet) => !seen.has(snippet.label)).map((snippet) => ({
    label: snippet.label,
    kind: monaco.languages.CompletionItemKind.Snippet,
    detail: snippet.detail,
    insertText: snippet.insertText,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    sortText: `2${snippet.label}`,
    range,
  }));
  return { ...list, suggestions: [...list.suggestions, ...engine, ...extra] };
}

// Registers the editor features once. Each one forwards to the current worker, and falls back
// to "nothing" if Pyright is still starting or a request fails.
function registerLanguageProviders(monaco: Monaco): void {
  if (providersRegistered) return;
  providersRegistered = true;

  monaco.languages.registerCompletionItemProvider('python', {
    triggerCharacters: ['.', '[', '"', "'"],
    provideCompletionItems: async (model, position) => {
      if (!active) return fallbackSuggestions(monaco, model, position);
      try {
        const list = await active.onCompletionRequest(model, position);
        // An import line with no prefix yet comes back empty; the fallback
        // still knows the engine's names, so the popup is never blank.
        if (!list.suggestions.length) return fallbackSuggestions(monaco, model, position);
        return withSnippets(monaco, model, position, list);
      } catch {
        return fallbackSuggestions(monaco, model, position);
      }
    },
    resolveCompletionItem: async (item) => {
      if (!active) return item;
      try {
        return await active.onResolveCompletion(item);
      } catch {
        return item;
      }
    },
  });

  monaco.languages.registerHoverProvider('python', {
    provideHover: async (model, position) => {
      if (!active) return null;
      try {
        return await active.onHover(model, position);
      } catch {
        return null;
      }
    },
  });

  monaco.languages.registerSignatureHelpProvider('python', {
    signatureHelpTriggerCharacters: ['(', ','],
    provideSignatureHelp: async (model, position) => {
      if (!active) return null;
      try {
        return await active.onSignatureHelp(model, position);
      } catch {
        return null;
      }
    },
  });

  monaco.languages.registerRenameProvider('python', {
    provideRenameEdits: async (model, position, newName, token) => {
      if (!active) return null;
      try {
        return await active.provideRenameEdits(model, position, newName, token);
      } catch {
        return null;
      }
    },
  });
}

// Starts a worker for the given project files and makes it the active one. `stubs` maps each
// file name (for example "workspace/custom_strategy.py") to its text. A rebuild runs after the
// previous one, and the old worker is terminated once the new one is ready, so the editor keeps
// checking meanwhile.
export function loadProject(monaco: Monaco, stubs: Record<string, string>): Promise<void> {
  const run = async () => {
    // Providers go in before the worker starts: if Pyright cannot boot at all,
    // the fallback completions still keep the editor useful.
    registerLanguageProviders(monaco);

    // Static libraries first: the engine every strategy imports, plus numpy
    // when the project uses it. Project files are layered on afterwards.
    const typeStubs: PyrightFileTree = { sltp: sltpStubTree() };
    if (usesNumpy(stubs)) {
      const pack = await numpyStubPack();
      // A missing pack only costs numpy's completions; sltp and the project
      // files below still resolve, so the worker starts regardless.
      if (pack) typeStubs['numpy'] = pack;
    }
    // Walks to a folder in the stub tree, creating the folders on the way.
    const folderNode = (path: string) => {
      if (!path) return typeStubs;
      const parts = path.split('/');
      let node = typeStubs;
      for (const part of parts) {
        const child = node[part];
        if (typeof child !== 'object' || child === null) node[part] = {};
        node = node[part] as PyrightFileTree;
      }
      return node;
    };

    // Every folder gets an empty __init__.pyi, so `core` and `workspace` are
    // regular packages and their modules always resolve.
    const folders = new Set<string>();
    for (const name of Object.keys(stubs)) {
      const parts = name.split('/');
      for (let index = 1; index < parts.length; index += 1) {
        folders.add(parts.slice(0, index).join('/'));
      }
    }
    for (const folder of folders) {
      folderNode(folder)['__init__.pyi'] = '';
    }

    for (const [name, text] of Object.entries(stubs)) {
      const parts = name.replace(/\.py$/, '.pyi').split('/');
      const parent = parts.slice(0, -1).join('/');
      folderNode(parent)[parts[parts.length - 1]] = text;
    }

    const next = new MonacoPyrightProvider(pyrightWorkerUrl, {
      features: NO_LIBRARY_FEATURES,
      typeStubs,
    });
    await next.init(monaco);
    await next.lspClient.setupDiagnosticsCallback((diagnostics) => {
      const current = target;
      if (!current) return;
      const { MarkerSeverity } = current.monaco;
      current.monaco.editor.setModelMarkers(
        current.model,
        'pyright',
        diagnostics
          .filter((d) => !(typeof d.code === 'string' && SUPPRESSED_RULES.has(d.code)))
          .map((d) => ({
            severity: d.severity === 2
              ? MarkerSeverity.Warning
              : d.severity === 3
                ? MarkerSeverity.Info
                : d.severity === 4
                  ? MarkerSeverity.Hint
                  : MarkerSeverity.Error,
            message: d.message,
            code: typeof d.code === 'string' ? d.code : undefined,
            startLineNumber: d.range.start.line + 1,
            startColumn: d.range.start.character + 1,
            endLineNumber: d.range.end.line + 1,
            endColumn: d.range.end.character + 1,
          })),
      );
    });

    const previous = active;
    active = next;
    previous?.lspClient.worker.terminate();
  };

  const job = queue.then(run);
  queue = job.catch(() => undefined);
  return job;
}

// Pushes the open buffer to Pyright at most once per window while typing.
// A pending push carries the latest text, so a burst of keystrokes costs one
// worker round-trip instead of one per character.
const SYNC_DEBOUNCE_MS = 400;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let syncListener: { dispose(): void } | null = null;
let pendingText: string | null = null;

function flushSync(): void {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
  const text = pendingText;
  pendingText = null;
  if (text !== null) void syncDocument(text);
}

function scheduleSync(text: string): void {
  pendingText = text;
  if (syncTimer) return;
  syncTimer = setTimeout(flushSync, SYNC_DEBOUNCE_MS);
}

// Points diagnostics at the model that is currently shown in the editor.
// Typing in that model schedules a throttled sync; switching files flushes
// the old file's last keystrokes before rebinding.
export function setDiagnosticsTarget(next: DiagnosticsTarget | null): void {
  flushSync();
  syncListener?.dispose();
  syncListener = null;
  target = next;
  if (!next) return;
  syncListener = next.model.onDidChangeContent(() => {
    if (target !== next) return;
    try {
      scheduleSync(next.model.getValue());
    } catch {
      // The model is gone; its pending text is dropped with it.
      pendingText = null;
    }
  });
}

// Sends the current document text to Pyright at once. Used on file switches
// and mounts. Typing goes through the throttled target listener above, never
// here per keystroke. Only the open buffer is re-analysed.
export function syncDocument(text: string): Promise<void> {
  if (!active) return Promise.resolve();
  return active.lspClient.updateDocVersion(text).then(() => undefined);
}
