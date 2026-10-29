# fetch.py — Read layer over the local Parquet market data.
#
# Loads the master parquet file into an in-memory cache once, then serves
# raw StockData histories and cached symbol data to strategies, managers and runners.

# -------- Imports --------
import json
import numpy as np
import os
import pandas as pd
from typing import Dict, List

import pyarrow.parquet as pq
from app.database.db_client import get_parquet_dir
from app.engine.utils.StockData import StockData
from app.database.db import load_etfs, load_gold, load_sp500, load_sp400, load_sp600, load_tsx60

# -------- Global Cache --------
_GLOBAL_CACHE = {
    "loaded": False,
    "histories": {},
}
_CACHE_FILE_SIGNATURE: tuple[str, int, int] | None = None
_SINGLE_HISTORY_CACHE: dict[str, StockData] = {}
_SINGLE_HISTORY_SIGNATURE: tuple[str, int, int] | None = None
_SYMBOL_DETAILS: list[dict[str, str]] | None = None
_SYMBOL_NAME_BY_TICKER: dict[str, str] | None = None
_SYMBOL_DETAILS_SIGNATURE: tuple[str, int, int] | None = None
_LATEST_TRADING_DATE: str | None = None
_LATEST_TRADING_DATE_SIGNATURE: tuple[str, int, int] | None = None
_UNIVERSE_CACHE: dict[str, tuple[str, ...]] = {}
_UNIVERSE_CACHE_SIGNATURE: tuple[str, int, int] | None = None


def validate_dates(start_date: str | None = None,
                   end_date: str | None = None) -> bool:
    fmt = "%Y-%m-%d"
    s_dt, e_dt = None, None

    # Validate and parse start date string format if provided
    if start_date is not None:
        try:
            s_dt = datetime.strptime(start_date, fmt)
        except ValueError:
            raise ValueError(f"Invalid start_date format ({start_date}). Expected YYYY-MM-DD")

    # Validate and parse end date string format if provided
    if end_date is not None:
        try:
            e_dt = datetime.strptime(end_date, fmt)
        except ValueError:
            raise ValueError(f"Invalid end_date format ({end_date}). Expected YYYY-MM-DD")

    # Ensure start date precedes end date when both are specified
    if s_dt is not None and e_dt is not None and s_dt >= e_dt:
        raise ValueError(f"Invalid date range: start_date ({start_date}) must be before end_date ({end_date}).")

    return True

def _write_symbol_catalog(parquet_path: str, signature: tuple[str, int, int]) -> None:
    """Persist the small symbol/name and category catalog for later API starts."""
    if not _SYMBOL_DETAILS:
        return
    catalog_path = f"{parquet_path}.symbols.json"
    temp_catalog_path = f"{catalog_path}.{os.getpid()}.tmp"
    try:
        with open(temp_catalog_path, "w", encoding="utf-8") as catalog_file:
            json.dump(
                {
                    "mtime_ns": signature[1],
                    "size": signature[2],
                    "details": _SYMBOL_DETAILS,
                    "universe_members": {
                        kind: list(members) for kind, members in _UNIVERSE_CACHE.items()
                    },
                },
                catalog_file,
                separators=(",", ":"),
            )
        os.replace(temp_catalog_path, catalog_path)
    except OSError:
        # The in-process cache still works when the data directory is read-only.
        try:
            os.unlink(temp_catalog_path)
        except OSError:
            pass



