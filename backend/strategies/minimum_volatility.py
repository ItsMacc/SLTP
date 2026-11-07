# -------- minimum_volatility.py --------
# Minimum Volatility: hold the quietest liquid US stocks, equal-weight.
#
# Long-only. Once a quarter, rank every liquid US stock by its trailing
# 252-bar realized volatility and hold the 30 lowest. A 45-name buffer keeps
# a held name from being sold the moment it slips just outside the target
# list. There is no market filter: the point is to own the defensive end of
# the market through the cycle, not to time entries.
#
# The universe is ordinary companies only. ETFs are excluded so the book is
# a stock portfolio rather than a fund-of-funds. A $50M average daily dollar
# volume floor keeps the names tradable, and the equal-weight book leaves a
# small cash buffer for entry fees and the gap between sizing and fills.

# -------- Imports --------
import numpy as np

# Engine imports
from sltp import Strategy
from sltp import Order, OrderSizing
from sltp import StockData
from sltp import Trade
from sltp import PositionType
from sltp import RebalanceFrequency


# -------- Minimum Volatility Strategy --------
class MinimumVolatility(Strategy):
    # Set the book policy, the ranking window and the liquidity screen.
    def __init__(self):
        super().__init__()

        self.name: str = "Minimum Volatility"
        self.description: str = "Holds the 30 least volatile liquid US stocks, equal-weighted and rebuilt quarterly."

        # Book policy. Thirty entries at 3.2% use 96% of the book.
        self.MAX_POSITIONS: int = 30
        self.MAX_LOTS_PER_TICKER: int = 1
        self.MAX_ALLOCATION_PER_TICKER: float = 0.034
        self.ALLOCATION: float = 0.032
        self.REBALANCE_FREQUENCY: RebalanceFrequency = RebalanceFrequency.QUARTERLY
        self.MIN_BARS_REQUIRED: int = 252
        self.LIQUIDATE_ON_END: bool = False

        # Ranking: one year of daily returns, annualized.
        self.VOLATILITY_BARS: int = 252
        self.TOP_N: int = 30
        self.BUFFER_N: int = 45

        # Universe: liquid enough to trade, cheap enough to be a real stock.
        self.MIN_PRICE: float = 5.0
        self.MIN_DOLLAR_VOLUME: float = 50_000_000.0
        self.LIQUIDITY_BARS: int = 63

        # Current decision state, refreshed on every rebalance.
        self.targets: list[str] = []
        self.keep: list[str] = []
        self._stocks: set[str] = set(self.available_stocks)

    # Rank stocks only; the strategy never holds an ETF.
    @property
    def available_universe(self) -> list[str]:
        return list(self._stocks)

    # -------- Universe --------
    # Build the first ranking, and keep the wider buffer for held names.
    def initialize_universe(self, current_date: str, histories: dict[str, StockData]) -> bool:
        self.tickers.clear()
        self._rank(histories)
        self.tickers = list(self.targets)
        return bool(self.tickers)

    # Refresh the ranking quarterly, keeping the buffer for names already held.
    def on_rebalance(self, current_date: str, histories: dict[str, StockData]) -> None:
        self._rank(histories)
        self.tickers = list(self.targets)

    # -------- Signals --------
    # Buy a target only when it is not already held and a slot is open.
    def on_signal(self, ticker: str, data: StockData) -> Order | None:
        if ticker not in self.targets or ticker in self.open_tickers:
            return None
        if len(self.open_tickers) >= self.MAX_POSITIONS:
            return None

        close: float = float(data.close_price[-1])
        if close <= 0:
            return None

        return Order(
            ticker=ticker,
            position_type=PositionType.LONG,
            allocation=self.ALLOCATION,
            sizing=OrderSizing.EQUITY,
            order_date=str(data.dates[-1]),
            stop_loss=0.0,
            take_profit=0.0,
        )

    # Leave only when the name drops out of the buffer.
    def should_exit(self, ticker: str, trade: Trade, history: StockData | None = None) -> bool:
        return ticker not in self.keep

    # -------- Ranking --------
    # Score every liquid stock by annualized close-to-close volatility.
    def _rank(self, histories: dict[str, StockData]) -> None:
        scored: list[tuple[str, float]] = []

        for ticker, history in histories.items():
            if ticker not in self._stocks or history is None:
                continue
            if not self._is_liquid(history):
                continue

            closes = history.close_price[-self.VOLATILITY_BARS:]
            returns = np.diff(np.log(closes))
            volatility: float = float(np.std(returns, ddof=1) * np.sqrt(252.0))
            if volatility <= 0.0 or not np.isfinite(volatility):
                continue

            scored.append((ticker, volatility))

        # Ticker is the tiebreak so identical volatility cannot depend on set order.
        scored.sort(key=lambda pair: (pair[1], pair[0]))
        # Keep ranked lists, not sets: at the open the order decides which target
        # fills first when cash or position slots run out.
        self.keep = [ticker for ticker, _ in scored[: self.BUFFER_N]]
        self.targets = [ticker for ticker, _ in scored[: self.TOP_N]]

    # A stock needs price, volume and enough history for the volatility window.
    def _is_liquid(self, history: StockData) -> bool:
        if len(history.close_price) < max(self.MIN_BARS_REQUIRED, self.VOLATILITY_BARS + 1):
            return False
        if len(history.volume) < self.LIQUIDITY_BARS:
            return False

        close: float = float(history.close_price[-1])
        if close < self.MIN_PRICE or close <= 0:
            return False

        closes = history.close_price[-self.LIQUIDITY_BARS:]
        volumes = history.volume[-self.LIQUIDITY_BARS:]
        dollar_volume: float = float(np.mean(closes * volumes))
        return dollar_volume >= self.MIN_DOLLAR_VOLUME
