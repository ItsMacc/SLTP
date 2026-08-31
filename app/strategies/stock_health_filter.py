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

    def generate_signal(self, ticker: str, history: StockData) -> StrategyDecision:
        # Check if stock has enough bars for processing
        close_arr = history.close_price
        if len(close_arr) < self.MIN_BARS_REQUIRED:
            raise ValueError(f"{ticker} does not contain enough bars | required: {self.MIN_BARS_REQUIRED}")

        today_date = str(history.dates[-1])

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