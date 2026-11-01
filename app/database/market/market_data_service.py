# -------- market_data_service.py --------
# Read layer over the local market data.
#
# Everything is cached in-process and reloads automatically when the backing file
# changes on disk. Symbol scopes: get_tickers("all" | "stocks" | "missing") plus the
# stored stock / etf / gold categories. Histories: get_stock_history(ticker, start,
# end) and get_stock_histories(tickers, start, end), where start defaults to
# 1998-01-01 (None means the same) and end defaults to the end of the data.
# Dividends: get_dividends(ticker, start, end) returns day codes and amount per share, so
# a backtest can account for them without reading a bar.
#
# Bars live in two files so a daily update never rewrites history:
#
#   market_data.parquet         every bar up to the last init or compaction
#   market_data_recent.parquet  the bars added since, growing by one session a day
#   market_actions.parquet      splits and dividends, one row per event
#
# Readers treat the pair as one table. A symbol's bars are never stored twice: a new
# bar is only written when it is newer than that symbol's newest stored bar.
#
# Both files are append-only, so having bars is no longer the same as being alive.
# symbol_status.parquet carries that answer (active, lagging, stopped, missing) next
# to bar counts, last bar dates and probe attempts. Universe lists still return every
# symbol with history, dead ones included: hiding them is exactly the survivorship
# bias a backtest must not have.

# -------- Imports --------
import os
import threading
import numpy as np
import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.parquet as pq

from datetime import datetime
from collections import OrderedDict
from typing import Literal

# Engine imports
from app.engine.utils.Dates import CALENDAR, labels_from_codes, to_code
from app.engine.utils.StockData import StockData

# Database imports
from app.database.market.symbol_categories import ETF, GOLD, STOCK, CATEGORY_COLUMN


# -------- Paths & Constants --------
MARKET_DIR: str = os.path.dirname(os.path.abspath(__file__))
SYMBOL_DATA_DIR: str = os.path.join(MARKET_DIR, "..", "symbol_data")
MASTER_FILE: str = os.path.join(MARKET_DIR, "market_data.parquet")
RECENT_FILE: str = os.path.join(MARKET_DIR, "market_data_recent.parquet")
ACTIONS_FILE: str = os.path.join(MARKET_DIR, "market_actions.parquet")

# Event kinds in the actions file. One row per event, never one per bar.
ACTION_SPLIT: int = 0
ACTION_DIVIDEND: int = 1
SYMBOLS_FILE: str = os.path.join(SYMBOL_DATA_DIR, "symbols.parquet")
STATUS_FILE: str = os.path.join(SYMBOL_DATA_DIR, "symbol_status.parquet")
DEFAULT_START: str = "1998-01-01"
DATE_FORMAT: str = "%Y-%m-%d"
PRICE_COLS: list[str] = ["Open", "High", "Low", "Close", "Volume"]
BAR_COLS: list[str] = ["Symbol", "Date", *PRICE_COLS]
BATCH_ROWS: int = 1_000_000

Scope = Literal["all", "stocks", "missing"]


# -------- Files --------
# Every file that holds bars, oldest first. Missing master is an error; an absent or
# empty recent tail simply means nothing has been added since the last compaction.
def data_files() -> list[str]:
    if not os.path.exists(MASTER_FILE):
        raise RuntimeError(f"Market data file not found: {MASTER_FILE}")
    files: list[str] = [MASTER_FILE]
    if os.path.exists(RECENT_FILE) and os.path.getsize(RECENT_FILE) > 0:
        files.append(RECENT_FILE)
    return files


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


# Return the symbols that have never returned a bar, sorted.
def get_missing_tickers() -> list[str]:
    return sorted(symbol for symbol, status in _symbol_status().items() if status == "missing")


# Return each symbol's status: active, lagging or stopped.
def get_symbol_statuses() -> dict[str, str]:
    return dict(_symbol_status())


# Return the symbols that stopped trading, meaning their last bar is 5+ sessions back.
def get_stopped_tickers() -> list[str]:
    return sorted(symbol for symbol, status in _symbol_status().items() if status == "stopped")