def _available_symbols(kind: str) -> List[str]:
    """Filter the cached Parquet symbol catalog without loading price histories."""
    global _UNIVERSE_CACHE, _UNIVERSE_CACHE_SIGNATURE
    details = _load_symbol_details()
    signature = _SYMBOL_DETAILS_SIGNATURE
    if _UNIVERSE_CACHE_SIGNATURE != signature:
        _UNIVERSE_CACHE = {}
        _UNIVERSE_CACHE_SIGNATURE = signature
    cached = _UNIVERSE_CACHE.get(kind)
    if cached is not None:
        return list(cached)

    loaders = {
        "etfs": load_etfs,
        "stocks": lambda: load_sp500() + load_sp400() + load_sp600() + load_tsx60(),
        "gold": load_gold,
    }
    members = set(loaders[kind]())
    result = tuple(item["ticker"] for item in details if item["ticker"] in members)
    _UNIVERSE_CACHE[kind] = result
    parquet_path = os.path.join(get_parquet_dir(), "market_data.parquet")
    _write_symbol_catalog(parquet_path, signature)
    return list(result)


def get_available_etfs() -> List[str]:
    return _available_symbols("etfs")


def get_available_stocks() -> List[str]:
    return _available_symbols("stocks")


def get_available_gold() -> List[str]:
    return _available_symbols("gold")

# -------- Master Cache Loader Helper --------
def __load_cache() -> None:
    global _GLOBAL_CACHE, _CACHE_FILE_SIGNATURE

    parquet_dir = get_parquet_dir()
    master_file_path = os.path.join(parquet_dir, "market_data.parquet")

    if not os.path.exists(master_file_path):
        # Fail loudly: silently serving an empty universe turns a missing dataset
        # into a confusing "no dates/tickers" error far away from the cause.
        raise RuntimeError(
            f"Market data not found: expected market_data.parquet in {parquet_dir}. "
            "Build the dataset before running a backtest."
        )

    file_stat = os.stat(master_file_path)
    signature = (master_file_path, file_stat.st_mtime_ns, file_stat.st_size)
    if _GLOBAL_CACHE["loaded"] and _CACHE_FILE_SIGNATURE == signature:
        return

    try:
        cols_to_load = ["Symbol", "Date", "Open", "High", "Low", "Close", "Volume"]
        df = pd.read_parquet(
            master_file_path,
            engine="pyarrow",
            memory_map=True,
            columns=cols_to_load
        )
        histories: dict[str, StockData] = {}
        if not df.empty and "Symbol" in df.columns:
            for symbol, group in df.groupby("Symbol", sort=False):
                matrix = group[["Date", "Open", "High", "Low", "Close", "Volume"]].to_numpy()
                histories[symbol] = StockData(
                    ticker=symbol,
                    dates=matrix[:, 0].astype("U"),
                    open_price=matrix[:, 1].astype(float),
                    high=matrix[:, 2].astype(float),
                    low=matrix[:, 3].astype(float),
                    close_price=matrix[:, 4].astype(float),
                    volume=matrix[:, 5].astype(float),
                )

    except Exception as e:
        # Leave the cache unloaded so a later call retries instead of quietly
        # operating on an empty universe.
        raise RuntimeError(
            f"Failed to load market_data.parquet from {parquet_dir}: {e}"
        ) from e

    if not histories:
        raise RuntimeError(
            f"market_data.parquet in {parquet_dir} loaded but contained no symbols."
        )

    _GLOBAL_CACHE = {"loaded": True, "histories": histories}
    _CACHE_FILE_SIGNATURE = signature


