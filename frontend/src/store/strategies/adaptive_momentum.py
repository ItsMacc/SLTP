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
    #
    # Vectorized across the cross-section: one pass stacks every candidate's
    # closes/volumes into two matrices then momentum, volatility and the
    # liquidity screen are a handful of array ops instead of ~5 numpy calls
    # per ticker per monthly rank. The formulas mirror the scalar versions
    # exactly — same slices, same reductions, same skip conditions — so the
    # picks are unchanged; only the per-ticker Python overhead is gone.
    def _rank(self, histories: dict[str, StockData]) -> list[str]:
        self.market_on = self._market_is_on(histories)

        names: list[str] = []
        close_rows: list[np.ndarray] = []
        volume_rows: list[np.ndarray] = []
        for ticker, history in histories.items():
            if ticker not in self._stocks:
                continue
            closes = history.close_price
            volumes = history.volume
            if len(closes) < self.LOOKBACK_BARS or len(volumes) < self.LIQUIDITY_BARS:
                continue
            if closes[-1] < self.MIN_PRICE or closes[-1] <= 0:
                continue
            names.append(ticker)
            close_rows.append(closes[-self.LOOKBACK_BARS:])
            volume_rows.append(volumes[-self.LIQUIDITY_BARS:])

        if not names:
            self.keep = set()
            self.targets = set()
            return []

        close_mat = np.stack(close_rows)
        volume_mat = np.stack(volume_rows)
        # 12-month return skipping the latest month, per row.
        momentum = close_mat[:, -self.SKIP_BARS] / close_mat[:, -self.LOOKBACK_BARS] - 1.0
        # Annualized close-to-close volatility over the trailing window. The
        # ceiling is deliberately above a normal large-cap's volatility, so it
        # filters the parabolic names rather than turning this into a
        # low-volatility strategy.
        log_window = np.log(close_mat[:, -self.VOLATILITY_BARS:])
        returns = log_window[:, 1:] - log_window[:, :-1]
        volatility = np.std(returns, axis=1, ddof=1) * np.sqrt(252.0)
        # Average daily dollar volume over the liquidity window.
        dollar_volume = np.mean(close_mat[:, -self.LIQUIDITY_BARS:] * volume_mat, axis=1)

        # Same skips as the scalar version: the negated comparisons keep NaN
        # exactly the way `<=` / `>` tests let it through.
        liquid = dollar_volume >= self.MIN_DOLLAR_VOLUME
        rising = ~(momentum <= 0.0)
        calm = ~((volatility <= 0.0) | (volatility > self.MAX_VOLATILITY))
        passed = liquid & rising & calm

        score = np.empty(len(names))
        score[passed] = momentum[passed] / volatility[passed]
        # Negation is exact, so ascending on -score with a stable sort is the
        # same order as a stable descending sort, ties included.
        order = np.flatnonzero(passed)[np.argsort(-score[passed], kind="stable")]
        buffer: list[str] = [names[i] for i in order[: self.BUFFER_N]]
        self.keep = set(buffer)
        self.targets = set(buffer[: self.TOP_N]) if self.market_on else set()
        return buffer

    # The market filter: SPY above its long moving average.
    def _market_is_on(self, histories: dict[str, StockData]) -> bool:
        spy = histories.get(self.MARKET_TICKER)
        if spy is None or len(spy.close_price) < self.MARKET_SMA_BARS:
            return False
        close: float = float(spy.close_price[-1])
        sma: float = float(np.mean(spy.close_price[-self.MARKET_SMA_BARS:]))
        return close > sma