# -------- Market Data --------
# Return the latest trading date stored in the market data files.
def get_latest_trading_date() -> str:
    return _cached("latest_date", _dataset_signature(), _read_latest_date)


# Return every trading day in the master file as sorted int32 date codes.
# Reading only the Date column keeps this to one dictionary-encoded pass, so a
# backtest can use the market's calendar without loading any price history.
def get_trading_calendar() -> np.ndarray:
    return _cached("trading_calendar", _dataset_signature(), _read_trading_calendar)


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


# Dividends for one ticker between start and end: day codes and amount per share.
# Empty arrays when the symbol never paid one. Amounts are split-adjusted by the source,
# so they line up with the closes in the bar files.
def get_dividends(ticker: str, start: str | None = None, end: str | None = None) -> tuple[np.ndarray, np.ndarray]:
    entry: tuple[np.ndarray, np.ndarray] | None = _actions_index(ACTION_DIVIDEND).get(ticker.strip().upper())
    if entry is None:
        return np.empty(0, dtype=np.int32), np.empty(0, dtype=np.float32)
    return _actions_in_range(entry[0], entry[1], start, end)


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


# A file set's signature, so a write to any part of it invalidates the caches.
def _dataset_signature() -> tuple:
    return tuple(_file_signature(path) for path in data_files())


# Return the cached value for key, rebuilding it when the signature changed.
def _cached(key: str, signature: tuple | None, build):
    entry = _CACHE.get(key)
    if entry is not None and entry[0] == signature:
        return entry[1]
    value = build()
    _CACHE[key] = (signature, value)
    return value


# The catalog's symbol to name map, cached per file change.
def _symbol_names() -> dict[str, str]:
    return _cached("symbols", _file_signature(SYMBOLS_FILE), _read_symbol_names)


# Every symbol that has bars, cached per file change.
def _master_tickers() -> list[str]:
    return _cached("master_tickers", _dataset_signature(), _read_master_tickers)


# The catalog's symbol to category map, cached per file change.
def _symbol_categories() -> dict[str, str]:
    return _cached("categories", _file_signature(SYMBOLS_FILE), _read_symbol_categories)


# The symbol to status map, cached per file change.
def _symbol_status() -> dict[str, str]:
    return _cached("status", _file_signature(STATUS_FILE, required=False), _read_symbol_status)


# Return symbols of the given categories that have bars in the master file.
def _symbols_in_category(kinds: tuple[str, ...]) -> list[str]:
    categories: dict[str, str] = _symbol_categories()
    available: set[str] = set(_master_tickers())
    return sorted(symbol for symbol, category in categories.items() if category in kinds and symbol in available)


# -------- History Helpers --------
# Load the whole master file into the cache once per file change, then serve lookups from memory.
def _histories(symbols: list[str]) -> dict[str, StockData]:
    global _HISTORY_SIGNATURE
    with _LOAD_LOCK:
        signature: tuple = _dataset_signature()
        if signature != _HISTORY_SIGNATURE:
            _HISTORY_CACHE.clear()
            _SYMBOL_CACHE.clear()
            _HISTORY_CACHE.update(_read_histories())
            _HISTORY_SIGNATURE = signature

        return {symbol: _HISTORY_CACHE[symbol] for symbol in symbols if symbol in _HISTORY_CACHE}


# Return histories by reading only the requested symbols' row groups.
def _symbol_histories(symbols: list[str]) -> dict[str, StockData]:
    global _SYMBOL_CACHE_SIGNATURE
    wanted: list[str] = list(dict.fromkeys(symbols))
    with _LOAD_LOCK:
        signature = _dataset_signature()
        if signature != _SYMBOL_CACHE_SIGNATURE:
            _SYMBOL_CACHE.clear()
            _SYMBOL_CACHE_SIGNATURE = signature

        # A loaded universe already holds every bar, so never keep a second copy of it.
        if _HISTORY_CACHE and signature == _HISTORY_SIGNATURE:
            return {symbol: _HISTORY_CACHE[symbol] for symbol in wanted if symbol in _HISTORY_CACHE}

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
    table = pq.read_table(data_files(), columns=["Symbol"], read_dictionary=["Symbol"])
    column = table.column("Symbol")
    if isinstance(column, pa.ChunkedArray):
        if pa.types.is_dictionary(column.type):
            return sorted({label for chunk in column.chunks for label in chunk.dictionary.to_pylist()})
        return column.unique().to_pylist()
    if pa.types.is_dictionary(column.type):
        return column.dictionary.to_pylist()
    return column.unique().to_pylist()


