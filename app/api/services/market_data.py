# -------- market_data.py --------
# API-facing market data helpers: timeframe maths and the stock-history response.
#
# Raw bars, Parquet access and cache management stay in app/database/market.

# -------- Imports --------
from datetime import datetime
from typing import Any

from dateutil.relativedelta import relativedelta

# Engine imports
from app.engine.utils.StockData import StockData


# -------- Timeframes --------
# Turn a stock-history timeframe into its earliest date; None means all history.
def calculate_start_date(timeframe: str) -> str | None:
    normalized: str = timeframe.lower()
    if normalized == "all":
        return None

    today: datetime = datetime.now()
    start_by_timeframe: dict[str, datetime] = {
        "1y": today - relativedelta(years=1),
        "2y": today - relativedelta(years=2),
        "5y": today - relativedelta(years=5),
    }
    return start_by_timeframe.get(normalized, start_by_timeframe["1y"]).strftime("%Y-%m-%d")


# -------- Serialization --------
# Convert one ticker's history into the stock-history API response body.
#
# Prices go out on today's share basis, the way a charting site draws them: the latest
# bar is the real quote and every earlier bar is restated by the splits that followed it.
# A fund that reverse-split seven times therefore reads as a large number in its early
# years, which is the price that would be comparable with today's share, not the price
# printed on the day. The client formats those with a short K/M suffix.
def serialize_stock_history(stock_data: StockData, ticker: str, timeframe: str) -> dict[str, Any]:
    normalized_ticker: str = ticker.strip().upper()
    bars: list[dict[str, Any]] = [
        {
            "date": str(date),
            "open": float(open_price),
            "high": float(high),
            "low": float(low),
            "close": float(close),
            "volume": float(volume),
        }
        for date, open_price, high, low, close, volume in zip(
            stock_data.labels,
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
