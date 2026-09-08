# -------- Imports --------
import numpy as np
import os
import pandas as pd
from datetime import datetime
from dateutil.relativedelta import relativedelta
from typing import Any, Dict, List
from app.database.db import load_sp500, load_tsx60
from app.database.db_client import get_parquet_dir
from app.utils.StockData import StockData

# -------- Global Cache --------
_GLOBAL_CACHE = {
    "loaded": False,
    "histories": {}
}


# -------- Date Helpers --------
def calculate_start_date(timeframe: str) -> str | None:
    # Normalize timeframe string to lowercase
    tf = timeframe.lower()
    if tf == "all":
        return None

    # Map timeframe strings to corresponding start dates relative to today
    today = datetime.now()
    mapping = {
        "1y": today - relativedelta(years=1),
        "2y": today - relativedelta(years=2),
        "5y": today - relativedelta(years=5),
    }

    start_dt = mapping.get(tf, mapping["1y"])
    return start_dt.strftime("%Y-%m-%d")


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


# -------- Master Cache Loader Helper --------
def __load_cache() -> None:
    global _GLOBAL_CACHE
    if _GLOBAL_CACHE["loaded"]:
        return

    parquet_dir = get_parquet_dir()
    master_file_path = os.path.join(parquet_dir, "market_data.parquet")

    if not os.path.exists(master_file_path):
        _GLOBAL_CACHE["loaded"] = True
        return

    try:
        df = pd.read_parquet(master_file_path)
        if not df.empty and "Symbol" in df.columns:
            for symbol, group in df.groupby("Symbol"):
                rows = group[["Date", "Open", "High", "Low", "Close", "Volume"]].values.tolist()
                _GLOBAL_CACHE["histories"][symbol] = _build_stock_data(symbol, rows)
    except Exception as e:
        print(f"Error loading master parquet cache: {e}")

    _GLOBAL_CACHE["loaded"] = True


# -------- Stock Data Queries --------
def get_all_tickers() -> List[str]:
    # Returns a list of all unique ticker symbols currently available in the master Parquet database
    __load_cache()
    global _GLOBAL_CACHE
    return list(_GLOBAL_CACHE["histories"].keys())

def get_all_stocks() -> List[str]:
    __load_cache()
    global _GLOBAL_CACHE
    stock_universe = set(load_sp500() + load_tsx60())
    return [ticker for ticker in _GLOBAL_CACHE["histories"].keys() if ticker in stock_universe]

def get_stock_history(ticker: str,
                      start: str | None = None,
                      end: str | None = None,
                      ) -> StockData:
    validate_dates(start, end)
    __load_cache()

    global _GLOBAL_CACHE

    if ticker not in _GLOBAL_CACHE["histories"]:
        raise ValueError(f"No local Parquet data found for {ticker} in master database")

    stock_data = _GLOBAL_CACHE["histories"][ticker]

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


def get_stock_history_json(ticker: str,
                           timeframe: str = "1y",
                           ) -> Dict[str, Any]:
    start_date = calculate_start_date(timeframe)
    stock_data = get_stock_history(ticker=ticker, start=start_date)

    bars: List[Dict[str, Any]] = [
        {
            "date": str(d),
            "open": float(o),
            "high": float(h),
            "low": float(l),
            "close": float(c),
            "volume": float(v),
        }
        for d, o, h, l, c, v in zip(
            stock_data.dates,
            stock_data.open_price,
            stock_data.high,
            stock_data.low,
            stock_data.close_price,
            stock_data.volume,
        )
    ]

    return {
        "ticker": ticker.upper(),
        "timeframe": timeframe,
        "total_bars": len(bars),
        "data": bars,
    }


def get_stock_histories(tickers: list[str],
                        start: str | None = None,
                        end: str | None = None,
                        ) -> dict[str, StockData]:
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
