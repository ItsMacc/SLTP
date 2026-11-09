"""One-off repair: re-stamp manifest entries to match the actual R2 objects.

The ghost run rewrote the 5 year chunks + actions but PUT a manifest with stale
sizes. This script downloads each data file, reads true bytes/rows/row-groups/
session range from the object itself, updates the entries in place, and PUTs
the manifest once. Version is untouched (data vintage did not change).
"""

import hashlib
import hmac
import io
import json
import os
import sys
import time
import urllib.error
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

import pyarrow.parquet as pq

EPOCH_ORDINAL = date(1970, 1, 1).toordinal()
MANIFEST_KEY = "META/manifest.json"


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
        headers["content-type"] = "application/json"
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
            with urlopen(req, timeout=600) as resp:
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
    print(f"manifest version: {manifest['version']}", flush=True)
    changed = False
    for entry in manifest["files"]:
        key = entry["key"]
        if key == "SYMBOL_DATA/symbol_catalog.parquet":
            print(f"skip {key} (untouched, bytes match)", flush=True)
            continue
        print(f"GET {key} ...", flush=True)
        blob = _s3("GET", key)
        f = pq.ParquetFile(io.BytesIO(blob))
        dates = f.read(columns=["Date"]).column("Date").to_pylist()
        first, last = _code_to_date(min(dates)), _code_to_date(max(dates))
        new = {"bytes": len(blob), "rows": f.metadata.num_rows,
               "row_groups": f.metadata.num_row_groups,
               "first_session": first, "last_session": last}
        old = {k: entry.get(k) for k in new}
        print(f"  old: {old}\n  new: {new}", flush=True)
        if old != new:
            entry.update(new)
            changed = True
    if not changed:
        print("manifest already matches — nothing written.")
        return 0
    _s3("PUT", MANIFEST_KEY, json.dumps(manifest, indent=1).encode())
    verify = json.loads(_s3("GET", MANIFEST_KEY).decode())
    assert verify == manifest, "manifest re-read differs from what was written"
    print(f"Done: manifest re-stamped at version {verify['version']}, re-read matches.", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
