# -------- market_data_service.py --------
# Cached read layer over the bar files and market_actions.parquet, reloaded when a file changes.
# Universe lists keep every symbol with history, dead ones included, so a backtest has no survivorship bias.

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
SYMBOLS_FILE: str = os.path.join(SYMBOL_DATA_DIR, "symbols.parquet")
STATUS_FILE: str = os.path.join(SYMBOL_DATA_DIR, "symbol_status.parquet")

ACTION_SPLIT: int = 0
ACTION_DIVIDEND: int = 1
DEFAULT_START: str = "1998-01-01"
DATE_FORMAT: str = "%Y-%m-%d"
PRICE_COLS: list[str] = ["Open", "High", "Low", "Close", "Volume"]
BAR_COLS: list[str] = ["Symbol", "Date", *PRICE_COLS]
BATCH_ROWS: int = 1_000_000
SYMBOL_CACHE_LIMIT: int = 500
BULK_READ_THRESHOLD: int = 500

Scope = Literal["all", "stocks", "missing"]

# Statuses that still trade: a current last bar, or one a few sessions behind.
TRADABLE_STATUSES: tuple[str, ...] = ("active", "lagging")

# Fewest bars before a chart is worth opening. The research list's shortest
# timeframe is one year, so a symbol listed last month draws an empty frame.
MIN_TRADABLE_BARS: int = 30

_CACHE: dict[str, tuple[tuple | None, object]] = {}  # key -> (file signature, value)
_HISTORY_CACHE: dict[str, StockData] = {}  # every ticker's bars, loaded in one pass
_HISTORY_SIGNATURE: tuple | None = None
_SYMBOL_CACHE: OrderedDict[str, StockData] = OrderedDict()  # bounded cache for small reads
_SYMBOL_CACHE_SIGNATURE: tuple | None = None
_SESSIONS: np.ndarray | None = None  # every session in the bar files, once a full read has seen them
_LOAD_LOCK = threading.RLock()  # without it, concurrent cold requests each load the file


# -------- Bar Files --------
# Every file holding bars, oldest first. A missing master is an error; an empty tail is not.
def bar_files() -> list[str]:
    if not os.path.exists(MASTER_FILE):
        raise RuntimeError(f"Market data file not found: {MASTER_FILE}")
    files: list[str] = [MASTER_FILE]
    if os.path.exists(RECENT_FILE) and os.path.getsize(RECENT_FILE) > 0:
        files.append(RECENT_FILE)
    return files


# -------- Market Data --------
# The latest trading date stored in the bar files.
def get_latest_trading_date() -> str:
    return _cached_value("latest_date", _bars_signature(), _read_latest_date)


# Every trading day as sorted int32 codes; served from the loaded universe when there is one.
def get_trading_calendar() -> np.ndarray:
    return _cached_value("trading_calendar", _bars_signature(), _read_trading_calendar)


# One ticker's bars between start and end, inclusive; None on either side means the full range.
def get_stock_history(ticker: str, start: str | None = None, end: str | None = None) -> StockData:
    start = start or DEFAULT_START
    _validate_range(start, end)
    symbol: str = ticker.strip().upper()
    history: StockData | None = _selected_histories([symbol]).get(symbol)
    if history is None:
        raise ValueError(f"No local data found for {symbol} in master database.")

    sliced: StockData | None = _slice_history(history, start, end)
    if sliced is None:
        raise ValueError(f"No data found for {symbol}{_describe_range(start, end)}.")
    return sliced


# Batch form of get_stock_history; tickers with no bars in the range are left out.
def get_stock_histories(tickers: list[str], start: str | None = None, end: str | None = None) -> dict[str, StockData]:
    if not tickers:
        return {}

    start = start or DEFAULT_START
    _validate_range(start, end)
    symbols: list[str] = [ticker.strip().upper() for ticker in tickers]
    histories: dict[str, StockData] = _selected_histories(symbols) if len(set(symbols)) <= BULK_READ_THRESHOLD else _all_histories(symbols)

    result: dict[str, StockData] = {}
    for symbol in symbols:
        history: StockData | None = histories.get(symbol)
        sliced: StockData | None = _slice_history(history, start, end) if history is not None else None
        if sliced is not None:
            result[symbol] = sliced
    return result


