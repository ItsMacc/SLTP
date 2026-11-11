# -------- adaptive_momentum.py --------
# Adaptive Momentum: hold the strongest liquid stocks while the market trend is up.
#
# Long-only cross-sectional momentum. Each month the strategy ranks liquid US
# stocks by 12-month return, skipping the most recent month so a short-term
# reversal does not dominate the signal. The score is divided by the stock's own
# volatility, and names above a 60% annualized volatility ceiling are dropped.
# That second rule is the one that matters: plain momentum kept buying parabolic
# names that then fell 50-70%, and no market filter can protect a book from a
# single stock doing that.
#
# It holds the top 20 equal-weight, but only while SPY is above its 200-day
# average. A name is kept until it falls out of the top 40, which cuts turnover
# without changing the entry list. When the market filter turns off, the book
# moves to cash instead of trying to pick the bottom.

# BROWSER COPY of backend/strategies/adaptive_momentum.py: bundled as text (?raw) and exec'd
# inside the engine worker. Keep the two in sync — the backend owns the logic.

# -------- Imports --------
import numpy as np

# Engine imports
from sltp import Strategy
from sltp import Order
from sltp import StockData
from sltp import PositionType
from sltp import RebalanceFrequency


# -------- Adaptive Momentum Strategy --------
class AdaptiveMomentum(Strategy):
    # Set the book policy, the ranking windows and the market filter.
    def __init__(self):
        super().__init__()

        self.name: str = "Adaptive Momentum"
        self.description: str = "Holds the 20 strongest liquid US stocks while the S&P 500 is above its 200-day average."

        # Book policy. The allocation leaves a small cash buffer for entry fees and
        # for the gap between a fill and the next rebalance.
        self.MAX_POSITIONS: int = 20
        self.MAX_LOTS_PER_TICKER: int = 1
        self.MAX_ALLOCATION_PER_TICKER: float = 0.06
        self.ALLOCATION: float = 1.0 / 22.0
        self.REBALANCE_FREQUENCY: RebalanceFrequency = RebalanceFrequency.MONTHLY
        self.MIN_BARS_REQUIRED: int = 252
        self.LIQUIDATE_ON_END: bool = False

        # Ranking: 12-month return, skipping the latest month, divided by volatility.
        self.TOP_N: int = 20
        self.BUFFER_N: int = 40
        self.LOOKBACK_BARS: int = 252
        self.SKIP_BARS: int = 21
        self.VOLATILITY_BARS: int = 126
        self.MAX_VOLATILITY: float = 0.60

        # Universe: liquid enough to trade, cheap enough to be a real stock.
        self.MIN_PRICE: float = 5.0
        self.MIN_DOLLAR_VOLUME: float = 75_000_000.0
        self.LIQUIDITY_BARS: int = 63

        # Market filter.
        self.MARKET_TICKER: str = "SPY"
        self.MARKET_SMA_BARS: int = 200

        # Current decision state, refreshed on every rebalance.
        self.targets: set[str] = set()
        self.keep: set[str] = set()
        self.market_on: bool = False
        self._stocks: set[str] = set(self.available_stocks)
        self._ordered: set[str] = set()

    # Rank stocks only; SPY is the market filter and is never held.
    @property
    def available_universe(self) -> list[str]:
        return [*self.available_stocks, self.MARKET_TICKER]

    # -------- Universe --------
    # Build the first ranking, and add the buffer so held names can be monitored.
    def initialize_universe(self, current_date: str, histories: dict[str, StockData]) -> bool:
        self.tickers.clear()
        self._ordered.clear()
        ranked = self._rank(histories)
        self.add_tickers(ranked[: self.BUFFER_N])
        return bool(self.tickers)

    # Refresh the ranking monthly, keeping the wider buffer for names already held.
    def on_rebalance(self, current_date: str, histories: dict[str, StockData]) -> None:
        ranked = self._rank(histories)
        self.tickers.clear()
        self.add_tickers(ranked[: self.BUFFER_N])
        self._ordered.clear()

    # Orders queued yesterday have either filled or been rejected by now, so a name
    # that is still missing can be tried again without stacking duplicate orders.
    def run_daily(self, current_date: str) -> None:
        self._ordered.clear()

    # -------- Signals --------
    # Buy a target only when the market filter is on and the name is not already held.
    def on_signal(self, ticker: str, data: StockData) -> Order | None:
        if not self.market_on or ticker not in self.targets or ticker in self.open_tickers:
            return None

        # Names that are about to leave still count as open until tomorrow's fill,
        # but their slots can be reused by the entries queued alongside them.
        leaving: int = sum(1 for held in self.open_tickers if held not in self.keep)
        slots: int = self.MAX_POSITIONS - (self.open_position_count - leaving)
        if ticker in self._ordered or len(self._ordered) >= slots:
            return None

        close: float = float(data.close_price[-1])
        if close <= 0:
            return None

        self._ordered.add(ticker)
        return Order(
            ticker=ticker,
            position_type=PositionType.LONG,
            allocation=self.ALLOCATION,
            order_date=str(data.dates[-1]),
            stop_loss=0.0,
            take_profit=0.0,
        )

    # Leave when the market filter turns off or the name drops out of the buffer.
    def should_exit(self, ticker: str, trade, history: StockData | None = None) -> bool:
        return not self.market_on or ticker not in self.keep

    # -------- Ranking --------
    # Score every liquid stock, then keep the top names for entries and the wider
    # buffer for names that are already held.
    def _rank(self, histories: dict[str, StockData]) -> list[str]:
        self.market_on = self._market_is_on(histories)
        scored: list[tuple[str, float]] = []

        for ticker, history in histories.items():
            if ticker not in self._stocks:
                continue
            if not self._is_liquid(history):
                continue

            closes = history.close_price
            momentum: float = float(closes[-self.SKIP_BARS] / closes[-self.LOOKBACK_BARS] - 1.0)
            if momentum <= 0.0:
                continue

            volatility: float = self._volatility(closes)
            if volatility <= 0.0 or volatility > self.MAX_VOLATILITY:
                continue

            scored.append((ticker, momentum / volatility))

        scored.sort(key=lambda pair: pair[1], reverse=True)
        buffer: list[str] = [ticker for ticker, _ in scored[: self.BUFFER_N]]
        self.keep = set(buffer)
        self.targets = set(buffer[: self.TOP_N]) if self.market_on else set()
        return buffer

    # A stock needs price, volume and enough history to carry the ranking window.
    def _is_liquid(self, history: StockData) -> bool:
        if len(history.close_price) < self.LOOKBACK_BARS or len(history.volume) < self.LIQUIDITY_BARS:
            return False
        close: float = float(history.close_price[-1])
        if close < self.MIN_PRICE or close <= 0:
            return False
        closes = history.close_price[-self.LIQUIDITY_BARS:]
        volumes = history.volume[-self.LIQUIDITY_BARS:]
        dollar_volume: float = float(np.mean(closes * volumes))
        return dollar_volume >= self.MIN_DOLLAR_VOLUME

    # Annualized close-to-close volatility. The ceiling is deliberately above a
    # normal large-cap's volatility, so it filters the parabolic names rather than
    # turning this into a low-volatility strategy.
    def _volatility(self, closes: np.ndarray) -> float:
        window = closes[-self.VOLATILITY_BARS:]
        if len(window) < 3:
            return 0.0
        returns = np.diff(np.log(window))
        return float(np.std(returns, ddof=1) * np.sqrt(252.0))

    # The market filter: SPY above its long moving average.
    def _market_is_on(self, histories: dict[str, StockData]) -> bool:
        spy = histories.get(self.MARKET_TICKER)
        if spy is None or len(spy.close_price) < self.MARKET_SMA_BARS:
            return False
        close: float = float(spy.close_price[-1])
        sma: float = float(np.mean(spy.close_price[-self.MARKET_SMA_BARS:]))
        return close > sma
