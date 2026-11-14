(function(){async function e(e){try{let t=new Set(e),n=(await a(`WHEELS`)).filter(e=>e.endsWith(`.whl`)&&!t.has(e));return await Promise.all(n.map(e=>s(`WHEELS/${e}`))),n}catch{return[]}}async function t(e){return(await navigator.storage.getDirectory()).getDirectoryHandle(`sltp-market`,{create:e})}async function n(e,n){let r=e.split(`/`).filter(Boolean),i=r.pop(),a=await t(n);for(let e of r)a=await a.getDirectoryHandle(e,{create:n});return{dir:a,name:i}}async function r(e){try{let{dir:t,name:r}=await n(e,!1);return await t.getFileHandle(r),!0}catch{return!1}}async function i(e){try{let{dir:t,name:r}=await n(e,!1);return(await t.getFileHandle(r)).getFile()}catch{return null}}async function a(e){let n=[],r=async(e,t)=>{for await(let i of e.values())i.kind===`file`?n.push(t+i.name):i.kind===`directory`&&await r(i,`${t}${i.name}/`)};try{let n=e.split(`/`).filter(Boolean),i=await t(!1);for(let e of n)i=await i.getDirectoryHandle(e);await r(i,``)}catch{}return n}async function o(e,t){let{dir:r,name:i}=await n(e,!0),a=await(await r.getFileHandle(i,{create:!0})).createWritable();try{await a.write(t)}finally{await a.close()}}async function s(e){try{let{dir:t,name:r}=await n(e,!1);await t.removeEntry(r)}catch{}}let c=`https://cdn.jsdelivr.net/pyodide/v314.0.7/full/`;async function l(){return(await import(`${c}pyodide.mjs`)).loadPyodide({indexURL:c})}async function u(e,t){let n=await fetch(`https://pypi.org/pypi/${e}/${t}/json`);if(!n.ok)throw Error(`PyPI lookup failed for ${e}==${t} (${n.status})`);let r=await n.json(),i=(r.urls??[]).find(e=>e.filename.endsWith(`.whl`)&&!e.filename.includes(`cp`)&&!e.filename.includes(`pp`))??(r.urls??[]).find(e=>e.filename.endsWith(`.whl`));if(!i)throw Error(`No wheel found for ${e}==${t}`);return{filename:i.filename,url:i.url}}async function d(e,t,n,a){let{filename:s,url:c}=await u(n,a),l=`WHEELS/${s}`,d=!0;if(!await r(l)){d=!1;let e=await fetch(c);if(!e.ok)throw Error(`Wheel download failed for ${s} (${e.status})`);await o(l,new Blob([await e.arrayBuffer()]))}let f=await i(l);if(!f)throw Error(`Wheel vanished after download: ${s}`);return e.FS.writeFile(`/tmp/${s}`,new Uint8Array(await f.arrayBuffer())),await t.install(`emfs:/tmp/${s}`),{cached:d,filename:s}}let f=null,p=!1,m=!1,h=!1;function g(e,t,n,r,i,a){self.postMessage({id:e,kind:t,ok:n,data:r,error:i,...a})}async function _(t){if(p)return m;let n=performance.now(),r=e=>{let t=performance.now();self.postMessage({kind:`progress`,stage:e,ms:Math.round(t-n)}),n=t},i=await l();f=i,r(`python`),await i.loadPackage([`micropip`,`numpy`]),r(`numpy`);try{let e=await(await navigator.storage.getDirectory()).getDirectoryHandle(`sltp-market`,{create:!0});i.FS.mkdirTree(`/home/pyodide/.sltp/cache`),await i.mountNativeFS(`/home/pyodide/.sltp/cache`,e),h=!0}catch{}r(`cache`);let a=i.pyimport(`micropip`),o=await Promise.all([d(i,a,`sltp`,`0.1.351`),d(i,a,`python-dateutil`,`2.9.0`)]);await e(o.map(e=>e.filename)),r(`wheels`),await i.runPythonAsync(`
import json
import time

_STRATEGIES = {}

# Timings for one run: how much of it was reading bars, and how much was the
# day loop itself. Printed in the UI, so a slow phone names its bottleneck
# instead of leaving the reader staring at a spinner.
_IO_STATS = {"io_seconds": 0.0, "io_calls": 0}


def register_strategy(key, classname, source):
    namespace = {}
    exec(compile(source, "<" + key + ">", "exec"), namespace)
    _STRATEGIES[key] = namespace[classname]


def run_strategy(key, start, end):
    from sltp.backtesting import Backtester
    from sltp.backtesting import backtester as _backtester
    from sltp.data import market_data_service as _market
    from sltp.web import to_jsonable

    # Time the bar reads. The backtester imported _get_histories by name, so
    # both module globals are patched; the timer is restored afterwards so a
    # failed run cannot leave the engine instrumented.
    _IO_STATS["io_seconds"] = 0.0
    _IO_STATS["io_calls"] = 0
    _original_backtester = _backtester._get_histories
    _original_market = getattr(_market, "_get_histories", None)

    def _timed(fn):
        def wrapper(*args, **kwargs):
            started = time.perf_counter()
            try:
                return fn(*args, **kwargs)
            finally:
                _IO_STATS["io_seconds"] += time.perf_counter() - started
                _IO_STATS["io_calls"] += 1
        return wrapper

    _backtester._get_histories = _timed(_original_backtester)
    if _original_market is not None:
        _market._get_histories = _timed(_original_market)

    cls = _STRATEGIES[key]
    _started = time.perf_counter()
    try:
        result = Backtester(cls(), start, end or None).run()
    finally:
        _run_seconds = time.perf_counter() - _started
        _backtester._get_histories = _original_backtester
        if _original_market is not None:
            _market._get_histories = _original_market
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
    payload["timings"] = {
        "run_seconds": round(_run_seconds, 2),
        "io_seconds": round(_IO_STATS["io_seconds"], 2),
        "io_calls": _IO_STATS["io_calls"],
        "bridge_seconds": round(_BRIDGE_STATS["seconds"], 2),
        "bridge_bytes": _BRIDGE_STATS["bytes"],
        "bridge_files": _BRIDGE_STATS["files"],
    }
    # Hand back the text and let the tray of equity/trade objects go: Safari
    # kills a tab that keeps a finished five-year result resident, which is
    # what a reader sees as the page reloading itself.
    text = json.dumps(payload)
    payload = None
    result = None
    import gc as _gc
    _gc.collect()
    return text


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

_BRIDGE_STATS = {"seconds": 0.0, "bytes": 0, "files": 0}


def enable_browser_fetch():
    from pyodide.http import open_url
    from sltp.data.remote import set_fetch

    # sltp ships the public r2.dev URL, which is closed now. Every remote read
    # goes through the gate instead: the unversioned alias serves the small
    # metadata files, and the cache mounted from OPFS serves the bars.
    import sltp.data.remote as _remote
    _remote.REMOTE_BASE_URL = "https://sltp-data.magicaltitan7.workers.dev/v/live"

    def _bridge(url, dest):
        from pathlib import Path
        from js import Uint8Array, XMLHttpRequest

        started = time.perf_counter()
        request = XMLHttpRequest.new()
        request.open("GET", str(url), False)
        request.responseType = "arraybuffer"
        request.send(None)
        if request.status != 200:
            raise IOError(f"download {url} failed with status {request.status}")
        data = Uint8Array.new(request.response).to_py().tobytes()
        _BRIDGE_STATS["seconds"] += time.perf_counter() - started
        _BRIDGE_STATS["bytes"] += len(data)
        _BRIDGE_STATS["files"] += 1
        path = Path(str(dest))
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(bytes(data))
        if path.suffix == ".parquet" and data[:4] != b"PAR1":
            raise IOError("download from " + str(url) + " is not a parquet file")

    set_fetch(_bridge)
`),r(`engine`),i.globals.get(`enable_browser_fetch`)(),await i.globals.get(`prime_remote_cache`)(),r(`data`);let s=i.globals.get(`register_strategy`);for(let e of t)s(e.key,e.className,e.source);return m=o.every(e=>e.cached),p=!0,m}self.onmessage=async e=>{let t=e.data;try{if(t.kind===`init`){let e=await _(t.strategies);g(t.id,t.kind,!0,JSON.stringify({ready:!0}),void 0,{wheelsCached:e,mounted:h});return}if(!f||!p)throw Error(`engine is not ready yet`);if(t.kind===`run`){let e=f.globals.get(`run_strategy`),n=String(e(t.key,t.start,t.end));g(t.id,t.kind,!0,n);return}}catch(e){g(t.id,t.kind??`?`,!1,void 0,e instanceof Error?e.message:String(e))}}})();