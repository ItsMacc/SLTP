// python.worker.ts — the Lab's Python runtime: Pyodide, booted off the main
// thread so a slow snippet never freezes the page.
//
// This is plain Python and nothing else. The strategy engine lives in its own
// worker with sltp, numpy and the market cache; the Lab deliberately keeps a
// small, fast runtime that can start while the reader is still typing.
//
// The worker owns one namespace and keeps it between runs, so a list defined in
// one run is still there in the next, the way a notebook behaves. Reset clears
// it. The last expression of a run is printed like a REPL would print it.

/** Pinned Pyodide build: the same distribution the engine worker uses. */
const PYODIDE_INDEX_URL = 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/';

interface PyodideApi {
  runPython: (code: string) => unknown;
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdout: (options: { batched?: (text: string) => void }) => void;
  setStderr: (options: { batched?: (text: string) => void }) => void;
}

type Incoming =
  | { id: number; kind: 'init' }
  | { id: number; kind: 'run'; code: string }
  | { id: number; kind: 'reset' };

let pyodide: PyodideApi | null = null;
/** The run whose stdout is arriving right now, so chunks find their way home. */
let currentRun = 0;

function post(message: unknown): void {
  self.postMessage(message);
}

// The interpreter's own code, loaded once. run_user compiles the snippet, runs
// every statement but a trailing expression, then evaluates that expression and
// prints its value, which is what makes `2 + 2` show 4 without a print call.
//
// Errors are formatted here rather than left to Pyodide: its own traceback
// starts inside _pyodide/_base.py and ends at `<exec>`, frames a reader can do
// nothing with. Only the lines from their own file are kept.
const BOOTSTRAP = `
import ast
import builtins
import linecache
import platform
import traceback

_namespace = {"__name__": "__main__", "__builtins__": builtins}
python_version = platform.python_version()


def reset_namespace():
    _namespace.clear()
    _namespace.update({"__name__": "__main__", "__builtins__": builtins})
    return "namespace cleared"


def _format_error(exc):
    frames = [
        frame
        for frame in traceback.extract_tb(exc.__traceback__)
        if frame.filename == "<lab>"
    ]
    # A syntax error never reaches the reader's file, so it gets no header.
    lines = ["Traceback (most recent call last):"] if frames else []
    for frame in frames:
        lines.append(f'  File "<lab>", line {frame.lineno}, in {frame.name}')
        if frame.line:
            lines.append(f"    {frame.line.strip()}")
    lines.extend(
        "".join(traceback.format_exception_only(type(exc), exc)).rstrip().splitlines()
    )
    return "\\n".join(lines)


def run_user(source):
    # Registering the source lets a traceback show the failing line at all.
    linecache.cache["<lab>"] = (len(source), None, source.splitlines(True), "<lab>")
    try:
        tree = ast.parse(source, "<lab>", "exec")
        tail = None
        if tree.body and isinstance(tree.body[-1], ast.Expr):
            tail = ast.Expression(tree.body.pop().value)
        exec(compile(tree, "<lab>", "exec"), _namespace)
        if tail is not None:
            value = eval(compile(tail, "<lab>", "eval"), _namespace)
            if value is not None:
                print(value)
    except Exception as exc:
        return "error\\n" + _format_error(exc)
    return "ok"
`;

async function loadPyodideAtPin(): Promise<PyodideApi> {
  // @vite-ignore keeps this a runtime CDN fetch instead of a build asset.
  const module = (await import(/* @vite-ignore */ `${PYODIDE_INDEX_URL}pyodide.mjs`)) as {
    loadPyodide: (options: { indexURL: string }) => Promise<PyodideApi>;
  };
  return module.loadPyodide({ indexURL: PYODIDE_INDEX_URL });
}

async function boot(): Promise<void> {
  if (pyodide) return;

  const instance = await loadPyodideAtPin();
  // Batched callbacks fire on line boundaries, so a print survives a newline
  // and a runaway loop cannot flood the page with single characters.
  instance.setStdout({
    batched: (text: string) => {
      if (currentRun) post({ type: 'stdout', id: currentRun, text });
    },
  });
  instance.setStderr({
    batched: (text: string) => {
      if (currentRun) post({ type: 'stderr', id: currentRun, text });
    },
  });
  instance.runPython(BOOTSTRAP);
  pyodide = instance;
}

self.onmessage = async (event: MessageEvent<Incoming>) => {
  const message = event.data;

  try {
    if (message.kind === 'init') {
      await boot();
      // Pyodide's own version (314.0.7) says nothing to a reader, so the chip
      // shows the Python release that is actually running underneath it.
      post({ type: 'ready', version: String(pyodide?.runPython('python_version') ?? '') });
      return;
    }

    if (!pyodide) throw new Error('Python is not ready yet');

    if (message.kind === 'reset') {
      pyodide.runPython('reset_namespace()');
      post({ type: 'reset-ok' });
      return;
    }

    if (message.kind === 'run') {
      currentRun = message.id;
      const started = performance.now();
      try {
        // The snippet travels as a JSON string, which is also a valid Python
        // string literal, so no quoting rules have to be re-invented here.
        const outcome = String(await pyodide.runPythonAsync(`run_user(${JSON.stringify(message.code)})`));
        const failed = outcome.startsWith('error\n');
        post({
          type: 'done',
          id: message.id,
          ok: !failed,
          message: failed ? outcome.slice('error\n'.length) : undefined,
          durationMs: performance.now() - started,
        });
      } catch (error) {
        post({
          type: 'done',
          id: message.id,
          ok: false,
          message: error instanceof Error ? error.message : String(error),
          durationMs: performance.now() - started,
        });
      } finally {
        currentRun = 0;
      }
    }
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    if (message.kind === 'init') {
      post({ type: 'boot-error', message: text });
      return;
    }
    post({
      type: 'done',
      id: message.id,
      ok: false,
      message: text,
      durationMs: 0,
    });
  }
};
