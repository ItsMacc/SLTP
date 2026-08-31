from datetime import datetime
from dateutil.relativedelta import relativedelta
from app.strategies.base import Strategy
from app.utils.StockData import StockData
import numpy as np


def backtest_strategy(strategy: Strategy, period: int = 1):
    # Create sliced_history object once so we can reuse it
    sliced_history = StockData("", [], [], [], [], [], [])

    # Find the start date string
    start_date = datetime.now() - relativedelta(years=period)
    start_date_str = start_date.strftime("%Y-%m-%d")

    # Inital Rebalance
    strategy.rebalance(start_date)

    manager = strategy.manager
    histories = manager.histories

    if not histories:
        return

    # Align and collect all unique trading dates across all tickers chronologically
    all_dates = sorted(list(set(d for h in histories.values() for d in h.dates)))
    valid_dates = [d for d in all_dates if d >= start_date_str]
    if not valid_dates:
        return

    manager.equity_curve = []

    # Pre-cache index mappings for each ticker
    ticker_data = {}
    for ticker, history in histories.items():
        # Use searchsorted for fast index finding since dates are sorted
        dates = history.dates
        start_idx = np.searchsorted(dates, start_date_str)
        if start_idx >= len(dates):
            continue

        ticker_data[ticker] = {
            "dates": dates,
            "open": history.open_price,
            "high": history.high,
            "low": history.low,
            "close": history.close_price,
            "volume": history.volume,
            "start_idx": start_idx,
            "date_to_idx": {d: idx for idx, d in enumerate(dates)}
        }

    # Outer loop: Iterate chronologically day by day across the portfolio
    for current_date in valid_dates:
        # Check for rebalance everyday
        strategy.rebalance(datetime.strptime(current_date, "%Y-%m-%d"))

        # Evaluate each ticker active on this specific date
        for ticker, data in ticker_data.items():
            date_map = data["date_to_idx"]
            if current_date not in date_map:
                continue

            i = date_map[current_date]

            # Ensure we only backtest past our start index window
            if i < data["start_idx"]:
                continue

            current_high = float(data["high"][i])
            current_low = float(data["low"][i])
            current_open = float(data["open"][i])
            current_close = float(data["close"][i])

            # Check existing positions for stop-loss or take-profit exits
            manager.check_exits(ticker, current_date, current_high, current_low)

            # Process pending entry orders at today's open price
            if ticker in manager.pending_entries:
                manager.process_pending_entries(ticker, current_open, current_date)

            # Slice historical data up to the current day for signal evaluation
            sliced_history.ticker = ticker
            sliced_history.dates = data["dates"][:i + 1]
            sliced_history.open_price = data["open"][:i + 1]
            sliced_history.high = data["high"][:i + 1]
            sliced_history.low = data["low"][:i + 1]
            sliced_history.close_price = data["close"][:i + 1]
            sliced_history.volume = data["volume"][:i + 1]

            # Generate strategy signals and register them if valid
            try:
                decision = strategy.generate_signal(ticker, sliced_history)
                if decision.signal == "BUY":
                    manager.on_signal(ticker, decision)
            except ValueError:
                pass

            # Update open position values using today's close price
            manager.mark_to_market(ticker, current_close)

        # Record a single clean portfolio-wide equity point per calendar day
        manager.equity_curve.append(
            {
                "date": current_date,
                "portfolio_value": round(manager.portfolio_index, 2)
            }
        )