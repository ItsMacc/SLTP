(function(){async function e(e){try{let t=new Set(e),n=(await a(`WHEELS`)).filter(e=>e.endsWith(`.whl`)&&!t.has(e));return await Promise.all(n.map(e=>s(`WHEELS/${e}`))),n}catch{return[]}}async function t(e){return(await navigator.storage.getDirectory()).getDirectoryHandle(`sltp-market`,{create:e})}async function n(e,n){let r=e.split(`/`).filter(Boolean),i=r.pop(),a=await t(n);for(let e of r)a=await a.getDirectoryHandle(e,{create:n});return{dir:a,name:i}}async function r(e){try{let{dir:t,name:r}=await n(e,!1);return await t.getFileHandle(r),!0}catch{return!1}}async function i(e){try{let{dir:t,name:r}=await n(e,!1);return(await t.getFileHandle(r)).getFile()}catch{return null}}async function a(e){let n=[],r=async(e,t)=>{for await(let i of e.values())i.kind===`file`?n.push(t+i.name):i.kind===`directory`&&await r(i,`${t}${i.name}/`)};try{let n=e.split(`/`).filter(Boolean),i=await t(!1);for(let e of n)i=await i.getDirectoryHandle(e);await r(i,``)}catch{}return n}async function o(e,t){let{dir:r,name:i}=await n(e,!0),a=await(await r.getFileHandle(i,{create:!0})).createWritable();try{await a.write(t)}finally{await a.close()}}async function s(e){try{let{dir:t,name:r}=await n(e,!1);await t.removeEntry(r)}catch{}}let c=`https://cdn.jsdelivr.net/pyodide/v314.0.7/full/`,l=null,u=0,d=[];function f(e){self.postMessage(e)}async function p(){return(await import(`${c}pyodide.mjs`)).loadPyodide({indexURL:c})}async function m(e,t){let n=await fetch(`https://pypi.org/pypi/${e}/${t}/json`);if(!n.ok)throw Error(`PyPI lookup failed for ${e}==${t} (${n.status})`);let r=await n.json(),i=(r.urls??[]).find(e=>e.filename.endsWith(`.whl`)&&!e.filename.includes(`cp`)&&!e.filename.includes(`pp`))??(r.urls??[]).find(e=>e.filename.endsWith(`.whl`));if(!i)throw Error(`No wheel found for ${e}==${t}`);return{filename:i.filename,url:i.url}}async function h(e,t,n,a){try{let{filename:s,url:c}=await m(n,a),l=`WHEELS/${s}`,u=!0;if(!await r(l)){u=!1;let e=await fetch(c);if(!e.ok)throw Error(`Wheel download failed for ${s} (${e.status})`);await o(l,new Blob([await e.arrayBuffer()]))}let d=await i(l);if(!d)throw Error(`Wheel vanished after download: ${s}`);return e.FS.writeFile(`/tmp/${s}`,new Uint8Array(await d.arrayBuffer())),await t.install(`emfs:/tmp/${s}`),{cached:u,filename:s}}catch{return await t.install(`${n}==${a}`),{cached:!1,filename:null}}}async function g(){if(l)return;f({type:`status`,text:`Loading Python…`});let t=await p();t.setStdout({batched:e=>{u&&(d.push({stream:`stdout`,text:e}),f({type:`stdout`,id:u,text:e}))}}),t.setStderr({batched:e=>{u&&(d.push({stream:`stderr`,text:e}),f({type:`stderr`,id:u,text:e}))}}),t.runPython(`
import builtins
import json
import linecache
import os
import platform
import inspect
import shutil
import sys
import traceback
from pathlib import Path

python_version = platform.python_version()
PROJECT_ROOT = Path("/home/pyodide/project")
# Reads come from a plain data dir whose files link into the mounted cache.
# Left on the cache root, sltp treats it as a remote cache and re-checks R2
# inside a run, which is what made a two-year backtest crawl.
os.environ["SLTP_DATA_DIR"] = "/data"


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
    for value in reversed(list(namespace.values())):
        name = getattr(value, "name", None)
        if isinstance(name, str) and callable(getattr(value, "on_signal", None)):
            return name
        if isinstance(value, type) and callable(getattr(value, "on_signal", None)):
            return value.__name__
    return None


def _is_project_class(value):
    """True for classes defined by files the reader wrote, not by sltp."""
    if not isinstance(value, type):
        return False
    # The entry file runs in a plain exec namespace, not a module registered
    # as __main__, so inspect.getsourcefile cannot see its path. Any class in
    # that namespace is the reader's own.
    if value.__module__ == "__main__":
        return True
    module = sys.modules.get(value.__module__)
    filename = getattr(module, "__file__", None) or inspect.getsourcefile(value) or ""
    return str(filename).startswith(str(PROJECT_ROOT))


def _find_strategy(namespace):
    """The reader's Strategy class, preferring one defined in the open file."""
    from sltp import Strategy

    found = [
        value
        for value in namespace.values()
        if _is_project_class(value)
        and value is not Strategy
        and issubclass(value, Strategy)
    ]
    for value in reversed(found):
        if value.__module__ == "__main__":
            return value
    return found[-1] if found else None


def _default_start():
    from datetime import date, timedelta

    return (date.today() - timedelta(days=730)).isoformat()


def _status(text):
    # The callback is registered as a JS module. It used to be read with a
    # from-js import, but pyodide.globals is not the JS module
    # namespace, so that import always failed and the error was swallowed:
    # every stage message was lost and the page stayed on its first label for
    # the whole run.
    try:
        from lab_bridge import status

        status(text)
        return
    except Exception:
        pass
    try:
        from js import lab_status

        lab_status(text)
    except Exception:
        pass


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


def _chart_svg(result, payload):
    # The same static SVG the CLI writes, built from the equity already in the
    # payload so the benchmark is not run a second time.
    try:
        from sltp.graphs import ChartSeries, equity_chart

        equity = payload.get("equity") or []
        if not equity:
            return None
        name = payload.get("strategy_name") or "Strategy"
        series = [ChartSeries.from_equity(name, result.get("equity") or [])]
        benchmark = [
            {"date": point["date"], "portfolio_value": point["value"]}
            for point in payload.get("benchmark") or []
        ]
        if benchmark:
            series.append(
                ChartSeries.from_equity("Buy & Hold (SPY)", benchmark, color="#9aa3b2")
            )
        first = str(equity[0]["date"])
        last = str(equity[-1]["date"])
        return equity_chart(
            series,
            title=name,
            subtitle=f"{first} → {last} · {len(equity)} sessions · index starts at 100",
            start_value=100.0,
        )
    except Exception:
        return None


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
    # The chart source leads the object, so the download opens on it and the
    # rest of the result follows unchanged.
    return {"svg": _chart_svg(result, payload), **payload}


def run_project(filename, files, settings_json="{}"):
    # Settings arrive as a JSON string so null/true mean the same thing here
    # as they do in the message from the page.
    settings = json.loads(settings_json) if settings_json else {}
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
    _status("Running your code…")
    try:
        exec(compile(source, absolute, "exec"), namespace)
    except Exception as exc:
        return json.dumps({"ok": False, "error": _format_error(exc)})

    # A script may still carry the old explicit Backtester call. Use that if
    # it exists; otherwise the reader only wrote a Strategy and the engine
    # supplies the Backtester, dates and run for them.
    result = _find_result(namespace)
    auto_run = result is None
    run_start = None
    run_end = None
    if result is None:
        strategy_class = _find_strategy(namespace)
        if strategy_class is None:
            return json.dumps({
                "ok": True,
                "result": None,
                "notice": "No Strategy subclass was found. Define a class that inherits from sltp.Strategy, then run again.",
            })
        run_start = str(settings.get("start") or _default_start())
        run_end = settings.get("end") or None
        _status("Running the strategy…")
        try:
            from sltp import Backtester

            participation = settings.get("max_participation")
            backtester = Backtester(
                strategy_class(),
                run_start,
                run_end,
                bool(settings.get("dividends", True)),
                spread_pct=float(settings.get("spread_pct") or 0.0),
                max_participation=None if participation is None else float(participation),
                borrow_rate=float(settings.get("borrow_rate") or 0.0),
            )
            # Fees and slippage live on the book, not the Backtester signature.
            if settings.get("fee_rate") is not None:
                backtester.manager.FEE_RATE = float(settings["fee_rate"])
            if settings.get("slippage_pct") is not None:
                backtester.manager.SLIPPAGE_PCT = float(settings["slippage_pct"])
            result = backtester.run()
        except Exception as exc:
            return json.dumps({"ok": False, "error": _format_error(exc)})

    _status("Building the report…")
    try:
        payload = _payload(result, namespace)
        payload["run"] = {
            "auto": auto_run,
            "start": run_start or _default_start(),
            "end": run_end,
        }
        return json.dumps({"ok": True, "result": payload})
    except Exception:
        # The backtest ran; only the rich result could not be serialized.
        # Keep the log useful instead of turning a success into an error.
        return json.dumps({
            "ok": False,
            "error": "The strategy ran but its result could not be prepared for the report.",
        })


def reset_project():
    _clear_project_modules()
    if PROJECT_ROOT.exists():
        shutil.rmtree(PROJECT_ROOT)
    return "cleared"

import json
import sys
from pathlib import Path

ANALYZE_ROOT = Path("/home/pyodide/analyze")


def _diagnose(code, path):
    class _Report:
        def __init__(self):
            self.items = []

        def flake(self, message):
            # str(message) leads with the temporary path the code is analysed
            # under, which means nothing to the reader; the template does not.
            template = getattr(message, "message", None)
            args = getattr(message, "message_args", ()) or ()
            text = template % args if template else str(message)
            # A name that does not exist is an error; a tidy-up is a warning.
            kind = type(message).__name__
            self.items.append({
                "line": getattr(message, "lineno", 1) or 1,
                "column": getattr(message, "col_offset", 0) or 0,
                "message": text,
                "severity": 1 if kind.startswith("Undefined") else 2,
            })

        def unexpectedError(self, filename, msg):
            self.items.append({"line": 1, "column": 0, "message": str(msg), "severity": 1})

        def syntaxError(self, filename, msg, lineno, offset, text):
            self.items.append({
                "line": lineno or 1,
                "column": max((offset or 1) - 1, 0),
                "message": str(msg),
                "severity": 1,
            })

    report = _Report()
    try:
        import pyflakes.api as _api

        _api.check(code, path, report)
    except Exception as exc:  # noqa: BLE001 - the reader gets the reason, not a crash
        return {"items": [{"line": 1, "column": 0, "message": str(exc), "severity": 1}]}
    return {"items": report.items}



def _import_candidates(code, line, column, files_json):
    """Names the reader has not imported yet, with the line that imports them."""
    import ast
    import re

    lines = code.splitlines()
    if line - 1 >= len(lines):
        return []
    word = re.search(r"[A-Za-z_][A-Za-z0-9_]*$", lines[line - 1][:column])
    if not word:
        return []
    prefix = word.group(0)

    found = {}
    try:
        import sltp

        for name in getattr(sltp, "__all__", None) or []:
            if name.startswith("_") or not name.startswith(prefix):
                continue
            value = getattr(sltp, name, None)
            found[name] = {
                "label": name,
                "kind": "class" if isinstance(value, type) else "function" if callable(value) else "statement",
                "detail": getattr(value, "__module__", None) or "sltp",
                "statement": f"from sltp import {name}",
            }
    except Exception:  # noqa: BLE001
        pass

    for name, content in (json.loads(files_json) if files_json else {}).items():
        stem = name.rsplit("/", 1)[-1].removesuffix(".py")
        if stem == "sltp" or stem.startswith("_"):
            continue
        try:
            tree = ast.parse(content)
        except SyntaxError:
            continue
        for node in tree.body:
            if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                continue
            if node.name.startswith("_") or not node.name.startswith(prefix):
                continue
            found.setdefault(
                node.name,
                {
                    "label": node.name,
                    "kind": "class" if isinstance(node, ast.ClassDef) else "function",
                    "detail": name,
                    "statement": f"from {stem} import {node.name}",
                },
            )
    return list(found.values())


def _module_members(code, line, column):
    """What a module exports, for "from x import" and "x.".

    jedi reads source statically, so a package that resolves its public names
    lazily looks like it holds nothing but submodules. sltp does exactly that
    through __getattr__, which is why "from sltp import" offered data and web
    but not Strategy. Asking the package for its own __all__ is both shorter
    and always right, and it fixes every lazily-exported module at once.
    """
    import re

    lines = code.splitlines()
    if line - 1 >= len(lines):
        return []
    head = lines[line - 1][:column]
    match = re.search(r"from +([A-Za-z_][A-Za-z0-9_.]*) +import +([A-Za-z_][A-Za-z0-9_]*)?$", head)
    if match:
        module_name, typed = match.group(1), match.group(2) or ""
    else:
        match = re.search(r"([A-Za-z_][A-Za-z0-9_.]*)[.]([A-Za-z_][A-Za-z0-9_]*)?$", head)
        if not match:
            return []
        module_name, typed = match.group(1), match.group(2) or ""

    import importlib

    try:
        module = importlib.import_module(module_name)
    except Exception:  # noqa: BLE001 - not a module, so nothing to add
        return []

    exported = list(getattr(module, "__all__", None) or [n for n in dir(module) if not n.startswith("_")])
    items = []
    for name in exported:
        if not isinstance(name, str) or not name.startswith(typed):
            continue
        try:
            value = getattr(module, name)
        except Exception:  # noqa: BLE001 - a broken export costs its own entry only
            continue
        if isinstance(value, type):
            kind = "class"
        elif callable(value):
            kind = "function"
        else:
            kind = "statement"
        items.append({
            "label": name,
            "insertText": name,
            "kind": kind,
            "detail": getattr(value, "__module__", None) or module_name,
            "documentation": None,
        })
    return items


def analyze(method, code, path, line, column, files_json=""):
    files = json.loads(files_json) if files_json else {}
    for name, content in files.items():
        target = ANALYZE_ROOT / name
        target.parent.mkdir(parents=True, exist_ok=True)
        try:
            target.write_text(content, encoding="utf-8")
        except OSError:
            pass

    current = ANALYZE_ROOT / path
    current.parent.mkdir(parents=True, exist_ok=True)
    current.write_text(code, encoding="utf-8")
    root = str(ANALYZE_ROOT)
    if root not in sys.path:
        sys.path.insert(0, root)

    if method == "diagnostics":
        return json.dumps({"ok": True, "data": _diagnose(code, str(current))})

    if method == "imports":
        return json.dumps({"ok": True, "data": {"items": _import_candidates(code, line, column, files_json)}})

    try:
        import jedi
    except Exception as exc:  # noqa: BLE001
        return json.dumps({"ok": False, "error": "jedi is unavailable: " + str(exc)})

    try:
        project = jedi.Project(root)
        script = jedi.Script(code=code, path=str(current), project=project)

        if method == "complete":
            found = []
            seen = set()
            for item in script.complete(line, column):
                # jedi can offer the same name from more than one inference
                # path; one row per name is what a reader expects.
                if item.name in seen:
                    continue
                seen.add(item.name)
                found.append(
                    {
                        "label": item.name,
                        "insertText": item.name,
                        "kind": item.type,
                        "detail": item.description,
                        "documentation": item.docstring(),
                    }
                )
            for extra in _module_members(code, line, column):
                if extra["label"] not in seen:
                    seen.add(extra["label"])
                    found.append(extra)
            return json.dumps({"ok": True, "data": {"items": found[:200]}})

        if method == "hover":
            names = script.infer(line, column)
            if not names:
                return json.dumps({"ok": True, "data": None})
            first = names[0]
            return json.dumps({
                "ok": True,
                "data": {
                    "name": first.name,
                    "type": first.type,
                    "description": first.description,
                    "doc": first.docstring(),
                },
            })

        if method == "signature":
            found = script.get_signatures(line, column)
            signatures = []
            active = 0
            for index, signature in enumerate(found[:10]):
                if index == 0:
                    active = getattr(signature, "index", 0) or 0
                signatures.append({
                    "label": signature.name,
                    "params": [param.to_string() for param in signature.params],
                    "doc": signature.docstring(),
                })
            return json.dumps({"ok": True, "data": {"signatures": signatures, "active": active}})

        if method == "define":
            found = script.get_definitions(line, column)
            if not found:
                return json.dumps({"ok": True, "data": None})
            first = found[0]
            relative = None
            module_path = getattr(first, "module_path", None)
            if module_path:
                try:
                    relative = str(Path(module_path).resolve().relative_to(ANALYZE_ROOT.resolve()))
                except Exception:  # noqa: BLE001 - installed packages are outside the project
                    relative = None
            return json.dumps({
                "ok": True,
                "data": {
                    "path": relative,
                    "external": module_path is not None and relative is None,
                    "line": first.line,
                    "column": first.column + 1,
                    "name": first.name,
                },
            })
    except Exception as exc:  # noqa: BLE001 - a failed query must not kill the worker
        return json.dumps({"ok": False, "error": str(exc)})

    return json.dumps({"ok": False, "error": "unknown method " + method})
`),l=t;let n=!1;try{f({type:`status`,text:`Linking the market cache…`});let e=await(await navigator.storage.getDirectory()).getDirectoryHandle(`sltp-market`,{create:!0});t.FS.mkdirTree(`/home/pyodide/.sltp/cache`),await t.mountNativeFS(`/home/pyodide/.sltp/cache`,e),n=!0}catch{}let r=!1,i=null,a=!1,o=null;try{f({type:`status`,text:`Installing numpy…`}),await t.loadPackage([`micropip`,`numpy`]),f({type:`status`,text:`Installing the trading engine…`});let n=t.pyimport(`micropip`),i=await h(t,n,`sltp`,`0.1.351`),a=await h(t,n,`python-dateutil`,`2.9.0`);await e([i.filename,a.filename].filter(e=>e!==null)),r=!0}catch(e){i=e instanceof Error?e.message:String(e)}if(r)try{f({type:`status`,text:`Preparing the analyser…`});let e=t.pyimport(`micropip`);await e.install(`jedi`),await e.install(`pyflakes`)}catch{}if(r)try{f({type:`status`,text:`Syncing market data…`}),t.runPython(`
def enable_browser_fetch():
    from sltp.data.remote import set_fetch

    # The package's default r2.dev base is private now; send its downloads
    # through the gate instead (the bars themselves come from the mounted
    # OPFS cache, so this only matters for metadata and a cold chunk).
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

def prime_market_cache():
    import os
    import shutil
    from pathlib import Path

    # Mirror the mounted chunks as links under an ordinary data dir first, so
    # the engine resolves every bar locally and never asks the network for a
    # file it already has.
    cache_root = Path("/home/pyodide/.sltp/cache")
    for source, target in (
        (cache_root / "MARKET_DAILY", Path("/data/market")),
        (cache_root / "SYMBOL_DATA", Path("/data/symbol_data")),
    ):
        target.mkdir(parents=True, exist_ok=True)
        if source.is_dir():
            for cached in source.glob("*.parquet"):
                link = target / cached.name
                if not link.exists():
                    os.symlink(cached, link)
    os.environ["SLTP_DATA_DIR"] = "/data"

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
`),t.globals.get(`enable_browser_fetch`)(),await Promise.resolve(t.globals.get(`prime_market_cache`)()),a=!0}catch(e){o=e instanceof Error?e.message:String(e)}t.registerJsModule(`lab_bridge`,{status:e=>{u&&f({type:`run-status`,id:u,text:String(e)})}}),f({type:`ready`,version:String(t.runPython(`python_version`)),engine:r,market:a,warning:i??o,cache:n})}self.onmessage=async e=>{let t=e.data;try{if(t.kind===`init`){await g();return}if(!l)throw Error(`Python is not ready yet`);if(t.kind===`reset`){l.runPython(`reset_project()`),f({type:`reset-ok`});return}if(t.kind===`analyze`){try{let e={};for(let n of t.files)e[n.name]=n.content;let n=String(await l.runPythonAsync(`analyze(${JSON.stringify(t.method)}, ${JSON.stringify(t.code)}, ${JSON.stringify(t.path)}, ${JSON.stringify(t.line)}, ${JSON.stringify(t.column)}, ${JSON.stringify(JSON.stringify(e))})`)),r=JSON.parse(n);f({type:`analyze-result`,id:t.id,ok:r.ok===!0,error:r.error,data:r.data??null})}catch(e){f({type:`analyze-result`,id:t.id,ok:!1,error:e instanceof Error?e.message:String(e)})}return}if(t.kind===`run`){u=t.id,d=[],f({type:`run-status`,id:t.id,text:`Preparing the workspace…`}),l.globals.set(`lab_status`,e=>{f({type:`run-status`,id:t.id,text:String(e)})});let e=performance.now(),n={};for(let e of t.files)n[e.name]=e.name===t.filename?t.code:e.content;try{let r=String(await l.runPythonAsync(`run_project(${JSON.stringify(t.filename)}, ${JSON.stringify(n)}, ${JSON.stringify(JSON.stringify(t.settings??{}))})`)),i;try{i=JSON.parse(r)}catch{i={ok:!1,error:r}}f({type:`done`,id:t.id,ok:i.ok===!0,message:i.error,notice:i.notice,result:i.result??null,logs:d,durationMs:performance.now()-e})}catch(n){f({type:`done`,id:t.id,ok:!1,message:n instanceof Error?n.message:String(n),logs:d,durationMs:performance.now()-e})}finally{u=0}}}catch(e){let n=e instanceof Error?e.message:String(e);if(t.kind===`init`){f({type:`boot-error`,message:n});return}f({type:`done`,id:t.id,ok:!1,message:n,durationMs:0})}}})();