# Dividends for one ticker as (day codes, amount per share), already split-adjusted by the source.
def get_dividends(ticker: str, start: str | None = None, end: str | None = None) -> tuple[np.ndarray, np.ndarray]:
    entry: tuple[np.ndarray, np.ndarray] | None = _events_by_symbol(ACTION_DIVIDEND).get(ticker.strip().upper())
    if entry is None:
        return np.empty(0, dtype=np.int32), np.empty(0, dtype=np.float32)
    return _events_in_range(entry[0], entry[1], start, end)


# Split ratios for one ticker as (day codes, ratio): 7.0 is a 7-for-1 forward split,
# 0.1 is a 1-for-10 reverse split.
def get_splits(ticker: str, start: str | None = None, end: str | None = None) -> tuple[np.ndarray, np.ndarray]:
    entry: tuple[np.ndarray, np.ndarray] | None = _events_by_symbol(ACTION_SPLIT).get(ticker.strip().upper())
    if entry is None:
        return np.empty(0, dtype=np.int32), np.empty(0, dtype=np.float32)
    return _events_in_range(entry[0], entry[1], start, end)


# Multiplier per bar that puts stored prices back on the basis they traded on: the product
# of every split ratio dated after that bar. A stock that never split comes back as ones.
def as_traded_factors(ticker: str, codes: np.ndarray) -> np.ndarray:
    split_codes, ratios = get_splits(ticker)
    if split_codes.size == 0:
        return np.ones(codes.shape, dtype=np.float64)

    order: np.ndarray = np.argsort(split_codes, kind="stable")
    split_codes = split_codes[order]
    # suffix[i] is the product of every split from i to the end, so one lookup per bar.
    suffix: np.ndarray = np.cumprod(ratios[order].astype(np.float64)[::-1])[::-1]

    first_after: np.ndarray = np.searchsorted(split_codes, codes, side="right")
    factors: np.ndarray = np.ones(codes.shape, dtype=np.float64)
    inside: np.ndarray = first_after < split_codes.size
    factors[inside] = suffix[first_after[inside]]
    return factors


# A price from the stored series, which is on today's share basis, put back onto the basis
# it traded on. A fund with seven reverse splits comes back from five figures to a
# two-digit quote, which is what the tape actually printed.
def as_traded_price(ticker: str, price: float, date: str) -> float:
    factor: float = float(as_traded_factors(ticker, np.array([to_code(date)], dtype=np.int32))[0])
    return round(float(price) * factor, 2)


# Drop every cached value so the next read reloads from disk.
def refresh_market_data_cache() -> None:
    global _HISTORY_SIGNATURE, _SYMBOL_CACHE_SIGNATURE, _SESSIONS
    with _LOAD_LOCK:
        _CACHE.clear()
        _HISTORY_CACHE.clear()
        _SYMBOL_CACHE.clear()
        _HISTORY_SIGNATURE = None
        _SYMBOL_CACHE_SIGNATURE = None
        _SESSIONS = None


# -------- Catalog --------
# Tickers for a scope: everything, the stock category, or the symbols that never returned a bar.
def get_tickers(scope: Scope = "all") -> list[str]:
    if scope == "all":
        return get_all_tickers()
    if scope == "stocks":
        return get_available_stocks()
    if scope == "missing":
        return get_missing_tickers()
    raise ValueError(f"Unknown scope {scope!r}. Expected one of: all, stocks, missing.")


# Every valid ticker in the catalog, sorted.
def get_all_tickers() -> list[str]:
    return sorted(_names_by_symbol())


# Ticker to company name, for callers that need the whole map.
def get_all_ticker_names() -> dict[str, str]:
    return dict(_names_by_symbol())


