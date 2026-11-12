"""Daily R2 upsert: newest Yahoo sessions straight into the tail file.

USAGE (from backend/):
  ../.venv/bin/python scripts/daily_r2_update.py   # cron/launchd runs this nightly

Reads manifest + catalog + MARKET_DAILY/market_data_recent.parquet, downloads
only the missing window (plus a 2-session buffer) for active/lagging tickers,
merges with dedup keep-last, tops up the actions sidecar with the window's
dividends/splits when the window held any, and makes three writes plus the
sidecar when it changed:

  1. MARKET_DAILY/market_data_recent.parquet (snappy, same schema)
  2. MARKET_DAILY/market_actions.parquet (only when payouts occurred)
  3. META/manifest.json (entry bytes/rows/last_session + version)
  4. META/version.txt (same version string)

Yearly chore (run each January after the year settles):
  ../.venv/bin/python scripts/daily_r2_update.py --fold-year 2026
moves the tail's rows from that completed calendar year into
MARKET_DAILY/market_data_2026.parquet (same schema, exactly one row
group), rewrites the tail with only the remaining rows, and updates both
manifest entries plus the version. Without the fold the tail grows a full
year of overlap; with it the tail stays small.

Stdlib SigV4 for R2; yfinance + pandas + pyarrow for data. Idempotent.
"""

import io
import json
import sys
import traceback
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import yfinance as yf
from sltp.utils.Dates import EPOCH_ORDINAL, register

sys.path.insert(0, str(Path(__file__).resolve().parent))  # sibling r2.py
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # app.notify

from app.notify.mailer import admin_recipient, ops_failure_email
from r2 import s3 as _s3

TAIL_KEY = "MARKET_DAILY/market_data_recent.parquet"
ACTIONS_KEY = "MARKET_DAILY/market_actions.parquet"
CATALOG_KEY = "SYMBOL_DATA/symbol_catalog.parquet"
MANIFEST_KEY = "META/manifest.json"
VERSION_KEY = "META/version.txt"
BATCH = 400  # server peak-RAM rule: never one call with >500 tickers


# R2 transport lives in sibling r2.py (imported above as _s3, so older
# callers keep working). It carries the XML error body on 4xx, which is
# what proved the last 403 was the secret, not the signing code.


def _code_to_date(code: int) -> str:
    return date.fromordinal(int(code) + EPOCH_ORDINAL).isoformat()


def _yahoo_symbol(symbol: str) -> str:
    """Download spelling for one catalog symbol.

    Yahoo wants US class shares hyphenated (BRK-A) but Canadian listings
    keep the dot suffix (XEQT.TO). Storage always uses the catalog
    spelling — this mapping lives at the download boundary only, because
    renaming stored tickers would fork twenty years of bars."""
    if symbol.endswith(".TO"):
        return symbol
    return symbol.replace(".", "-")