# -------- Stock Data Queries --------
def _load_symbol_details() -> list[dict[str, str]]:
    """Load only the small symbol/name columns for list and search endpoints."""
    global _SYMBOL_DETAILS, _SYMBOL_NAME_BY_TICKER, _SYMBOL_DETAILS_SIGNATURE
    global _UNIVERSE_CACHE, _UNIVERSE_CACHE_SIGNATURE
    parquet_path = os.path.join(get_parquet_dir(), "market_data.parquet")
    if not os.path.exists(parquet_path):
        raise RuntimeError(
            f"Market data not found: expected market_data.parquet in {os.path.dirname(parquet_path)}. "
            "Build the dataset before requesting ticker lists."
        )

    file_stat = os.stat(parquet_path)
    signature = (parquet_path, file_stat.st_mtime_ns, file_stat.st_size)
    if _SYMBOL_DETAILS is not None and _SYMBOL_DETAILS_SIGNATURE == signature:
        return _SYMBOL_DETAILS

    # Keep the small symbol catalog across API restarts. Its Parquet signature
    # makes it self-invalidating when ingestion replaces or updates market data.
    catalog_path = f"{parquet_path}.symbols.json"
    try:
        with open(catalog_path, encoding="utf-8") as catalog_file:
            catalog = json.load(catalog_file)
        cached_details = catalog.get("details")
        if (
            catalog.get("mtime_ns") == file_stat.st_mtime_ns
            and catalog.get("size") == file_stat.st_size
            and isinstance(cached_details, list)
            and cached_details
            and all(
                isinstance(item, dict)
                and isinstance(item.get("ticker"), str)
                and isinstance(item.get("name"), str)
                for item in cached_details
            )
        ):
            _SYMBOL_DETAILS = cached_details
            _SYMBOL_NAME_BY_TICKER = {
                item["ticker"]: item["name"] for item in _SYMBOL_DETAILS
            }
            _SYMBOL_DETAILS_SIGNATURE = signature
            cached_universes = catalog.get("universe_members", {})
            if isinstance(cached_universes, dict):
                _UNIVERSE_CACHE = {
                    kind: tuple(tickers)
                    for kind, tickers in cached_universes.items()
                    if kind in {"etfs", "stocks", "gold"}
                    and isinstance(tickers, list)
                    and all(isinstance(ticker, str) for ticker in tickers)
                }
                _UNIVERSE_CACHE_SIGNATURE = signature
            return _SYMBOL_DETAILS
    except (OSError, ValueError, TypeError, KeyError):
        pass

    try:
        schema_columns = set(pq.read_schema(parquet_path).names)
        columns = ["Symbol"]
        if "Name" in schema_columns:
            columns.append("Name")
        frame = pd.read_parquet(parquet_path, engine="pyarrow", columns=columns)
        if "Symbol" not in frame.columns:
            raise ValueError("Parquet market data has no Symbol column.")
        if "Name" not in frame.columns:
            frame["Name"] = frame["Symbol"]
        details = frame[["Symbol", "Name"]].drop_duplicates("Symbol", keep="last")
        _SYMBOL_DETAILS = [
            {
                "ticker": str(row.Symbol),
                "name": str(row.Name) if pd.notna(row.Name) else str(row.Symbol),
            }
            for row in details.itertuples(index=False)
        ]
        _SYMBOL_NAME_BY_TICKER = {item["ticker"]: item["name"] for item in _SYMBOL_DETAILS}
        _SYMBOL_DETAILS_SIGNATURE = signature
        _write_symbol_catalog(parquet_path, signature)
    except Exception as exc:
        raise RuntimeError(f"Failed to read ticker details from {parquet_path}: {exc}") from exc

    if not _SYMBOL_DETAILS:
        raise RuntimeError(f"market_data.parquet in {os.path.dirname(parquet_path)} contained no symbols.")
    return _SYMBOL_DETAILS


def refresh_market_data_cache() -> None:
    """Invalidate process-local symbol and OHLCV caches after a dataset refresh."""
    global _SYMBOL_DETAILS, _SYMBOL_NAME_BY_TICKER, _SYMBOL_DETAILS_SIGNATURE
    global _GLOBAL_CACHE, _CACHE_FILE_SIGNATURE, _SINGLE_HISTORY_CACHE, _SINGLE_HISTORY_SIGNATURE
    global _LATEST_TRADING_DATE, _LATEST_TRADING_DATE_SIGNATURE
    global _UNIVERSE_CACHE, _UNIVERSE_CACHE_SIGNATURE
    _SYMBOL_DETAILS = None
    _SYMBOL_NAME_BY_TICKER = None
    _SYMBOL_DETAILS_SIGNATURE = None
    _GLOBAL_CACHE = {"loaded": False, "histories": {}}
    _CACHE_FILE_SIGNATURE = None
    _SINGLE_HISTORY_CACHE = {}
    _SINGLE_HISTORY_SIGNATURE = None
    _LATEST_TRADING_DATE = None
    _LATEST_TRADING_DATE_SIGNATURE = None
    _UNIVERSE_CACHE = {}
    _UNIVERSE_CACHE_SIGNATURE = None


