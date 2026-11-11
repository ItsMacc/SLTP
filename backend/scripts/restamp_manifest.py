"""One-off repair: re-stamp manifest entries to match the actual R2 objects.

USAGE (from backend/, after the R2 keys work):
  ../.venv/bin/python scripts/restamp_manifest.py   # delete after one clean run

The ghost run rewrote the 5 year chunks + actions but PUT a manifest with stale
sizes. This script downloads each data file, reads true bytes/rows/row-groups/
session range from the object itself, updates the entries in place, and PUTs
the manifest once. Version is untouched (data vintage did not change).
"""

import io
import json
import sys
from datetime import date
from pathlib import Path

import pyarrow.parquet as pq

sys.path.insert(0, str(Path(__file__).resolve().parent))  # sibling r2.py

from r2 import s3 as _raw_s3

EPOCH_ORDINAL = date(1970, 1, 1).toordinal()
MANIFEST_KEY = "META/manifest.json"


# R2 transport lives in sibling r2.py. Era files are tens of megabytes,
# so this script keeps the old 600s socket timeout instead of the default.
def _s3(method: str, key: str, body: bytes | None = None) -> bytes:
    return _raw_s3(method, key, body, timeout=600)


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