# The newest Date in one file, from row-group statistics when the file has them.
def _newest_date_in(path: str) -> int | None:
    metadata = pq.ParquetFile(path).metadata
    if metadata.num_row_groups == 0:
        return None
    date_index = next(
        (
            index
            for index in range(metadata.num_columns)
            if metadata.row_group(0).column(index).path_in_schema == "Date"
        ),
        None,
    )
    if date_index is None:
        return None

    newest = None
    for group in range(metadata.num_row_groups):
        statistics = metadata.row_group(group).column(date_index).statistics
        if statistics is None or statistics.max is None:
            return None
        value = int(statistics.max)
        if newest is None or value > newest:
            newest = value
    return newest


# Read the newest session across every data file, falling back to the Date column.
def _read_latest_date() -> str:
    newest: int | None = None
    for path in data_files():
        value: int | None = _newest_date_in(path)
        if value is None:
            newest = None
            break
        if newest is None or value > newest:
            newest = value
    if newest is None:
        newest = int(np.max(_date_codes(_read_table(["Date"]))))
    CALENDAR.register(labels_from_codes(np.array([newest], dtype=np.int32)))
    return CALENDAR.label(newest)


# Read the requested columns from every data file. Filters still skip row groups.
def _read_table(columns: list[str], filters: list | None = None) -> pa.Table:
    return pq.read_table(data_files(), columns=columns, filters=filters)


# The Date column as int32 day numbers.
def _date_codes(table: pa.Table) -> np.ndarray:
    column = table.column("Date")
    if isinstance(column, pa.ChunkedArray):
        column = column.combine_chunks()
    return column.to_numpy(zero_copy_only=False)


# Read every trading day in the file as sorted int32 codes.
def _read_trading_calendar() -> np.ndarray:
    codes: np.ndarray = np.unique(_date_codes(_read_table(["Date"])))
    CALENDAR.register(labels_from_codes(codes))
    return codes


# Read the whole master file into StockData objects, grouped by symbol.
def _read_histories() -> dict[str, StockData]:
    paths: list[str] = data_files()
    return _histories_from_batches(_iter_batches(paths), _row_count(paths))


# Read only the requested symbols, using row-group statistics to skip the rest.
def _read_symbols(symbols: list[str]) -> dict[str, StockData]:
    filters = [("Symbol", "=", symbols[0])] if len(symbols) == 1 else [("Symbol", "in", symbols)]
    table: pa.Table = _read_table(BAR_COLS, filters)
    return _histories_from_batches(table.to_batches(), table.num_rows)


# Stream the bars of every file, one row group at a time.
def _iter_batches(paths: list[str]):
    for path in paths:
        for batch in pq.ParquetFile(path).iter_batches(batch_size=BATCH_ROWS, columns=BAR_COLS):
            yield batch


# Total bars across the given files.
def _row_count(paths: list[str]) -> int:
    return sum(pq.ParquetFile(path).metadata.num_rows for path in paths)


# Every event of one kind grouped by symbol, built once per file signature. The file is a
# few megabytes, so loading it whole beats reopening it for every symbol a backtest asks
# about: get_dividends becomes a dict lookup instead of a parquet read.
def _actions_index(kind: int) -> dict[str, tuple[np.ndarray, np.ndarray]]:
    return _cached(f"actions_{kind}", _file_signature(ACTIONS_FILE, required=False), lambda: _build_actions_index(kind))


