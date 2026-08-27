from datetime import datetime, timedelta
from typing import Any, Dict, List
import numpy as np
from app.database.db_client import get_db_client
from app.utils.StockData import StockData


# --- Date Helpers ---

def calculate_start_date(timeframe: str) -> str | None:
    tf = timeframe.lower()
    if tf == "all":
        return None

    today = datetime.now()
    mapping = {
        "1y": today - timedelta(days=365),
        "2y": today - timedelta(days=365 * 2),
        "5y": today - timedelta(days=365 * 5),
    }

    start_dt = mapping.get(tf, mapping["1y"])
    return start_dt.strftime("%Y-%m-%d")


def validate_dates(start_date: str | None = None, end_date: str | None = None) -> bool:
    fmt = "%Y-%m-%d"
    s_dt, e_dt = None, None

    if start_date is not None:
        try:
            s_dt = datetime.strptime(start_date, fmt)
        except ValueError:
            raise ValueError(f"Invalid start_date format ({start_date}). Expected YYYY-MM-DD")

    if end_date is not None:
        try:
            e_dt = datetime.strptime(end_date, fmt)
        except ValueError:
            raise ValueError(f"Invalid end_date format ({end_date}). Expected YYYY-MM-DD")

    if s_dt is not None and e_dt is not None and s_dt >= e_dt:
        raise ValueError(f"Invalid date range: start_date ({start_date}) must be before end_date ({end_date}).")

    return True


# --- Database Queries ---

def _build_stock_data(ticker: str, rows: list) -> StockData:
    """Helper to convert SQL rows into a vectorized StockData instance."""
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


def get_stock_history(ticker: str, start: str | None = None, end: str | None = None, client=None) -> StockData:
    if client is None:
        client = get_db_client()

    validate_dates(start, end)

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
    """
    params = [ticker]

    if start is not None:
        query += " AND b.date >= ?"
        params.append(start)

    if end is not None:
        query += " AND b.date <= ?"
        params.append(end)

    query += " ORDER BY b.date"

    result = client.execute(query, params)
    rows = result.rows if result else []

    if not rows:
        date_range = ""
        if start is not None:
            date_range += f" from {start}"
        if end is not None:
            date_range += f" to {end}"
        raise ValueError(f"No data found for {ticker}{date_range}")

    return _build_stock_data(ticker, rows)


def get_stock_history_json(ticker: str, timeframe: str = "1y", client=None) -> Dict[str, Any]:
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


def get_stock_histories(tickers: list[str], start: str | None = None, end: str | None = None, client=None) -> dict[str, StockData]:
    if not tickers:
        return {}

    if client is None:
        client = get_db_client()

    validate_dates(start, end)

    placeholders = ", ".join(["?"] * len(tickers))
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
    """
    params = list(tickers)

    if start is not None:
        query += " AND b.date >= ?"
        params.append(start)

    if end is not None:
        query += " AND b.date <= ?"
        params.append(end)

    query += " ORDER BY s.name, b.date"

    result = client.execute(query, params)
    rows = result.rows if result else []

    data_by_ticker = {t: [] for t in tickers}
    for r in rows:
        t_name = r[0]
        if t_name in data_by_ticker:
            data_by_ticker[t_name].append(r[1:])

    return {
        ticker: _build_stock_data(ticker, t_rows)
        for ticker, t_rows in data_by_ticker.items()
        if t_rows
    }