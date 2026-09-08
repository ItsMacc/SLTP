import numpy as np
from datetime import datetime
from dateutil.relativedelta import relativedelta
from app.portfolio.portfolio_manager import TradeRecord
from app.strategies.base import Strategy
from app.utils.StockData import StockData
from scipy.stats import skew, kurtosis, norm


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
            self.manager.on_rebalance(current_date)

            # Pick up any tickers on_rebalance just added so they're actually simulated
            self._sync_ticker_data(ticker_data, current_date)

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

                current_open = float(data["open"][i])
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

            # Record a clean, unified portfolio equity point once per day
            self.manager.equity_curve.append(
                {
                    "date": current_date,
                    "portfolio_value": round(self.manager.portfolio_value, 2),
                    "active_positions": self.manager.active_positions,
                    "total_transaction_cost": round(self.manager.total_transactions_cost, 4)
                }
            )

    def performance_metrics(self) -> dict:
        """
        Calculates and returns a comprehensive dictionary of performance analytics
        ordered properly from starting values down to equity curve records.
        """
        if not self.manager.equity_curve:
            return {}

        equity_curve = self.manager.equity_curve
        starting_value = float(equity_curve[0]["portfolio_value"])
        ending_value = float(equity_curve[-1]["portfolio_value"])
        pnl = round(ending_value - starting_value, 4)

        # Calculate Compound Annual Growth Rate (CAGR)
        start_dt = datetime.strptime(equity_curve[0]["date"], "%Y-%m-%d")
        end_dt = datetime.strptime(equity_curve[-1]["date"], "%Y-%m-%d")
        days = max(1, (end_dt - start_dt).days)
        years = days / 365.25
        cagr = float(((ending_value / starting_value) ** (1.0 / years) - 1.0) * 100.0) if years > 0 and starting_value > 0 else 0.0
        cagr = round(cagr, 2)

        # Extract daily portfolio values for return-based metrics
        values = [point["portfolio_value"] for point in equity_curve]
        daily_returns = np.diff(values) / values[:-1] if len(values) > 1 else np.array([0.0])

        # Calculate Annualized Sharpe Ratio
        mean_return = float(np.mean(daily_returns))
        std_return = float(np.std(daily_returns, ddof=1)) if len(daily_returns) > 1 else 0.0
        sharpe = round((mean_return / std_return) * np.sqrt(252), 4) if std_return > 0 else 0.0

        # Calculate Probabilistic Sharpe Ratio (PSR)
        psr = 0.5
        try:
            if len(daily_returns) > 2 and std_return > 0:
                sk = float(skew(daily_returns))
                kt = float(kurtosis(daily_returns))
                pearson_kurt = kt + 3.0
                n = len(daily_returns)
                sr_benchmark = 0.0
                denom = np.sqrt((1.0 - sk * sharpe + ((pearson_kurt - 1.0) / 4.0) * (sharpe ** 2)) / (n - 1))
                if denom > 0:
                    stat = (sharpe - sr_benchmark) / denom
                    psr = round(float(norm.cdf(stat)), 4)
        except ImportError:
            psr = round(float(1.0 / (1.0 + np.exp(-1.7 * sharpe))), 4)

        # Calculate Annualized Sortino Ratio
        negative_returns = daily_returns[daily_returns < 0]
        downside_std = float(np.std(negative_returns, ddof=1)) if len(negative_returns) > 1 else 0.0
        sortino = round((mean_return / downside_std) * np.sqrt(252), 4) if downside_std > 0 else 0.0

        # Calculate Max Drawdown and Drawdown Recovery Duration
        peak = values[0]
        max_dd = 0.0
        drawdown_durations = []
        current_dd_duration = 0
        in_drawdown = False

        for val in values:
            if val > peak:
                peak = val
                if in_drawdown:
                    drawdown_durations.append(current_dd_duration)
                    current_dd_duration = 0
                    in_drawdown = False
            else:
                dd = (peak - val) / peak
                if dd > max_dd:
                    max_dd = dd
                if dd > 0:
                    in_drawdown = True
                    current_dd_duration += 1

        if in_drawdown:
            drawdown_durations.append(current_dd_duration)

        max_drawdown = round(max_dd * 100.0, 2)
        drawdown_recovery = max(drawdown_durations) if drawdown_durations else 0

        # Collect closed trade returns for trade-based analytics
        all_closed_returns = []
        for ticker, trade_list in self.manager.trades.items():
            for trade in trade_list:
                if trade.realized_return_pct is not None:
                    all_closed_returns.append(trade.realized_return_pct)

        total_trades = len(all_closed_returns)
        winning_trades = [r for r in all_closed_returns if r > 0]
        losing_trades = [r for r in all_closed_returns if r < 0]

        win_rate = round((len(winning_trades) / total_trades) * 100.0, 2) if total_trades > 0 else 0.0
        loss_rate = round((len(losing_trades) / total_trades) * 100.0, 2) if total_trades > 0 else 0.0
        average_win = round((sum(winning_trades) / len(winning_trades)) * 100.0, 2) if winning_trades else 0.0
        average_loss = round((sum(losing_trades) / len(losing_trades)) * 100.0, 2) if losing_trades else 0.0

        win_prob = len(winning_trades) / total_trades if total_trades > 0 else 0.0
        loss_prob = len(losing_trades) / total_trades if total_trades > 0 else 0.0
        expectancy = round((win_prob * (average_win / 100.0)) - (loss_prob * abs(average_loss / 100.0)), 4)

        # Return metrics ordered properly as requested
        return {
            "starting value": starting_value,
            "ending value": ending_value,
            "PNL": pnl,
            "CAGR": cagr,
            "sharpe": sharpe,
            "PSR": psr,
            "sortino": sortino,
            "max drawdown": max_drawdown,
            "drawdown recovery": drawdown_recovery,
            "win rate": win_rate,
            "loss rate": loss_rate,
            "average win": average_win,
            "average loss": average_loss,
            "expectancy": expectancy,
            "equity": equity_curve,
        }

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
            entry = self._build_cache_entry(history, active_start_date)
            if entry is not None:
                ticker_data[ticker] = entry
        return ticker_data

    def _sync_ticker_data(self, ticker_data: dict, current_date: str) -> None:
        for ticker, history in self.manager.histories.items():
            if ticker in ticker_data:
                continue

            entry = self._build_cache_entry(history, current_date)
            if entry is not None:
                ticker_data[ticker] = entry

    @staticmethod
    def _build_cache_entry(history: StockData, anchor_date: str) -> dict | None:
        dates = history.dates
        start_idx = np.searchsorted(dates, anchor_date)
        if start_idx >= len(dates):
            return None

        return {
            "dates": dates,
            "open": history.open_price,
            "high": history.high,
            "low": history.low,
            "close": history.close_price,
            "volume": history.volume,
            "start_idx": start_idx,
            "date_to_idx": {d: idx for idx, d in enumerate(dates)}
        }

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
