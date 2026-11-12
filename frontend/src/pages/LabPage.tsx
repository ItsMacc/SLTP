// LabPage.tsx — the Lab: a Python scratchpad that runs in the tab.
//
// The interpreter is a worker (lab/python.worker.ts), so the editor stays
// responsive while a snippet runs, and it is booted as soon as the page opens so
// the reader rarely waits for it. Nothing is installed and no code leaves the
// page: Pyodide downloads Python once from a pinned CDN build and keeps it in
// that worker for the rest of the visit.
//
// This page runs plain Python on purpose. The strategy engine, the market cache
// and sltp live in the Research workspace; the Lab is where a reader checks a
// loop, a list and a function before any of that matters.

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Editor, { type Monaco, type OnMount } from '@monaco-editor/react';
import { Play, RotateCcw, Trash2 } from 'lucide-react';
import Button from '../ui/Button';
import { applyLabEditorTheme } from '../lab/editorTheme';
import {
  getPythonState,
  loadPython,
  restartPython,
  resetPythonNamespace,
  runPython,
  subscribePython,
} from '../lab/pythonRunner';
import './LabPage.css';

/* The snippet a first visit opens on: a list, some arithmetic, and a loop that
   prints one line per item, which is enough to see output arrive. */
const STARTER = `# Press Run, or Cmd/Ctrl + Enter, to execute this file.

prices = [101.5, 99.2, 103.8, 98.4, 105.1]
average = sum(prices) / len(prices)

print(f"{len(prices)} prices, average {average:.2f}")
print()

for price in prices:
    change = (price - average) / average * 100
    print(f"{price:>6.1f}   {change:+5.1f}% from the average")
`;

const STORAGE_KEY = 'sltp.lab.snippet';
/** Output is capped so a long loop cannot grow the page without limit. */
const MAX_LINES = 400;

interface OutputLine {
  kind: 'out' | 'err' | 'meta';
  text: string;
}

function readStoredSnippet(): string {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored && stored.trim() ? stored : STARTER;
  } catch {
    return STARTER;
  }
}

/** The theme the page is actually showing, attribute first, OS preference next. */
function readDarkMode(): boolean {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr) return attr.toLowerCase() === 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function appendLine(lines: OutputLine[], line: OutputLine): OutputLine[] {
  const next = [...lines, line];
  return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
}

/** Worker chunks arrive on line boundaries and still carry a trailing newline. */
const cleanChunk = (text: string) => text.replace(/\n$/, '');

