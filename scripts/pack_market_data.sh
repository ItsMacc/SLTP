#!/usr/bin/env bash
# -------- pack_market_data.sh --------
# Pack the bar files into one release asset so a runner can fetch them in a single
# request. The master file is 407 MB and the loader needs every file below, so they
# travel together and are versioned by the release tag.
#
#   scripts/pack_market_data.sh                    # build dist/market-data.tar.gz
#   scripts/pack_market_data.sh --upload           # build, then create the release asset
#   scripts/pack_market_data.sh --upload market-data-v2
#
# Requires the gh CLI and `gh auth login` for --upload.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${ROOT}/app/database"
OUT_DIR="${ROOT}/dist"
OUT="${OUT_DIR}/market-data.tar.gz"

# market_data_zstd_delta.parquet is deliberately absent: nothing reads it.
FILES=(
  "market/market_data.parquet"
  "market/market_data_recent.parquet"
  "market/market_actions.parquet"
  "symbol_data/symbols.parquet"
  "symbol_data/symbol_status.parquet"
)

for file in "${FILES[@]}"; do
  if [ ! -f "${DATA_DIR}/${file}" ]; then
    echo "missing required file: app/database/${file}" >&2
    exit 1
  fi
done

mkdir -p "${OUT_DIR}"
tar -czf "${OUT}" -C "${DATA_DIR}" "${FILES[@]}"

echo "packed ${#FILES[@]} files into ${OUT}"
du -h "${OUT}"
tar -tzf "${OUT}"

if [ "${1:-}" = "--upload" ]; then
  TAG="${2:-market-data-v1}"
  echo "uploading to release ${TAG}"
  gh release create "${TAG}" "${OUT}" \
      --title "Market data ${TAG}" \
      --notes "Bar files for the backtest workflow. Bump data_revision when you upload a new one." \
    || gh release upload "${TAG}" "${OUT}" --clobber
  echo "done: gh release view ${TAG}"
fi
