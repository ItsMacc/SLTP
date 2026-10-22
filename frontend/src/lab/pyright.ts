// pyright.ts — Pyright running in a Web Worker (monaco-pyright-lsp) for the Lab editor.
// Each project's files are handed to Pyright as type stubs under /typings, so
// `from core.strategy.strategy import Strategy` and
// `from workspace.custom_manager import CustomManager` resolve, and completions,
// hovers and type errors know the project's own names. Everything runs in the
// browser: no server call.
import type * as MonacoNs from 'monaco-editor';
import { MonacoPyrightProvider } from 'monaco-pyright-lsp';
import pyrightWorkerUrl from 'monaco-pyright-lsp/dist/worker.js?url';

type PyrightFileTree = { [key: string]: PyrightFileTree | string | ArrayBuffer };

export type Monaco = typeof MonacoNs;
export type TextModel = MonacoNs.editor.ITextModel;

export interface DiagnosticsTarget {
  monaco: Monaco;
  model: TextModel;
}

// Missing-import rules are dropped. A stub-only module (core.strategy.strategy) reports
// "could not be resolved from source" even though it resolves fine, and third-party modules
// such as numpy are loaded by the server, not known to Pyright. Every other rule
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

const NO_SUGGESTIONS = { suggestions: [] };

// Registers the editor features once. Each one forwards to the current worker, and falls back
// to "nothing" if Pyright is still starting or a request fails.
function registerLanguageProviders(monaco: Monaco): void {
  if (providersRegistered) return;
  providersRegistered = true;

  monaco.languages.registerCompletionItemProvider('python', {
    triggerCharacters: ['.', '[', '"', "'"],
    provideCompletionItems: async (model, position) => {
      if (!active) return NO_SUGGESTIONS;
      try {
        return await active.onCompletionRequest(model, position);
      } catch {
        return NO_SUGGESTIONS;
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
    const typeStubs: PyrightFileTree = {};
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

    registerLanguageProviders(monaco);
    const previous = active;
    active = next;
    previous?.lspClient.worker.terminate();
  };

  const job = queue.then(run);
  queue = job.catch(() => undefined);
  return job;
}

// Points diagnostics at the model that is currently shown in the editor.
export function setDiagnosticsTarget(next: DiagnosticsTarget | null): void {
  target = next;
}

// Sends the current document text to Pyright. Only the open buffer is re-analysed.
export function syncDocument(text: string): Promise<void> {
  if (!active) return Promise.resolve();
  return active.lspClient.updateDocVersion(text).then(() => undefined);
}