def get_latest_trading_date() -> str:
    """Read/cache only the Date column to find the latest stored market session."""
    global _LATEST_TRADING_DATE, _LATEST_TRADING_DATE_SIGNATURE
    parquet_path = os.path.join(get_parquet_dir(), "market_data.parquet")
    if not os.path.exists(parquet_path):
        raise RuntimeError(f"Market data not found: expected market_data.parquet in {os.path.dirname(parquet_path)}.")
    stat = os.stat(parquet_path)
    signature = (parquet_path, stat.st_mtime_ns, stat.st_size)
    if _LATEST_TRADING_DATE is not None and _LATEST_TRADING_DATE_SIGNATURE == signature:
        return _LATEST_TRADING_DATE
    try:
        parquet_file = pq.ParquetFile(parquet_path)
        date_column_index = parquet_file.schema.names.index("Date")
        date_maxima = []
        for row_index in range(parquet_file.metadata.num_row_groups):
            stats = parquet_file.metadata.row_group(row_index).column(date_column_index).statistics
            if stats is None or not stats.has_min_max:
                date_maxima = []
                break
            date_maxima.append(stats.max)

        if date_maxima:
            latest = max(date_maxima)
        else:
            frame = pd.read_parquet(parquet_path, engine="pyarrow", columns=["Date"])
            if frame.empty:
                raise RuntimeError("market_data.parquet contains no market dates.")
            latest = frame["Date"].max()
    except (IndexError, KeyError, OSError, ValueError) as exc:
        raise RuntimeError(f"Could not determine the latest date in {parquet_path}: {exc}") from exc

    _LATEST_TRADING_DATE = str(latest)
    _LATEST_TRADING_DATE_SIGNATURE = signature
    return _LATEST_TRADING_DATE


def get_all_tickers() -> List[str]:
    # Symbol-only requests do not need to materialize all OHLCV history in memory.
    return [item["ticker"] for item in _load_symbol_details()]


def get_all_ticker_details() -> List[Dict[str, str]]:
    """Return ticker symbols and their company/fund display names for search."""
    return [item.copy() for item in _load_symbol_details()]


def get_stock_name(ticker: str) -> str:
    """Return a market-data name, falling back to the symbol for older files."""
    global _SYMBOL_NAME_BY_TICKER
    _load_symbol_details()
    return (_SYMBOL_NAME_BY_TICKER or {}).get(ticker.upper(), ticker.upper())

def get_all_stocks() -> List[str]:
    __load_cache()
    global _GLOBAL_CACHE
    stock_universe = set(load_sp500() + load_tsx60())
    return [ticker for ticker in _GLOBAL_CACHE["histories"].keys() if ticker in stock_universe]

