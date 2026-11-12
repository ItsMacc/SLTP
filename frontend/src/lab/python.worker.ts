// python.worker.ts — the Lab's Python runtime: Pyodide, booted off the main
// thread so a slow import never freezes the page.
//
// The Lab runs projects, not snippets. Every run writes the project's files
// into /home/pyodide/project first, puts that root and the entry file's folder
// on sys.path, then executes the open file as __main__. Imports between project
// files therefore work the way they do from a terminal, and `from sltp import
// ...` resolves because the pinned engine wheel is installed at boot.
//
// Wheels ride OPFS too (WHEELS/, shared with the Research engine worker): the
// first visit downloads the pinned builds once, later visits install them from
// disk. If OPFS is unavailable the install falls back to PyPI through micropip,
// and if that fails too the Lab still runs plain Python, with the reason shown
// in the status bar.

import { getFile, hasFile, putFile } from '../store/opfs';

/** Pinned Pyodide build: the same distribution the engine worker uses. */
const PYODIDE_INDEX_URL = 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/';
/** Engine pin: matches backend/requirements.txt. */
const SLTP_VERSION = '0.1.32';
/** Pure-Python date library the strategy base imports. */
const DATEUTIL_VERSION = '2.9.0';

interface PyodideApi {
  runPython: (code: string) => unknown;
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdout: (options: { batched?: (text: string) => void }) => void;
  setStderr: (options: { batched?: (text: string) => void }) => void;
  loadPackage: (names: string | string[]) => Promise<void>;
  pyimport: (name: string) => { install: (requirement: string) => Promise<unknown> };
  globals: { get: (name: string) => (...args: unknown[]) => unknown };
  FS: {
    writeFile: (path: string, data: Uint8Array) => void;
    mkdirTree: (path: string) => void;
  };
  mountNativeFS: (mountpoint: string, handle: FileSystemDirectoryHandle) => Promise<unknown>;
}

type Incoming =
  | { id: number; kind: 'init' }
  | {
      id: number;
      kind: 'run';
      filename: string;
      code: string;
      files: { name: string; content: string }[];
    }
  | { id: number; kind: 'reset' };

let pyodide: PyodideApi | null = null;
/** The run whose stdout is arriving right now, so chunks find their way home. */
let currentRun = 0;

function post(message: unknown): void {
  self.postMessage(message);
}

