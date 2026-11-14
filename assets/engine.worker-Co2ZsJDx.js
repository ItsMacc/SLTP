(function(){async function e(e){try{let t=new Set(e),n=(await a(`WHEELS`)).filter(e=>e.endsWith(`.whl`)&&!t.has(e));return await Promise.all(n.map(e=>s(`WHEELS/${e}`))),n}catch{return[]}}async function t(e){return(await navigator.storage.getDirectory()).getDirectoryHandle(`sltp-market`,{create:e})}async function n(e,n){let r=e.split(`/`).filter(Boolean),i=r.pop(),a=await t(n);for(let e of r)a=await a.getDirectoryHandle(e,{create:n});return{dir:a,name:i}}async function r(e){try{let{dir:t,name:r}=await n(e,!1);return await t.getFileHandle(r),!0}catch{return!1}}async function i(e){try{let{dir:t,name:r}=await n(e,!1);return(await t.getFileHandle(r)).getFile()}catch{return null}}async function a(e){let n=[],r=async(e,t)=>{for await(let i of e.values())i.kind===`file`?n.push(t+i.name):i.kind===`directory`&&await r(i,`${t}${i.name}/`)};try{let n=e.split(`/`).filter(Boolean),i=await t(!1);for(let e of n)i=await i.getDirectoryHandle(e);await r(i,``)}catch{}return n}async function o(e,t){let{dir:r,name:i}=await n(e,!0),a=await(await r.getFileHandle(i,{create:!0})).createWritable();try{await a.write(t)}finally{await a.close()}}async function s(e){try{let{dir:t,name:r}=await n(e,!1);await t.removeEntry(r)}catch{}}let c=`https://cdn.jsdelivr.net/pyodide/v314.0.7/full/`;async function l(){return(await import(`${c}pyodide.mjs`)).loadPyodide({indexURL:c})}async function u(e,t){let n=await fetch(`https://pypi.org/pypi/${e}/${t}/json`);if(!n.ok)throw Error(`PyPI lookup failed for ${e}==${t} (${n.status})`);let r=await n.json(),i=(r.urls??[]).find(e=>e.filename.endsWith(`.whl`)&&!e.filename.includes(`cp`)&&!e.filename.includes(`pp`))??(r.urls??[]).find(e=>e.filename.endsWith(`.whl`));if(!i)throw Error(`No wheel found for ${e}==${t}`);return{filename:i.filename,url:i.url}}async function d(e,t,n,a){let{filename:s,url:c}=await u(n,a),l=`WHEELS/${s}`,d=!0;if(!await r(l)){d=!1;let e=await fetch(c);if(!e.ok)throw Error(`Wheel download failed for ${s} (${e.status})`);await o(l,new Blob([await e.arrayBuffer()]))}let f=await i(l);if(!f)throw Error(`Wheel vanished after download: ${s}`);return e.FS.writeFile(`/tmp/${s}`,new Uint8Array(await f.arrayBuffer())),await t.install(`emfs:/tmp/${s}`),{cached:d,filename:s}}let f=null,p=!1,m=!1,h=!1;function g(e,t,n,r,i,a){self.postMessage({id:e,kind:t,ok:n,data:r,error:i,...a})}async function _(t){if(p)return m;let n=await l();f=n,await n.loadPackage([`micropip`,`numpy`]);try{let e=await(await navigator.storage.getDirectory()).getDirectoryHandle(`sltp-market`,{create:!0});n.FS.mkdirTree(`/home/pyodide/.sltp/cache`),await n.mountNativeFS(`/home/pyodide/.sltp/cache`,e),h=!0}catch{}let r=n.pyimport(`micropip`),i=await Promise.all([d(n,r,`sltp`,`0.1.351`),d(n,r,`python-dateutil`,`2.9.0`)]);await e(i.map(e=>e.filename)),await n.runPythonAsync(`
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
`),n.globals.get(`enable_browser_fetch`)(),await n.globals.get(`prime_remote_cache`)();let a=n.globals.get(`register_strategy`);for(let e of t)a(e.key,e.className,e.source);return m=i.every(e=>e.cached),p=!0,m}self.onmessage=async e=>{let t=e.data;try{if(t.kind===`init`){let e=await _(t.strategies);g(t.id,t.kind,!0,JSON.stringify({ready:!0}),void 0,{wheelsCached:e,mounted:h});return}if(!f||!p)throw Error(`engine is not ready yet`);if(t.kind===`run`){let e=f.globals.get(`run_strategy`),n=String(e(t.key,t.start,t.end));g(t.id,t.kind,!0,n);return}}catch(e){g(t.id,t.kind??`?`,!1,void 0,e instanceof Error?e.message:String(e))}}})();