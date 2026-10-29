# backtester.py — Runs a strategy day by day and returns what happened.
#
# Each day calls the strategy's hooks, fills queued orders at the open, checks
# stops and targets, then marks the close. Hooks only see history up to today,
# so there is no lookahead.
#
# Positions still open on the last bar are liquidated as END_OF_BACKTEST unless
# liquidate_on_end is off. A Backtester runs once; build a new one per run.

# -------- Imports --------
import cProfile
import os
import pstats
import time
import numpy as np
from collections import defaultdict
from datetime import datetime
from dateutil.relativedelta import relativedelta
from scipy.stats import skew, kurtosis, norm
from app.database.fetch import get_stock_history
from app.engine.portfolio.portfolio_manager import PortfolioManager
from app.engine.strategy.strategy import Strategy
from app.engine.utils.StockData import StockData
from app.engine.utils.PositionType import PositionType


# -------- Backtester --------
class Backtester:
    def __init__(self,
                 strategy: Strategy,
                 start_date: str,
                 end_date: str | None = None,
                 liquidate_on_end: bool = True,
                 ) -> None:
        # Strategy under test and the book it trades through
        self.strategy: Strategy = strategy
        self.manager: PortfolioManager = PortfolioManager(strategy)

        # The simulation window
        self.start_date: str = start_date
        self.end_date: str | None = end_date

        # Whether the final bar closes every open position
        self.liquidate_on_end: bool = liquidate_on_end

        # Price data per ticker, loaded once and reused
        self._data: dict[str, dict] = {}
        self.skipped: set[str] = set()

        # One reused view; a strategy must not keep a reference to it.
        self._sliced = StockData("", [], [], [], [], [], [])

        self._unrealized_at_end: float = 0.0
        self._has_run: bool = False

    # -------- Run --------
    def run(self) -> dict:
        """Simulate the strategy and return metrics, equity, trades and rejections."""
        if self._has_run:
            raise RuntimeError(
                "This Backtester has already run. Build a new one for another simulation."
            )
        self._has_run = True

        # Build the universe, then load its data and calendar
        actual_start = self._initialize_universe()
        self._ensure_universe()
        calendar = self._build_calendar(actual_start)
        if not calendar:
            raise ValueError("No trading days available between the start date and the loaded data.")

        # Day one is not a rebalance; the baseline is the first trading day,
        # not the date the universe was initialised on.
        self.manager.mark_rebalanced(calendar[0])
        last_date = calendar[-1]

        for current_date in calendar:
            # Strategy hooks first, so a rebalance can add tickers
            self.manager.refresh_view()
            self.strategy.on_day(current_date)

            if self.manager.rebalance_due(current_date):
                self.strategy.on_rebalance(current_date)
                self.manager.mark_rebalanced(current_date)

            # Load tickers the rebalance or an open position introduced
            self._ensure_universe()

            bars = self._bars_on(current_date)
            opens = {ticker: bar[0] for ticker, bar in bars.items()}
            closes = {ticker: bar[3] for ticker, bar in bars.items()}

            # Fill yesterday's orders and exits at today's open
            self.manager.fill_pending(current_date, opens)

            # Stops, signals and discretionary exits
            self._process_tickers(current_date, bars)

            # Mark the close, then optionally liquidate what is still open
            self.manager.mark_to_market(closes)
            if current_date == last_date:
                self._unrealized_at_end = self.manager.portfolio_value - (
                    self.manager.starting_equity
                    + self.manager.realized_pnl
                    - self.manager.total_cost
                )
                if self.liquidate_on_end:
                    self.manager.close_all(current_date, closes)
                    self.manager.mark_to_market(closes)

            self.manager.record_equity(current_date)

        # Refresh so the strategy is not left with a stale view after liquidation
        self.manager.refresh_view()

        return {
            "metrics": self.performance_metrics(),
            "equity": self.manager.equity_curve,
            "trades": self.manager.trades,
            "rejections": dict(sorted(self.manager.rejected_orders.items())),
        }

    # -------- Debug: timed run (temporary) --------
    def run_timed(self, top_n: int = 10) -> dict:
        """Debug copy of run() with per-section timings and call counts. Remove later."""
        if self._has_run:
            raise RuntimeError(
                "This Backtester has already run. Build a new one for another simulation."
            )
        self._has_run = True

        timings: dict[str, float] = defaultdict(float)
        counts: dict[str, int] = defaultdict(int)
        profiler = cProfile.Profile()
        total_start = time.perf_counter()
        profiler.enable()
        try:
            t = time.perf_counter()
            actual_start = self._initialize_universe()
            t = self._lap(timings, "initialize_universe", t)
            self._ensure_universe()
            t = self._lap(timings, "ensure_universe", t)
            calendar = self._build_calendar(actual_start)
            t = self._lap(timings, "build_calendar", t)
            if not calendar:
                raise ValueError("No trading days available between the start date and the loaded data.")

            self.manager.mark_rebalanced(calendar[0])
            last_date = calendar[-1]
            counts["days"] = len(calendar)

            for current_date in calendar:
                t = time.perf_counter()
                self.manager.refresh_view()
                self.strategy.on_day(current_date)
                t = self._lap(timings, "strategy_on_day", t)

                if self.manager.rebalance_due(current_date):
                    counts["rebalances"] += 1
                    self.strategy.on_rebalance(current_date)
                    self.manager.mark_rebalanced(current_date)
                t = self._lap(timings, "rebalance", t)

                self._ensure_universe()
                t = self._lap(timings, "ensure_universe", t)

                bars = self._bars_on(current_date)
                opens = {ticker: bar[0] for ticker, bar in bars.items()}
                closes = {ticker: bar[3] for ticker, bar in bars.items()}
                counts["ticker_bars"] += len(bars)
                t = self._lap(timings, "bars_on_day", t)

                self.manager.fill_pending(current_date, opens)
                t = self._lap(timings, "fill_pending", t)

                self._process_tickers(current_date, bars)
                t = self._lap(timings, "process_tickers", t)

                self.manager.mark_to_market(closes)
                if current_date == last_date:
                    self._unrealized_at_end = self.manager.portfolio_value - (
                        self.manager.starting_equity
                        + self.manager.realized_pnl
                        - self.manager.total_cost
                    )
                    if self.liquidate_on_end:
                        self.manager.close_all(current_date, closes)
                        self.manager.mark_to_market(closes)
                t = self._lap(timings, "mark_to_market", t)

                self.manager.record_equity(current_date)
                t = self._lap(timings, "record_equity", t)

            self.manager.refresh_view()
            metrics = self.performance_metrics()
            self._lap(timings, "performance_metrics", t)
        finally:
            profiler.disable()

        stats = pstats.Stats(profiler)
        top = sorted(stats.stats.items(), key=lambda kv: kv[1][2], reverse=True)[:top_n]
        return {
            "metrics": metrics,
            "total_seconds": time.perf_counter() - total_start,
            "timings_seconds": dict(sorted(timings.items(), key=lambda kv: kv[1], reverse=True)),
            "counts": dict(counts),
            "trades": len(self.manager.trades),
            "function_calls": stats.total_calls,
            "primitive_function_calls": stats.prim_calls,
            "top_functions_by_own_time": [
                {
                    "function": f"{os.path.basename(file)}:{line}({name})",
                    "calls": nc,
                    "own_seconds": tt,
                    "cumulative_seconds": ct,
                }
                for (file, line, name), (cc, nc, tt, ct, _callers) in top
            ],
        }

    @staticmethod
    def _lap(timings: dict[str, float], section: str, start: float) -> float:
        now = time.perf_counter()
        timings[section] += now - start
        return now

    # -------- Metrics --------
    def performance_metrics(self) -> dict:
        # Nothing to summarize without a curve
        if not self.manager.equity_curve:
            return {}

        equity_curve = self.manager.equity_curve
        starting_value = float(equity_curve[0]["portfolio_value"])
        ending_value = float(equity_curve[-1]["portfolio_value"])

        # Annualized growth rate from the curve endpoints
        start_dt = datetime.strptime(equity_curve[0]["date"], "%Y-%m-%d")
        end_dt = datetime.strptime(equity_curve[-1]["date"], "%Y-%m-%d")
        days = max(1, (end_dt - start_dt).days)
        years = days / 365.25
        cagr = float(((ending_value / starting_value) ** (1.0 / years) - 1.0) * 100.0) if years > 0 and starting_value > 0 else 0.0
        cagr = round(cagr, 2)

        values = [point["portfolio_value"] for point in equity_curve]
        daily_returns = np.diff(values) / values[:-1] if len(values) > 1 else np.array([0.0])

        mean_return = float(np.mean(daily_returns))
        std_return = float(np.std(daily_returns, ddof=1)) if len(daily_returns) > 1 else 0.0
        daily_sharpe = mean_return / std_return if std_return > 0 else 0.0
        sharpe = round(daily_sharpe * np.sqrt(252), 4)

        # Probabilistic Sharpe Ratio, adjusted for skew and fat tails
        n = len(daily_returns)
        sr_benchmark_daily = 1.0 / np.sqrt(252)

        if n > 2 and std_return > 0:
            sr_daily = mean_return / std_return
            sk = float(skew(daily_returns))
            kt = float(kurtosis(daily_returns, fisher=False))  # Pearson kurtosis (Normal = 3.0)

            daily_variance = (1.0 - (sk * sr_daily) + (((kt - 1.0) / 4.0) * (sr_daily ** 2))) / (n - 1)

            if daily_variance > 0:
                daily_std_error = np.sqrt(daily_variance)
                z_stat = (sr_daily - sr_benchmark_daily) / daily_std_error
                psr = round(float(norm.cdf(z_stat)), 4)
            else:
                psr = 0.0
        else:
            psr = 0.0

        # Sortino uses only the downside deviation of returns
        negative_returns = daily_returns[daily_returns < 0]
        downside_std = float(np.std(negative_returns, ddof=1)) if len(negative_returns) > 1 else 0.0
        sortino = round((mean_return / downside_std) * np.sqrt(252), 4) if downside_std > 0 else 0.0

        # Max drawdown and the longest stretch spent below a previous peak
        vals = np.array(values, dtype=float)
        cummax = np.maximum.accumulate(vals)
        drawdowns = (cummax - vals) / cummax

        max_dd_ratio = float(np.max(drawdowns)) if len(drawdowns) > 0 else 0.0
        max_drawdown = round(max_dd_ratio * 100.0, 2)

        max_duration = 0
        current_duration = 0
        in_drawdown = False

        for i in range(len(vals)):
            if vals[i] < cummax[i]:
                if not in_drawdown:
                    in_drawdown = True
                    current_duration = 1
                else:
                    current_duration += 1
            else:
                if in_drawdown:
                    if current_duration > max_duration:
                        max_duration = current_duration
                    current_duration = 0
                    in_drawdown = False

        # Catch a run that ends while still in a drawdown
        if in_drawdown and current_duration > max_duration:
            max_duration = current_duration

        # Every lot counts: closed at its exit, still-open at its last mark
        trade_returns: list[float] = []
        for trade in self.manager.trades:
            if trade.exit is not None:
                exit_price = trade.exit.price
            else:
                exit_price = self.manager.last_prices.get(trade.ticker, trade.entry_price)

            direction = -1.0 if trade.position_type is PositionType.SHORT else 1.0
            trade_returns.append(
                direction * (exit_price - trade.entry_price) / trade.entry_price
            )

        total_trades = len(trade_returns)
        winning_trades = [r for r in trade_returns if r > 0]
        losing_trades = [r for r in trade_returns if r < 0]

        win_rate = round((len(winning_trades) / total_trades) * 100.0, 2) if total_trades > 0 else 0.0

        # Loss rate is the complement, so flat trades count as losses too.
        loss_rate = round(100.0 - win_rate, 2) if total_trades > 0 else 0.0
        average_win = round((sum(winning_trades) / len(winning_trades)) * 100.0, 2) if winning_trades else 0.0
        average_loss = round((sum(losing_trades) / len(losing_trades)) * 100.0, 2) if losing_trades else 0.0

        # Expectancy = win prob * avg win - loss prob * avg loss
        win_prob = len(winning_trades) / total_trades if total_trades > 0 else 0.0
        loss_prob = len(losing_trades) / total_trades if total_trades > 0 else 0.0
        expectancy = round((win_prob * (average_win / 100.0)) - (loss_prob * abs(average_loss / 100.0)), 4)

        return {
            "starting_value": starting_value,
            "ending_value": ending_value,
            "cagr": cagr,
            "sharpe": sharpe,
            "psr": psr,
            "sortino": sortino,
            "expectancy": expectancy,
            "win_rate": win_rate,
            "loss_rate": loss_rate,
            "average_win": average_win,
            "average_loss": average_loss,
            "max_drawdown": max_drawdown,
            "drawdown_recovery": max_duration,
            "unrealized_profit": round(self._unrealized_at_end, 2),
            "rejected_orders": dict(sorted(self.manager.rejected_orders.items())),
        }

    # -------- Universe and Data --------
    def _initialize_universe(self) -> str:
        # Walk forward until a universe exists, bounded so a broken strategy fails.
        current_dt = datetime.strptime(self.start_date, "%Y-%m-%d")

        for _ in range(60):
            date_str = current_dt.strftime("%Y-%m-%d")
            if self.strategy.initialize_universe(date_str):
                if not self.strategy.tickers:
                    raise ValueError("initialize_universe() returned True but declared no tickers.")
                return date_str
            current_dt += relativedelta(days=1)

        raise ValueError(
            f"Could not initialize universe from {self.start_date} within 60 days."
        )

    def _ensure_universe(self) -> None:
        # Load declared tickers plus anything still held outside the universe.
        wanted = list(self.strategy.tickers)
        for ticker in self.manager.open_tickers:
            if ticker not in wanted:
                wanted.append(ticker)

        for ticker in wanted:
            self._load_ticker(ticker)

    def _load_ticker(self, ticker: str) -> None:
        # Cache one ticker's arrays and a date -> index map
        if ticker in self._data or ticker in self.skipped:
            return

        try:
            history = get_stock_history(ticker)
        except ValueError:
            self.skipped.add(ticker)
            return

        self._data[ticker] = {
            "dates": history.dates,
            "date_to_idx": {date: idx for idx, date in enumerate(history.dates)},
            "open": history.open_price,
            "high": history.high,
            "low": history.low,
            "close": history.close_price,
            "volume": history.volume,
        }

    def _build_calendar(self, actual_start: str) -> list[str]:
        # Union of loaded dates: a holiday for one symbol is still a trading day.
        if not self._data:
            raise ValueError(
                "No price data loaded. initialize_universe() must add tickers that exist locally."
            )

        all_dates = {date for data in self._data.values() for date in data["dates"]}
        # Normalise numpy strings so dates leave the engine as plain str.
        ordered = [str(date) for date in sorted(all_dates)]
        end = self.end_date if self.end_date is not None else ordered[-1]
        return [date for date in ordered if actual_start <= date <= end]

    def _bars_on(self, current_date: str) -> dict[str, tuple[float, float, float, float]]:
        # Today's OHLC for every loaded ticker that actually traded
        bars: dict[str, tuple[float, float, float, float]] = {}
        for ticker, data in self._data.items():
            i = data["date_to_idx"].get(current_date)
            if i is None:
                continue
            bars[ticker] = (
                float(data["open"][i]),
                float(data["high"][i]),
                float(data["low"][i]),
                float(data["close"][i]),
            )
        return bars

    # -------- Daily Loop --------
    def _process_tickers(self,
                         current_date: str,
                         bars: dict[str, tuple[float, float, float, float]],
                         ) -> None:
        # Declared order first, then held tickers, so runs are deterministic.
        universe = set(self.strategy.tickers)

        ordered: list[str] = list(self.strategy.tickers)
        for ticker in self.manager.open_tickers:
            if ticker not in universe:
                ordered.append(ticker)

        max_positions = self.strategy.MAX_POSITIONS

        for ticker in ordered:
            bar = bars.get(ticker)
            if bar is None:
                continue

            current_open, current_high, current_low, _ = bar

            # Resting levels first: a stop or target can close a lot today
            self.manager.check_exits(
                ticker, current_open, current_high, current_low, current_date,
            )

            i = self._data[ticker]["date_to_idx"][current_date]
            if i + 1 < self.strategy.MIN_BARS_REQUIRED:
                continue

            self._slice(ticker, i)

            held = self.manager.lots(ticker)

            if ticker in universe:
                # No new entries once the book is full; exits still run below.
                if (not held
                        and max_positions is not None
                        and self.manager.active_positions >= max_positions):
                    continue

                self.manager.refresh_view()
                order = self.strategy.on_signal(ticker, self._sliced)
                if order is not None:
                    self.manager.submit(order)

            # Discretionary exits queue for the next open
            self.manager.refresh_view()
            for trade in held:
                if self.strategy.should_exit(ticker, trade, self._sliced):
                    self.manager.queue_exit(trade.id)

    def _slice(self, ticker: str, i: int) -> None:
        # Point the shared view at history up to and including today
        data = self._data[ticker]
        sliced = self._sliced
        sliced.ticker = ticker
        sliced.dates = data["dates"][:i + 1]
        sliced.open_price = data["open"][:i + 1]
        sliced.high = data["high"][:i + 1]
        sliced.low = data["low"][:i + 1]
        sliced.close_price = data["close"][:i + 1]
        sliced.volume = data["volume"][:i + 1]
