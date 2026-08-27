import numpy as np
from app.strategies.base import Strategy, StrategyDecision


class StockHealthFilterStrategy(Strategy):

    def __init__(self):
        super().__init__()
        self.name = "Fixed-Window Health Spike Strategy"
        self.description = "Generates a BUY signal when a stock's short-term health score spikes dramatically relative to its yearly average."

        # Strategy Parameters
        self.SHORT_BARS = 21  # Short-term trading window length
        self.LONG_BARS = 63  # Long-term baseline window length

        # Spike Detection Thresholds
        self.SPIKE_PEAK_THRESHOLD = 15.0  # Absolute min ratio peak to qualify as a massive spike
        self.MIN_1D_VELOCITY = 10.0  # Minimum 1-day jump required (delta_1d)

        self.MIN_BARS_REQUIRED = self.LONG_BARS + 2  # Add buffer

    def generate_signal(self) -> dict[str, StrategyDecision]:
        decisions = {}

        for ticker, history in self.history.items():
            close_arr = history.close_price
            if len(close_arr) < self.MIN_BARS_REQUIRED:
                continue

            ratios, deltas, h_short_list, h_long_list = self._compute_ratio_pair(close_arr)
            yesterday_ratio, current_ratio = ratios[0], ratios[1]
            delta_1d = deltas[1]
            today_date = str(history.dates[-1])

            # Detect instantaneous spike
            is_spike = (current_ratio >= self.SPIKE_PEAK_THRESHOLD) and (delta_1d >= self.MIN_1D_VELOCITY)
            confidence = self._confidence_from_spike(current_ratio, delta_1d)

            metrics = {
                "health_ratio": current_ratio,
                "prev_health_ratio": yesterday_ratio,
                "delta_1d_velocity": round(delta_1d, 4),
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

            if is_spike:
                decisions[ticker] = StrategyDecision(
                    signal='BUY',
                    confidence=confidence,
                    metrics=metrics,
                    meta_data=meta_data,
                )
            else:
                decisions[ticker] = StrategyDecision(
                    signal='HOLD',
                    confidence=1.0,
                    metrics=metrics,
                    meta_data=meta_data,
                )

        return decisions

    def generate_exit(self, decisions: dict[str, StrategyDecision]) -> dict[str, StrategyDecision]:
        exit_decisions = {}

        for ticker, decision in decisions.items():
            if decision.signal == "BUY":
                current_price = decision.metrics["close_price"]
                scale_factor = (decision.confidence - 0.5) / 0.5

                sl_pct = 0.03 + (0.03 * scale_factor)
                tp_pct = 0.05 + (0.05 * scale_factor)

                stop_loss = round(current_price * (1.0 - sl_pct), 2)
                take_profit = round(current_price * (1.0 + tp_pct), 2)

                # Attach targets to decision object & metadata
                decision.meta_data["exits"] = {
                    "stop_loss": stop_loss,
                    "take_profit": take_profit,
                    "sl_pct": round(sl_pct * 100, 1),
                    "tp_pct": round(tp_pct * 100, 1),
                }

                exit_decisions[ticker] = decision
            else:
                exit_decisions[ticker] = decision

        return exit_decisions

    # ======== HELPER METHODS ========
    def _confidence_from_spike(self, ratio: float, delta_1d: float) -> float:
        """Scales confidence smoothly from 0 to 1 using an asymptotic function"""
        peak_excess = (ratio - self.SPIKE_PEAK_THRESHOLD) / self.SPIKE_PEAK_THRESHOLD
        velocity_excess = (delta_1d - self.MIN_1D_VELOCITY) / self.MIN_1D_VELOCITY
        combined = (peak_excess + velocity_excess) / 2.0

        return round(float(0.5 + 0.5 * np.tanh(combined)), 2)

    def _compute_ratio_pair(self, close_arr: np.ndarray):
        ratios, deltas, h_short_list, h_long_list = [], [], [], []

        # Offsets for yesterday (len - 1) and today (len)
        offsets = [len(close_arr) - 1, len(close_arr)]

        for end_idx in offsets:
            close_slice = close_arr[:end_idx]

            # Slice fixed windows
            slice_short = close_slice[-self.SHORT_BARS:]
            slice_long = close_slice[-self.LONG_BARS:]

            h_short = self._calc_window_health(slice_short)
            h_long = self._calc_window_health(slice_long)
            ratio = float(h_short / h_long)

            h_short_list.append(h_short)
            h_long_list.append(h_long)
            ratios.append(ratio)

        # 1-Day velocity calculation (Today's ratio minus Yesterday's ratio)
        delta_1d_yest = 0.0
        delta_1d_today = ratios[1] - ratios[0]
        deltas = [delta_1d_yest, delta_1d_today]

        return ratios, deltas, h_short_list, h_long_list

    def _calc_window_health(self, sub_close: np.ndarray) -> float:
        n = len(sub_close)
        log_close = np.log(sub_close)

        # Slope & Trend Fit (R-Squared)
        x_reg = np.arange(n, dtype=np.float64)
        x_diff = x_reg - ((n - 1) / 2.0)
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

        # Downside Frequency (Unpunished downside ratio)
        returns = np.diff(sub_close) / sub_close[:-1]
        downside_freq = float(np.sum(returns < 0) / len(returns)) if len(returns) > 0 else 0.5
        downside_score = 100.0 * (1.0 - downside_freq)

        # Geometric Combination
        return max(0.01, float(np.sqrt(trend_score * downside_score)))
