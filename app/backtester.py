import numpy as np
from datetime import datetime
from dateutil.relativedelta import relativedelta
from app.portfolio.portfolio_manager import TradeRecord
from app.strategies.base import Strategy
from app.utils.StockData import StockData


class Backtester:
    def __init__(self, strategy: Strategy, start_date: str, end_date: str | None = None):
        self.strategy = strategy
        self.manager = strategy.manager
        self.start_date = start_date
        self.end_date = end_date
        self._pending_buys: list[tuple[str, TradeRecord]] = []

    def run(self) -> None:
        # Initialize Universe and get the actual valid start date string
        actual_start_date = self._initialize_universe()

        # Build and validate calendar
        valid_dates = self._build_trading_calendar()
        if not valid_dates:
            raise ValueError("No valid dates found within the specified start and end range.")

        # Filter active dates from actual_start_date onwards (and up to end_date if specified)
        if self.end_date is not None:
            active_dates = [d for d in valid_dates if actual_start_date <= d <= self.end_date]
        else:
            active_dates = [d for d in valid_dates if d >= actual_start_date]

        if not active_dates:
            raise ValueError("No active dates found after initialization and filtering.")

        self.manager.equity_curve = []

        # Pre-cache ticker data mappings for high-performance lookup
        ticker_data = self._pre_cache_ticker_data(active_dates[0])
        sliced_history = StockData("", [], [], [], [], [], [])

        # Iterate day by day
        for current_date in active_dates:
            # Rebalance portfolio
            self.manager.rebalance(current_date)

            # Execute pending buys
            self._execute_pending_buys(current_date, ticker_data)

            # Check exits and signal generation
            for ticker, data in ticker_data.items():
                date_map = data["date_to_idx"]
                if current_date not in date_map:
                    continue

                i = date_map[current_date]

                # Ensure we only backtest past our start index window
                if i < data["start_idx"]:
                    continue

                current_open = float(data["open_price"][i])
                current_high = float(data["high"][i])
                current_low = float(data["low"][i])
                current_close = float(data["close"][i])

                # Check existing positions for stop-loss or take-profit exits
                self.manager.check_exits(ticker, current_open, current_high, current_low, current_date)

                # Slice historical data up to current day to prevent lookahead bias
                self._slice_history_for_ticker(sliced_history, ticker, data, i)

                # Generate strategy signals and queue for tomorrow's open
                try:
                    decision = self.strategy.generate_signal(ticker, sliced_history)
                    if decision and decision.signal == "BUY":
                        trade_record = self.manager.on_signal(ticker, decision)

                        if trade_record is not None:
                            self._pending_buys.append((ticker, trade_record))
                except ValueError:
                    pass

                # Update open position values using today's close price
                self.manager.mark_to_market(ticker, current_close)

            # Record a single clean portfolio-wide equity point per calendar day
            self.manager.equity_curve.append(
                {
                    "date": current_date,
                    "portfolio_value": round(self.manager.portfolio_value, 2)
                }
            )

    # -------- Helper Methods --------
    def _initialize_universe(self) -> str:
        # Continuously loops forward day-by-day until initialize_universe returns True
        current_dt = datetime.strptime(self.start_date, "%Y-%m-%d")
        max_attempts = 60  # Safeguard limit (~2 months)
        attempts = 0

        while attempts < max_attempts:
            date_str = current_dt.strftime("%Y-%m-%d")
            if self.manager.initialize_universe(date_str):
                return date_str

            current_dt += relativedelta(days=1)
            attempts += 1

        raise ValueError(f"Could not initialize universe starting from {self.start_date} within {max_attempts} days.")

    def _build_trading_calendar(self) -> list[str]:
        # Collects and sorts all unique trading dates across cached stock histories within bounds
        histories = self.manager.histories
        if not histories:
            raise ValueError("Manager histories are empty. Ensure universe or histories are populated before running.")

        all_dates = sorted(list(set(d for h in histories.values() for d in h.dates)))

        # If no end_date is specified, use all available data from start_date onwards
        if self.end_date is not None:
            return [d for d in all_dates if self.start_date <= d <= self.end_date]
        else:
            return [d for d in all_dates if d >= self.start_date]

    def _pre_cache_ticker_data(self, active_start_date: str) -> dict:
        # Pre-caches arrays and index maps for each ticker to maximize performance during loops
        ticker_data = {}
        for ticker, history in self.manager.histories.items():
            dates = history.dates
            start_idx = np.searchsorted(dates, active_start_date)
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
        return ticker_data

    def _execute_pending_buys(self, current_date: str, ticker_data: dict) -> None:
        # Executes queued pending buy orders at today's open price and clears the queue
        if not self._pending_buys:
            return

        orders_to_fill = self._pending_buys.copy()
        self._pending_buys.clear()  # Clear so they don't repeat infinitely

        for ticker, trade_record in orders_to_fill:
            data = ticker_data.get(ticker)
            if data and current_date in data["date_to_idx"]:
                i = data["date_to_idx"][current_date]
                open_price = float(data["open"][i])

                if open_price > 0:
                    self.manager.buy_order(ticker, open_price, trade_record, current_date)

    @staticmethod
    def _slice_history_for_ticker(sliced_history: StockData, ticker: str, data: dict, i: int) -> None:
        # Updates the shared sliced_history object up to index `i` to prevent look-ahead bias
        sliced_history.ticker = ticker
        sliced_history.dates = data["dates"][:i + 1]
        sliced_history.open_price = data["open"][:i + 1]
        sliced_history.high = data["high"][:i + 1]
        sliced_history.low = data["low"][:i + 1]
        sliced_history.close_price = data["close"][:i + 1]
        sliced_history.volume = data["volume"][:i + 1]