// The interpreter's own code, loaded once. run_project owns the project folder,
// clears modules from the previous run so an edited helper is re-imported, and
// formats errors down to the reader's own files.
const BOOTSTRAP = `
import builtins
import json
import linecache
import platform
import shutil
import sys
import traceback
from pathlib import Path

python_version = platform.python_version()
PROJECT_ROOT = Path("/home/pyodide/project")


def _format_error(exc):
    frames = [
        frame
        for frame in traceback.extract_tb(exc.__traceback__)
        if frame.filename == "<lab>"
        or frame.filename.startswith(str(PROJECT_ROOT))
    ]
    lines = ["Traceback (most recent call last):"] if frames else []
    for frame in frames:
        shown = frame.filename.replace(str(PROJECT_ROOT) + "/", "")
        lines.append(f'  File "{shown}", line {frame.lineno}, in {frame.name}')
        if frame.line:
            lines.append(f"    {frame.line.strip()}")
    tail = "".join(traceback.format_exception_only(type(exc), exc)).rstrip()
    # Exception-only text names the file for syntax errors; show it the same
    # way the frames above do, relative to the project root.
    lines.extend(tail.replace(str(PROJECT_ROOT) + "/", "").splitlines())
    return "\\n".join(lines)


def _clear_project_modules():
    for name, module in list(sys.modules.items()):
        filename = getattr(module, "__file__", None)
        if filename and str(filename).startswith(str(PROJECT_ROOT)):
            sys.modules.pop(name, None)


def _find_result(namespace):
    # Backtester.run returns a dict with metrics and equity. The script may
    # keep it in any name, so look at the values rather than guessing one.
    for value in reversed(list(namespace.values())):
        if isinstance(value, dict) and "metrics" in value and "equity" in value:
            return value
    return None


def _strategy_name(namespace):
    for value in namespace.values():
        name = getattr(value, "name", None)
        if isinstance(name, str) and callable(getattr(value, "on_signal", None)):
            return name
    return None


def _benchmark_series(start, end):
    # The same buy-and-hold SPY line the CLI prints next to a lone strategy.
    # A benchmark failure costs the second line, never the result window.
    try:
        from sltp.web import _benchmark

        return [
            {"date": str(point["date"]), "value": float(point["portfolio_value"])}
            for point in _benchmark(start, end, True)
        ]
    except Exception:
        return []


def _payload(result, namespace):
    from sltp.web import to_jsonable

    payload = to_jsonable(result)
    equity = payload.get("equity") or []
    stamp = payload.get("stamp") or {}
    start = str(stamp.get("actual_start") or (equity[0]["date"] if equity else ""))
    end = str(stamp.get("end") or (equity[-1]["date"] if equity else ""))
    payload["benchmark"] = _benchmark_series(start, end) if start and end else []
    payload["strategy_name"] = _strategy_name(namespace)
    # Rejections are part of the raw run and useful in the download even
    # though they are not a headline metric.
    payload["rejections"] = result.get("rejections") or {}
    return payload


def run_project(filename, files):
    if PROJECT_ROOT.exists():
        shutil.rmtree(PROJECT_ROOT)
    PROJECT_ROOT.mkdir(parents=True, exist_ok=True)
    for name, content in files.items():
        path = PROJECT_ROOT / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")

    _clear_project_modules()
    # The base path is captured on the first run, after micropip has added its
    # site-packages entry, so reinstalling the project paths never loses it.
    if not hasattr(sys, "_lab_base_path"):
        sys._lab_base_path = list(sys.path)
    root = str(PROJECT_ROOT)
    entry = PROJECT_ROOT / filename
    entry_dir = str(entry.parent)
    sys.path[:] = [root, entry_dir] + [
        item for item in sys._lab_base_path if item not in (root, entry_dir)
    ]
    sys.argv = [filename]

    source = entry.read_text(encoding="utf-8")
    # Absolute filename, so traceback frames can be filtered to the project and
    # then shown relative to it; __file__ and linecache agree with that path.
    absolute = str(entry)
    linecache.cache[absolute] = (len(source), None, source.splitlines(True), absolute)
    namespace = {
        "__name__": "__main__",
        "__file__": absolute,
        "__package__": None,
        "__builtins__": builtins,
    }
    try:
        exec(compile(source, absolute, "exec"), namespace)
    except Exception as exc:
        return json.dumps({"ok": False, "error": _format_error(exc)})

    result = _find_result(namespace)
    if result is None:
        return json.dumps({"ok": True, "result": None})
    try:
        return json.dumps({"ok": True, "result": _payload(result, namespace)})
    except Exception:
        # The backtest ran; only the rich result could not be serialized.
        # Keep the terminal useful instead of turning a success into an error.
        return json.dumps({"ok": True, "result": None})


def reset_project():
    _clear_project_modules()
    if PROJECT_ROOT.exists():
        shutil.rmtree(PROJECT_ROOT)
    return "cleared"
`;

// sltp reaches for urllib when it needs a file the cache does not have, and
// Pyodide's urllib has no TLS. This bridge swaps that download for a
// synchronous XMLHttpRequest, which a worker is allowed to make: the browser
// fetches the file, and it lands in the mounted OPFS cache as if sltp had
// downloaded it itself. That is why the Lab runs Python in a worker at all.
const FETCH_BRIDGE = `
def enable_browser_fetch():
    from sltp.data.remote import set_fetch

    def _bridge(url, dest):
        from pathlib import Path
        from js import Uint8Array, XMLHttpRequest

        request = XMLHttpRequest.new()
        request.open("GET", str(url), False)
        request.responseType = "arraybuffer"
        request.send(None)
        if request.status != 200:
            raise IOError(f"download {url} failed with status {request.status}")
        data = Uint8Array.new(request.response).to_py().tobytes()
        path = Path(str(dest))
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(bytes(data))
        if path.suffix == ".parquet" and data[:4] != b"PAR1":
            raise IOError("download from " + str(url) + " is not a parquet file")

    set_fetch(_bridge)
`;

