import numpy as np
from app.database.db import load_symbols
from app.database.fetch import get_stock_histories
from app.strategies.base import Strategy, StrategyDecision
from app.utils.StockData import StockData
from app.portfolio.stock_health_filter_manager import StockHealthFilterManager
from datetime import datetime
from dateutil.relativedelta import relativedelta


class StockHealthFilterStrategy(Strategy):
    """
    Key Terms & Definitions:
    - Health Score: A score from 0 to 100 measuring how smoothly and consistently
      a stock's price is rising while avoiding frequent downward drops.
      (Uses linear regression for trend score and ratio of positive-to-negative
      return days for downward drops)
    - Health Ratio: The relative multiple between short-term health and long-term health
    """

    def __init__(self):
        super().__init__()
        self.name = "Fixed-Window Health Spike Strategy (Balanced Multi-Sector Variant)"
        self.description = "Identifies momentum breakouts filtered through a balanced multi-sector health and liquidity selection model."
        self.manager = StockHealthFilterManager()

        # Strategy Parameters
        self.SHORT_BARS = 21  # Short-term trading window length
        self.LONG_BARS = 63  # Long-term baseline window length

        # Spike Detection Thresholds
        self.SPIKE_PEAK_THRESHOLD = 15.0  # Absolute min ratio peak to qualify as a massive spike
        self.MIN_1D_VELOCITY = 10.0  # Minimum 1-day jump required (delta_1d)

        self.MIN_BARS_REQUIRED = self.LONG_BARS + 2  # Add buffer

        # Trackers for underperforming tickers awaiting trade closure
        self.pending_removal_tickers = set()

    def rebalance(self, current_date: datetime) -> None:
        start_date = (current_date - relativedelta(years=1)).strftime("%Y-%m-%d")
        end_date = current_date.strftime("%Y-%m-%d")

        if self.LAST_REBALANCE_MONTH is None:
            # Initial rebalance: populate the initial top quality stocks
            self._replenish_top_tickers(start_date, end_date, 50)

        elif current_date >= self.LAST_REBALANCE_MONTH + relativedelta(months=3):
            # Remove eligible poor performers and capture how many were removed (n)
            removed_tickers = self._remove_poor_performing_tickers()
            n_removed = len(removed_tickers)

            # Replenish portfolio with n new top-performing stocks based on health and liquidity
            if n_removed > 0:
                self._replenish_top_tickers(start_date, end_date, n_removed)

        else:
            return

        self.LAST_REBALANCE_MONTH = current_date

    def generate_signal(self, ticker: str, history: StockData) -> StrategyDecision:
        # Check if stock has enough bars for processing
        close_arr = history.close_price
        if len(close_arr) < self.MIN_BARS_REQUIRED:
            raise ValueError(f"{ticker} does not contain enough bars | required: {self.MIN_BARS_REQUIRED}")

        today_date = str(history.dates[-1])

        # Check if this ticker is flagged for removal and if its open trade has finally closed out
        trade_list = self.manager.trades.get(ticker, [])
        has_open_trade = any(t.realized_return_pct is None for t in trade_list)

        if ticker in self.pending_removal_tickers:
            if not has_open_trade:
                # Trade is now closed out, safely purge it completely from active lists and history
                if ticker in self.manager.tickers:
                    self.manager.tickers.remove(ticker)
                self.manager.histories.pop(ticker, None)
                self.pending_removal_tickers.remove(ticker)

            # Force HOLD signal while waiting to exit/clear the position so no new buys happen
            ratios, deltas, h_short_list, h_long_list = self._compute_ratio_pair(close_arr)
            metrics, meta_data = self._build_decision_payload(ticker, today_date, ratios, deltas, h_short_list, h_long_list, close_arr)
            return StrategyDecision(signal='HOLD', confidence=1.0, metrics=metrics, meta_data=meta_data)

        # Compute metrics
        ratios, deltas, h_short_list, h_long_list = self._compute_ratio_pair(close_arr)
        current_ratio = ratios[1]
        delta_1d = deltas[1]

        # Detect instantaneous spike
        is_spike = (current_ratio >= self.SPIKE_PEAK_THRESHOLD) and (delta_1d >= self.MIN_1D_VELOCITY)
        confidence = self._confidence_from_spike(current_ratio, delta_1d)

        metrics, meta_data = self._build_decision_payload(ticker, today_date, ratios, deltas, h_short_list, h_long_list, close_arr)

        signal_type = 'BUY' if is_spike else 'HOLD'
        final_confidence = confidence if is_spike else 1.0

        return StrategyDecision(signal=signal_type, confidence=final_confidence, metrics=metrics, meta_data=meta_data)

    # ======== HELPER METHODS ========
    def _build_decision_payload(self, ticker: str, today_date: str, ratios: list, deltas: list, h_short_list: list, h_long_list: list, close_arr: np.ndarray):
        metrics = {
            "health_ratio": ratios[1],
            "prev_health_ratio": ratios[0],
            "delta_1d_velocity": round(deltas[1], 4),
            "health_short": round(h_short_list[1], 4),
            "health_long": round(h_long_list[1], 4),
            "close_price": float(close_arr[-1]),
        }

        meta_data = {
            "ticker": ticker,
            "signal_date": today_date,
            "strategy_parameters": {
                "short_bars": self.SHORT_BARS,
                "long_bars": self.LONG_BARS,
                "spike_peak_threshold": self.SPIKE_PEAK_THRESHOLD,
                "min_1d_velocity": self.MIN_1D_VELOCITY,
            }
        }
        return metrics, meta_data

    def _confidence_from_spike(self, ratio: float, delta_1d: float) -> float:
        peak_excess = max(0.0, (ratio - self.SPIKE_PEAK_THRESHOLD) / self.SPIKE_PEAK_THRESHOLD)
        velocity_excess = max(0.0, (delta_1d - self.MIN_1D_VELOCITY) / self.MIN_1D_VELOCITY)
        excess = (peak_excess + velocity_excess) / 2.0
        confidence = excess / (1.0 + excess)
        return round(float(confidence), 2)

    def _compute_ratio_pair(self, close_arr: np.ndarray):
        ratios, h_short_list, h_long_list = [], [], []
        offsets = [len(close_arr) - 1, len(close_arr)]

        for end_idx in offsets:
            close_slice = close_arr[:end_idx]
            slice_short = close_slice[-self.SHORT_BARS:]
            slice_long = close_slice[-self.LONG_BARS:]

            h_short = self._calc_window_health(slice_short)
            h_long = self._calc_window_health(slice_long)

            h_short_list.append(h_short)
            h_long_list.append(h_long)
            ratios.append(float(h_short / h_long))

        deltas = [0.0, ratios[1] - ratios[0]]
        return ratios, deltas, h_short_list, h_long_list

    @staticmethod
    def _calc_window_health(sub_close: np.ndarray) -> float:
        n = len(sub_close)
        log_close = np.log(sub_close)

        x_reg = np.arange(n, dtype=np.float64)
        x_mean = (n - 1) / 2.0
        x_diff = x_reg - x_mean
        var_x = float(np.sum(x_diff ** 2))

        y_mean = np.mean(log_close)
        y_diff = log_close - y_mean
        cov_xy = np.sum(x_diff * y_diff)
        slope = cov_xy / var_x
        ss_tot = np.sum(y_diff ** 2)

        r_squared = float((cov_xy ** 2) / (var_x * ss_tot)) if ss_tot > 1e-12 else 0.0
        r_squared = min(1.0, max(0.0, r_squared))
        daily_growth_pct = float((np.exp(slope) - 1.0) * 100.0)

        trend_score = 100.0 * r_squared if daily_growth_pct > 0 else 25.0 * r_squared

        returns = np.diff(sub_close) / sub_close[:-1]
        downside_freq = float(np.count_nonzero(returns < 0) / len(returns)) if len(returns) > 0 else 0.5
        downside_score = 100.0 * (1.0 - downside_freq)

        return max(0.01, float(np.sqrt(trend_score * downside_score)))

    def _remove_poor_performing_tickers(self) -> list[str]:
        poor_tickers = []
        for ticker, trade_list in self.manager.trades.items():
            completed_returns = [t.realized_return_pct for t in trade_list if t.realized_return_pct is not None]
            app_returns = sum(completed_returns) if completed_returns else 0.0
            if completed_returns and app_returns < 0.0:
                has_open_trade = any(t.realized_return_pct is None for t in trade_list)
                if has_open_trade:
                    self.pending_removal_tickers.add(ticker)
                    continue
                poor_tickers.append(ticker)

        for ticker in poor_tickers:
            if ticker in self.manager.tickers:
                self.manager.tickers.remove(ticker)
            self.manager.histories.pop(ticker, None)

        return poor_tickers

    def _replenish_top_tickers(self, start_date: str, end_date: str, n_slots: int) -> None:
        all_tickers = load_symbols()
        histories = get_stock_histories(all_tickers, start_date, end_date)

        composite_scores = {}
        for ticker, history in histories.items():
            if ticker in self.manager.tickers:
                continue

            if history and len(history.close_price) > self.LONG_BARS:
                closes = history.close_price
                volumes = history.volume if hasattr(history, 'volume') and len(history.volume) == len(closes) else np.ones_like(closes)

                # Volume
                avg_vol = np.mean(volumes[-30:]) if len(volumes) >= 30 else np.mean(volumes)
                liquidity_mult = np.log1p(avg_vol)

                # Composite score
                composite_scores[ticker] = liquidity_mult

        sorted_candidates = sorted(composite_scores, key=composite_scores.get, reverse=True)
        new_top_tickers = sorted_candidates[:n_slots]

        if new_top_tickers:
            self.add_tickers(new_top_tickers)

