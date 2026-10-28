# strategy.py — Base class for a strategy: hooks, universe access and indicators.
#
# A strategy makes the decisions and keeps no book. on_signal returns an Order
# and the manager turns it into a position; the strategy sees a read-only view
# through open_trades, open_tickers, position() and equity.
#
# Only on_signal is required. initialize_universe, on_rebalance, on_day and
# should_exit are optional and do nothing by default.

# -------- Imports --------
import talib as ta
from app.database.fetch import (
    get_stock_history,
    get_stock_histories,
    get_all_tickers,
    get_available_etfs,
    get_available_stocks,
    get_available_gold,
)
from app.engine.utils.Order import Order
from app.engine.utils.StockData import StockData
from app.engine.utils.Trade import Trade
from app.engine.utils.RebalanceFrequency import RebalanceFrequency


# -------- Strategy --------
class Strategy:
    """Base class for every strategy: hooks, universe access and indicators."""

    # -------- Identity --------
    name: str = "Base Strategy"
    description: str = "Base Strategy Interface"

    # -------- Policy, read by the manager --------
    MAX_POSITIONS: int | None = 10
    MAX_WEIGHT_PER_TICKER: float | None = None
    MAX_LOTS_PER_TICKER: int = 1
    REBALANCE_FREQUENCY: RebalanceFrequency = RebalanceFrequency.NEVER
    MIN_BARS_REQUIRED: int = 0

    def __init__(self) -> None:
        # Tickers this strategy trades, in declared order
        self.tickers: list[str] = []

        self._open_trades: tuple[Trade, ...] = ()
        self._equity: float = 0.0

    # -------- Book, read-only --------
    @property
    def open_trades(self) -> tuple[Trade, ...]:
        return self._open_trades

    @property
    def open_tickers(self) -> set[str]:
        # Distinct tickers with at least one open lot
        return {trade.ticker for trade in self._open_trades}

    @property
    def equity(self) -> float:
        # Portfolio value as of the previous close
        return self._equity

    def position(self, ticker: str) -> Trade | None:
        # The oldest open lot in this ticker, if any
        for trade in self._open_trades:
            if trade.ticker == ticker:
                return trade
        return None

    def is_open(self, ticker: str) -> bool:
        # True when this ticker already holds at least one lot
        return any(trade.ticker == ticker for trade in self._open_trades)

    # -------- Universe --------
    @property
    def available_universe(self) -> list[str]:
        # Everything with local price data
        return get_all_tickers()

    @property
    def available_etfs(self) -> list[str]:
        # Exchange-traded funds only
        return get_available_etfs()

    @property
    def available_stocks(self) -> list[str]:
        # Individual companies only
        return get_available_stocks()

    @property
    def available_gold(self) -> list[str]:
        # Gold proxies only
        return get_available_gold()

    def add_ticker(self, ticker: str) -> None:
        # Add one symbol to the universe, ignoring a duplicate
        if ticker not in self.tickers:
            self.tickers.append(ticker)

    def add_tickers(self, tickers: list[str]) -> None:
        # Add several symbols at once, keeping their order
        for ticker in tickers:
            self.add_ticker(ticker)

    def remove_ticker(self, ticker: str) -> None:
        # Drop one symbol from the universe; a no-op when it is not held
        if ticker in self.tickers:
            self.tickers.remove(ticker)

    def get_history(self,
                    ticker: str,
                    start: str | None = None,
                    end: str | None = None,
                    ) -> StockData:
        # One ticker's full history, optionally bounded, for universe scoring
        return get_stock_history(ticker, start, end)

    def get_histories(self,
                      tickers: list[str],
                      start: str | None = None,
                      end: str | None = None,
                      ) -> dict[str, StockData]:
        # Batch version of get_history; unknown tickers are skipped
        return get_stock_histories(tickers, start, end)

    # -------- Lifecycle Hooks --------
    def initialize_universe(self, current_date: str) -> bool:
        # Build the starting universe; the default accepts the declared tickers.
        return bool(self.tickers)

    def on_rebalance(self, current_date: str) -> None:
        # Refresh self.tickers when REBALANCE_FREQUENCY comes due
        return None

    def on_day(self, current_date: str) -> None:
        # Once per day, before any ticker is polled
        return None

    def on_signal(self, ticker: str, data: StockData) -> Order | None:
        # Turn one ticker's data into at most one order. Return None to pass.
        raise NotImplementedError("Strategy subclasses must implement on_signal()")

    def should_exit(self,
                    ticker: str,
                    trade: Trade,
                    data: StockData,
                    ) -> bool:
        # True closes this lot at the next open, separate from its stop or target.
        return False

    # -------- Indicator Helpers --------
    def _sma(self, values, window):
        # Simple Moving Average (average price over a fixed window)
        return ta.SMA(values, window)

    def _ema(self, values, window):
        # Exponential Moving Average (weights recent prices more heavily)
        return ta.EMA(values, window)

    def _dema(self, values, window):
        # Double Exponential Moving Average (less lag than a standard EMA)
        return ta.DEMA(values, window)

    def _rsi(self, values, window):
        # Relative Strength Index (momentum on a 0 to 100 scale)
        return ta.RSI(values, window)

    def _macd(self,
              values,
              fast_period=12,
              slow_period=26,
              signal_period=9):
        # Moving Average Convergence Divergence (trend momentum and direction)
        return ta.MACD(values, fast_period, slow_period, signal_period)

    def _bollinger_bands(self, values, window, deviations=2):
        # Volatility bands placed above and below a moving average
        return ta.BBANDS(values, window, deviations, deviations)

    def _atr(self,
             high,
             low,
             close,
             window):
        # Average True Range (volatility over time)
        return ta.ATR(high, low, close, window)

    def _adx(self,
             high,
             low,
             close,
             window):
        # Average Directional Index (strength of a trend)
        return ta.ADX(high, low, close, window)

    def _stochastic(self,
                    high,
                    low,
                    close,
                    fast_k=5,
                    slow_k=3,
                    slow_d=3):
        # Stochastic Oscillator (close relative to the recent range)
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
        # Williams %R (overbought and oversold conditions)
        return ta.WILLR(high, low, close, window)

    def _cci(self,
             high,
             low,
             close,
             window):
        # Commodity Channel Index (price relative to its statistical average)
        return ta.CCI(high, low, close, window)

    def _roc(self, values, window):
        # Rate of Change (percentage difference from `window` bars ago)
        return ta.ROC(values, window)

    def _momentum(self, values, window):
        # Price momentum (absolute difference from `window` bars ago)
        return ta.MOM(values, window)

    def _obv(self, close, volume):
        # On-Balance Volume (volume flow as a predictor of price shifts)
        return ta.OBV(close, volume)

    def _mfi(self,
             high,
             low,
             close,
             volume,
             window):
        # Money Flow Index (price and volume as buying or selling pressure)
        return ta.MFI(high, low, close, volume, window)

    def _ad(self,
            high,
            low,
            close,
            volume):
        # Accumulation/Distribution Line (underlying supply and demand)
        return ta.AD(high, low, close, volume)

    def _trix(self, values, window):
        # Triple Exponential Average (noise-filtered momentum)
        return ta.TRIX(values, window)

    def _tema(self, values, window):
        # Triple Exponential Moving Average (very low lag)
        return ta.TEMA(values, window)

    def _parabolic_sar(self,
                       high,
                       low,
                       acceleration=0.02,
                       maximum=0.2):
        # Parabolic SAR (trend direction and potential reversal points)
        return ta.SAR(high, low, acceleration, maximum)

    def _stochastic_rsi(self,
                        values,
                        window,
                        fast_k=5,
                        fast_d=3):
        # Stochastic RSI (the Stochastic formula applied to RSI values)
        return ta.STOCHRSI(values, window, fast_k, fast_d)
