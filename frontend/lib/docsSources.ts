// docsSources.ts — Curated read-only excerpts of the SLTP engine, shown on the Docs page.
//
// These are bundled as strings so the Docs page controls exactly what is exposed.
// When the engine changes (base.py, portfolio_manager.py, backtester.py, utils),
// update the matching constant here. Keep excerpts faithful to the source.
export const BASE_STRATEGY_SOURCE = `# base.py
import talib as ta
from app.portfolio.portfolio_manager import PortfolioManager
from app.utils.StockData import StockData
from app.utils.StrategyDecision import StrategyDecision


class Strategy:
    """
    Base Strategy Interface providing fundamental strategy properties,
    portfolio manager delegation, and standard technical analysis indicators.
    """

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

    # -------- Helper Methods (thin TA-Lib wrappers) --------
    def _sma(self, values, window):
        # Simple Moving Average (average price over a fixed window)
        return ta.SMA(values, window)

    def _ema(self, values, window):
        # Exponential Moving Average (higher weight on recent prices)
        return ta.EMA(values, window)

    def _dema(self, values, window):
        # Double Exponential Moving Average (reduces lag vs EMA)
        return ta.DEMA(values, window)

    def _tema(self, values, window):
        # Triple Exponential Moving Average (ultra-low lag)
        return ta.TEMA(values, window)

    def _rsi(self, values, window):
        # Relative Strength Index (momentum on a 0 to 100 scale)
        return ta.RSI(values, window)

    def _macd(self, values, fast_period=12, slow_period=26, signal_period=9):
        # Moving Average Convergence Divergence (trend momentum and direction)
        return ta.MACD(values, fast_period, slow_period, signal_period)

    def _bollinger_bands(self, values, window, deviations=2):
        # Volatility bands placed above and below a moving average
        return ta.BBANDS(values, window, deviations, deviations)

    def _atr(self, high, low, close, window):
        # Average True Range (market volatility over time)
        return ta.ATR(high, low, close, window)

    def _adx(self, high, low, close, window):
        # Average Directional Index (strength of a trend)
        return ta.ADX(high, low, close, window)

    def _stochastic(self, high, low, close, fast_k=5, slow_k=3, slow_d=3):
        # Stochastic Oscillator (close vs recent price range)
        return ta.STOCH(high, low, close,
                        fastk_period=fast_k, slowk_period=slow_k, slowd_period=slow_d)

    def _williams_r(self, high, low, close, window):
        # Williams %R (overbought / oversold conditions)
        return ta.WILLR(high, low, close, window)

    def _cci(self, high, low, close, window):
        # Commodity Channel Index (price level vs statistical average)
        return ta.CCI(high, low, close, window)

    def _roc(self, values, window):
        # Rate of Change (percentage difference vs past price)
        return ta.ROC(values, window)

    def _momentum(self, values, window):
        # Momentum (absolute difference vs past price)
        return ta.MOM(values, window)

    def _obv(self, close, volume):
        # On-Balance Volume (volume flow predicting price shifts)
        return ta.OBV(close, volume)

    def _mfi(self, high, low, close, volume, window):
        # Money Flow Index (buying / selling pressure using price and volume)
        return ta.MFI(high, low, close, volume, window)

    def _ad(self, high, low, close, volume):
        # Accumulation/Distribution Line (supply and demand)
        return ta.AD(high, low, close, volume)

    def _trix(self, values, window):
        # Triple Exponential Average (noise-filtered momentum)
        return ta.TRIX(values, window)

    def _parabolic_sar(self, high, low, acceleration=0.02, maximum=0.2):
        # Parabolic SAR (trend direction and reversal points)
        return ta.SAR(high, low, acceleration, maximum)

    def _stochastic_rsi(self, values, window, fast_k=5, fast_d=3):
        # Stochastic RSI (Stochastic formula applied to RSI)
        return ta.STOCHRSI(values, window, fast_k, fast_d)`;

