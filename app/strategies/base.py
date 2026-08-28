from app.portfolio.portfolio_manager import PortfolioManager
from app.utils.StrategyDecision import StrategyDecision
from app.database.fetch import *
import talib as ta


class Strategy:
    def __init__(self):
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

    # ======== Indicator support ========

    def sma(self, values, window):
        """Simple Moving Average."""
        return ta.SMA(values, window)

    def ema(self, values, window):
        """Exponential Moving Average."""
        return ta.EMA(values, window)

    def dema(self, values, window):
        """Double Exponential Moving Average."""
        return ta.DEMA(values, window)

    def rsi(self, values, window):
        """Relative Strength Index."""
        return ta.RSI(values, window)

    def macd(self, values, fast_period=12, slow_period=26, signal_period=9):
        """Moving Average Convergence Divergence."""
        return ta.MACD(values, fast_period, slow_period, signal_period)

    def bollinger_bands(self, values, window, deviations=2):
        """Bollinger Bands."""
        return ta.BBANDS(values, window, deviations, deviations)

    def atr(self, high, low, close, window):
        """Average True Range."""
        return ta.ATR(high, low, close, window)

    def adx(self, high, low, close, window):
        """Average Directional Index."""
        return ta.ADX(high, low, close, window)

    def stochastic(self, high, low, close, fast_k=5, slow_k=3, slow_d=3):
        """Stochastic Oscillator."""
        return ta.STOCH(high, low, close, fast_k, slow_k, slow_d)

    def williams_r(self, high, low, close, window):
        """Williams Percent R."""
        return ta.WILLR(high, low, close, window)

    def cci(self, high, low, close, window):
        """Commodity Channel Index."""
        return ta.CCI(high, low, close, window)

    def roc(self, values, window):
        """Rate of Change."""
        return ta.ROC(values, window)

    def momentum(self, values, window):
        """Price Momentum."""
        return ta.MOM(values, window)

    def obv(self, close, volume):
        """On Balance Volume."""
        return ta.OBV(close, volume)

    def mfi(self, high, low, close, volume, window):
        """Money Flow Index."""
        return ta.MFI(high, low, close, volume, window)

    def ad(self, high, low, close, volume):
        """Accumulation/Distribution Line."""
        return ta.AD(high, low, close, volume)

    def trix(self, values, window):
        """Triple Exponential Average."""
        return ta.TRIX(values, window)

    def tema(self, values, window):
        """Triple Exponential Moving Average."""
        return ta.TEMA(values, window)

    def parabolic_sar(self, high, low, acceleration=0.02, maximum=0.2):
        """Parabolic SAR trend indicator."""
        return ta.SAR(high, low, acceleration, maximum)

    def stochastic_rsi(self, values, window, fast_k=5, fast_d=3):
        """Stochastic Relative Strength Index."""
        return ta.STOCHRSI(values, window, fast_k, fast_d)