def _read_ticker_history(ticker: str) -> StockData:
    """Load one symbol directly from Parquet without hydrating the whole market cache."""
    global _SINGLE_HISTORY_CACHE, _SINGLE_HISTORY_SIGNATURE
    parquet_path = os.path.join(get_parquet_dir(), "market_data.parquet")
    file_stat = os.stat(parquet_path)
    signature = (parquet_path, file_stat.st_mtime_ns, file_stat.st_size)
    if _SINGLE_HISTORY_SIGNATURE != signature:
        _SINGLE_HISTORY_CACHE = {}
        _SINGLE_HISTORY_SIGNATURE = signature
    cached = _SINGLE_HISTORY_CACHE.get(ticker)
    if cached is not None:
        return cached
    try:
        frame = pd.read_parquet(
            parquet_path,
            engine="pyarrow",
            columns=["Symbol", "Date", "Open", "High", "Low", "Close", "Volume"],
            filters=[("Symbol", "=", ticker)],
        )
    except Exception as exc:
        raise RuntimeError(f"Failed to read history for {ticker} from {parquet_path}: {exc}") from exc
    if frame.empty:
        raise ValueError(f"No local Parquet data found for {ticker} in master database")
    frame = frame.sort_values("Date")
    matrix = frame[["Date", "Open", "High", "Low", "Close", "Volume"]].to_numpy()
    history = StockData(
        ticker=ticker,
        dates=matrix[:, 0].astype("U"),
        open_price=matrix[:, 1].astype(float),
        high=matrix[:, 2].astype(float),
        low=matrix[:, 3].astype(float),
        close_price=matrix[:, 4].astype(float),
        volume=matrix[:, 5].astype(float),
    )
    _SINGLE_HISTORY_CACHE[ticker] = history
    return history


def get_stock_history(ticker: str,
                      start: str | None = None,
                      end: str | None = None,
                      ) -> StockData:
    # Return one ticker's history, optionally sliced to a date range
    validate_dates(start, end)
    normalized_ticker = ticker.strip().upper()
    cached = _GLOBAL_CACHE["histories"].get(normalized_ticker)
    stock_data = cached if cached is not None else _read_ticker_history(normalized_ticker)

    if stock_data is None:
        raise ValueError(f"No local Parquet data found for {normalized_ticker} in master database")

    dates = stock_data.dates
    mask = np.ones(len(dates), dtype=bool)

    if start is not None:
        mask &= (dates >= start)
    if end is not None:
        mask &= (dates <= end)

    if not np.any(mask):
        date_range = ""
        if start is not None:
            date_range += f" from {start}"
        if end is not None:
            date_range += f" to {end}"
        raise ValueError(f"No data found for {ticker}{date_range} within specified range")

    return StockData(
        ticker=ticker,
        dates=stock_data.dates[mask],
        open_price=stock_data.open_price[mask],
        high=stock_data.high[mask],
        low=stock_data.low[mask],
        close_price=stock_data.close_price[mask],
        volume=stock_data.volume[mask],
    )


def get_stock_histories(tickers: list[str],
                        start: str | None = None,
                        end: str | None = None,
                        ) -> dict[str, StockData]:
    # Batch version of get_stock_history; missing tickers are silently skipped
    if not tickers:
        return {}

    validate_dates(start, end)
    __load_cache()

    global _GLOBAL_CACHE

    result_dict = {}
    for ticker in tickers:
        if ticker in _GLOBAL_CACHE["histories"]:
            cached_data = _GLOBAL_CACHE["histories"][ticker]
            dates = cached_data.dates
            mask = np.ones(len(dates), dtype=bool)

            if start is not None:
                mask &= (dates >= start)
            if end is not None:
                mask &= (dates <= end)

            if np.any(mask):
                result_dict[ticker] = StockData(
                    ticker=ticker,
                    dates=cached_data.dates[mask],
                    open_price=cached_data.open_price[mask],
                    high=cached_data.high[mask],
                    low=cached_data.low[mask],
                    close_price=cached_data.close_price[mask],
                    volume=cached_data.volume[mask],
                )

    return result_dict


# -------- Helper Methods --------
def _build_stock_data(ticker: str,
                      rows: list) -> StockData:
    matrix = np.array(rows, dtype=object)
    return StockData(
        ticker=ticker,
        dates=matrix[:, 0].astype(str),
        open_price=matrix[:, 1].astype(float),
        high=matrix[:, 2].astype(float),
        low=matrix[:, 3].astype(float),
        close_price=matrix[:, 4].astype(float),
        volume=matrix[:, 5].astype(float),
    )
