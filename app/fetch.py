from datetime import datetime, timedelta
from dotenv import load_dotenv
import os
import numpy as np
from typing import Dict, Any, List
import libsql_client
from app.utils.StockData import StockData

# Load environment variables for cloud connection
load_dotenv()

TURSO_URL = os.getenv("TURSO_URL")
TURSO_AUTH_TOKEN = os.getenv("TURSO_AUTH_TOKEN")


def calculate_start_date(timeframe: str) -> str | None:
    """Translates user timeframes into an ISO start date string."""
    tf = timeframe.lower()
    if tf == "all":
        return None  # No lower bound; fetches everything in Turso DB

    today = datetime.now()
    mapping = {
        "1y": today - timedelta(days=365),
        "2y": today - timedelta(days=365 * 2),
        "5y": today - timedelta(days=365 * 5),
    }

    start_dt = mapping.get(tf, mapping["1y"])
    return start_dt.strftime("%Y-%m-%d")


def validate_dates(start_date: str | None = None, end_date: str | None = None) -> bool:
    if start_date is not None or end_date is not None:
        try:
            if start_date is not None:
                start_date = str(np.datetime64(start_date, "D"))
            if end_date is not None:
                end_date = str(np.datetime64(end_date, "D"))
        except Exception:
            raise ValueError("Invalid date format. Expected YYYY-MM-DD")

    if start_date is not None and end_date is not None:
        if start_date >= end_date:
            raise ValueError(
                f"Invalid date range: start_date ({start_date}) "
                f"must be before end_date ({end_date})."
            )

    return True


def get_stock_history(ticker: str, start: str | None = None, end: str | None = None) -> StockData:
    validate_dates(start, end)

    # Connect synchronously to Turso cloud database
    client = libsql_client.create_client_sync(url=TURSO_URL, auth_token=TURSO_AUTH_TOKEN)

    try:
        query = """
            SELECT
                b.date,
                b.open,
                b.high,
                b.low,
                b.close,
                b.volume
            FROM bars b
            JOIN symbols s
                ON b.symbol_id = s.id
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
        rows = result.rows if result.rows else []

    finally:
        client.close()

    if not rows:
        date_range = ""
        if start is not None:
            date_range += f" from {start}"
        if end is not None:
            date_range += f" to {end}"

        raise ValueError(f"No data found for {ticker}{date_range}")

    return StockData(
        ticker=ticker,
        dates=np.array([r[0] for r in rows]),
        open_price=np.array([r[1] for r in rows], dtype=float),
        high=np.array([r[2] for r in rows], dtype=float),
        low=np.array([r[3] for r in rows], dtype=float),
        close_price=np.array([r[4] for r in rows], dtype=float),
        volume=np.array([r[5] for r in rows], dtype=float)
    )


def get_stock_history_json(ticker: str, timeframe: str = "1y") -> Dict[str, Any]:
    """
    Fetches stock history using timeframe string (1y, 2y, 5y, all)
    and formats it into JSON for the web UI.
    """
    start_date = calculate_start_date(timeframe)
    stock_data = get_stock_history(ticker=ticker, start=start_date)

    bars: List[Dict[str, Any]] = []
    for i in range(len(stock_data.dates)):
        bars.append({
            "date": str(stock_data.dates[i]),
            "open": float(stock_data.open_price[i]),
            "high": float(stock_data.high[i]),
            "low": float(stock_data.low[i]),
            "close": float(stock_data.close_price[i]),
            "volume": float(stock_data.volume[i]),
        })

    return {
        "ticker": ticker.upper(),
        "timeframe": timeframe,
        "total_bars": len(bars),
        "data": bars
    }


def get_stock_histories(tickers: list[str], start: str | None = None,
                        end: str | None = None) -> dict[str, StockData]:
    if not tickers:
        return {}

    validate_dates(start, end)
    client = libsql_client.create_client_sync(url=TURSO_URL,
                                              auth_token=TURSO_AUTH_TOKEN)

    try:
        # Create placeholders (?, ?, ?) dynamically based on the number of tickers
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
            JOIN symbols s
                ON b.symbol_id = s.id
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
        rows = result.rows if result.rows else []

    finally:
        client.close()

    # Group rows by ticker in memory
    data_by_ticker = {ticker: [] for ticker in tickers}
    for r in rows:
        t_name = r[0]
        if t_name in data_by_ticker:
            data_by_ticker[t_name].append(r[1:])

    # Construct StockData objects for each
    result_dict = {}
    for ticker, t_rows in data_by_ticker.items():
        if not t_rows:
            continue
        result_dict[ticker] = StockData(
            ticker=ticker,
            dates=np.array([r[0] for r in t_rows]),
            open_price=np.array([r[1] for r in t_rows], dtype=float),
            high=np.array([r[2] for r in t_rows], dtype=float),
            low=np.array([r[3] for r in t_rows], dtype=float),
            close_price=np.array([r[4] for r in t_rows], dtype=float),
            volume=np.array([r[5] for r in t_rows], dtype=float)
        )

    return result_dict