export default function LabPage() {
  const python = useSyncExternalStore(subscribePython, getPythonState);

  const [code, setCode] = useState(readStoredSnippet);
  const [lines, setLines] = useState<OutputLine[]>([]);
  const [running, setRunning] = useState(false);
  const [dark, setDark] = useState(readDarkMode);

  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const codeRef = useRef(code);
  const darkRef = useRef(dark);
  const runRef = useRef<() => void>(() => {});

  /* Python starts loading as the page opens, not on the first Run: by the time
     the reader has read the snippet, the interpreter is usually ready. */
  useEffect(() => {
    loadPython();
  }, []);

  useEffect(() => {
    codeRef.current = code;
    try {
      window.localStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* a full or blocked store only costs the snippet on the next visit */
    }
  }, [code]);

  /* Follow the site theme, including a switch made while the page is open. */
  useEffect(() => {
    const update = () => setDark(readDarkMode());
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', update);
    return () => {
      observer.disconnect();
      media.removeEventListener('change', update);
    };
  }, []);

  useEffect(() => {
    darkRef.current = dark;
    const monaco = monacoRef.current;
    if (monaco) applyLabEditorTheme(monaco, dark ? 'vs-dark' : 'vs');
  }, [dark]);

  const push = useCallback((kind: OutputLine['kind'], text: string) => {
    // Empty text is still a line: print() with nothing in it is a blank line.
    setLines((previous) => appendLine(previous, { kind, text }));
  }, []);

  const run = useCallback(async () => {
    const source = codeRef.current;
    if (running) return;
    if (!source.trim()) {
      push('meta', 'Nothing to run: the editor is empty.');
      return;
    }
    if (getPythonState().status !== 'ready') {
      push('meta', 'Python is still starting. The Run button turns on when it is ready.');
      return;
    }

    setRunning(true);
    setLines([]);
    const result = await runPython(source, {
      onOutput: (text) => push('out', cleanChunk(text)),
      onOutputError: (text) => push('err', cleanChunk(text)),
    });

    if (result.ok) {
      push('meta', `Ran in ${Math.max(1, Math.round(result.durationMs))} ms`);
    } else {
      push('err', result.error ?? 'The snippet failed');
    }
    setRunning(false);
  }, [push, running]);

  useEffect(() => {
    runRef.current = () => {
      void run();
    };
  }, [run]);

  const handleMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    applyLabEditorTheme(monaco, darkRef.current ? 'vs-dark' : 'vs');
    // Cmd/Ctrl + Enter runs from inside the editor, where a reader's hands are.
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current());
  }, []);

  const resetSnippet = () => {
    setCode(STARTER);
    editorRef.current?.focus();
  };

  const statusLabel = useMemo(() => {
    if (python.status === 'ready') {
      return python.version ? `Python ${python.version} ready` : 'Python ready';
    }
    if (python.status === 'loading') return 'Starting Python…';
    if (python.status === 'error') return 'Python could not start';
    return 'Python is not running';
  }, [python]);

  const canRun = python.status === 'ready' && !running;

  return (
    <div className="lab-page">
      <header className="lab-head">
        <p className="lab-eyebrow">Lab</p>
        <h1 className="lab-title">Python, running in this tab</h1>
        <p className="lab-lede">
          Write a list, a loop, a function and press Run. Nothing is installed and nothing leaves
          the browser: Python downloads once, then stays on the page. Market data and the strategy
          hooks come later.
        </p>
      </header>

      <section className="lab-workbench" aria-label="Python scratchpad">
        <div className="lab-toolbar">
          <div className={`lab-status is-${python.status}`}>
            <span className="lab-status-dot" aria-hidden="true" />
            <span className="lab-status-text">{statusLabel}</span>
            {python.status === 'error' && (
              <Button variant="secondary" size="sm" onClick={restartPython}>
                Try again
              </Button>
            )}
          </div>

          <div className="lab-actions">
            <Button variant="ghost" size="sm" onClick={resetSnippet}>
              <RotateCcw size={14} aria-hidden="true" />
              Reset snippet
            </Button>
            <Button variant="primary" size="md" onClick={() => void run()} disabled={!canRun}>
              <Play size={15} aria-hidden="true" />
              {running ? 'Running' : 'Run'}
              <kbd className="lab-kbd">{'\u2318\u21B5'}</kbd>
            </Button>
          </div>
        </div>

        <div className="lab-split">
          <div className="lab-editor">
            <Editor
              height="100%"
              language="python"
              theme={dark ? 'sltp-dark' : 'sltp-light'}
              value={code}
              onChange={(value) => setCode(value ?? '')}
              beforeMount={(monaco) => applyLabEditorTheme(monaco, darkRef.current ? 'vs-dark' : 'vs')}
              onMount={handleMount}
              loading={<div className="lab-editor-loading">Loading the editor…</div>}
              options={{
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 14,
                lineHeight: 22,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                renderLineHighlight: 'line',
                padding: { top: 16, bottom: 16 },
                lineNumbersMinChars: 3,
                tabSize: 4,
                insertSpaces: true,
                wordWrap: 'on',
                automaticLayout: true,
                smoothScrolling: true,
                guides: { indentation: true },
                scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
                overviewRulerLanes: 0,
                contextmenu: false,
              }}
            />
          </div>

          <section className="lab-console" aria-label="Output">
            <header className="lab-console-head">
              <span className="lab-console-title">Output</span>
              <div className="lab-console-actions">
                <button
                  type="button"
                  className="lab-console-btn"
                  onClick={() => {
                    resetPythonNamespace();
                    push('meta', 'Variables cleared. The next run starts fresh.');
                  }}
                >
                  Forget variables
                </button>
                <button
                  type="button"
                  className="lab-console-btn"
                  onClick={() => setLines([])}
                  aria-label="Clear output"
                >
                  <Trash2 size={13} aria-hidden="true" />
                  Clear
                </button>
              </div>
            </header>

            <div className="lab-console-body" role="log" aria-live="polite">
              {lines.length === 0 ? (
                <p className="lab-empty">
                  {python.status === 'ready'
                    ? 'Nothing yet. Press Run, or Cmd/Ctrl + Enter, to execute the snippet.'
                    : 'Starting Python in the background. Output appears here.'}
                </p>
              ) : (
                lines.map((line, index) => (
                  <span key={`${index}-${line.kind}`} className={`lab-line is-${line.kind}`}>
                    {line.text}
                  </span>
                ))
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