def main() -> int:
    manifest = json.loads(_s3("GET", MANIFEST_KEY).decode())
    entry = next(e for e in manifest["files"] if e["key"] == TAIL_KEY)
    old_last = entry["last_session"]
    print(f"tail on R2: {entry['first_session']} -> {old_last}, {entry['rows']} rows", flush=True)

    catalog = pd.read_parquet("/tmp/catalog.parquet") if Path("/tmp/catalog.parquet").is_file() \
        else pd.read_parquet(io.BytesIO(_s3("GET", CATALOG_KEY)))
    tradable = catalog[catalog["Status"].isin(("active", "lagging"))]
    symbols: list[str] = tradable["Symbol"].tolist()
    names = dict(zip(tradable["Symbol"], tradable["Name"]))
    print(f"universe: {len(symbols)} symbols (active+lagging)", flush=True)

    # Missing window with a 2-session buffer so a partial day heals itself.
    start = (date.fromisoformat(old_last) - timedelta(days=4)).isoformat()
    end = (date.today() + timedelta(days=1)).isoformat()
    print(f"window: {start} -> {end}", flush=True)

    frames: list[pd.DataFrame] = []
    action_frames: list[pd.DataFrame] = []
    for i in range(0, len(symbols), BATCH):
        chunk = symbols[i:i + BATCH]
        # Several catalog spellings can share one Yahoo download (the catalog
        # holds both BRK.B and BRK-B): fetch each spelling once, fan the bars
        # out to every catalog symbol that maps to it. Storage keeps the
        # catalog spelling, so no series ever forks or merges.
        want: dict[str, list[str]] = {}
        for s in chunk:
            want.setdefault(_yahoo_symbol(s), []).append(s)
        dl = list(want)
        df = yf.download(dl, start=start, end=end, group_by="column",
                         auto_adjust=False, actions=True, progress=False, threads=True)
        if df is None or df.empty:
            continue
        for dl_sym in dl:
            try:
                sub = df.xs(dl_sym, axis=1, level=1)
            except KeyError:
                continue
            sub = sub[sub["Close"].notna()]
            if sub.empty:
                continue
            idx = sub.index.tz_localize(None) if sub.index.tz is not None else sub.index
            bars = pd.DataFrame({
                "Date": register(idx.strftime("%Y-%m-%d").to_numpy()),
                "Open": sub["Open"].to_numpy(dtype="float32"),
                "High": sub["High"].to_numpy(dtype="float32"),
                "Low": sub["Low"].to_numpy(dtype="float32"),
                "Close": sub["Close"].to_numpy(dtype="float32"),
                "Volume": sub["Volume"].to_numpy(dtype="float32"),
            })
            for ticker in want[dl_sym]:
                frame = bars.copy()
                frame["Symbol"] = ticker
                frame["Name"] = names.get(ticker, ticker)
                frames.append(frame[["Symbol", "Name", "Date", "Open",
                                      "High", "Low", "Close", "Volume"]])
            # Payouts ride in the same download (actions=True above): ex-date
            # cash (Kind 1) and split ratios (Kind 0), stored under the
            # catalog spelling like the bars.
            adates = register(idx.strftime("%Y-%m-%d").to_numpy())
            for kind, col in ((1, "Dividends"), (0, "Stock Splits")):
                nz = sub[col].fillna(0).to_numpy() != 0
                if not nz.any():
                    continue
                amounts = sub[col].to_numpy(dtype="float64")[nz]
                for ticker in want[dl_sym]:
                    action_frames.append(pd.DataFrame({
                        "Symbol": ticker,
                        "Date": adates[nz],
                        "Kind": kind,
                        "Amount": amounts,
                    }))
        print(f"  batch {i // BATCH + 1}/{(len(symbols) + BATCH - 1) // BATCH}: {len(frames)} blocks", flush=True)

    if not frames:
        print("no new bars — R2 already current, nothing written.")
        return 0
    new = pd.concat(frames, ignore_index=True)
    new["Date"] = new["Date"].astype("int32")
    new_max = _code_to_date(int(new["Date"].max()))
    if new_max <= old_last:
        print(f"no sessions newer than {old_last} — nothing written.")
        return 0
    print(f"downloaded sessions through {new_max}", flush=True)

    old = pd.read_parquet(io.BytesIO(_s3("GET", TAIL_KEY)))
    merged = (pd.concat([old, new], ignore_index=True)
              .drop_duplicates(subset=["Symbol", "Date"], keep="last")
              .sort_values(["Symbol", "Date"])
              .reset_index(drop=True))
    merged["Date"] = merged["Date"].astype("int32")
    for col in ("Open", "High", "Low", "Close", "Volume"):
        merged[col] = merged[col].astype("float32")
    added = [s for s in sorted(new["Date"].map(_code_to_date).unique()) if s > old_last]
    print(f"tail {len(old)} -> {len(merged)} rows; new sessions: {added}", flush=True)
    print("spot check:\n" + merged[merged["Symbol"] == "AAPL"].tail(3).to_string(), flush=True)

    buf = io.BytesIO()
    merged.to_parquet(buf, engine="pyarrow", compression="snappy", index=False)
    blob = buf.getvalue()

    import pyarrow.parquet as pq
    check = pq.ParquetFile(io.BytesIO(blob))
    comps = {check.metadata.row_group(r).column(c).compression
             for r in range(check.metadata.num_row_groups)
             for c in range(check.metadata.row_group(r).num_columns)}
    assert comps == {"SNAPPY"}, f"unexpected compression: {comps}"
    assert str(check.schema_arrow.field("Date").type) == "int32"
    assert [str(check.schema_arrow.field(c).type) for c in ("Open", "Close", "Volume")] == ["float", "float", "float"]
    print(f"write check: {len(blob)} bytes, snappy, schema OK", flush=True)

    _s3("PUT", TAIL_KEY, blob)  # write 1: the file
    entry["bytes"] = len(blob)
    entry["rows"] = len(merged)
    entry["first_session"] = _code_to_date(int(merged["Date"].min()))
    entry["last_session"] = new_max
    entry["row_groups"] = check.num_row_groups
    if action_frames:
        anew = pd.concat(action_frames, ignore_index=True)
        anew["Date"] = anew["Date"].astype("int32")
        aold = pd.read_parquet(io.BytesIO(_s3("GET", ACTIONS_KEY)))
        for col in ("Kind", "Amount"):
            anew[col] = anew[col].astype(aold[col].dtype)
        amerged = (pd.concat([aold, anew], ignore_index=True)
                   .drop_duplicates(subset=["Symbol", "Date", "Kind"], keep="last")
                   .sort_values(["Symbol", "Date", "Kind"])
                   .reset_index(drop=True))
        abuf = io.BytesIO()
        amerged.to_parquet(abuf, engine="pyarrow", compression="snappy", index=False)
        ablob = abuf.getvalue()
        _s3("PUT", ACTIONS_KEY, ablob)  # write 2: the sidecar, when changed
        aentry = next(e for e in manifest["files"] if e["key"] == ACTIONS_KEY)
        aentry["bytes"] = len(ablob)
        aentry["rows"] = len(amerged)
        aentry["first_session"] = _code_to_date(int(amerged["Date"].min()))
        aentry["last_session"] = _code_to_date(int(amerged["Date"].max()))
        aentry["row_groups"] = pq.ParquetFile(io.BytesIO(ablob)).num_row_groups
        print(f"actions: {len(aold)} -> {len(amerged)} rows", flush=True)
    manifest["version"] = new_max
    _s3("PUT", MANIFEST_KEY, json.dumps(manifest, indent=1).encode())  # write 2: manifest
    _s3("PUT", VERSION_KEY, f"{new_max}\n".encode())  # write 3: version

    verify = json.loads(_s3("GET", MANIFEST_KEY).decode())
    ventry = next(e for e in verify["files"] if e["key"] == TAIL_KEY)
    vtext = _s3("GET", VERSION_KEY).decode().strip()
    assert verify["version"] == new_max == vtext, (verify["version"], vtext)
    assert ventry["bytes"] == len(blob) and ventry["last_session"] == new_max
    print(f"Done: version {vtext}, tail {ventry['first_session']} -> {ventry['last_session']}, "
          f"{ventry['rows']} rows, {ventry['bytes']} bytes. 3 writes total.", flush=True)
    return 0


