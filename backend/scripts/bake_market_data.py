"""Bake market data into the Docker image.

Runs once at image build time, after `pip install -r requirements.txt`.
It uses the sltp package's own sync code against the public R2 bucket and
writes into the engine's default cache path, so at runtime the engine finds
local bars on its very first lookup and never downloads.

Usage:  python scripts/bake_market_data.py /app/.sltp/cache

Nothing here is sltp-specific beyond the import: if the package ever moves
its cache layout, this script follows it automatically.
"""

import sys

from pathlib import Path


def main() -> None:
    dest = Path(sys.argv[1] if len(sys.argv) > 1 else "/app/.sltp/cache")
    # Imported late so a missing/broken sltp install fails loudly here.
    from sltp.data.remote import (  # noqa: PLC0415
        read_manifest,
        read_remote_version,
        sync_actions,
        sync_bars,
        sync_catalog,
    )

    manifest = read_manifest()
    print(f"manifest: {len(manifest['files'])} files, version {manifest['version']}")
    sync_catalog(cache_root=dest)
    sync_actions(cache_root=dest)
    bars = sync_bars(None, None, cache_root=dest)
    print(f"baked {len(bars)} bar chunks + catalog + actions into {dest}")
    print(f"version: {read_remote_version()}")


if __name__ == "__main__":
    main()
