# -------- market_data_service.py --------
# Read layer over the local market data.
#
# Everything is cached in-process and reloads automatically when the backing file
# changes on disk. Symbol scopes: get_tickers("all" | "stocks" | "missing") plus the
# stored stock / etf / gold categories. Histories: get_stock_history(ticker, start,
# end) and get_stock_histories(tickers, start, end), where start defaults to
# 1998-01-01 (None means the same) and end defaults to the end of the data.

# -------- Imports --------
import os
import json
import threading
import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq

from datetime import datetime
from collections import OrderedDict
from typing import Literal

# Engine imports
from app.engine.utils.Dates import CALENDAR, to_code
from app.engine.utils.StockData import StockData

# Database imports
from app.database.market.symbol_categories import ETF, GOLD, STOCK, CATEGORY_COLUMN


# -------- Paths & Constants --------
MARKET_DIR: str = os.path.dirname(os.path.abspath(__file__))
SYMBOL_DATA_DIR: str = os.path.join(MARKET_DIR, "..", "symbol_data")
MASTER_FILE: str = os.path.join(MARKET_DIR, "market_data.parquet")
SYMBOLS_FILE: str = os.path.join(SYMBOL_DATA_DIR, "symbols.parquet")
MISSING_FILE: str = os.path.join(SYMBOL_DATA_DIR, "missing_symbols.json")
DEFAULT_START: str = "1998-01-01"
DATE_FORMAT: str = "%Y-%m-%d"
PRICE_COLS: list[str] = ["Open", "High", "Low", "Close", "Volume"]

Scope = Literal["all", "stocks", "missing"]


# -------- Process Caches --------
# Each entry maps a key to (file signature, value); a changed signature forces a reload.
_CACHE: dict[str, tuple[tuple | None, object]] = {}

# Every ticker's full history, loaded from the master file in one pass and tied to its signature.
_HISTORY_CACHE: dict[str, StockData] = {}
_HISTORY_SIGNATURE: tuple | None = None

# Small requests read only their own row groups (the file is sorted by Symbol) and are
# kept in a bounded cache, so the API never has to hold the whole dataset.
_SYMBOL_CACHE: OrderedDict[str, StockData] = OrderedDict()
_SYMBOL_CACHE_SIGNATURE: tuple | None = None
SYMBOL_CACHE_LIMIT: int = 500

# Above this many tickers, one full-file read beats many targeted reads.
BULK_READ_THRESHOLD: int = 500

# Serialises loads: without it, concurrent cold requests each load the whole file.
_LOAD_LOCK = threading.RLock()


# -------- Symbol Scopes --------
# Return tickers for a scope: every symbol, the stock category, or the missed symbols.
def get_tickers(scope: Scope = "all") -> list[str]:
    if scope == "all":
        return get_all_tickers()
    if scope == "stocks":
        return get_available_stocks()
    if scope == "missing":
        return get_missing_tickers()
    raise ValueError(f"Unknown scope {scope!r}. Expected one of: all, stocks, missing.")


# Return every valid ticker in the symbol catalog, sorted.
def get_all_tickers() -> list[str]:
    return sorted(_symbol_names())


# Return a dict mapping each valid ticker to its company name.
def get_all_ticker_names() -> dict[str, str]:
    return dict(_symbol_names())


# Return ticker symbols and their company or fund names, for search.
def get_all_ticker_details() -> list[dict[str, str]]:
    return [{"ticker": ticker, "name": name} for ticker, name in _symbol_names().items()]


# Return a ticker's name, falling back to the symbol when it is not in the catalog.
def get_stock_name(ticker: str) -> str:
    symbol: str = ticker.strip().upper()
    return _symbol_names().get(symbol, symbol)


# Return each catalog symbol's category: stock, etf or gold.
def get_symbol_categories() -> dict[str, str]:
    return dict(_symbol_categories())


# Return company tickers with bars in the master file, sorted.
def get_available_stocks() -> list[str]:
    return _symbols_in_category((STOCK,))


# Return ETF tickers with bars in the master file, sorted. Gold funds are ETFs too.
def get_available_etfs() -> list[str]:
    return _symbols_in_category((ETF, GOLD))


# Return gold-fund tickers with bars in the master file, sorted.
def get_available_gold() -> list[str]:
    return _symbols_in_category((GOLD,))


