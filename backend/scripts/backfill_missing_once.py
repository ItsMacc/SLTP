"""ONE-TIME backfill: populate the symbols the daily updater never fetched.

Background: the universe holds 40 symbols with Status 'missing' and zero bars
— 38 Canadian listings (.TO, never in the download universe) plus 2 dead
tickers. The daily updater only tops up the tail file for active/lagging
symbols, so these gaps never heal on their own. This script downloads their
FULL history once, buckets rows into the era file whose session range owns
them (tail included), flips populated symbols to active, marks the truly
dead ones stopped, and bumps the manifest version so clients pick it up.

Run AFTER fixing the R2 keys, BEFORE the next fixed daily run. Delete after
one successful run — the wired daily updater owns these symbols from then on.

USAGE (from backend/):
  ../.venv/bin/python scripts/backfill_missing_once.py              # bars pass
  ../.venv/bin/python scripts/backfill_missing_once.py --actions-only  # payouts pass
(The 22 US class-share symbols from the spelling bug are NOT targets here:
the fixed daily run's 4-day overlap window re-downloads and merges their few
missing sessions by itself.)
"""

import io
import json
import sys
from datetime import date, timedelta

import numpy as np
import pandas as pd
import pyarrow.parquet as pq
import yfinance as yf

import daily_r2_update as up

ACTIONS_KEY = "MARKET_DAILY/market_actions.parquet"
CATALOG_KEY = "SYMBOL_DATA/symbol_catalog.parquet"
MANIFEST_KEY = "META/manifest.json"
VERSION_KEY = "META/version.txt"