// sltp looks for bars, actions and the symbol catalog under ~/.sltp/cache.
// The Research sync fills that same OPFS directory; mounting it here means the
// Lab reads the downloaded data instead of asking R2 for everything again.
// Only the metadata mirror runs at boot; missing price files are fetched
// through the bridge above when a run asks for them.
const PRIME_CACHE = `
def prime_market_cache():
    import shutil
    from pathlib import Path
    from sltp.data import market_data_service as _mds
    from sltp.data import remote as _remote

    # Self-heal: a cached file without the parquet magic is dropped so the
    # next request downloads it again.
    for directory in (Path(_remote.CACHE_ROOT) / "MARKET_DAILY", Path(_mds.SYMBOL_DATA_DIR)):
        if directory.is_dir():
            for cached in directory.glob("*.parquet"):
                with open(cached, "rb") as handle:
                    if handle.read(4) != b"PAR1":
                        cached.unlink()
    _remote.sync_catalog()
    _remote.sync_actions()
    # The bucket uses SYMBOL_DATA/; sltp opens symbol_data/. Mirror the small
    # metadata files once per boot so available_universe resolves locally.
    src = Path(_remote.CACHE_ROOT) / "SYMBOL_DATA"
    dest = Path(_mds.SYMBOL_DATA_DIR)
    if src.is_dir():
        dest.mkdir(parents=True, exist_ok=True)
        try:
            same = src.resolve() == dest.resolve()
        except OSError:
            same = False
        if not same:
            for child in src.iterdir():
                if child.is_file():
                    try:
                        shutil.copy2(child, dest / child.name)
                    except shutil.SameFileError:
                        pass
`;

async function loadPyodideAtPin(): Promise<PyodideApi> {
  // @vite-ignore keeps this a runtime CDN fetch instead of a build asset.
  const module = (await import(/* @vite-ignore */ `${PYODIDE_INDEX_URL}pyodide.mjs`)) as {
    loadPyodide: (options: { indexURL: string }) => Promise<PyodideApi>;
  };
  return module.loadPyodide({ indexURL: PYODIDE_INDEX_URL });
}

/** Exact wheel URL for a pinned pure-Python release, via the PyPI API. */
async function pypiWheelUrl(name: string, version: string): Promise<{ filename: string; url: string }> {
  const res = await fetch(`https://pypi.org/pypi/${name}/${version}/json`);
  if (!res.ok) throw new Error(`PyPI lookup failed for ${name}==${version} (${res.status})`);
  const meta = (await res.json()) as { urls?: { filename: string; url: string }[] };
  const pure = (meta.urls ?? []).find(
    (u) => u.filename.endsWith('.whl') && !u.filename.includes('cp') && !u.filename.includes('pp'),
  );
  const wheel = pure ?? (meta.urls ?? []).find((u) => u.filename.endsWith('.whl'));
  if (!wheel) throw new Error(`No wheel found for ${name}==${version}`);
  return { filename: wheel.filename, url: wheel.url };
}

/**
 * One pinned wheel: OPFS on a hit, PyPI (then stored) on a miss. Installs
 * through micropip's `emfs:` scheme, which reads the file written below. Any
 * OPFS trouble falls back to a plain PyPI install so a locked-down browser
 * still gets the engine.
 */