# Return the symbols that returned no bars on their last check, sorted.
def get_missing_tickers() -> list[str]:
    return sorted(_cached("missing", MISSING_FILE, _read_missing, required=False))


# -------- Market Data --------
# Return the latest trading date stored in the master file.
def get_latest_trading_date() -> str:
    return _cached("latest_date", MASTER_FILE, _read_latest_date)


# Return every trading day in the master file as sorted int32 date codes.
# Reading only the Date column keeps this to one dictionary-encoded pass, so a
# backtest can use the market's calendar without loading any price history.
def get_trading_calendar() -> np.ndarray:
    return _cached("trading_calendar", MASTER_FILE, _read_trading_calendar)


# Return one ticker's bars between start and end (inclusive).
# start=None means from DEFAULT_START; end=None means to the end of the data.
def get_stock_history(ticker: str, start: str | None = None, end: str | None = None) -> StockData:
    start = start or DEFAULT_START
    _validate_range(start, end)
    symbol: str = ticker.strip().upper()
    history: StockData | None = _symbol_histories([symbol]).get(symbol)
    if history is None:
        raise ValueError(f"No local data found for {symbol} in master database.")

    sliced: StockData | None = _slice(history, start, end)
    if sliced is None:
        raise ValueError(f"No data found for {symbol}{_describe_range(start, end)}.")
    return sliced


# Batch version of get_stock_history. Tickers with no bars in the range are skipped.
def get_stock_histories(tickers: list[str], start: str | None = None, end: str | None = None) -> dict[str, StockData]:
    if not tickers:
        return {}

    start = start or DEFAULT_START
    _validate_range(start, end)
    symbols: list[str] = [ticker.strip().upper() for ticker in tickers]
    histories: dict[str, StockData] = _symbol_histories(symbols) if len(set(symbols)) <= BULK_READ_THRESHOLD else _histories(symbols)

    result: dict[str, StockData] = {}
    for symbol in symbols:
        history: StockData | None = histories.get(symbol)
        sliced: StockData | None = _slice(history, start, end) if history is not None else None
        if sliced is not None:
            result[symbol] = sliced
    return result


# Drop every cached value so the next read reloads from disk.
def refresh_market_data_cache() -> None:
    global _HISTORY_SIGNATURE, _SYMBOL_CACHE_SIGNATURE
    with _LOAD_LOCK:
        _CACHE.clear()
        _HISTORY_CACHE.clear()
        _SYMBOL_CACHE.clear()
        _HISTORY_SIGNATURE = None
        _SYMBOL_CACHE_SIGNATURE = None


# -------- Cache Helpers --------
# Build the (path, size, mtime) signature that tells us whether a file changed.
def _file_signature(path: str, required: bool = True) -> tuple | None:
    if not os.path.exists(path):
        if required:
            raise RuntimeError(f"Market data file not found: {path}")
        return None
    stat = os.stat(path)
    return os.path.abspath(path), stat.st_size, stat.st_mtime_ns


# Return the cached value for key, rebuilding it when the file at path changed.
def _cached(key: str, path: str, build, required: bool = True):
    signature = _file_signature(path, required)
    entry = _CACHE.get(key)
    if entry is not None and entry[0] == signature:
        return entry[1]
    value = build()
    _CACHE[key] = (signature, value)
    return value


# The catalog's symbol to name map, cached per file change.
def _symbol_names() -> dict[str, str]:
    return _cached("symbols", SYMBOLS_FILE, _read_symbol_names)


# Every symbol that has bars in the master file, cached per file change.
def _master_tickers() -> list[str]:
    return _cached("master_tickers", MASTER_FILE, _read_master_tickers)


# The catalog's symbol to category map, cached per file change.
def _symbol_categories() -> dict[str, str]:
    return _cached("categories", SYMBOLS_FILE, _read_symbol_categories)


# Return symbols of the given categories that also have bars in the master file.
def _symbols_in_category(kinds: tuple[str, ...]) -> list[str]:
    categories: dict[str, str] = _symbol_categories()
    available: set[str] = set(_master_tickers())
    return sorted(symbol for symbol, category in categories.items() if category in kinds and symbol in available)


# -------- History Helpers --------
# Load the whole master file into the cache once per file change, then serve lookups from memory.
def _histories(symbols: list[str]) -> dict[str, StockData]:
    global _HISTORY_SIGNATURE
    with _LOAD_LOCK:
        signature = _file_signature(MASTER_FILE)
        if signature != _HISTORY_SIGNATURE:
            _HISTORY_CACHE.clear()
            _HISTORY_CACHE.update(_read_histories())
            _HISTORY_SIGNATURE = signature

        return {symbol: _HISTORY_CACHE[symbol] for symbol in symbols if symbol in _HISTORY_CACHE}