# Group one kind's events by symbol. The file is sorted by Symbol, so each run of equal
# symbols is one ticker's series.
def _build_actions_index(kind: int) -> dict[str, tuple[np.ndarray, np.ndarray]]:
    if not os.path.exists(ACTIONS_FILE):
        return {}

    table: pa.Table = pq.read_table(
        ACTIONS_FILE, columns=["Symbol", "Date", "Amount"], filters=[("Kind", "=", kind)]
    )
    if table.num_rows == 0:
        return {}

    codes = table.column("Date").combine_chunks().to_numpy(zero_copy_only=False).astype(np.int32)
    amounts = table.column("Amount").combine_chunks().to_numpy(zero_copy_only=False).astype(np.float32)
    symbols: np.ndarray = np.array(table.column("Symbol").combine_chunks().to_pylist(), dtype=object)

    edges = np.flatnonzero(symbols[1:] != symbols[:-1]) + 1
    starts = np.concatenate((np.zeros(1, dtype=np.int64), edges)).tolist()
    ends = np.concatenate((edges, np.array([len(symbols)], dtype=np.int64))).tolist()
    return {str(symbols[start]): (codes[start:end], amounts[start:end]) for start, end in zip(starts, ends)}


# Cut an event series to the requested range. start=None means from DEFAULT_START.
def _actions_in_range(codes: np.ndarray, amounts: np.ndarray, start: str | None, end: str | None) -> tuple[np.ndarray, np.ndarray]:
    if codes.size == 0:
        return codes, amounts

    start_code: np.int32 = to_code(start or DEFAULT_START)
    end_code: np.int32 = to_code(end) if end is not None else np.iinfo(np.int32).max
    keep = (codes >= start_code) & (codes <= end_code)
    return codes[keep], amounts[keep]


# Turn streamed bars into one StockData per symbol. Every bar lands in a preallocated
# array once, and each ticker's arrays are slices of those blocks, so a full universe
# costs one copy of the data instead of one per reading step.
def _histories_from_batches(batches, rows: int) -> dict[str, StockData]:
    if rows == 0:
        return {}

    date = np.empty(rows, dtype=np.int32)
    prices = {name: np.empty(rows, dtype=np.float32) for name in ("Open", "High", "Low", "Close")}
    volume = np.empty(rows, dtype=np.float32)
    symbols = np.empty(rows, dtype=np.int32)
    ids: dict[str, int] = {}
    at: int = 0

    for batch in batches:
        count: int = batch.num_rows
        encoded = pc.dictionary_encode(batch.column("Symbol"))
        local = np.array([ids.setdefault(label, len(ids)) for label in encoded.dictionary.to_pylist()], dtype=np.int32)
        symbols[at:at + count] = local[encoded.indices.to_numpy()]
        dates = batch.column("Date").to_numpy()
        date[at:at + count] = dates
        CALENDAR.register(labels_from_codes(np.unique(dates)))
        for name, target in prices.items():
            target[at:at + count] = batch.column(name).to_numpy()
        volume[at:at + count] = batch.column("Volume").to_numpy()
        at += count

    names: list[str] = [""] * len(ids)
    for label, index in ids.items():
        names[index] = label

    # The file is sorted by symbol, so each run of equal ids is one ticker.
    edges = np.flatnonzero(symbols[1:] != symbols[:-1]) + 1
    starts = np.concatenate((np.zeros(1, dtype=np.int64), edges)).tolist()
    ends = np.concatenate((edges, np.array([at], dtype=np.int64))).tolist()

    histories: dict[str, StockData] = {}
    for start, end in zip(starts, ends):
        ticker: str = names[symbols[start]]
        histories[ticker] = StockData(
            ticker=ticker,
            date_codes=date[start:end],
            open_price=prices["Open"][start:end],
            high=prices["High"][start:end],
            low=prices["Low"][start:end],
            close_price=prices["Close"][start:end],
            volume=volume[start:end],
        )
    return histories


# Read the status file as symbol
def _read_symbol_status() -> dict[str, str]:
    if not os.path.exists(STATUS_FILE):
        return {}
    table = pq.read_table(STATUS_FILE, columns=["Symbol", "Status"])
    return dict(zip(table.column("Symbol").to_pylist(), table.column("Status").to_pylist()))
