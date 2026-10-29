# market_data.py — API-facing market data date and serialization helpers.
# Raw history loading, Parquet access, and cache management stay in fetch.py.
from datetime import datetime
from typing import Any

from dateutil.relativedelta import relativedelta

from app.engine.utils.StockData import StockData


def calculate_start_date(timeframe: str) -> str | None:
    """Translate a stock-history API timeframe into its earliest date."""
    normalized = timeframe.lower()
    if normalized == "all":
        return None

    today = datetime.now()
    start_by_timeframe = {
        "1y": today - relativedelta(years=1),
        "2y": today - relativedelta(years=2),
        "5y": today - relativedelta(years=5),
    }
    return start_by_timeframe.get(normalized, start_by_timeframe["1y"]).strftime("%Y-%m-%d")


def serialize_stock_history(stock_data: StockData, ticker: str, timeframe: str) -> dict[str, Any]:
    """Convert a StockData record to the existing stock-history API response."""
    normalized_ticker = ticker.strip().upper()
    bars = [
        {
            "date": str(date),
            "open": float(open_price),
            "high": float(high),
            "low": float(low),
            "close": float(close),
            "volume": float(volume),
        }
        for date, open_price, high, low, close, volume in zip(
            stock_data.dates,
            stock_data.open_price,
            stock_data.high,
            stock_data.low,
            stock_data.close_price,
            stock_data.volume,
        )
    ]
    return {
        "ticker": normalized_ticker,
        "timeframe": timeframe,
        "total_bars": len(bars),
        "data": bars,
    }
