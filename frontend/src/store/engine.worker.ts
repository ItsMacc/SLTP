// engine.worker.ts — the sltp engine, off the UI thread.
//
// A module Web Worker that boots Pyodide, mounts the OPFS market cache
// straight into the Emscripten filesystem, installs the pinned sltp
// release, and answers run calls with JSON strings. The engine is never
// modified here: every call below is public sltp API.
//
// Reads need no bridge: the worker mounts the same `sltp-market` directory
// the sync downloads into at sltp's own cache path (`~/.sltp/cache`), and
// the bucket layout the sync mirrors is almost the layout sltp expects:
// bars and actions sit in MARKET_DAILY/ where sltp looks, and boot mirrors
// the uppercase SYMBOL_DATA/ catalog to the lowercase symbol_data/ dir the
// readers open. A run over a range the sync never fetched
// still resolves — sltp's own fetch hook downloads the gap through the
// browser stack (synchronous XHR, which is why this worker exists: the
// main thread cannot do it), landing in the same mounted files.
//
// Wheels ride OPFS too (WHEELS/, shared with the page): the first visit
// downloads the pinned builds from PyPI once, later visits install them
// from disk with no network at all.

import { getFile, hasFile, putFile } from './opfs';

/** Pinned runtime: the full build serves loadPyodide plus every wheel. */
const PYODIDE_INDEX_URL = 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/';
/** Engine pin: matches backend/requirements.txt. */
const SLTP_VERSION = '0.1.30';
/** Pure-Python date library the strategy base imports. */
const DATEUTIL_VERSION = '2.9.0';

/** The slice of the Pyodide JS API this worker touches. */
interface PyodideApi {
  loadPackage: (names: string | string[]) => Promise<void>;
  runPythonAsync: (code: string) => Promise<unknown>;
  pyimport: (name: string) => { install: (requirement: string) => Promise<unknown> };
  globals: { get: (name: string) => (...args: unknown[]) => unknown };
  FS: { mkdirTree: (path: string) => void; writeFile: (path: string, data: Uint8Array) => void };
  mountNativeFS: (mountpoint: string, handle: FileSystemDirectoryHandle) => Promise<unknown>;
}

async function loadPyodideAtPin(): Promise<PyodideApi> {
  // @vite-ignore keeps this a runtime CDN fetch instead of a build asset.
  const module = (await import(/* @vite-ignore */ `${PYODIDE_INDEX_URL}pyodide.mjs`)) as {
    loadPyodide: (options: { indexURL: string }) => Promise<PyodideApi>;
  };
  return module.loadPyodide({ indexURL: PYODIDE_INDEX_URL });
}

interface StrategyInit {
  key: string;
  className: string;
  source: string;
}

type Incoming =
  | { id: number; kind: 'init'; strategies: StrategyInit[] }
  | { id: number; kind: 'run'; key: string; start: string; end: string | null };

// Everything the worker needs from Python, defined once. Drivers return
// JSON strings so the only thing crossing the worker boundary is text.
const BOOTSTRAP = `
import json

_STRATEGIES = {}


def register_strategy(key, classname, source):
    namespace = {}
    exec(compile(source, "<" + key + ">", "exec"), namespace)
    _STRATEGIES[key] = namespace[classname]


def run_strategy(key, start, end):
    from sltp.backtesting import Backtester
    from sltp.web import to_jsonable

    cls = _STRATEGIES[key]
    result = Backtester(cls(), start, end or None).run()
    # sltp's curve points carry portfolio_value; accept a bare value too so
    # a point never dies inside to_jsonable with a bare KeyError. Anything
    # else fails loud, naming the keys, the range and the engine version.
    stamp = result.get("stamp") or {}
    equity = []
    for point in result.get("equity") or []:
        if "portfolio_value" in point:
            value = point["portfolio_value"]
        elif "value" in point:
            value = point["value"]
        else:
            raise ValueError(
                f"equity point has keys {sorted(point.keys())} "
                f"for {key} {start}..{end} (sltp {stamp.get('sltp_version')})"
            )
        equity.append({"date": str(point["date"]), "value": float(value)})
    payload = to_jsonable(result)
    payload["equity"] = equity
    return json.dumps(payload)


def prime_remote_cache():
    # The bucket layout is uppercase (SYMBOL_DATA) while the readers open
    # the lowercase symbol_data directory beside the market dir, so mirror
    # the small metadata files to the names sltp actually opens. Bars and
    # actions already sit where sltp looks (MARKET_DAILY/). Runs at every
    # boot, so a half-written file heals itself on the next visit.
    import shutil
    from pathlib import Path
    from sltp.data import market_data_service as _mds
    from sltp.data import remote as _remote

    # Self-heal: anything cached without the parquet magic is dropped so
    # the sync below downloads it again.
    for directory in (Path(_remote.CACHE_ROOT) / "MARKET_DAILY", Path(_mds.SYMBOL_DATA_DIR)):
        if directory.is_dir():
            for cached in directory.glob("*.parquet"):
                with open(cached, "rb") as handle:
                    if handle.read(4) != b"PAR1":
                        cached.unlink()
    _remote.sync_catalog()
    _remote.sync_actions()
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
                        # Case-insensitive checkout: src and dest are one dir.
                        pass
`;