# A nightly cron job fails unseen, so a crash mails the operator through
# mailer (the only module that sends mail). Best-effort: the alert never
# masks the original traceback or exit code.
def _alert_admin() -> None:
    try:
        to = admin_recipient()
        if not to:
            print("no admin address (set ADMIN_EMAIL or SENDER_EMAIL) — no alert sent.")
            return
        ok, err = ops_failure_email(to, "daily_r2_update", traceback.format_exc(limit=8))
        print(f"alert mailed to {to}" if ok else f"alert FAILED: {err}")
    except Exception as exc:  # alerting must not raise
        print(f"alert FAILED: {exc}")


def fold_year(year: int) -> int:
    """Move the tail's rows from one completed year into its year file.

    Refuses when the manifest has no market_data_<year>.parquet entry (the
    bucket has not flipped to year files yet). Enforces the year-file
    contract on the way out: column order, snappy, exactly one row group,
    rows sorted by (Symbol, Date) verified with a vectorized lexsort check.
    Four writes: year file, tail, manifest, version. Idempotent — a second
    run finds nothing to move and writes nothing.
    """
    import pyarrow.parquet as pq

    manifest = json.loads(_s3("GET", MANIFEST_KEY).decode())
    year_key = f"MARKET_DAILY/market_data_{year}.parquet"
    yentry = next((e for e in manifest["files"] if e["key"] == year_key), None)
    if yentry is None:
        print(f"no {year_key} in the manifest — the bucket has not flipped to year files yet.")
        return 2
    tentry = next(e for e in manifest["files"] if e["key"] == TAIL_KEY)

    ydf = pd.read_parquet(io.BytesIO(_s3("GET", year_key)))
    tdf = pd.read_parquet(io.BytesIO(_s3("GET", TAIL_KEY)))
    print(f"year file: {len(ydf)} rows; tail: {len(tdf)} rows", flush=True)

    start_code = int(register(np.array([f"{year}-01-01"]))[0])
    end_code = int(register(np.array([f"{year + 1}-01-01"]))[0])
    mask = (tdf["Date"] >= start_code) & (tdf["Date"] < end_code)
    moving, stay = tdf[mask], tdf[~mask]
    print(f"moving {len(moving)} rows from {year} out of the tail; {len(stay)} stay", flush=True)
    if moving.empty:
        print("nothing to fold.")
        return 0

    cols = ["Symbol", "Name", "Date", "Open", "High", "Low", "Close", "Volume"]
    merged = (pd.concat([ydf, moving], ignore_index=True)
              .drop_duplicates(subset=["Symbol", "Date"], keep="last")
              .sort_values(["Symbol", "Date"])
              .reset_index(drop=True))
    merged = merged[cols]
    merged["Date"] = merged["Date"].astype("int32")
    for col in ("Open", "High", "Low", "Close", "Volume"):
        merged[col] = merged[col].astype("float32")
    sym_codes = pd.factorize(merged["Symbol"])[0]
    order = np.lexsort((merged["Date"].to_numpy(), sym_codes))
    assert (order == np.arange(len(merged))).all(), "fold output is not sorted by (Symbol, Date)"

    ybuf = io.BytesIO()
    merged.to_parquet(ybuf, engine="pyarrow", compression="snappy", index=False,
                      row_group_size=len(merged))
    yblob = ybuf.getvalue()
    ycheck = pq.ParquetFile(io.BytesIO(yblob))
    yschema = ycheck.schema_arrow
    assert [f.name for f in yschema] == cols, "year file column order changed"
    assert str(yschema.field("Date").type) == "int32"
    # pandas writes object columns as large_string; both are Arrow strings.
    assert [str(yschema.field(c).type) for c in ("Symbol", "Name")] == ["large_string"] * 2
    assert [str(yschema.field(c).type) for c in ("Open", "Close", "Volume")] == ["float"] * 3
    ycomps = {ycheck.metadata.row_group(r).column(c).compression
              for r in range(ycheck.metadata.num_row_groups)
              for c in range(ycheck.metadata.row_group(r).num_columns)}
    assert ycomps == {"SNAPPY"}, f"unexpected compression: {ycomps}"
    assert ycheck.num_row_groups == 1, f"year file has {ycheck.num_row_groups} row groups, want 1"
    yfirst = _code_to_date(int(merged["Date"].min()))
    ylast = _code_to_date(int(merged["Date"].max()))
    assert yfirst[:4] == str(year) and ylast[:4] == str(year), (yfirst, ylast)
    print(f"year file {len(ydf)} -> {len(merged)} rows, {len(yblob)} bytes, 1 row group, "
          f"{yfirst} -> {ylast}", flush=True)

    stay = stay[cols].reset_index(drop=True)
    stay["Date"] = stay["Date"].astype("int32")
    for col in ("Open", "High", "Low", "Close", "Volume"):
        stay[col] = stay[col].astype("float32")
    tbuf = io.BytesIO()
    stay.to_parquet(tbuf, engine="pyarrow", compression="snappy", index=False)
    tblob = tbuf.getvalue()
    tgroups = pq.ParquetFile(io.BytesIO(tblob)).num_row_groups

    _s3("PUT", year_key, yblob)  # write 1: the year file
    _s3("PUT", TAIL_KEY, tblob)  # write 2: the tail
    yentry["bytes"] = len(yblob)
    yentry["rows"] = len(merged)
    yentry["first_session"] = yfirst
    yentry["last_session"] = ylast
    yentry["row_groups"] = 1
    tentry["bytes"] = len(tblob)
    tentry["rows"] = len(stay)
    tentry["first_session"] = _code_to_date(int(stay["Date"].min())) if len(stay) else None
    tentry["last_session"] = _code_to_date(int(stay["Date"].max())) if len(stay) else None
    tentry["row_groups"] = tgroups
    today = date.today().isoformat()
    manifest["version"] = today
    _s3("PUT", MANIFEST_KEY, json.dumps(manifest, indent=1).encode())  # write 3: manifest
    _s3("PUT", VERSION_KEY, f"{today}\n".encode())  # write 4: version

    verify = json.loads(_s3("GET", MANIFEST_KEY).decode())
    vyentry = next(e for e in verify["files"] if e["key"] == year_key)
    ventry = next(e for e in verify["files"] if e["key"] == TAIL_KEY)
    vtext = _s3("GET", VERSION_KEY).decode().strip()
    assert verify["version"] == today == vtext, (verify["version"], vtext)
    assert vyentry["bytes"] == len(yblob) and vyentry["last_session"] == ylast
    assert ventry["bytes"] == len(tblob)
    print(f"Done: version {vtext}, {year_key} {len(merged)} rows, "
          f"tail {len(stay)} rows. 4 writes total.", flush=True)
    return 0


if __name__ == "__main__":
    if "--fold-year" in sys.argv:
        pos = sys.argv.index("--fold-year")
        try:
            fold_target = int(sys.argv[pos + 1])
        except (IndexError, ValueError):
            print("usage: daily_r2_update.py [--fold-year YYYY]")
            sys.exit(2)
        try:
            sys.exit(fold_year(fold_target))
        except Exception:
            _alert_admin()
            raise
    try:
        sys.exit(main())
    except Exception:
        _alert_admin()
        raise