# Ticker and name pairs, for search boxes.
def get_ticker_directory() -> list[dict[str, str]]:
    return [{"ticker": ticker, "name": name} for ticker, name in _names_by_symbol().items()]


# Ticker and name pairs for symbols that still trade and carry enough history to
# chart. The research list uses this: a delisted symbol, or one listed three
# weeks ago, opens an empty chart and every number under it is meaningless.
def get_tradable_ticker_directory() -> list[dict[str, str]]:
    bars: dict[str, int] = _tradable_bars_by_symbol()
    return [
        {"ticker": ticker, "name": name}
        for ticker, name in _names_by_symbol().items()
        if bars.get(ticker, 0) >= MIN_TRADABLE_BARS
    ]


# One ticker's name, falling back to the symbol when the catalog has no entry.
def get_stock_name(ticker: str) -> str:
    symbol: str = ticker.strip().upper()
    return _names_by_symbol().get(symbol, symbol)


# Each catalog symbol's category: stock, etf or gold.
def get_symbol_categories() -> dict[str, str]:
    return dict(_categories_by_symbol())


# Company tickers that have bars, sorted.
def get_available_stocks() -> list[str]:
    return _tickers_in_categories((STOCK,))


# ETF tickers that have bars, sorted. Gold funds count as ETFs too.
def get_available_etfs() -> list[str]:
    return _tickers_in_categories((ETF, GOLD))


# Gold-fund tickers that have bars, sorted.
def get_available_gold() -> list[str]:
    return _tickers_in_categories((GOLD,))


# Symbols that never returned a single bar, sorted.
def get_missing_tickers() -> list[str]:
    return sorted(symbol for symbol, status in _status_by_symbol().items() if status == "missing")


# Each symbol's status: active, lagging, stopped or missing.
def get_status_by_symbol() -> dict[str, str]:
    return dict(_status_by_symbol())


# Symbols that stopped trading, meaning their last bar is five or more sessions back.
def get_stopped_tickers() -> list[str]:
    return sorted(symbol for symbol, status in _status_by_symbol().items() if status == "stopped")


# -------- Cache Helpers --------
# (path, size, mtime) of one file, which is what tells the caches to reload.
def _signature(path: str, required: bool = True) -> tuple | None:
    if not os.path.exists(path):
        if required:
            raise RuntimeError(f"Market data file not found: {path}")
        return None
    stat = os.stat(path)
    return os.path.abspath(path), stat.st_size, stat.st_mtime_ns


# The signature of every bar file, so a write to any part of the set invalidates the caches.
def _bars_signature() -> tuple:
    return tuple(_signature(path) for path in bar_files())


# The cached value for a key, rebuilt when its signature changed.
def _cached_value(key: str, signature: tuple | None, build):
    entry = _CACHE.get(key)
    if entry is not None and entry[0] == signature:
        return entry[1]
    value = build()
    _CACHE[key] = (signature, value)
    return value


# The catalog's symbol to name map, cached per file change.
def _names_by_symbol() -> dict[str, str]:
    return _cached_value("symbols", _signature(SYMBOLS_FILE), _read_symbol_names)


# Every symbol that has bars, cached per file change.
def _tickers_with_bars() -> list[str]:
    return _cached_value("tickers_with_bars", _bars_signature(), _read_tickers_with_bars)


# The catalog's symbol to category map, cached per file change.
def _categories_by_symbol() -> dict[str, str]:
    return _cached_value("categories", _signature(SYMBOLS_FILE), _read_symbol_categories)


# The symbol to status map, cached per file change.
def _status_by_symbol() -> dict[str, str]:
    return _cached_value("status", _signature(STATUS_FILE, required=False), _read_symbol_status)


# Bar counts for the symbols that still trade, cached per file change.
def _tradable_bars_by_symbol() -> dict[str, int]:
    return _cached_value("tradable_bars", _signature(STATUS_FILE, required=False), _read_tradable_bars)