/** Exact wheel URL for a pinned pure-Python release, via the PyPI API. */
async function pypiWheelUrl(name: string, version: string): Promise<{ filename: string; url: string }> {
  const res = await fetch(`https://pypi.org/pypi/${name}/${version}/json`);
  if (!res.ok) throw new Error(`PyPI lookup failed for ${name}==${version} (${res.status})`);
  const meta = (await res.json()) as {
    urls?: { filename: string; url: string }[];
  };
  const pure = (meta.urls ?? []).find(
    (u) => u.filename.endsWith('.whl') && !u.filename.includes('cp') && !u.filename.includes('pp'),
  );
  const wheel = pure ?? (meta.urls ?? []).find((u) => u.filename.endsWith('.whl'));
  if (!wheel) throw new Error(`No wheel found for ${name}==${version}`);
  return { filename: wheel.filename, url: wheel.url };
}

/**
 * One pinned wheel: OPFS on a hit, PyPI (then stored) on a miss. Installs
 * through micropip's `emfs:` scheme — note the single colon — which reads
 * the file we wrote into the Emscripten filesystem below.
 */
async function installWheel(
  pyodide: PyodideApi,
  micropip: { install: (requirement: string) => Promise<unknown> },
  name: string,
  version: string,
): Promise<boolean> {
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
}

/** Sync downloads through the browser's own network stack. open_url decodes
    to text, which corrupts parquet beyond its ASCII magic, so the response
    is read as an arraybuffer without a text step. Anything sltp fetches
    through here lands in the mounted OPFS files, where the main-thread
    sync counts it like any download of its own. */
const FETCH_BRIDGE = `
def enable_browser_fetch():
    from pyodide.http import open_url
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

let pyodide: PyodideApi | null = null;
let booted = false;
let bootCached = false;
let cacheMounted = false;

function reply(
  id: number,
  kind: string,
  ok: boolean,
  data?: unknown,
  error?: string,
  extra?: Record<string, unknown>,
) {
  self.postMessage({ id, kind, ok, data, error, ...extra });
}

async function boot(strategies: StrategyInit[]): Promise<boolean> {
  if (booted) return bootCached;
  const instance = await loadPyodideAtPin();
  pyodide = instance;
  // Binary wheels come from the Pyodide distribution, not PyPI: a WASM
  // runtime cannot consume CPython wheels, so numpy loads here and micropip
  // then only fetches what is still missing (the pinned wheels below).
  await instance.loadPackage(['micropip', 'numpy']);
  // The market cache, mounted where sltp looks for it. Best-effort: a
  // denial falls back to memory downloads, which still run and simply
  // refetch next visit.
  try {
    const root = await navigator.storage.getDirectory();
    const cacheHandle = await root.getDirectoryHandle('sltp-market', { create: true });
    instance.FS.mkdirTree('/home/pyodide/.sltp/cache');
    await instance.mountNativeFS('/home/pyodide/.sltp/cache', cacheHandle);
    cacheMounted = true;
  } catch {
    /* memory cache only */
  }
  const micropip = instance.pyimport('micropip');
  const cached = await Promise.all([
    installWheel(instance, micropip, 'sltp', SLTP_VERSION),
    installWheel(instance, micropip, 'python-dateutil', DATEUTIL_VERSION),
  ]);
  await instance.runPythonAsync(BOOTSTRAP + FETCH_BRIDGE);
  const enableFetch = instance.globals.get('enable_browser_fetch');
  enableFetch();
  // Mirror the uppercase bucket layout to the lowercase paths sltp opens
  // (SYMBOL_DATA/ -> symbol_data/), fetching anything still missing.
  const prime = instance.globals.get('prime_remote_cache');
  await prime();
  const register = instance.globals.get('register_strategy');
  for (const entry of strategies) {
    register(entry.key, entry.className, entry.source);
  }
  bootCached = cached.every(Boolean);
  booted = true;
  return bootCached;
}

self.onmessage = async (event: MessageEvent<Incoming>) => {
  const message = event.data;
  try {
    if (message.kind === 'init') {
      const wheelsCached = await boot(message.strategies);
      reply(message.id, message.kind, true, JSON.stringify({ ready: true }), undefined, {
        wheelsCached,
        mounted: cacheMounted,
      });
      return;
    }
    if (!pyodide || !booted) throw new Error('engine is not ready yet');
    if (message.kind === 'run') {
      const runStrategy = pyodide.globals.get('run_strategy');
      const text = String(runStrategy(message.key, message.start, message.end));
      reply(message.id, message.kind, true, text);
      return;
    }
  } catch (error) {
    reply(
      message.id,
      (message as { kind?: string }).kind ?? '?',
      false,
      undefined,
      error instanceof Error ? error.message : String(error),
    );
  }
};
