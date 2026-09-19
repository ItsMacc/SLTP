# -------- Imports --------
import numpy as np
from app.portfolio.stock_health_filter_manager import StockHealthFilterManager
from app.strategies.base import Strategy, StrategyDecision
from app.utils.StockData import StockData


# -------- Stock Health Filter Strategy Class --------
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
        self.name = "Stock Health Filter"
        self.description = "Identifies momentum breakouts filtered through a balanced multi-sector health and liquidity selection model."
        self.manager = StockHealthFilterManager()

        # Strategy Parameters
        self.SHORT_BARS = 15  # Short-term trading window length
        self.LONG_BARS = 45  # Long-term baseline window length
        self.SMA_LENGTH = 200   # sma window length

        # Spike Detection Thresholds
        self.SPIKE_PEAK_THRESHOLD = 50.0  # Absolute min ratio peak to qualify as a massive spike
        self.MIN_1D_VELOCITY = 50.0  # Minimum 1-day jump required (delta_1d)

        self.MIN_BARS_REQUIRED = max(self.SHORT_BARS, self.LONG_BARS, self.SMA_LENGTH) + 2


    def generate_signal(self, ticker: str, history: StockData) -> StrategyDecision:
        # Check if stock has enough price history to calculate metrics
        close_arr = history.close_price
        if len(close_arr) < self.MIN_BARS_REQUIRED:
            raise ValueError(f"{ticker} does not contain enough bars | required: {self.MIN_BARS_REQUIRED}")

        today_date = str(history.dates[-1])

        # Calculate short-term and long-term health ratio metrics
        ratios, deltas, h_short_list, h_long_list = self._compute_ratio_pair(close_arr)
        current_ratio = ratios[1]
        delta_1d = deltas[1]

        # Check if stock is above it's current ema
        sma = self._sma(values=close_arr, window=self.SMA_LENGTH)
        is_above_sma = close_arr[-1] >= sma[-1]

        # Check if today's price action qualifies as a sudden upward health spike
        is_spike = (current_ratio >= self.SPIKE_PEAK_THRESHOLD) and (delta_1d >= self.MIN_1D_VELOCITY)
        confidence = self._confidence_from_spike(current_ratio, delta_1d)

        # Build output metadata and metric dictionary
        metrics, meta_data = self._build_decision_payload(ticker, today_date, ratios, deltas, h_short_list, h_long_list, close_arr)

        buy_condition = is_spike and is_above_sma and h_long_list[1] > 0.01
        signal_type = 'BUY' if buy_condition else 'HOLD'
        final_confidence = confidence if is_spike else 1.0

        return StrategyDecision(signal=signal_type, confidence=final_confidence, metrics=metrics, meta_data=meta_data)

    # -------- Helper Methods --------
    def _build_decision_payload(self,
                                ticker: str,
                                today_date: str,
                                ratios: list,
                                deltas: list,
                                h_short_list: list,
                                h_long_list: list,
                                close_arr: np.ndarray):
        # Format metrics and metadata into easy-to-read dictionaries for strategy decisions
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
        # Calculate how far above threshold the spike is to score signal confidence between 0 and 1
        peak_excess = max(0.0, (ratio - self.SPIKE_PEAK_THRESHOLD) / self.SPIKE_PEAK_THRESHOLD)
        velocity_excess = max(0.0, (delta_1d - self.MIN_1D_VELOCITY) / self.MIN_1D_VELOCITY)
        excess = (peak_excess + velocity_excess) / 2.0
        confidence = excess / (1.0 + excess)
        return round(float(confidence), 2)

    def _compute_ratio_pair(self, close_arr: np.ndarray):
        # Calculate short and long health scores for today
        slice_short_today = close_arr[-self.SHORT_BARS:]
        slice_long_today = close_arr[-self.LONG_BARS:]

        h_short_today = self._calc_window_health(slice_short_today)
        h_long_today = self._calc_window_health(slice_long_today)
        ratio_today = float(h_short_today / h_long_today)

        # Calculate short and long health scores for yesterday to measure speed of change
        slice_short_prev = close_arr[-(self.SHORT_BARS + 1):-1]
        slice_long_prev = close_arr[-(self.LONG_BARS + 1):-1]

        h_short_prev = self._calc_window_health(slice_short_prev)
        h_long_prev = self._calc_window_health(slice_long_prev)
        ratio_prev = float(h_short_prev / h_long_prev)

        ratios = [ratio_prev, ratio_today]
        h_short_list = [h_short_prev, h_short_today]
        h_long_list = [h_long_prev, h_long_today]
        deltas = [0.0, ratio_today - ratio_prev]

        return ratios, deltas, h_short_list, h_long_list

    @staticmethod
    def _calc_window_health(sub_close: np.ndarray) -> float:
        n = len(sub_close)
        log_close = np.log(sub_close)

        # Setup time axis (X) and average values for linear regression calculations
        x_reg = np.arange(n, dtype=np.float64)
        x_mean = (n - 1) / 2.0
        x_diff = x_reg - x_mean
        var_x = float(np.sum(x_diff ** 2))

        # Calculate price change slope (trend line) and R-squared (consistency of trend)
        y_mean = np.mean(log_close)
        y_diff = log_close - y_mean
        cov_xy = np.sum(x_diff * y_diff)
        slope = cov_xy / var_x
        ss_tot = np.sum(y_diff ** 2)

        # Keep R-squared values safely bounded between 0 and 1
        r_squared = float((cov_xy ** 2) / (var_x * ss_tot)) if ss_tot > 1e-12 else 0.0
        r_squared = min(1.0, max(0.0, r_squared))
        daily_growth_pct = float((np.exp(slope) - 1.0) * 100.0)

        # Score higher if trend line is overall positive
        trend_score = 100.0 * r_squared if daily_growth_pct > 0 else 1.0 * r_squared

        # Calculate frequency of down days to penalize high volatility
        returns = np.diff(sub_close) / sub_close[:-1]
        downside_freq = float(np.count_nonzero(returns < 0) / len(returns)) if len(returns) > 0 else 0.5
        downside_score = 100.0 * (1.0 - downside_freq)

        # Combine trend and downside score into a final health score
        return max(0.01, float(np.sqrt(trend_score * downside_score)))