# Symbols of the given categories that have bars.
def _tickers_in_categories(kinds: tuple[str, ...]) -> list[str]:
    categories: dict[str, str] = _categories_by_symbol()
    available: set[str] = set(_tickers_with_bars())
    return sorted(symbol for symbol, category in categories.items() if category in kinds and symbol in available)


# -------- History Helpers --------
# Histories for a large request: the whole file is loaded once, then served from memory.
def _all_histories(symbols: list[str]) -> dict[str, StockData]:
    global _HISTORY_SIGNATURE
    with _LOAD_LOCK:
        signature: tuple = _bars_signature()
        if signature != _HISTORY_SIGNATURE:
            _HISTORY_CACHE.clear()
            _SYMBOL_CACHE.clear()
            _HISTORY_CACHE.update(_read_all_histories())
            _HISTORY_SIGNATURE = signature

        return {symbol: _HISTORY_CACHE[symbol] for symbol in symbols if symbol in _HISTORY_CACHE}


# Histories for a small request, reading only those symbols' row groups.
def _selected_histories(symbols: list[str]) -> dict[str, StockData]:
    global _SYMBOL_CACHE_SIGNATURE
    wanted: list[str] = list(dict.fromkeys(symbols))
    with _LOAD_LOCK:
        signature = _bars_signature()
        if signature != _SYMBOL_CACHE_SIGNATURE:
            _SYMBOL_CACHE.clear()
            _SYMBOL_CACHE_SIGNATURE = signature

        # A loaded universe already holds every bar, so never keep a second copy of it.
        if _HISTORY_CACHE and signature == _HISTORY_SIGNATURE:
            return {symbol: _HISTORY_CACHE[symbol] for symbol in wanted if symbol in _HISTORY_CACHE}

        missing: list[str] = [symbol for symbol in wanted if symbol not in _SYMBOL_CACHE]
        if missing:
            for symbol, history in _read_requested_histories(missing).items():
                _SYMBOL_CACHE[symbol] = history
                _SYMBOL_CACHE.move_to_end(symbol)
            while len(_SYMBOL_CACHE) > SYMBOL_CACHE_LIMIT:
                _SYMBOL_CACHE.popitem(last=False)

        return {symbol: _SYMBOL_CACHE[symbol] for symbol in wanted if symbol in _SYMBOL_CACHE}


# One history cut to a date range; the slices stay views because the codes are sorted.
def _slice_history(history: StockData, start: str, end: str | None) -> StockData | None:
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


# Reject a range whose start sits after its end.
def _validate_range(start: str, end: str | None) -> None:
    start_dt: datetime = _parse_date(start, "start")
    if end is None:
        return
    if start_dt > _parse_date(end, "end"):
        raise ValueError(f"Invalid date range: start ({start}) must not be after end ({end}).")


# Parse one YYYY-MM-DD string, naming which bound was wrong when it fails.
def _parse_date(value: str, label: str) -> datetime:
    try:
        return datetime.strptime(value, DATE_FORMAT)
    except ValueError:
        raise ValueError(f"Invalid {label} date ({value}). Expected YYYY-MM-DD.") from None


# The range as a phrase, for error messages.
def _describe_range(start: str, end: str | None) -> str:
    return f" from {start}" + (f" to {end}" if end is not None else "")


# -------- Readers --------
# The catalog's Symbol and Name columns as a dict.
def _read_symbol_names() -> dict[str, str]:
    table = pq.read_table(SYMBOLS_FILE, columns=["Symbol", "Name"])
    return dict(zip(table.column("Symbol").to_pylist(), table.column("Name").to_pylist()))


# The catalog's Symbol and Category columns, insisting the category column exists.
def _read_symbol_categories() -> dict[str, str]:
    if CATEGORY_COLUMN not in pq.read_schema(SYMBOLS_FILE).names:
        raise RuntimeError(
            f"{os.path.relpath(SYMBOLS_FILE)} has no {CATEGORY_COLUMN} column. "
            "Run: python -m app.database.market.symbol_categories"
        )
    table = pq.read_table(SYMBOLS_FILE, columns=["Symbol", CATEGORY_COLUMN])
    return dict(zip(table.column("Symbol").to_pylist(), table.column(CATEGORY_COLUMN).to_pylist()))


