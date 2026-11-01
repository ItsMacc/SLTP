# -------- base_strategy.py --------
# Base class for a strategy: hooks, universe access and indicators.
#
# A strategy makes the decisions and keeps no book. on_signal returns an Order and
# the manager turns it into a position; the strategy sees a read-only view through
# open_trades, open_tickers, position() and equity.
#
# Only on_signal is required. initialize_universe, on_rebalance, on_day and
# should_exit are optional and do nothing by default.

# -------- Imports --------
import numpy as np
import talib as ta

from datetime import datetime
from dateutil.relativedelta import relativedelta

# Engine imports
from app.engine.utils.Order import Order
from app.engine.utils.Trade import Trade
from app.engine.utils.Dates import to_code
from app.engine.utils.StockData import StockData
from app.engine.utils.PositionType import PositionType
from app.engine.utils.RebalanceFrequency import RebalanceFrequency

# Database imports
from app.database.market.market_data_service import get_all_tickers, get_available_etfs, get_available_gold, get_available_stocks


# -------- Strategy --------
# Base class for every strategy: hooks, universe access and indicators.
class Strategy:
    # Set up the identity, the portfolio limits and the empty universe.
    def __init__(self):
        # -------- Identity --------
        self.name: str = "Base Strategy"
        self.description: str = "Base Strategy Interface"

        # -------- Portfolio Constraints --------
        self.MAX_POSITIONS: int | None = 10
        self.MAX_ALLOCATION_PER_TICKER: float | None = None
        self.MAX_LOTS_PER_TICKER: int = 1
        self.REBALANCE_FREQUENCY: RebalanceFrequency = RebalanceFrequency.NEVER
        self.MIN_BARS_REQUIRED: int = 0
        self.LIQUIDATE_ON_END: bool = False

        # -------- Tickers --------
        self.tickers: list[str] = []

    # -------- Universe --------
    # Everything with local price data.
    @property
    def available_universe(self) -> list[str]:
        return get_all_tickers()

    # Exchange-traded funds only.
    @property
    def available_etfs(self) -> list[str]:
        return get_available_etfs()

    # Individual companies only.
    @property
    def available_stocks(self) -> list[str]:
        return get_available_stocks()

    # Gold proxies only.
    @property
    def available_gold(self) -> list[str]:
        return get_available_gold()

    # The tickers currently holding open positions.
    @property
    def open_tickers(self) -> frozenset[str]:
        return getattr(self, "_open_ticker_set", frozenset())

    # The active open trades.
    @property
    def open_positions(self) -> tuple[Trade, ...]:
        return getattr(self, "_open_trades", tuple())

    # The number of distinct active positions.
    @property
    def open_position_count(self) -> int:
        return len(self.open_tickers)

    # Add one symbol to the universe, ignoring a duplicate.
    def add_ticker(self, ticker: str) -> None:
        if ticker not in self.tickers:
            self.tickers.append(ticker)

    # Add several symbols at once, keeping their order.
    def add_tickers(self, tickers: list[str]) -> None:
        for ticker in tickers:
            self.add_ticker(ticker)

    # Drop one symbol from the universe.
    def remove_ticker(self, ticker: str) -> None:
        if ticker in self.tickers:
            self.tickers.remove(ticker)

    # -------- Lifecycle Hooks --------
    # Build the starting universe; the default accepts the declared tickers.
    def initialize_universe(self, current_date: str, histories: dict[str, StockData]) -> bool:
        return bool(self.tickers)

    # Refresh self.tickers when REBALANCE_FREQUENCY comes due.
    def on_rebalance(self, current_date: str, histories: dict[str, StockData]) -> None:
        return None

    # Evaluate one ticker's history and return an order, or None for no trade.
    def on_signal(self, ticker: str, data: StockData) -> Order | None:
        raise NotImplementedError("Strategy subclasses must implement on_signal()")

    # Run once per day, before any ticker is polled.
    def run_daily(self, current_date: str) -> None:
        return None

    # Custom exit logic using the helper methods below.
    def should_exit(self, ticker: str, trade: Trade, history: StockData | None = None) -> bool:
        return False

    # -------- Indicator Helpers --------
    # TA-Lib only accepts float64 arrays and market data is stored float32, so widen here.
    @staticmethod
    def _widen(*arrays) -> tuple:
        return tuple(np.asarray(array, dtype=np.float64) if isinstance(array, np.ndarray) else array for array in arrays)

    # Simple Moving Average: the average price over a fixed window.
    def _sma(self, values, window):
        return ta.SMA(*self._widen(values), window)

    # Exponential Moving Average: weights recent prices more heavily.
    def _ema(self, values, window):
        return ta.EMA(*self._widen(values), window)

    # Double Exponential Moving Average: less lag than a standard EMA.
    def _dema(self, values, window):
        return ta.DEMA(*self._widen(values), window)

    # Relative Strength Index: momentum on a 0 to 100 scale.
    def _rsi(self, values, window):
        return ta.RSI(*self._widen(values), window)

    # Moving Average Convergence Divergence: trend momentum and direction.
    def _macd(self, values, fast_period=12, slow_period=26, signal_period=9):
        return ta.MACD(*self._widen(values), fast_period, slow_period, signal_period)

    # Bollinger Bands: volatility bands above and below a moving average.
    def _bollinger_bands(self, values, window, deviations=2):
        return ta.BBANDS(*self._widen(values), window, deviations, deviations)

    # Average True Range: volatility over time.
    def _atr(self, high, low, close, window):
        return ta.ATR(*self._widen(high, low, close), window)

    # Average Directional Index: the strength of a trend.
    def _adx(self, high, low, close, window):
        return ta.ADX(*self._widen(high, low, close), window)

    # Stochastic Oscillator: the close relative to its recent range.
    def _stochastic(self, high, low, close, fast_k=5, slow_k=3, slow_d=3):
        return ta.STOCH(*self._widen(high, low, close), fastk_period=fast_k, slowk_period=slow_k, slowd_period=slow_d)

    # Williams %R: overbought and oversold conditions.
    def _williams_r(self, high, low, close, window):
        return ta.WILLR(*self._widen(high, low, close), window)

    # Commodity Channel Index: price relative to its statistical average.
    def _cci(self, high, low, close, window):
        return ta.CCI(*self._widen(high, low, close), window)

    # Rate of Change: percentage difference from `window` bars ago.
    def _roc(self, values, window):
        return ta.ROC(*self._widen(values), window)

    # Price momentum: absolute difference from `window` bars ago.
    def _momentum(self, values, window):
        return ta.MOM(*self._widen(values), window)

    # On-Balance Volume: volume flow as a predictor of price shifts.
    def _obv(self, close, volume):
        return ta.OBV(*self._widen(close, volume))

    # Money Flow Index: price and volume as buying or selling pressure.
    def _mfi(self, high, low, close, volume, window):
        return ta.MFI(*self._widen(high, low, close, volume), window)

    # Accumulation/Distribution Line: underlying supply and demand.
    def _ad(self, high, low, close, volume):
        return ta.AD(*self._widen(high, low, close, volume))

    # Triple Exponential Average: noise-filtered momentum.
    def _trix(self, values, window):
        return ta.TRIX(*self._widen(values), window)

    # Triple Exponential Moving Average: very low lag.
    def _tema(self, values, window):
        return ta.TEMA(*self._widen(values), window)

    # Parabolic SAR: trend direction and potential reversal points.
    def _parabolic_sar(self, high, low, acceleration=0.02, maximum=0.2):
        return ta.SAR(*self._widen(high, low), acceleration, maximum)

    # Stochastic RSI: the Stochastic formula applied to RSI values.
    def _stochastic_rsi(self, values, window, fast_k=5, fast_d=3):
        return ta.STOCHRSI(*self._widen(values), window, fast_k, fast_d)

    # -------- Exit Helpers --------
    # True once the trade has been held for the allowed number of days.
    def _time_stop_days(self, trade: Trade, days: int) -> bool:
        entry_dt = datetime.strptime(trade.entry_date, "%Y-%m-%d")
        exit_deadline = to_code((entry_dt + relativedelta(days=days)).strftime("%Y-%m-%d"))

        return int(trade.history.date_codes[-1]) >= int(exit_deadline)

    # True when price has pulled back from its best level since entry.
    def _trailing_stop(self, trade: Trade, pct: float) -> bool:
        entry_idx = self._get_entry_index(trade)
        data = trade.history

        if trade.position_type == PositionType.LONG:
            # Long: track the highest price since entry, stop if the low drops below the peak threshold.
            highest_since_entry = np.max(data.high[entry_idx:])
            trailing_stop = highest_since_entry * (1.0 - pct)
            return data.low[-1] <= trailing_stop
        else:
            # Short: track the lowest price since entry, stop if the high rises above the trough threshold.
            lowest_since_entry = np.min(data.low[entry_idx:])
            trailing_stop = lowest_since_entry * (1.0 + pct)
            return data.high[-1] >= trailing_stop

    # True when price has moved against the entry by a multiple of the average true range.
    def _atr_stop(self, trade: Trade, multiplier: float, window: int = 14) -> bool:
        entry_idx = self._get_entry_index(trade)

        # Slice backward from entry_idx, without going below 0.
        start_idx = max(0, entry_idx - window - 1)

        data = trade.history
        high = data.high[start_idx:entry_idx + 1]
        low = data.low[start_idx:entry_idx + 1]
        close = data.close_price[start_idx:entry_idx + 1]

        current_atr = self._atr(high, low, close, window)

        if trade.position_type == PositionType.LONG:
            # Long: the stop sits below the entry by ATR * multiplier.
            stop_price = trade.entry_price - (current_atr * multiplier)
            return data.low[-1] <= stop_price
        else:
            # Short: the stop sits above the entry by ATR * multiplier.
            stop_price = trade.entry_price + (current_atr * multiplier)
            return data.high[-1] >= stop_price

    # Position of the entry bar, falling back to the nearest bar if the date is absent.
    def _get_entry_index(self, trade: Trade) -> int:
        data = trade.history
        entry_code = to_code(trade.entry_date)
        match_indices = np.flatnonzero(data.date_codes == entry_code)
        if len(match_indices) == 0:
            return int(np.searchsorted(data.date_codes, entry_code))
        return int(match_indices[0])
