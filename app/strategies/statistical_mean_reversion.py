# statistical_mean_reversion.py — Statistical Mean Reversion (SMR) strategy.
#
# Key Terms & Definitions:
# - Z-Score: A statistical measure of how far the current price deviates from its
#   20-day Simple Moving Average (SMA) in terms of standard deviations.
# - RSI (Relative Strength Index): A 25-period momentum oscillator measuring the
#   speed and magnitude of recent price changes to identify oversold conditions.
# - Trailing Dollar Volume: The 12-month rolling sum of daily closing prices
#   multiplied by daily trading volume, used for annual universe ranking and liquidity filtering.
#
# Entry rule: Buy (long-only) when an asset is heavily dislocated and oversold
# (Z-Score < -1.5 and RSI < 30). The paired StatisticalMeanReversionManager
# sizes positions using confidence-weighted Kelly allocation and enforces
# symmetrical 3.0 StDev stop-loss and take-profit limits alongside RSI > 70 exits.

# -------- Imports --------
import numpy as np
from app.strategies.statistical_mean_reversion_manager import StatisticalMeanReversionManager
from app.engine.strategy.strategy import Strategy, StrategyDecision
from app.engine.utils.StrategyDecision import Signal
from app.engine.utils.StockData import StockData

# -------- Statistical Mean Reversion Strategy Class --------
class StatisticalMeanReversionStrategy(Strategy):
    def __init__(self):
        super().__init__()

        # Identity and paired manager
        self.name = "Statistical Mean Reversion"
        self.description = "Identifies oversold dislocations using RSI and Z-Scores with confidence-weighted sizing and dynamic volatility exits."
        self.manager = StatisticalMeanReversionManager()

        # Strategy Parameters
        self.RSI_PERIOD = 25  # RSI window length
        self.Z_SCORE_PERIOD = 20  # Z-score window length
        self.RSI_THRESHOLD = 30.0   # minimum RSI threshold to go long
        self.RSI_EXIT_THRESHOLD = 70.0  # maximum RSI threshold to exit
        self.Z_SCORE_THRESHOLD = 1.5    # Z-score threshold
        self.MIN_BARS_REQUIRED = max(self.RSI_PERIOD, self.Z_SCORE_PERIOD) + 2

    def generate_signal(self, ticker: str, history: StockData) -> StrategyDecision:
        # Check if stock has enough price history to calculate metrics
        close_arr = history.close_price
        if len(close_arr) < self.MIN_BARS_REQUIRED:
            raise ValueError(f"{ticker} does not contain enough bars | required: {self.MIN_BARS_REQUIRED}")

        today_date = str(history.dates[-1])
        current_close = close_arr[-1]

        # Calculate rsi and z-score
        rsi_list = self._rsi(close_arr, self.RSI_PERIOD)
        current_rsi = rsi_list[-1]

        stdev = np.std(close_arr[-self.Z_SCORE_PERIOD:], ddof=1)
        if stdev == 0:
            metrics = {"close_price": current_close}
            meta_data = {"ticker": ticker, "signal_date": today_date,
                         "strategy_parameters": {
                             "rsi_period": self.RSI_PERIOD,
                             "z_score_period": self.Z_SCORE_PERIOD,
                             "rsi_threshold": self.RSI_THRESHOLD,
                             "z_score_threshold": self.Z_SCORE_THRESHOLD,
                             "rsi_exit_threshold": self.RSI_EXIT_THRESHOLD,
                         }
                    }
            return StrategyDecision(signal=Signal.HOLD, confidence=1.0, metrics=metrics, meta_data=meta_data)

        sma = self._sma(close_arr, self.Z_SCORE_PERIOD)
        current_sma = sma[-1]
        z_score = (current_close - current_sma) / stdev

        # Pre-build metrics and metadata outside the conditional blocks to avoid code duplication
        metrics = {
            "close_price": current_close,
            "z_score": round(z_score, 4),
            "rsi": round(current_rsi, 4),
            "stdev": round(stdev, 4),
        }

        meta_data = {
            "ticker": ticker,
            "signal_date": today_date,
            "strategy_parameters": {
                "rsi_period": self.RSI_PERIOD,
                "z_score_period": self.Z_SCORE_PERIOD,
                "rsi_threshold": self.RSI_THRESHOLD,
                "z_score_threshold": self.Z_SCORE_THRESHOLD,
                "rsi_exit_threshold": self.RSI_EXIT_THRESHOLD,
            }
        }

        # Check if buy conditions are met
        if current_rsi < self.RSI_THRESHOLD and z_score < -self.Z_SCORE_THRESHOLD:
            k = 2.0  # Steepness parameter
            confidence = 1.0 / (1.0 + np.exp(-k * (-self.Z_SCORE_THRESHOLD - z_score)))
            confidence = float(np.clip(confidence, 0.0, 1.0))

            return StrategyDecision(
                signal=Signal.LONG,
                confidence=confidence,
                metrics=metrics,
                meta_data=meta_data
            )

        # The further price sits from its SMA in z-score units, the earlier we take the profit.
        z_magnitude = abs(z_score)
        dynamic_exit_threshold = self.RSI_EXIT_THRESHOLD - max(0.0, (z_magnitude - 1.0) * 3.0)

        if current_rsi >= dynamic_exit_threshold:
            return StrategyDecision(
                signal=Signal.EXIT,
                confidence=1.0,
                metrics=metrics,
                meta_data=meta_data
            )

        return StrategyDecision(signal=Signal.HOLD, confidence=1.0, metrics=metrics, meta_data=meta_data)