def main() -> int:
    manifest = json.loads(up._s3("GET", MANIFEST_KEY).decode())
    catalog = pd.read_parquet(io.BytesIO(up._s3("GET", CATALOG_KEY)))
    actions_only = "--actions-only" in sys.argv[1:]
    if actions_only:
        print("actions-only mode: bars already backfilled, skipping to payouts…",
              flush=True)
    targets = catalog[catalog["Status"] == "missing"]
    print(f"missing-status symbols: {len(targets)}", flush=True)
    if targets.empty and not actions_only:
        print("nothing to backfill.")
        return 0

    symbols: list[str] = [] if actions_only else targets["Symbol"].tolist()
    names = dict(zip(targets["Symbol"], targets["Name"]))
    dl = [up._yahoo_symbol(s) for s in symbols]
    frames: dict[str, pd.DataFrame] = {}
    dead: list[str] = []
    if not symbols:
        df = None
    else:
        print(f"downloading full history for {len(dl)} spellings…", flush=True)
        df = yf.download(dl, period="max", group_by="column",
                         auto_adjust=False, actions=False, progress=False, threads=True)
        if df is None or df.empty:
            print("yahoo returned nothing — aborting, R2 untouched.")
            return 1
    for ticker, dl_sym in zip(symbols, dl):
        try:
            sub = df.xs(dl_sym, axis=1, level=1)
        except KeyError:
            dead.append(ticker)
            continue
        sub = sub[sub["Close"].notna()]
        if sub.empty:
            dead.append(ticker)
            continue
        idx = sub.index.tz_localize(None) if sub.index.tz is not None else sub.index
        frame = pd.DataFrame({
            "Symbol": ticker,
            "Name": names.get(ticker, ticker),
            "Date": up.register(idx.strftime("%Y-%m-%d").to_numpy()),
            "Open": sub["Open"].to_numpy(dtype="float32"),
            "High": sub["High"].to_numpy(dtype="float32"),
            "Low": sub["Low"].to_numpy(dtype="float32"),
            "Close": sub["Close"].to_numpy(dtype="float32"),
            "Volume": sub["Volume"].to_numpy(dtype="float32"),
        })
        frames[ticker] = frame[["Symbol", "Name", "Date", "Open",
                                "High", "Low", "Close", "Volume"]]
    print(f"served: {len(frames)}, dead: {sorted(dead)}", flush=True)

    # Bar chunks only: the MARKET_DAILY/ prefix also matches the actions
    # sidecar (Symbol/Date/Kind/Amount — splits and dividends, not bars).
    bars = [e for e in manifest["files"]
            if e["key"].startswith("MARKET_DAILY/market_data_")]
    bars.sort(key=lambda e: e["first_session"])
    lo = {e["key"]: (date.fromisoformat(e["first_session"]).toordinal()
                     - up.EPOCH_ORDINAL) for e in bars}
    hi = {e["key"]: (date.fromisoformat(e["last_session"]).toordinal()
                     - up.EPOCH_ORDINAL) for e in bars}
    tail_key = bars[-1]["key"]

    # Every new row must land in exactly one file. Rows newer than the tail
    # extend it; rows older than the oldest file (e.g. Barrick back into the
    # 90s, before the universe's 1998 cutoff) extend the oldest chunk instead
    # of being dropped. A session in a gap *between* files is a loud abort,
    # never a silent drop.
    assignments: dict[str, list[pd.DataFrame]] = {e["key"]: [] for e in bars}
    oldest_key = bars[0]["key"]
    for ticker, frame in frames.items():
        codes = frame["Date"].to_numpy()
        assigned = np.zeros(len(frame), dtype=bool)
        for e in bars:
            key = e["key"]
            mask = (codes >= lo[key]) & (codes <= hi[key])
            if key == tail_key:
                mask = mask | (codes > hi[key])
            if mask.any():
                assignments[key].append(frame[mask])
                assigned |= mask
        leftover = frame[~assigned]
        if not leftover.empty:
            if bool((leftover["Date"] < lo[oldest_key]).all()):
                assignments[oldest_key].append(leftover)
            else:
                raise RuntimeError(f"{ticker} has {len(leftover)} sessions in "
                                   f"a gap between files — aborting, R2 untouched.")
    touched: list[str] = []
    if frames:  # assignments are non-empty exactly when frames is (assert above)
        for e in bars:
            if not assignments[e["key"]]:
                continue
            add = pd.concat(assignments[e["key"]], ignore_index=True)
            old = pd.read_parquet(io.BytesIO(up._s3("GET", e["key"])))
            if set(old.columns) != set(add.columns):
                raise RuntimeError(f"{e['key']} schema {list(old.columns)} != "
                                   f"backfill {list(add.columns)} — aborting.")
            add = add[old.columns]
            merged = (pd.concat([old, add], ignore_index=True)
                      .drop_duplicates(subset=["Symbol", "Date"], keep="last")
                      .sort_values(["Symbol", "Date"])
                      .reset_index(drop=True))
            merged["Date"] = merged["Date"].astype("int32")
            for col in ("Open", "High", "Low", "Close", "Volume"):
                merged[col] = merged[col].astype("float32")
            buf = io.BytesIO()
            merged.to_parquet(buf, engine="pyarrow", compression="snappy", index=False)
            blob = buf.getvalue()
            up._s3("PUT", e["key"], blob)
            e["bytes"] = len(blob)
            e["rows"] = len(merged)
            e["row_groups"] = pq.ParquetFile(io.BytesIO(blob)).num_row_groups
            e["first_session"] = up._code_to_date(int(merged["Date"].min()))
            e["last_session"] = up._code_to_date(int(merged["Date"].max()))
            touched.append(f"{e['key']}: +{len(merged) - len(old)} rows")
            print(f"  {e['key']}: {len(old)} -> {len(merged)} rows", flush=True)

    # Second pass, same symbols: full-history payouts. yfinance carries them
    # in the download (actions=True); Kind follows dictionary.json — 0 for
    # splits (ratio: 7.0 is 7-for-1, 0.1 is 1-for-10 reverse), 1 for cash
    # dividends per share. Dtypes are matched to the stored file, not
    # assumed, and split events print for an eyeball check (they're rare).
    if frames or actions_only:
        if actions_only:
            # Bars are done; find every tracked symbol that has no payout
            # rows yet. Old names with genuinely no payouts probe harmlessly
            # and write nothing; the catalog is left untouched in this mode.
            have_actions = set(pd.read_parquet(
                io.BytesIO(up._s3("GET", ACTIONS_KEY)))["Symbol"].unique())
            tracked = catalog[catalog["Status"].isin(("active", "lagging",
                                                          "missing"))]
            action_targets = sorted(set(tracked["Symbol"]) - have_actions)
            print(f"  {len(action_targets)} symbols without payout rows", flush=True)
        else:
            action_targets = list(frames)
        print("downloading full-history actions (dividends + splits)…", flush=True)
        adl = [up._yahoo_symbol(s) for s in action_targets]
        adf = yf.download(adl, period="max", group_by="column",
                          auto_adjust=False, actions=True,
                          progress=False, threads=True)
        action_rows: list[pd.DataFrame] = []
        splits_found: list[tuple[str, str, float]] = []
        for ticker in action_targets:
            dl_sym = up._yahoo_symbol(ticker)
            try:
                asub = adf.xs(dl_sym, axis=1, level=1)
            except KeyError:
                continue
            asub = asub[asub["Close"].notna()]
            if asub.empty:
                continue
            aidx = asub.index.tz_localize(None) if asub.index.tz is not None else asub.index
            adates = up.register(aidx.strftime("%Y-%m-%d").to_numpy())
            for kind, col in ((1, "Dividends"), (0, "Stock Splits")):
                nz = asub[col].fillna(0).to_numpy() != 0
                if not nz.any():
                    continue
                sel = asub[col].to_numpy(dtype="float64")[nz]
                action_rows.append(pd.DataFrame({
                    "Symbol": ticker,
                    "Date": adates[nz],
                    "Kind": kind,
                    "Amount": sel,
                }))
                if kind == 0:
                    for d, amt in zip(aidx[nz].strftime("%Y-%m-%d"), sel):
                        splits_found.append((ticker, d, float(amt)))
        print(f"  splits found: {splits_found or 'none'} — verify ratios", flush=True)
        if action_rows:
            anew = pd.concat(action_rows, ignore_index=True)
            anew["Date"] = anew["Date"].astype("int32")
            aold = pd.read_parquet(io.BytesIO(up._s3("GET", ACTIONS_KEY)))
            for col in ("Kind", "Amount"):
                anew[col] = anew[col].astype(aold[col].dtype)
            amerged = (pd.concat([aold, anew], ignore_index=True)
                       .drop_duplicates(subset=["Symbol", "Date", "Kind"],
                                        keep="last")
                       .sort_values(["Symbol", "Date", "Kind"])
                       .reset_index(drop=True))
            abuf = io.BytesIO()
            amerged.to_parquet(abuf, engine="pyarrow", compression="snappy",
                               index=False)
            ablob = abuf.getvalue()
            up._s3("PUT", ACTIONS_KEY, ablob)
            aentry = next(e for e in manifest["files"] if e["key"] == ACTIONS_KEY)
            aentry["bytes"] = len(ablob)
            aentry["rows"] = len(amerged)
            aentry["first_session"] = up._code_to_date(int(amerged["Date"].min()))
            aentry["last_session"] = up._code_to_date(int(amerged["Date"].max()))
            aentry["row_groups"] = pq.ParquetFile(io.BytesIO(ablob)).num_row_groups
            touched.append(f"{ACTIONS_KEY}: +{len(amerged) - len(aold)} rows")
            print(f"  actions: {len(aold)} -> {len(amerged)} rows", flush=True)

    # The catalog only changes when bars landed (full mode): bars populate
    # statuses/counts, the dead flip to stopped. Actions-only mode leaves it
    # alone — re-PUTting an identical file would just churn the manifest.
    today = date.today().isoformat()
    if not actions_only:
        for ticker, frame in frames.items():
            mask = catalog["Symbol"] == ticker
            catalog.loc[mask, "Status"] = "active"
            catalog.loc[mask, "Bars"] = len(frame)
            catalog.loc[mask, "FirstBar"] = up._code_to_date(int(frame["Date"].min()))
            catalog.loc[mask, "LastBar"] = up._code_to_date(int(frame["Date"].max()))
        for ticker in dead:
            mask = catalog["Symbol"] == ticker
            catalog.loc[mask, "Status"] = "stopped"
            catalog.loc[mask, "LastError"] = f"no bars returned on backfill {today}"
        buf = io.BytesIO()
        catalog.to_parquet(buf, engine="pyarrow", compression="snappy", index=False)
        blob = buf.getvalue()
        up._s3("PUT", CATALOG_KEY, blob)
        centry = next(e for e in manifest["files"] if e["key"] == CATALOG_KEY)
        centry["bytes"] = len(blob)
        centry["rows"] = len(catalog)
        centry["row_groups"] = pq.ParquetFile(io.BytesIO(blob)).num_row_groups

    if touched:
        # Bar data changed: bump the version so clients pick it up through
        # the existing wholesale-refresh path. (No touched files + only
        # status flips = no bump, nothing clients cache changed.)
        manifest["version"] = today
        up._s3("PUT", VERSION_KEY, f"{today}\n".encode())
    up._s3("PUT", MANIFEST_KEY, json.dumps(manifest, indent=1).encode())

    verify = json.loads(up._s3("GET", MANIFEST_KEY).decode())
    assert verify["version"] == manifest["version"]
    print(f"Done. files touched: {touched}", flush=True)
    print(f"activated: {sorted(frames)}, stopped: {sorted(dead)}", flush=True)
    print("version:", today, "— delete this script; the daily run owns it now.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
