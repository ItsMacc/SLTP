# -------- Imports --------
import numpy as np
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from typing import Any, Dict, List
from app.database.db_client import get_db_client
from app.utils.StockData import StockData

# -------- Global Cache --------
_GLOBAL_CACHE = {
    "date": None,
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
        "1y": today - timedelta(days=365),
        "2y": today - timedelta(days=365 * 2),
        "5y": today - timedelta(days=365 * 5),
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


# -------- Stock Data Queries --------
def get_stock_history(ticker: str,
                      start: str | None = None,
                      end: str | None = None,
                      client=None) -> StockData:
    validate_dates(start, end)

    global _GLOBAL_CACHE

    # Read-only check: if stock is already cached, return sliced copy without modifying cache
    if ticker in _GLOBAL_CACHE["histories"]:
        stock_data = _GLOBAL_CACHE["histories"][ticker]
    else:
        # Fetch directly from database for fast single-stock query without writing to cache
        if client is None:
            client = get_db_client()

        query = """
            SELECT
                b.date,
                b.open,
                b.high,
                b.low,
                b.close,
                b.volume
            FROM bars b
            JOIN symbols s ON b.symbol_id = s.id
            WHERE s.name = ?
            ORDER BY b.date
        """
        result = client.execute(query, [ticker])
        rows = result.rows if result else []

        if not rows:
            raise ValueError(f"No data found for {ticker}")

        stock_data = _build_stock_data(ticker, rows)

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
                           client=None) -> Dict[str, Any]:
    if client is None:
        client = get_db_client()

    start_date = calculate_start_date(timeframe)
    stock_data = get_stock_history(ticker=ticker, start=start_date, client=client)

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
                        client=None) -> dict[str, StockData]:
    if not tickers:
        return {}

    validate_dates(start, end)

    global _GLOBAL_CACHE

    # Identify missing tickers not yet loaded into cache
    missing_tickers = [t for t in tickers if t not in _GLOBAL_CACHE["histories"]]

    # Fetch missing full histories in parallel and write ONLY missing symbols to cache
    if missing_tickers:
        if client is None:
            client = get_db_client()

        batch_size = 10
        max_workers = 8
        batches = [missing_tickers[i:i + batch_size] for i in range(0, len(missing_tickers), batch_size)]

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_batch = {
                executor.submit(_fetch_batch, batch, client): batch for batch in batches
            }
            for future in as_completed(future_to_batch):
                try:
                    data_by_ticker = future.result()
                    for ticker, t_rows in data_by_ticker.items():
                        if t_rows:
                            _GLOBAL_CACHE["histories"][ticker] = _build_stock_data(ticker, t_rows)
                except Exception as exc:
                    print(f"Batch fetch generated an exception: {exc}")

    # Return sliced StockData copies from cache without modifying cached instances
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


def _fetch_batch(batch_subset: list,
                 client: Any) -> dict[str, list]:
    placeholders = ", ".join(["?"] * len(batch_subset))
    query = f"""
        SELECT
            s.name,
            b.date,
            b.open,
            b.high,
            b.low,
            b.close,
            b.volume
        FROM bars b
        JOIN symbols s ON b.symbol_id = s.id
        WHERE s.name IN ({placeholders})
        ORDER BY s.name, b.date
    """
    params = list(batch_subset)

    result = client.execute(query, params)
    rows = result.rows if result else []

    data_by_ticker = {t: [] for t in batch_subset}
    for r in rows:
        t_name = r[0]
        if t_name in data_by_ticker:
            data_by_ticker[t_name].append(r[1:])
    return data_by_ticker