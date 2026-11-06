// worker.ts — the sltp engine, off the UI thread.
//
// A module Web Worker that boots Pyodide, installs the pinned sltp release,
// points the engine's downloads at a sync fetch bridge (allowed in workers,
// forbidden on the main thread), and answers JSON-string calls from the page.
// The engine is never modified here: every call below is public sltp API.

import type { PyodideInterface } from 'pyodide'

// The runtime loads from CDN at boot, never from the app bundle: importing
// the loader statically would make Vite inline the whole distribution.
async function loadPyodideAtPin(): Promise<PyodideInterface> {
  const module = (await import(/* @vite-ignore */ `${PYODIDE_INDEX_URL}pyodide.mjs`)) as {
    loadPyodide: (options: { indexURL: string }) => Promise<PyodideInterface>
  }
  return module.loadPyodide({ indexURL: PYODIDE_INDEX_URL })
}

// Pinned to the same line the sltp wheels track (CPython 3.14): its bundled
// numpy satisfies the package pins, so micropip accepts the install.
const PYODIDE_INDEX_URL = 'https://cdn.jsdelivr.net/pyodide/v314.0.3/full/'
const SLTP_VERSION = '0.1.23'

interface StrategyInit {
  key: string
  className: string
  source: string
}

type Incoming =
  | { id: number; kind: 'init'; strategies: StrategyInit[] }
  | { id: number; kind: 'run'; key: string; start: string; end: string | null }
  | { id: number; kind: 'history'; ticker: string; start: string | null; end: string | null }
  | { id: number; kind: 'directory' }
  | { id: number; kind: 'latest' }

// Everything the worker needs from Python, defined once. Drivers return JSON
// strings so the only thing crossing the worker boundary is text.
const BOOTSTRAP = `
import json

_STRATEGIES = {}


def _num(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number != number or number in (float("inf"), float("-inf")):
        return None
    return number


def register_strategy(key, classname, source):
    namespace = {}
    exec(compile(source, "<" + key + ">", "exec"), namespace)
    _STRATEGIES[key] = namespace[classname]


def run_strategy(key, start, end):
    from sltp.web import run

    cls = _STRATEGIES[key]
    return json.dumps(run(cls(), start, end or None))


def get_history(ticker, start, end):
    from sltp.data.market_data_service import get_stock_history, get_stock_name

    history = get_stock_history(ticker, start, end)
    dates = [str(day) for day in history.dates]
    bars = [
        {
            "date": dates[i],
            "open": _num(history.open_price[i]),
            "high": _num(history.high[i]),
            "low": _num(history.low[i]),
            "close": _num(history.close_price[i]),
            "volume": _num(history.volume[i]),
        }
        for i in range(len(dates))
    ]
    return json.dumps(
        {
            "ticker": ticker,
            "name": get_stock_name(ticker),
            "total_bars": len(bars),
            "data": bars,
        }
    )


def get_directory():
    from sltp.data.market_data_service import get_tradable_ticker_directory

    return json.dumps(get_tradable_ticker_directory())


def get_latest():
    from sltp.data.market_data_service import get_latest_trading_date

    return str(get_latest_trading_date())


def prime_remote_cache():
    # The bucket layout is uppercase (SYMBOL_DATA) while checkouts on disk
    # use lowercase (symbol_data); macOS cannot tell them apart but the
    # browser can, so mirror the small metadata files to the names the
    # readers open. Temporary until the package reads one layout everywhere.
    import shutil
    from pathlib import Path
    from sltp.data import market_data_service as _mds
    from sltp.data import remote as _remote

    # Self-heal: anything cached without the parquet magic (e.g. written by
    # an earlier text-decoding bridge) is dropped so it downloads again.
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
                    shutil.copy2(child, dest / child.name)


def enable_browser_fetch():
    # Sync downloads through the browser's own network stack. open_url is
    # synchronous XHR, which is why this worker exists: the main thread
    # cannot do it. The parquet magic check makes a bad download loud.
    from pyodide.http import open_url
    from sltp.data.remote import set_fetch

    def _bridge(url, dest):
        # Sync binary download through raw XHR. open_url decodes the body to
        # text, which corrupts parquet beyond its ASCII magic, so the response
        # is read as an arraybuffer and converted without a text step.
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
`

let pyodide: PyodideInterface | null = null
let booted = false

function reply(id: number, kind: string, ok: boolean, data?: unknown, error?: string) {
  console.log(`[sltp-worker] reply id=${id} kind=${kind} ok=${ok} bytes=${typeof data === 'string' ? data.length : 0}`)
  self.postMessage({ id, kind, ok, data, error })
}

async function boot(strategies: StrategyInit[]) {
  if (booted) return
  const instance = await loadPyodideAtPin()
  pyodide = instance
  // Binary wheels come from the Pyodide distribution, not PyPI: a WASM
  // runtime cannot consume CPython wheels, so numpy/scipy/pyarrow load here
  // and micropip then only fetches what is still missing (sltp itself).
  await instance.loadPackage(['micropip', 'numpy', 'scipy', 'pyarrow', 'python-dateutil'])
  // Persist the chunk cache between visits when the browser allows it.
  // OPFS is best-effort: a denial falls back to memory, which still works
  // and simply refetches next visit.
  try {
    const root = await navigator.storage.getDirectory()
    const cacheHandle = await root.getDirectoryHandle('sltp-cache', { create: true })
    instance.FS.mkdirTree('/home/pyodide/.sltp')
    await instance.mountNativeFS('/home/pyodide/.sltp', cacheHandle)
  } catch {
    /* memory cache only */
  }
  const micropip = instance.pyimport('micropip')
  await micropip.install(`sltp==${SLTP_VERSION}`)
  await instance.runPythonAsync(BOOTSTRAP)
  const register = instance.globals.get('register_strategy')
  const enableFetch = instance.globals.get('enable_browser_fetch')
  enableFetch()
  for (const entry of strategies) {
    register(entry.key, entry.className, entry.source)
  }
  register.destroy()
  enableFetch.destroy()
  const prime = instance.globals.get('prime_remote_cache')
  await prime()
  prime.destroy()
  booted = true
}

self.onmessage = async (event: MessageEvent<Incoming>) => {
  const message = event.data
  try {
    if (message.kind === 'init') {
      await boot(message.strategies)
      reply(message.id, message.kind, true, JSON.stringify({ ready: true }))
      return
    }
    if (!pyodide || !booted) throw new Error('engine is not ready yet')
    if (message.kind === 'run') {
      const out = pyodide.globals.get('run_strategy')(message.key, message.start, message.end)
      const text = String(out)
      reply(message.id, message.kind, true, text)
      return
    }
    if (message.kind === 'history') {
      const out = pyodide.globals.get('get_history')(message.ticker, message.start, message.end)
      reply(message.id, message.kind, true, String(out))
      return
    }
    if (message.kind === 'directory') {
      const out = pyodide.globals.get('get_directory')()
      reply(message.id, message.kind, true, String(out))
      return
    }
    const out = pyodide.globals.get('get_latest')()
    reply(message.id, message.kind, true, String(out))
  } catch (error) {
    reply(message.id, (message as { kind?: string }).kind || '?', false, undefined, error instanceof Error ? error.message : String(error))
  }
}
