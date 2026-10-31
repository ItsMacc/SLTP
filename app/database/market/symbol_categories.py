# symbol_categories.py — Assign a Category to every symbol in the catalog.
#
# Writes a `Category` column (stock | etf | gold) into symbols.parquet so the
# market-data service can answer "which tickers are ETFs / stocks / gold"
# without scraping Wikipedia on every call.
#
# Evidence, in order of precedence:
#   1. GOLD_FUNDS      — explicit list of physical-gold funds.
#   2. Exchange flags  — NASDAQ Trader listing files carry an official ETF flag.
#   3. Name keywords   — fallback for listings the US files miss (e.g. .TO).
# Anything left over is a stock. No index scraping is involved.
#
# The exchange files are downloaded once and cached next to the catalog, so a
# rebuild does not need the network. Rerun the build whenever the symbol
# catalog changes:
#
#     python -m app.database.market.symbol_categories

# -------- Imports --------
from __future__ import annotations

import io
import json
import os
from datetime import date

import pandas as pd
import requests

# -------- Paths & Constants --------
MARKET_DIR = os.path.dirname(os.path.abspath(__file__))
SYMBOL_DATA_DIR = os.path.join(MARKET_DIR, "..", "symbol_data")
SYMBOLS_FILE = os.path.join(SYMBOL_DATA_DIR, "symbols.parquet")
ETF_CACHE_FILE = os.path.join(SYMBOL_DATA_DIR, "etf_symbols.json")

CATEGORY_COLUMN = "Category"
STOCK, ETF, GOLD = "stock", "etf", "gold"

# Physical-gold and leveraged/inverse gold funds: the "gold proxies" the engine
# exposes to strategies.
GOLD_FUNDS = frozenset({
    "GLD",    # SPDR Gold Shares
    "IAU",    # iShares Gold Trust
    "GLDM",   # SPDR Gold MiniShares Trust
    "SGOL",   # abrdn Physical Gold Shares
    "AAAU",   # Goldman Sachs Physical Gold
    "BAR",    # GraniteShares Gold Trust
    "OUNZ",   # VanEck Merk Gold Trust
    "UGL",    # ProShares Ultra Gold (2x)
    "GLL",    # ProShares UltraShort Gold (-1x)
    "DGP",    # DB Gold Double Long
    "DZZ",    # DB Gold Double Short
})

# Used only when a symbol is missing from the US exchange listings. "Fund",
# "ETF" and "Trust" also name closed-end funds; "Trust" alone is ambiguous
# because mortgage REITs use it too, so the weak words need no company marker.
STRONG_FUND_WORDS = ("etf", " fund", "trust fund")
WEAK_FUND_WORDS = ("trust", "index", "portfolio")
COMPANY_MARKERS = (
    " inc", " corp", " company", " ltd", " plc", " reit", " mortgage",
    " realty", " bancorp", " bankshares", " notes", " holdings",
)

EXCHANGE_FILES = (
    ("https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt", "Symbol"),
    ("https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt", "ACT Symbol"),
)


# -------- Evidence Sources --------
def download_etf_symbols() -> list[str]:
    """Return every US-listed symbol the exchanges flag as an ETF."""
    headers = {"User-Agent": "Mozilla/5.0"}
    symbols: set[str] = set()
    for url, symbol_column in EXCHANGE_FILES:
        response = requests.get(url, headers=headers, timeout=60)
        response.raise_for_status()
        frame = pd.read_csv(io.StringIO(response.text), sep="|")
        # Both files end with a "File Creation Time" footer row.
        frame = frame[frame.iloc[:, 0].astype(str).str.strip() != "File Creation Time"]
        flagged = frame.loc[frame["ETF"] == "Y", symbol_column]
        symbols.update(str(symbol).strip() for symbol in flagged.dropna())
    return sorted(symbols)


def load_etf_symbols(refresh: bool = False) -> set[str]:
    """Read the cached exchange ETF flags, downloading them when missing or stale."""
    if not refresh and os.path.exists(ETF_CACHE_FILE):
        try:
            with open(ETF_CACHE_FILE, encoding="utf-8") as f:
                return set(json.load(f)["symbols"])
        except (OSError, ValueError, KeyError):
            pass

    symbols = download_etf_symbols()
    if symbols:
        os.makedirs(SYMBOL_DATA_DIR, exist_ok=True)
        with open(ETF_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump({"updated": str(date.today()), "symbols": symbols}, f, indent=0)
    return set(symbols)


# -------- Classification --------
def classify_symbol(symbol: str, name: str, etf_symbols: set[str]) -> str:
    """Return the category for one symbol."""
    if symbol in GOLD_FUNDS:
        return GOLD
    if symbol in etf_symbols:
        return ETF
    lowered = (name or "").lower()
    if any(word in lowered for word in STRONG_FUND_WORDS):
        return ETF
    if any(word in lowered for word in WEAK_FUND_WORDS) and not any(
        marker in lowered for marker in COMPANY_MARKERS
    ):
        return ETF
    return STOCK


def classify_frame(frame: pd.DataFrame, etf_symbols: set[str]) -> pd.DataFrame:
    """Return the frame with a fresh Category column."""
    frame = frame.copy()
    frame[CATEGORY_COLUMN] = [
        classify_symbol(str(symbol), str(name or ""), etf_symbols)
        for symbol, name in zip(frame["Symbol"], frame.get("Name", ""))
    ]
    return frame


# -------- Build --------
def build_symbol_categories(*, refresh_etf_flags: bool = False) -> dict[str, int]:
    """Write Category into symbols.parquet and return the per-category counts."""
    frame = pd.read_parquet(SYMBOLS_FILE)
    etf_symbols = load_etf_symbols(refresh=refresh_etf_flags)
    if not etf_symbols:
        raise RuntimeError(
            "No ETF flags available: the exchange files could not be downloaded and no cache exists. "
            "Rerun with network access so categories are not guessed from names alone."
        )

    frame = classify_frame(frame, etf_symbols)

    # Write through a temp file so a failed write cannot truncate the catalog.
    temp_path = f"{SYMBOLS_FILE}.{os.getpid()}.tmp"
    frame.to_parquet(temp_path, index=False)
    os.replace(temp_path, SYMBOLS_FILE)

    counts = frame[CATEGORY_COLUMN].value_counts().to_dict()
    print(f"Categories written to {os.path.relpath(SYMBOLS_FILE)}: {counts}")
    return counts


if __name__ == "__main__":
    build_symbol_categories(refresh_etf_flags=True)