async function installWheel(
  pyodide: PyodideApi,
  micropip: { install: (requirement: string) => Promise<unknown> },
  name: string,
  version: string,
): Promise<boolean> {
  try {
    const { filename, url } = await pypiWheelUrl(name, version);
    const key = `WHEELS/${filename}`;
    let cached = true;
    if (!(await hasFile(key))) {
      cached = false;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Wheel download failed for ${filename} (${res.status})`);
      await putFile(key, new Blob([await res.arrayBuffer()]));
    }
    const file = await getFile(key);
    if (!file) throw new Error(`Wheel vanished after download: ${filename}`);
    pyodide.FS.writeFile(`/tmp/${filename}`, new Uint8Array(await file.arrayBuffer()));
    await micropip.install(`emfs:/tmp/${filename}`);
    return cached;
  } catch {
    await micropip.install(`${name}==${version}`);
    return false;
  }
}

async function boot(): Promise<void> {
  if (pyodide) return;

  post({ type: 'status', text: 'Loading Python…' });
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

  // sltp's cache is the Research page's OPFS directory, so the bars and
  // metadata already downloaded there are the files a backtest reads. A
  // denied OPFS falls back to the in-memory filesystem; runs still work and
  // simply fetch what they need again on the next visit.
  let cacheMounted = false;
  try {
    post({ type: 'status', text: 'Linking the market cache…' });
    const root = await navigator.storage.getDirectory();
    const cacheHandle = await root.getDirectoryHandle('sltp-market', { create: true });
    instance.FS.mkdirTree('/home/pyodide/.sltp/cache');
    await instance.mountNativeFS('/home/pyodide/.sltp/cache', cacheHandle);
    cacheMounted = true;
  } catch {
    /* memory cache only */
  }

  let engineReady = false;
  let engineError: string | null = null;
  let marketReady = false;
  let marketError: string | null = null;
  try {
    post({ type: 'status', text: 'Installing numpy…' });
    await instance.loadPackage(['micropip', 'numpy']);
    post({ type: 'status', text: 'Installing the trading engine…' });
    const micropip = instance.pyimport('micropip');
    await installWheel(instance, micropip, 'sltp', SLTP_VERSION);
    await installWheel(instance, micropip, 'python-dateutil', DATEUTIL_VERSION);
    engineReady = true;
  } catch (error) {
    engineError = error instanceof Error ? error.message : String(error);
  }

  if (engineReady) {
    try {
      post({ type: 'status', text: 'Syncing market data…' });
      instance.runPython(FETCH_BRIDGE + PRIME_CACHE);
      instance.globals.get('enable_browser_fetch')();
      await Promise.resolve(instance.globals.get('prime_market_cache')());
      marketReady = true;
    } catch (error) {
      marketError = error instanceof Error ? error.message : String(error);
    }
  }

  // Only surface a market warning when the engine itself installed: a broken
  // sltp is the more useful error, and "market unavailable" would hide it.
  post({
    type: 'ready',
    version: String(instance.runPython('python_version')),
    engine: engineReady,
    market: marketReady,
    warning: engineError ?? marketError,
    cache: cacheMounted,
  });
}

self.onmessage = async (event: MessageEvent<Incoming>) => {
  const message = event.data;

  try {
    if (message.kind === 'init') {
      await boot();
      return;
    }

    if (!pyodide) throw new Error('Python is not ready yet');

    if (message.kind === 'reset') {
      pyodide.runPython('reset_project()');
      post({ type: 'reset-ok' });
      return;
    }

    if (message.kind === 'run') {
      currentRun = message.id;
      const started = performance.now();
      const files: Record<string, string> = {};
      for (const file of message.files) {
        // The open buffer's unsaved draft is what runs, not the last save.
        files[file.name] = file.name === message.filename ? message.code : file.content;
      }
      try {
        const outcome = String(
          await pyodide.runPythonAsync(
            `run_project(${JSON.stringify(message.filename)}, ${JSON.stringify(files)})`,
          ),
        );
        // run_project answers with one JSON object: ok, plus either the
        // reader's traceback or the normalized backtest payload.
        let parsed: { ok?: boolean; result?: unknown; error?: string };
        try {
          parsed = JSON.parse(outcome) as { ok?: boolean; result?: unknown; error?: string };
        } catch {
          parsed = { ok: false, error: outcome };
        }
        post({
          type: 'done',
          id: message.id,
          ok: parsed.ok === true,
          message: parsed.error,
          result: parsed.result ?? null,
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
