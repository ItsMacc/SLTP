# strategy.py — Base Strategy interface and technical indicator helpers.
#
# Every SLTP strategy subclasses Strategy. A strategy decides WHEN to buy;
# its paired PortfolioManager decides HOW MUCH and where to cut losses.
# Subclasses implement generate_signal() and set MIN_BARS_REQUIRED.
# The indicator helpers below are thin TA-Lib wrappers for common analysis.

# -------- Imports --------
import talib as ta
from app.engine.portfolio.portfolio_manager import PortfolioManager
from app.engine.utils.StockData import StockData
from app.engine.utils.StrategyDecision import StrategyDecision


# -------- Base Strategy Class --------
class Strategy:
    """
    Base Strategy Interface providing fundamental strategy properties,
    portfolio manager delegation, and standard technical analysis indicators.
    """

    def __init__(self):
        # Identity, paired manager, and minimum history requirement
        self.name: str = "Base Strategy"
        self.description: str = "Base Strategy Interface"
        self.manager: PortfolioManager = None

        self.MIN_BARS_REQUIRED: int = 0


    def add_ticker(self, ticker: str, start_date: str | None = None, end_date: str | None = None) -> None:
        # Delegate single ticker addition to the underlying portfolio manager
        self.manager.add_ticker(ticker, start_date, end_date)


    def add_tickers(self, tickers: list[str], start_date: str | None = None, end_date: str | None = None) -> None:
        # Delegate multiple ticker addition to the underlying portfolio manager
        self.manager.add_tickers(tickers, start_date, end_date)


    def generate_signal(self, ticker: str, history: StockData) -> StrategyDecision:
        # Enforce implementation of signal generation in strategy subclasses
        raise NotImplementedError("Strategy subclasses must implement generate_signal()")

    # -------- Helper Methods --------
    def _sma(self, values, window):
        # Calculate Simple Moving Average (average price over a fixed window)
        return ta.SMA(values, window)

    def _ema(self, values, window):
        # Calculate Exponential Moving Average (gives higher weight to recent prices)
        return ta.EMA(values, window)

    def _dema(self, values, window):
        # Calculate Double Exponential Moving Average (reduces lag compared to standard EMA)
        return ta.DEMA(values, window)

    def _rsi(self, values, window):
        # Calculate Relative Strength Index (measures momentum on a 0 to 100 scale)
        return ta.RSI(values, window)

    def _macd(self,
              values,
              fast_period=12,
              slow_period=26,
              signal_period=9):
        # Calculate Moving Average Convergence Divergence (shows trend momentum and direction)
        return ta.MACD(values, fast_period, slow_period, signal_period)

    def _bollinger_bands(self, values, window, deviations=2):
        # Calculate volatility bands placed above and below a moving average
        return ta.BBANDS(values, window, deviations, deviations)

    def _atr(self,
             high,
             low,
             close,
             window):
        # Calculate Average True Range (measures market volatility over time)
        return ta.ATR(high, low, close, window)

    def _adx(self,
             high,
             low,
             close,
             window):
        # Calculate Average Directional Index (measures the strength of a trend)
        return ta.ADX(high, low, close, window)

    def _stochastic(self,
                    high,
                    low,
                    close,
                    fast_k=5,
                    slow_k=3,
                    slow_d=3):
        # Calculate Stochastic Oscillator (compares closing price to price range over time)
        return ta.STOCH(
            high, low, close,
            fastk_period=fast_k,
            slowk_period=slow_k,
            slowd_period=slow_d,
        )

    def _williams_r(self,
                    high,
                    low,
                    close,
                    window):
        # Calculate Williams %R (reflects overbought or oversold conditions)
        return ta.WILLR(high, low, close, window)

    def _cci(self,
             high,
             low,
             close,
             window):
        # Calculate Commodity Channel Index (evaluates price level relative to statistical average)
        return ta.CCI(high, low, close, window)

    def _roc(self, values, window):
        # Calculate Rate of Change (percentage difference between current and past price)
        return ta.ROC(values, window)

    def _momentum(self, values, window):
        # Calculate price momentum (absolute difference between current and past price)
        return ta.MOM(values, window)

    def _obv(self, close, volume):
        # Calculate On-Balance Volume (uses volume flow to predict price shifts)
        return ta.OBV(close, volume)

    def _mfi(self,
             high,
             low,
             close,
             volume,
             window):
        # Calculate Money Flow Index (uses price and volume to measure buying/selling pressure)
        return ta.MFI(high, low, close, volume, window)

    def _ad(self,
            high,
            low,
            close,
            volume):
        # Calculate Accumulation/Distribution Line (measures underlying supply and demand)
        return ta.AD(high, low, close, volume)

    def _trix(self, values, window):
        # Calculate Triple Exponential Average (filters out market noise to show momentum)
        return ta.TRIX(values, window)

    def _tema(self, values, window):
        # Calculate Triple Exponential Moving Average (ultra-low lag moving average)
        return ta.TEMA(values, window)

    def _parabolic_sar(self,
                       high,
                       low,
                       acceleration=0.02,
                       maximum=0.2):
        # Calculate Parabolic SAR (determines trend direction and potential reversal points)
        return ta.SAR(high, low, acceleration, maximum)

    def _stochastic_rsi(self,
                        values,
                        window,
                        fast_k=5,
                        fast_d=3):
        # Calculate Stochastic RSI (applies Stochastic formula to RSI values for sensitivity)
        return ta.STOCHRSI(values, window, fast_k, fast_d)