# Every symbol with bars; the dictionary encoding means one small read per row group.
def _read_tickers_with_bars() -> list[str]:
    table = pq.read_table(bar_files(), columns=["Symbol"], read_dictionary=["Symbol"])
    column = table.column("Symbol")
    if isinstance(column, pa.ChunkedArray):
        if pa.types.is_dictionary(column.type):
            return sorted({label for chunk in column.chunks for label in chunk.dictionary.to_pylist()})
        return column.unique().to_pylist()
    if pa.types.is_dictionary(column.type):
        return column.dictionary.to_pylist()
    return column.unique().to_pylist()


# The newest Date in one file, taken from row-group statistics when they are there.
def _newest_code_in(path: str) -> int | None:
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


# The newest session across every bar file, falling back to reading the Date column.
def _read_latest_date() -> str:
    newest: int | None = None
    for path in bar_files():
        value: int | None = _newest_code_in(path)
        if value is None:
            newest = None
            break
        if newest is None or value > newest:
            newest = value
    if newest is None:
        newest = int(np.max(_codes_from_table(_read_table(["Date"]))))
    CALENDAR.register(labels_from_codes(np.array([newest], dtype=np.int32)))
    return CALENDAR.label(newest)


# The requested columns from every bar file; filters still skip row groups.
def _read_table(columns: list[str], filters: list | None = None) -> pa.Table:
    return pq.read_table(bar_files(), columns=columns, filters=filters)


# The Date column as int32 day numbers.
def _codes_from_table(table: pa.Table) -> np.ndarray:
    column = table.column("Date")
    if isinstance(column, pa.ChunkedArray):
        column = column.combine_chunks()
    return column.to_numpy(zero_copy_only=False)


# Every trading day in the bars as sorted int32 codes.
def _read_trading_calendar() -> np.ndarray:
    sessions: np.ndarray | None = _known_sessions()
    codes: np.ndarray = sessions if sessions is not None else np.unique(_codes_from_table(_read_table(["Date"])))
    CALENDAR.register(labels_from_codes(codes))
    return codes


# Sessions collected while the whole universe was read, or None if it has not been read.
def _known_sessions() -> np.ndarray | None:
    if _SESSIONS is not None and _HISTORY_CACHE and _HISTORY_SIGNATURE == _bars_signature():
        return _SESSIONS
    return None


# The whole bar file as StockData objects, grouped by symbol.
def _read_all_histories() -> dict[str, StockData]:
    paths: list[str] = bar_files()
    return _build_histories(_iter_bar_batches(paths), _count_rows(paths), complete=True)


# Only the requested symbols, letting row-group statistics skip the rest.
def _read_requested_histories(symbols: list[str]) -> dict[str, StockData]:
    filters = [("Symbol", "=", symbols[0])] if len(symbols) == 1 else [("Symbol", "in", symbols)]
    table: pa.Table = _read_table(BAR_COLS, filters)
    return _build_histories(table.to_batches(), table.num_rows)


# Stream the bars of every file, one row group at a time.
def _iter_bar_batches(paths: list[str]):
    for path in paths:
        for batch in pq.ParquetFile(path).iter_batches(batch_size=BATCH_ROWS, columns=BAR_COLS):
            yield batch


# Total bars across the given files.
def _count_rows(paths: list[str]) -> int:
    return sum(pq.ParquetFile(path).metadata.num_rows for path in paths)


# Every event of one kind grouped by symbol, so a dividend lookup is a dict hit, not a parquet read.
def _events_by_symbol(kind: int) -> dict[str, tuple[np.ndarray, np.ndarray]]:
    return _cached_value(f"actions_{kind}", _signature(ACTIONS_FILE, required=False), lambda: _read_events_by_symbol(kind))