# Return histories by reading only the requested symbols' row groups.
def _symbol_histories(symbols: list[str]) -> dict[str, StockData]:
    global _SYMBOL_CACHE_SIGNATURE
    wanted: list[str] = list(dict.fromkeys(symbols))
    with _LOAD_LOCK:
        signature = _file_signature(MASTER_FILE)
        if signature != _SYMBOL_CACHE_SIGNATURE:
            _SYMBOL_CACHE.clear()
            _SYMBOL_CACHE_SIGNATURE = signature

        missing: list[str] = [symbol for symbol in wanted if symbol not in _SYMBOL_CACHE]
        if missing:
            for symbol, history in _read_symbols(missing).items():
                _SYMBOL_CACHE[symbol] = history
                _SYMBOL_CACHE.move_to_end(symbol)
            while len(_SYMBOL_CACHE) > SYMBOL_CACHE_LIMIT:
                _SYMBOL_CACHE.popitem(last=False)

        return {symbol: _SYMBOL_CACHE[symbol] for symbol in wanted if symbol in _SYMBOL_CACHE}


# Cut one history down to a date range. Dates are sorted int32 codes, so binary
# search finds the bounds and the slices stay views.
def _slice(history: StockData, start: str, end: str | None) -> StockData | None:
    codes = history.date_codes
    lo: int = int(np.searchsorted(codes, to_code(start), side="left"))
    hi: int = len(codes) if end is None else int(np.searchsorted(codes, to_code(end), side="right"))
    if lo >= hi:
        return None
    if lo == 0 and hi == len(codes):
        return history
    return StockData(
        ticker=history.ticker,
        date_codes=codes[lo:hi],
        open_price=history.open_price[lo:hi],
        high=history.high[lo:hi],
        low=history.low[lo:hi],
        close_price=history.close_price[lo:hi],
        volume=history.volume[lo:hi],
    )


# Reject a date range whose start sits after its end.
def _validate_range(start: str, end: str | None) -> None:
    start_dt: datetime = _parse_date(start, "start")
    if end is None:
        return
    if start_dt > _parse_date(end, "end"):
        raise ValueError(f"Invalid date range: start ({start}) must not be after end ({end}).")


# Parse one YYYY-MM-DD string, with a message naming which bound was wrong.
def _parse_date(value: str, label: str) -> datetime:
    try:
        return datetime.strptime(value, DATE_FORMAT)
    except ValueError:
        raise ValueError(f"Invalid {label} date ({value}). Expected YYYY-MM-DD.") from None


# Describe a range so error messages can say what was asked for.
def _describe_range(start: str, end: str | None) -> str:
    return f" from {start}" + (f" to {end}" if end is not None else "")


# -------- Readers --------
# Read the catalog's Symbol and Name columns into a dict.
def _read_symbol_names() -> dict[str, str]:
    table = pq.read_table(SYMBOLS_FILE, columns=["Symbol", "Name"])
    return dict(zip(table.column("Symbol").to_pylist(), table.column("Name").to_pylist()))


# Read the catalog's Symbol and Category columns, insisting the category exists.
def _read_symbol_categories() -> dict[str, str]:
    if CATEGORY_COLUMN not in pq.read_schema(SYMBOLS_FILE).names:
        raise RuntimeError(
            f"{os.path.relpath(SYMBOLS_FILE)} has no {CATEGORY_COLUMN} column. "
            "Run: python -m app.database.market.symbol_categories"
        )
    table = pq.read_table(SYMBOLS_FILE, columns=["Symbol", CATEGORY_COLUMN])
    return dict(zip(table.column("Symbol").to_pylist(), table.column(CATEGORY_COLUMN).to_pylist()))


# List every symbol with bars. The Symbol column is dictionary-encoded per row
# group, so this reads one small dictionary per group instead of 29.8M strings.
def _read_master_tickers() -> list[str]:
    table = pq.read_table(MASTER_FILE, columns=["Symbol"], read_dictionary=["Symbol"])
    column = table.column("Symbol")
    if isinstance(column, pa.ChunkedArray):
        column = column.combine_chunks()
    if pa.types.is_dictionary(column.type):
        return column.dictionary.to_pylist()
    return column.unique().to_pylist()


