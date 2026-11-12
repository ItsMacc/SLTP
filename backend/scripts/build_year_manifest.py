# build_year_manifest.py — one-shot: stage the year-file R2 flip.
#
# Reads the 29 local market_data_YYYY.parquet files plus the live remote
# manifest (for the catalog/actions/recent entries, which are NOT
# re-uploaded), and writes the META/manifest.json + META/version.txt the
# flip needs. Row counts and sessions come from parquet footers — no bar
# is decoded. Re-run at flip time so bytes/rows/version are fresh, then
# upload the two files (or hand them to someone with the R2 console).
#
# USAGE (from backend/):
#   ../.venv/bin/python scripts/build_year_manifest.py [--out DIR]
#
# Upload order matters, and the manifest flip is the atomic step:
#   1. PUT the 29 year files (invisible to every reader until step 3).
#   2. Backtest against the new bucket with a year-aware engine.
#   3. PUT META/manifest.json + META/version.txt (the flip).
#   4. After one successful end-to-end run, delete market_data_*_*.

import io
import json
import sys
from datetime import date
from pathlib import Path

import pyarrow.parquet as pq

sys.path.insert(0, str(Path(__file__).resolve().parent))  # sibling r2.py

from r2 import s3
from sltp.utils.Dates import EPOCH_ORDINAL

CACHE_DIR = Path.home() / ".sltp" / "cache" / "MARKET_DAILY"
MANIFEST_KEY = "META/manifest.json"
TAIL_KEY = "MARKET_DAILY/market_data_recent.parquet"
ACTIONS_KEY = "MARKET_DAILY/market_actions.parquet"
CATALOG_KEY = "SYMBOL_DATA/symbol_catalog.parquet"


def _session(code: int) -> str:
    return date.fromordinal(int(code) + EPOCH_ORDINAL).isoformat()


def main() -> int:
    out = Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else Path("/tmp/r2_year_flip")
    out.mkdir(parents=True, exist_ok=True)

    remote = json.loads(s3("GET", MANIFEST_KEY).decode())
    keep = {e["key"]: e for e in remote["files"] if e["key"] in (TAIL_KEY, ACTIONS_KEY, CATALOG_KEY)}
    missing = {TAIL_KEY, ACTIONS_KEY, CATALOG_KEY} - set(keep)
    if missing:
        print(f"live manifest is missing sidecars: {sorted(missing)}")
        return 2

    files = [keep[CATALOG_KEY]]
    total_rows = 0
    for year in range(1998, 2027):
        path = CACHE_DIR / f"market_data_{year}.parquet"
        if not path.is_file():
            print(f"missing local file: {path}")
            return 2
        meta = pq.ParquetFile(path).metadata
        di = pq.ParquetFile(path).schema_arrow.get_field_index("Date")
        stats = meta.row_group(0).column(di).statistics
        first, last = _session(stats.min), _session(stats.max)
        entry = {
            "key": f"MARKET_DAILY/market_data_{year}.parquet",
            "bytes": path.stat().st_size,
            "rows": meta.num_rows,
            "first_session": first,
            "last_session": last,
            "row_groups": meta.num_row_groups,
        }
        assert first[:4] == str(year) and last[:4] == str(year), (path, first, last)
        assert meta.num_row_groups == 1, (path, meta.num_row_groups)
        assert meta.num_rows > 0, path
        total_rows += meta.num_rows
        files.append(entry)
    files += [keep[TAIL_KEY], keep[ACTIONS_KEY]]

    version = date.today().isoformat()
    manifest = {"version": version, "files": files}
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1) + "\n", encoding="utf-8")
    (out / "version.txt").write_text(version + "\n", encoding="utf-8")
    tail = keep[TAIL_KEY]
    print(f"29 year files, {total_rows:,} rows total")
    print(f"tail carried over: {tail['first_session']} -> {tail['last_session']}, {tail['rows']} rows")
    print(f"version: {version}")
    print(f"wrote {out / 'manifest.json'} and {out / 'version.txt'}")
    print("NOT uploaded. Flip only with a year-aware engine (see header).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
