"""Daily R2 upsert: newest Yahoo sessions straight into the tail file.

Reads manifest + catalog + MARKET_DAILY/market_data_recent.parquet, downloads
only the missing window (plus a 2-session buffer) for active/lagging tickers,
merges with dedup keep-last, and makes exactly three writes:

  1. MARKET_DAILY/market_data_recent.parquet (snappy, same schema)
  2. META/manifest.json (entry bytes/rows/last_session + version)
  3. META/version.txt (same version string)

Stdlib SigV4 for R2; yfinance + pandas + pyarrow for data. Idempotent.
"""

import hashlib
import hmac
import json
import os
import sys
import time
import urllib.error
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.request import Request, urlopen

import numpy as np
import pandas as pd
import yfinance as yf
from sltp.utils.Dates import EPOCH_ORDINAL, register

TAIL_KEY = "MARKET_DAILY/market_data_recent.parquet"
CATALOG_KEY = "SYMBOL_DATA/symbol_catalog.parquet"
MANIFEST_KEY = "META/manifest.json"
VERSION_KEY = "META/version.txt"
BATCH = 400  # server peak-RAM rule: never one call with >500 tickers


def _load_dotenv() -> None:
    dotenv = Path(__file__).resolve().parent.parent.parent / ".env"
    if dotenv.is_file():
        for line in dotenv.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key, value = key.strip(), value.strip().strip("'\"")
            if key and key not in os.environ:
                os.environ[key] = value


_load_dotenv()
for _mine, _alts in (("R2_ACCESS_KEY_ID", ("CLOUDFLARE_ACCESS_KEY_ID",)),
                     ("R2_SECRET_ACCESS_KEY", ("CLOUDFLARE_SECRET_ACCESS_KEY",))):
    if _mine not in os.environ:
        for _alt in _alts:
            if os.environ.get(_alt):
                os.environ[_mine] = os.environ[_alt]
                break
_ENDPOINT = os.environ.get("CLOUDFLARE_URL", "").rstrip("/") or \
    f"https://{os.environ['CLOUDFLARE_ACCOUNT_ID']}.r2.cloudflarestorage.com"
_BUCKET = os.environ.get("R2_BUCKET", "sltp-market-data")
_HOST = _ENDPOINT.split("://", 1)[-1]


def _s3(method: str, key: str, body: bytes | None = None) -> bytes:
    key_id, secret = os.environ["R2_ACCESS_KEY_ID"], os.environ["R2_SECRET_ACCESS_KEY"]
    now = datetime.now(timezone.utc)
    stamp, datestamp = now.strftime("%Y%m%dT%H%M%SZ"), now.strftime("%Y%m%d")
    payload_hash = "UNSIGNED-PAYLOAD" if body is not None else hashlib.sha256(b"").hexdigest()
    headers = {"host": _HOST, "x-amz-content-sha256": payload_hash, "x-amz-date": stamp}
    if body is not None:
        headers["content-type"] = "application/octet-stream"
        headers["content-length"] = str(len(body))
    signed = ";".join(sorted(headers))
    canonical = "\n".join([method, f"/{_BUCKET}/{key}", "",
                            "\n".join(f"{k}:{headers[k]}" for k in sorted(headers)),
                            "", signed, payload_hash])
    scope = f"{datestamp}/auto/s3/aws4_request"
    to_sign = f"AWS4-HMAC-SHA256\n{stamp}\n{scope}\n{hashlib.sha256(canonical.encode()).hexdigest()}"

    def _sign(k: bytes, msg: str) -> bytes:
        return hmac.new(k, msg.encode(), hashlib.sha256).digest()

    sk = _sign(_sign(_sign(_sign(b"AWS4" + secret.encode(), datestamp), "auto"), "s3"), "aws4_request")
    headers["Authorization"] = (
        f"AWS4-HMAC-SHA256 Credential={key_id}/{scope}, "
        f"SignedHeaders={signed}, "
        f"Signature={hmac.new(sk, to_sign.encode(), hashlib.sha256).hexdigest()}")
    req = Request(f"https://{_HOST}/{_BUCKET}/{key}", data=body, headers=headers, method=method)
    last: BaseException | None = None
    for attempt in range(4):
        try:
            with urlopen(req, timeout=300) as resp:
                return resp.read()
        except urllib.error.HTTPError as e:
            if e.code is not None and 400 <= e.code < 500 and e.code != 429:
                raise
            last = e
        except Exception as e:
            last = e
        time.sleep(2 ** attempt)
    raise last  # type: ignore[misc]


def _code_to_date(code: int) -> str:
    return date.fromordinal(int(code) + EPOCH_ORDINAL).isoformat()


def main() -> int:
    manifest = json.loads(_s3("GET", MANIFEST_KEY).decode())
    entry = next(e for e in manifest["files"] if e["key"] == TAIL_KEY)
    old_last = entry["last_session"]
    print(f"tail on R2: {entry['first_session']} -> {old_last}, {entry['rows']} rows", flush=True)

    catalog = pd.read_parquet("/tmp/catalog.parquet") if Path("/tmp/catalog.parquet").is_file() \
        else pd.read_parquet(__import__("io").BytesIO(_s3("GET", CATALOG_KEY)))
    tradable = catalog[catalog["Status"].isin(("active", "lagging"))]
    symbols: list[str] = tradable["Symbol"].tolist()
    names = dict(zip(tradable["Symbol"], tradable["Name"]))
    print(f"universe: {len(symbols)} symbols (active+lagging)", flush=True)

    # Missing window with a 2-session buffer so a partial day heals itself.
    start = (date.fromisoformat(old_last) - timedelta(days=4)).isoformat()
    end = (date.today() + timedelta(days=1)).isoformat()
    print(f"window: {start} -> {end}", flush=True)

    frames: list[pd.DataFrame] = []
    for i in range(0, len(symbols), BATCH):
        chunk = symbols[i:i + BATCH]
        df = yf.download(chunk, start=start, end=end, group_by="column",
                         auto_adjust=False, actions=True, progress=False, threads=True)
        if df is None or df.empty:
            continue
        for ticker in chunk:
            try:
                sub = df.xs(ticker, axis=1, level=1)
            except KeyError:
                continue
            sub = sub[sub["Close"].notna()]
            if sub.empty:
                continue
            idx = sub.index.tz_localize(None) if sub.index.tz is not None else sub.index
            frames.append(pd.DataFrame({
                "Symbol": ticker,
                "Name": names.get(ticker, ticker),
                "Date": register(idx.strftime("%Y-%m-%d").to_numpy()),
                "Open": sub["Open"].to_numpy(dtype="float32"),
                "High": sub["High"].to_numpy(dtype="float32"),
                "Low": sub["Low"].to_numpy(dtype="float32"),
                "Close": sub["Close"].to_numpy(dtype="float32"),
                "Volume": sub["Volume"].to_numpy(dtype="float32"),
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

    old = pd.read_parquet(__import__("io").BytesIO(_s3("GET", TAIL_KEY)))
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

    import io
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


if __name__ == "__main__":
    sys.exit(main())