# Read the newest session from row-group statistics, falling back to the Date column.
def _read_latest_date() -> str:
    metadata = pq.ParquetFile(MASTER_FILE).metadata
    date_index = next(
        (
            index
            for index in range(metadata.num_columns)
            if metadata.row_group(0).column(index).path_in_schema == "Date"
        ),
        None,
    )
    if date_index is not None:
        newest = None
        for group in range(metadata.num_row_groups):
            statistics = metadata.row_group(group).column(date_index).statistics
            if statistics is None or statistics.max is None:
                newest = None
                break
            value = statistics.max
            value = value.decode() if isinstance(value, bytes) else str(value)
            if newest is None or value > newest:
                newest = value
        if newest is not None:
            return newest

    column = _read_table(["Date"]).column("Date")
    if isinstance(column, pa.ChunkedArray):
        column = column.combine_chunks()
    values = column.dictionary if pa.types.is_dictionary(column.type) else column
    return str(max(values.to_pylist()))


# Read the requested columns, keeping Date dictionary-encoded.
# Arrow then hands over ~7k labels plus an int32 index per bar instead of
# materialising a string for every bar.
def _read_table(columns: list[str], filters: list | None = None) -> pa.Table:
    return pq.read_table(MASTER_FILE, columns=columns, filters=filters, read_dictionary=["Date"])


# Convert a table's Date column to int32 day codes.
def _table_date_codes(table: pa.Table) -> np.ndarray:
    column = table.column("Date")
    if isinstance(column, pa.ChunkedArray):
        column = column.combine_chunks()
    if pa.types.is_dictionary(column.type):
        labels = column.dictionary.to_numpy(zero_copy_only=False).astype("<U10", copy=False)
        return CALENDAR.register(labels)[column.indices.to_numpy()]
    return CALENDAR.register(column.to_numpy(zero_copy_only=False))


# Read every trading day in the file as sorted int32 codes.
def _read_trading_calendar() -> np.ndarray:
    column = _read_table(["Date"]).column("Date")
    if isinstance(column, pa.ChunkedArray):
        column = column.combine_chunks()
    if pa.types.is_dictionary(column.type):
        labels = column.dictionary.to_numpy(zero_copy_only=False).astype("<U10", copy=False)
        codes = CALENDAR.register(labels)[column.indices.to_numpy()]
    else:
        codes = CALENDAR.register(column.to_numpy(zero_copy_only=False))
    return np.unique(codes)


# Read the whole master file into StockData objects, grouped by symbol.
def _read_histories() -> dict[str, StockData]:
    return _table_to_histories(_read_table(["Symbol", "Date", *PRICE_COLS]))


# Read only the requested symbols, using row-group statistics to skip the rest.
def _read_symbols(symbols: list[str]) -> dict[str, StockData]:
    filters = [("Symbol", "=", symbols[0])] if len(symbols) == 1 else [("Symbol", "in", symbols)]
    return _table_to_histories(_read_table(["Symbol", "Date", *PRICE_COLS], filters))


# Turn an Arrow table of bars into one StockData per symbol.
def _table_to_histories(table: pa.Table) -> dict[str, StockData]:
    codes: np.ndarray = _table_date_codes(table)
    frame = table.select([name for name in table.column_names if name != "Date"]).to_pandas()
    frame["date_code"] = codes
    frame["Symbol"] = frame["Symbol"].astype(str)
    frame = frame.sort_values(["Symbol", "date_code"])

    histories: dict[str, StockData] = {}
    for symbol, rows in frame.groupby("Symbol", sort=False):
        histories[symbol] = StockData(
            ticker=symbol,
            date_codes=rows["date_code"].to_numpy(dtype=np.int32),
            open_price=rows["Open"].to_numpy(dtype=float),
            high=rows["High"].to_numpy(dtype=float),
            low=rows["Low"].to_numpy(dtype=float),
            close_price=rows["Close"].to_numpy(dtype=float),
            volume=rows["Volume"].to_numpy(dtype=float),
        )
    return histories


# Read the missed-symbol list, treating a missing file as "no misses".
def _read_missing() -> list[str]:
    if not os.path.exists(MISSING_FILE):
        return []
    with open(MISSING_FILE, encoding="utf-8") as f:
        return list(json.load(f))