# One kind's events per symbol; the file is sorted, so each run of equal symbols is one ticker.
def _read_events_by_symbol(kind: int) -> dict[str, tuple[np.ndarray, np.ndarray]]:
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

    edges: np.ndarray = np.flatnonzero(symbols[1:] != symbols[:-1]) + 1
    starts = np.concatenate((np.zeros(1, dtype=np.int64), edges)).tolist()
    ends = np.concatenate((edges, np.array([len(symbols)], dtype=np.int64))).tolist()
    return {str(symbols[start]): (codes[start:end], amounts[start:end]) for start, end in zip(starts, ends)}


# One event series cut to the requested range; start=None means from DEFAULT_START.
def _events_in_range(codes: np.ndarray, amounts: np.ndarray, start: str | None, end: str | None) -> tuple[np.ndarray, np.ndarray]:
    if codes.size == 0:
        return codes, amounts

    start_code: np.int32 = to_code(start or DEFAULT_START)
    end_code: np.int32 = to_code(end) if end is not None else np.int32(np.iinfo(np.int32).max)
    keep = (codes >= start_code) & (codes <= end_code)
    return codes[keep], amounts[keep]


# Streamed bars into one StockData per symbol, whose arrays are slices of shared blocks.
# A complete read also leaves the sessions behind, so the calendar never reads Date again.
def _build_histories(batches, rows: int, complete: bool = False) -> dict[str, StockData]:
    global _SESSIONS
    if rows == 0:
        return {}

    date: np.ndarray = np.empty(rows, dtype=np.int32)
    prices: dict[str, np.ndarray] = {name: np.empty(rows, dtype=np.float32) for name in ("Open", "High", "Low", "Close")}
    volume: np.ndarray = np.empty(rows, dtype=np.float32)
    symbols: np.ndarray = np.empty(rows, dtype=np.int32)
    ids: dict[str, int] = {}
    sessions: list[np.ndarray] = []
    at: int = 0

    for batch in batches:
        count: int = batch.num_rows
        encoded = pc.dictionary_encode(batch.column("Symbol"))
        local = np.array([ids.setdefault(label, len(ids)) for label in encoded.dictionary.to_pylist()], dtype=np.int32)
        symbols[at:at + count] = local[encoded.indices.to_numpy()]
        dates = batch.column("Date").to_numpy()
        date[at:at + count] = dates
        sessions.append(np.unique(dates))
        CALENDAR.register(labels_from_codes(sessions[-1]))
        for name, target in prices.items():
            target[at:at + count] = batch.column(name).to_numpy()
        volume[at:at + count] = batch.column("Volume").to_numpy()
        at += count

    if complete and sessions:
        _SESSIONS = np.unique(np.concatenate(sessions))

    names: list[str] = [""] * len(ids)
    for label, index in ids.items():
        names[index] = label

    # One run of equal ids is one ticker, because the bars for a symbol are stored together.
    edges: np.ndarray = np.flatnonzero(symbols[1:] != symbols[:-1]) + 1
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


# The status file as symbol -> status.
def _read_symbol_status() -> dict[str, str]:
    if not os.path.exists(STATUS_FILE):
        return {}
    table = pq.read_table(STATUS_FILE, columns=["Symbol", "Status"])
    return dict(zip(table.column("Symbol").to_pylist(), table.column("Status").to_pylist()))


# The status file as symbol -> bar count, for the symbols that still trade.
def _read_tradable_bars() -> dict[str, int]:
    if not os.path.exists(STATUS_FILE):
        return {}
    table = pq.read_table(STATUS_FILE, columns=["Symbol", "Status", "Bars"])
    return {
        symbol: int(count)
        for symbol, status, count in zip(
            table.column("Symbol").to_pylist(),
            table.column("Status").to_pylist(),
            table.column("Bars").to_pylist(),
        )
        if status in TRADABLE_STATUSES
    }