export const PORTFOLIO_MANAGER_SOURCE = `# portfolio_manager.py
from dataclasses import dataclass, replace
from enum import Enum
from dateutil.relativedelta import relativedelta
from app.database.fetch import get_stock_histories, get_all_tickers, get_stock_history
from app.utils.StockData import StockData
from app.utils.StrategyDecision import StrategyDecision


@dataclass
class TradeRecord:
    ticker: str
    action: str                      # BUY | STOP_LOSS | TAKE_PROFIT
    entry_date: str | None
    allocation_size: float           # fraction of portfolio value (0.0 - 1.0)
    entry_price: float | None
    stop_loss: float
    take_profit: float
    exit_price: float | None = None
    exit_date: str | None = None
    transaction_cost: float = 0.0
    realized_return_pct: float | None = None
    signal_date: str | None = None


class RebalanceFrequency(Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"
    NEVER = "never"


class PortfolioManager:
    def __init__(self, max_positions: int | None = 10) -> None:
        # Trading costs & configuration
        self.SLIPPAGE_PCT: float = 0.0005
        self.FEE_RATE: float = 0.001
        self.max_positions: int | None = max_positions

        # Universe & market data storage
        self.tickers: list[str] = []
        self.histories: dict[str, StockData] = {}

        # Portfolio tracking & state
        self.portfolio_value: float = 100.00
        self.active_positions: int = 0
        self.open_positions: dict[str, bool] = {}
        self.trades: dict[str, list[TradeRecord]] = {}

        # Execution & marking states
        self.blacklisted_tickers: set[str] = set()
        self.open_trade_state: dict[str, dict] = {}

        # Performance & analytics cache
        self.equity_curve: list[dict] = []
        self.ticker_wins: dict[str, list[float]] = {}
        self.ticker_losses: dict[str, list[float]] = {}
        self.total_transactions_cost: float = 0.0

        # Rebalancing tracking
        self.LAST_REBALANCE_DATE: str | None = None
        self.REBALANCE_FREQUENCY: RebalanceFrequency = RebalanceFrequency.NEVER
        self.WARM_UP_PERIOD: int = 0

    # -------- Data Management --------
    def add_ticker(self, ticker, start_date=None, end_date=None) -> None:
        # Fetch and cache individual stock history
        ...

    def add_tickers(self, tickers, start_date=None, end_date=None) -> None:
        # Fetch and cache batch stock histories
        ...

    # -------- Lifecycle Hooks (override these) --------
    def on_signal(self, ticker: str, decision: StrategyDecision) -> TradeRecord:
        # Called on every generated signal. Return a pending TradeRecord
        # to queue a BUY, or None to skip the signal.
        raise NotImplementedError("PortfolioManager subclasses must implement on_signal()")

    def on_rebalance(self, current_date: str) -> None:
        # Called when the rebalance schedule is due. Prune / replace tickers here.
        pass

    def initialize_universe(self, current_date: str) -> bool:
        # Called once at the start. Populate self.tickers and self.histories.
        # Return False if the universe cannot be built on this date.
        pass

    # -------- Trade Execution (usually leave alone) --------
    def check_exits(self, ticker, current_open, current_high, current_low, current_date) -> None:
        # Stop-loss / take-profit exit engine with pessimistic priority
        # (stop-loss before take-profit) and gap handling.
        ...

    def buy_order(self, ticker, fill_price, trade_record, current_date) -> None:
        # Fills a pending BUY at the given price: applies slippage and fees,
        # caps total allocation at 100% of the portfolio, records the trade.
        ...

    def mark_to_market(self, ticker, current_close) -> None:
        # Adjusts portfolio value daily for open positions using the close.
        ...

    def _base_allocation(self) -> float:
        # Kelly-criterion position sizing over closed trades (quarter-Kelly),
        # falling back to 1 / max_positions until enough trades exist.
        ...`;

export const BACKTESTER_SOURCE = `# backtester.py  (the day loop, simplified)
class Backtester:
    def __init__(self, strategy: Strategy, start_date: str, end_date: str | None = None):
        self.strategy = strategy
        self.manager = strategy.manager
        self.start_date = start_date
        self.end_date = end_date
        self._pending_buys: list[tuple[str, TradeRecord]] = []

    def run(self) -> None:
        # 1. Initialize universe (walks forward until initialize_universe returns True)
        actual_start_date = self._initialize_universe()

        # 2. Build the trading calendar and pre-cache per-ticker data
        valid_dates = self._build_trading_calendar()
        ticker_data = self._pre_cache_ticker_data(actual_start_date)

        # 3. Iterate day by day
        for current_date in active_dates:
            # Rebalance when the schedule says so
            if self._should_rebalance(current_date):
                self.manager.on_rebalance(current_date)
                self.manager.LAST_REBALANCE_DATE = current_date

            # Fill yesterday's queued buys at TODAY'S OPEN
            self._execute_pending_buys(current_date, ticker_data)

            for ticker, data in ticker_data.items():
                i = data["date_to_idx"][current_date]

                # Check stop-loss / take-profit exits intraday
                self.manager.check_exits(ticker, open_i, high_i, low_i, current_date)

                # Slice history strictly up to today (prevents lookahead bias).
                # This sliced StockData is what your generate_signal receives.
                self._slice_history_for_ticker(sliced_history, ticker, data, i)

                # Your strategy decides
                decision = self.strategy.generate_signal(ticker, sliced_history)
                if decision and decision.signal == "BUY":
                    trade_record = self.manager.on_signal(ticker, decision)
                    if trade_record is not None:
                        self._pending_buys.append((ticker, trade_record))

                # Mark open positions to today's close
                self.manager.mark_to_market(ticker, current_close)

            # One equity point per day
            self.manager.equity_curve.append({
                "date": current_date,
                "portfolio_value": round(self.manager.portfolio_value, 2),
                "active_positions": self.manager.active_positions,
                "total_transaction_cost": round(self.manager.total_transactions_cost, 4),
            })

    def performance_metrics(self) -> dict:
        # Returns: starting_value, ending_value, cagr, sharpe, psr, sortino,
        # expectancy, win_rate, loss_rate, average_win, average_loss,
        # max_drawdown, drawdown_recovery, unrealized_profit, equity
        ...`;

export const STOCK_DATA_SOURCE = `# StockData.py
import numpy as np
from dataclasses import dataclass


@dataclass
class StockData:
    ticker: str
    dates: np.ndarray        # array of 'YYYY-MM-DD' strings
    open_price: np.ndarray
    high: np.ndarray
    low: np.ndarray
    close_price: np.ndarray
    volume: np.ndarray`;

export const STRATEGY_DECISION_SOURCE = `# StrategyDecision.py
from dataclasses import dataclass, field
from typing import Any


@dataclass()
class StrategyDecision:
    signal: str                                          # "BUY" | "SELL" | "HOLD"
    confidence: float                                    # 0.0 - 1.0
    metrics: dict[str, float] = field(default_factory=dict)      # numeric readouts
    meta_data: dict[str, Any] = field(default_factory=dict)      # free-form metadata

# Example:
# return StrategyDecision(
#     signal="BUY",
#     confidence=0.72,
#     metrics={"rsi": 24.1, "close_price": 187.44},
#     meta_data={"ticker": ticker, "signal_date": str(history.dates[-1])},
# )`;

