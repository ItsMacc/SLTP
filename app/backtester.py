# backtester.py — Runs a strategy day by day and returns what happened.
#
# Market data is loaded once per ticker from the shared cache. Strategy and
# manager callbacks receive an as-of-date StockData view, never future bars.
# Resting exits are evaluated after that day's signals, then queued signal exits
# and entries fill at the next open. A Backtester runs once; build a new one per run.

# -------- Imports --------
import inspect
import numpy as np
from datetime import datetime
from dateutil.relativedelta import relativedelta
from scipy.stats import skew, kurtosis, norm
from app.database.fetch import get_stock_histories
from app.engine.portfolio.portfolio_manager import PortfolioManager
from app.engine.strategy.strategy import Strategy
from app.engine.utils.StockData import StockData
from app.engine.utils.PositionType import PositionType


# -------- Backtester --------
class Backtester:
    def __init__(
        self,
        strategy: Strategy,
        start_date: str,
        end_date: str | None = None,
    ) -> None:
        self.strategy = strategy
        self.manager = PortfolioManager(strategy)
        self.start_date = start_date
        self.end_date = end_date
        self.liquidate_on_end = self.strategy.LIQUIDATE_ON_END

        # Ticker histories are loaded once and indexed once for the whole run.
        self._data: dict[str, dict] = {}
        self.skipped: set[str] = set()
        self._unrealized_at_end = 0.0
        self._equity_records: list[dict] = []
        self._has_run = False
        self._should_exit_accepts_history = (
            len(inspect.signature(strategy.should_exit).parameters) >= 3
        )
        self._has_custom_exit = (
            getattr(strategy.should_exit, "__func__", None) is not Strategy.should_exit
        )
        self._has_resting_exits = False
        self._universe_tickers: set[str] = set()

    # -------- Run --------
    def run(self) -> dict:
        """Simulate the strategy and return metrics, equity, trades and rejections."""
        if self._has_run:
            raise RuntimeError("This Backtester has already run. Build a new one for another simulation.")
        self._has_run = True

        actual_start = self._initialize_universe()
        self._ensure_universe()
        calendar = self._build_calendar(actual_start)
        if not calendar:
            raise ValueError("No trading days available between the start date and the loaded data.")

        self.manager.mark_rebalanced(calendar[0])
        for day_index, current_date in enumerate(calendar):
            # Strategy lifecycle callbacks precede order processing.
            self.manager.refresh_view()
            self.strategy.run_daily(current_date)

            if self.manager.rebalance_due(current_date):
                self.strategy.on_rebalance(current_date)
                self.manager.mark_rebalanced(current_date)

            # A rebalance can change the active universe; cached tickers are cheap to revisit.
            self._ensure_universe()
            bars = self._bars_on(current_date)
            opens = {ticker: bar[0] for ticker, bar in bars.items()}
            closes = {ticker: bar[3] for ticker, bar in bars.items()}

            # Fill pending exits and entries at today's open
            self.manager.fill_pending_exits(current_date, opens)
            filled_tickers = {order.ticker for order in self.manager.pending_orders}
            self.manager.fill_pending_orders(current_date, opens)
            for ticker in filled_tickers:
                data = self._data.get(ticker)
                fill_index = data["date_to_idx"].get(current_date) if data is not None else None
                if fill_index is not None:
                    for trade in self.manager.lots(ticker):
                        if trade.entry_date == current_date:
                            trade.history = self._history_as_of(ticker, fill_index)

            # Evaluate entries against history through today's completed bar.
            self.manager.refresh_view()
            self._process_tickers(current_date, bars)

            # Custom exits use today's completed data and queue next-open orders.
            if self._has_custom_exit and self.manager.open_trades:
                self._process_custom_exits(current_date, bars)

            # Close-based protective exits use today's final OHLC
            self._check_resting_exits(current_date, bars)

            is_last_day = day_index == len(calendar) - 1
            if is_last_day:
                self._unrealized_at_end = self._unrealized_pnl(closes)
                if self.liquidate_on_end:
                    self.manager.close_all(current_date, closes)

            # Exactly one mark/log per date, after all final-day fills.
            self.manager.update_daily_accounting(current_date, closes)
            self._equity_records.append({
                "date": current_date,
                "portfolio_value": float(self.manager.portfolio_value),
                "active_positions": self.manager.active_positions,
                "total_transaction_cost": float(self.manager.total_cost),
            })

        self.manager.refresh_view()
        metrics = self.performance_metrics()
        equity = self._equity_records
        return {
            "metrics": metrics,
            "equity": equity,
            "trades": self.manager.trades,
            "rejections": dict(sorted(self.manager.rejected_orders.items())),
        }

    # -------- Metrics --------
    def performance_metrics(self) -> dict:
        dates, equity_values, _cash_values = self.manager.equity_curve
        if len(equity_values) == 0:
            return {}

        starting_value = float(equity_values[0])
        ending_value = float(equity_values[-1])
        start_dt = datetime.strptime(str(dates[0]), "%Y-%m-%d")
        end_dt = datetime.strptime(str(dates[-1]), "%Y-%m-%d")
        years = max(1, (end_dt - start_dt).days) / 365.25
        cagr = (
            float(((ending_value / starting_value) ** (1.0 / years) - 1.0) * 100.0)
            if starting_value > 0 else 0.0
        )

        daily_returns = np.diff(equity_values) / equity_values[:-1] if len(equity_values) > 1 else np.array([0.0])
        mean_return = float(np.mean(daily_returns))
        std_return = float(np.std(daily_returns, ddof=1)) if len(daily_returns) > 1 else 0.0
        sharpe = round(mean_return / std_return * np.sqrt(252), 4) if std_return > 0 else 0.0

        n = len(daily_returns)
        sr_benchmark_daily = 1.0 / np.sqrt(252)
        if n > 2 and std_return > 0:
            sr_daily = mean_return / std_return
            sk = float(skew(daily_returns))
            kt = float(kurtosis(daily_returns, fisher=False))
            daily_variance = (1.0 - sk * sr_daily + ((kt - 1.0) / 4.0) * sr_daily**2) / (n - 1)
            psr = round(float(norm.cdf((sr_daily - sr_benchmark_daily) / np.sqrt(daily_variance))), 4) if daily_variance > 0 else 0.0
        else:
            psr = 0.0

        negative_returns = daily_returns[daily_returns < 0]
        downside_std = float(np.std(negative_returns, ddof=1)) if len(negative_returns) > 1 else 0.0
        sortino = round(mean_return / downside_std * np.sqrt(252), 4) if downside_std > 0 else 0.0

        peaks = np.maximum.accumulate(equity_values)
        drawdowns = np.divide(peaks - equity_values, peaks, out=np.zeros_like(peaks), where=peaks != 0)
        max_drawdown = round(float(np.max(drawdowns)) * 100.0, 2)
        below_peak = equity_values < peaks
        max_duration = current_duration = 0
        for is_below in below_peak:
            current_duration = current_duration + 1 if is_below else 0
            max_duration = max(max_duration, current_duration)

        # Only evaluate trades that have actually exited/closed
        trade_returns = []
        for trade in self.manager.trades:
            if trade.exit is not None:
                exit_price = trade.exit.price
                direction = -1.0 if trade.position_type is PositionType.SHORT else 1.0
                trade_returns.append(direction * (exit_price - trade.entry_price) / trade.entry_price)

        wins = [value for value in trade_returns if value > 0]
        losses = [value for value in trade_returns if value < 0]
        total_trades = len(trade_returns)
        win_rate = len(wins) / total_trades * 100.0 if total_trades else 0.0
        average_win = sum(wins) / len(wins) * 100.0 if wins else 0.0
        average_loss = sum(losses) / len(losses) * 100.0 if losses else 0.0
        expectancy = (
            (len(wins) / total_trades * average_win / 100.0)
            - (len(losses) / total_trades * abs(average_loss) / 100.0)
            if total_trades else 0.0
        )

        return {
            "starting_value": starting_value,
            "ending_value": ending_value,
            "cagr": round(cagr, 2),
            "sharpe": sharpe,
            "psr": psr,
            "sortino": sortino,
            "expectancy": round(expectancy, 4),
            "win_rate": round(win_rate, 2),
            "loss_rate": round(100.0 - win_rate, 2) if total_trades else 0.0,
            "average_win": round(average_win, 2),
            "average_loss": round(average_loss, 2),
            "max_drawdown": max_drawdown,
            "drawdown_recovery": max_duration,
            "unrealized_profit": round(self._unrealized_at_end, 2),
            "rejected_orders": dict(sorted(self.manager.rejected_orders.items())),
            "equity": self._equity_records,
        }

    # -------- Universe and Data --------
    def _initialize_universe(self) -> str:
        current_dt = datetime.strptime(self.start_date, "%Y-%m-%d")
        for _ in range(60):
            date_str = current_dt.strftime("%Y-%m-%d")
            if self.strategy.initialize_universe(date_str):
                if not self.strategy.tickers:
                    raise ValueError("initialize_universe() returned True but declared no tickers.")
                return date_str
            current_dt += relativedelta(days=1)
        raise ValueError(f"Could not initialize universe from {self.start_date} within 60 days.")

    def _ensure_universe(self) -> None:
        wanted = list(dict.fromkeys([*self.strategy.tickers, *self.manager.open_tickers]))
        self._universe_tickers.update(self.strategy.tickers)
        missing = [ticker for ticker in wanted if ticker not in self._data and ticker not in self.skipped]
        if not missing:
            return

        loaded = get_stock_histories(missing)
        for ticker in missing:
            history = loaded.get(ticker)
            if history is None:
                self.skipped.add(ticker)
                continue
            self._data[ticker] = {
                "history": history,
                "dates": history.dates,
                "open": history.open_price,
                "high": history.high,
                "low": history.low,
                "close": history.close_price,
                "volume": history.volume,
                "date_to_idx": {str(date): idx for idx, date in enumerate(history.dates)},
            }

    def _build_calendar(self, actual_start: str) -> list[str]:
        if not self._data:
            raise ValueError("No price data loaded. initialize_universe() must add locally available tickers.")
        all_dates = set()
        for data in self._data.values():
            all_dates.update(str(date) for date in data["dates"])
        ordered = sorted(all_dates)
        end = self.end_date if self.end_date is not None else ordered[-1]
        return [date for date in ordered if actual_start <= date <= end]

    def _bars_on(self, current_date: str) -> dict[str, tuple[float, float, float, float]]:
        bars = {}
        for ticker, data in self._data.items():
            index = data["date_to_idx"].get(current_date)
            if index is not None:
                bars[ticker] = (
                    float(data["open"][index]),
                    float(data["high"][index]),
                    float(data["low"][index]),
                    float(data["close"][index]),
                )
        return bars

    def _history_as_of(self, ticker: str, index: int) -> StockData:
        data = self._data[ticker]
        end = index + 1
        return StockData(
            ticker=ticker,
            dates=data["dates"][:end],
            open_price=data["open"][:end],
            high=data["high"][:end],
            low=data["low"][:end],
            close_price=data["close"][:end],
            volume=data["volume"][:end],
        )

    # -------- Daily Loop Helpers --------
    def _process_tickers(
        self,
        current_date: str,
        bars: dict[str, tuple[float, float, float, float]],
    ) -> None:
        universe = self._universe_tickers
        held_tickers = self.manager.open_tickers
        ordered = list(self.strategy.tickers)
        for ticker in held_tickers:
            if ticker not in universe:
                ordered.append(ticker)

        max_positions = self.strategy.MAX_POSITIONS
        for ticker in ordered:
            if ticker not in bars:
                continue
            held = self.manager.lots(ticker)
            if ticker in universe:
                max_lots = self.strategy.MAX_LOTS_PER_TICKER
                can_add_lot = max_lots is None or len(held) < max_lots
                has_position_capacity = (
                    max_positions is None
                    or bool(held)
                    or self.manager.active_positions < max_positions
                )
                if can_add_lot and has_position_capacity:
                    history = self._history_for_date(ticker, current_date)
                    if len(history.dates) >= self.strategy.MIN_BARS_REQUIRED:
                        order = self.strategy.on_signal(ticker, history)
                        if order is not None:
                            self.manager.submit_order(order)
                            if (order.stop_loss > 0 or order.take_profit > 0) and not self._has_resting_exits:
                                self._has_resting_exits = True
            if not held:
                continue

    def _process_custom_exits(
        self,
        current_date: str,
        bars: dict[str, tuple[float, float, float, float]],
    ) -> None:
        for ticker in self.manager.open_tickers:
            if ticker not in bars:
                continue
            history = self._history_for_date(ticker, current_date)
            if len(history.dates) < self.strategy.MIN_BARS_REQUIRED:
                continue
            for trade in self.manager.lots(ticker):
                trade.history = history
                if self._should_exit_accepts_history:
                    should_exit = self.strategy.should_exit(ticker, trade)
                else:
                    should_exit = self.strategy.should_exit(ticker, trade)
                if should_exit:
                    self.manager.queue_exit(trade.id)

    def _history_for_date(self, ticker: str, current_date: str) -> StockData:
        index = self._data[ticker]["date_to_idx"][current_date]
        return self._history_as_of(ticker, index)

    def _check_resting_exits(
        self,
        current_date: str,
        bars: dict[str, tuple[float, float, float, float]],
    ) -> None:
        if not self._has_resting_exits:
            return

        for ticker in self.manager.open_tickers:
            bar = bars.get(ticker)
            if bar is None:
                continue
            ticker_lots = self.manager.lots(ticker)
            if not any(trade.stop_loss > 0 or trade.take_profit > 0 for trade in ticker_lots):
                continue
            current_open, current_high, current_low, _close = bar
            self.manager.check_exits(ticker, current_date, current_open, current_high, current_low)

    def _unrealized_pnl(self, closes: dict[str, float]) -> float:
        unrealized = 0.0
        for trade in self.manager.open_trades.values():
            price = closes.get(trade.ticker, self.manager.last_prices.get(trade.ticker, trade.entry_price))
            direction = -1.0 if trade.position_type is PositionType.SHORT else 1.0
            notional = trade.equity_at_entry * trade.allocation
            unrealized += notional * direction * (price - trade.entry_price) / trade.entry_price
        return unrealized
