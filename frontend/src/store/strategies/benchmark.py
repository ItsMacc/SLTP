# -------- benchmark.py --------
# The market benchmark: hold SPY with the whole book, first session to last.
#
# SPY is what every strategy is measured against because it is one liquid fund a
# real investor can buy, not a list of everything the dataset happens to contain.
# Holding the entire catalog instead equal-weights thousands of illiquid names,
# which measures the data rather than the market.

# BROWSER COPY of backend/strategies/benchmark.py: bundled as text (?raw) and exec'd
# inside the engine worker. Keep the two in sync — the backend owns the logic.

# -------- Imports --------
# Engine imports
from sltp import Strategy
from sltp import Order
from sltp import StockData
from sltp import PositionType
from sltp import RebalanceFrequency


# -------- Benchmark Strategy --------
class Benchmark(Strategy):
    # One fund, one lot, bought on the first session the run can trade.
    def __init__(self):
        super().__init__()

        self.name: str = "Benchmark (SPY)"
        self.description: str = "Holds SPY from the first session to the last: the market to beat"

        self.TICKER: str = "SPY"
        # The whole book; the manager trims the fill so the entry fee still fits.
        self.ALLOCATION: float = 1.0
        self.MAX_POSITIONS: int | None = 1
        self.MAX_LOTS_PER_TICKER: int = 1
        self.REBALANCE_FREQUENCY: RebalanceFrequency = RebalanceFrequency.NEVER
        self.MIN_BARS_REQUIRED: int = 1
        self.LIQUIDATE_ON_END: bool = False

    # The book is one fund by definition, so there is nothing to rank or filter.
    # Declaring histories=None tells the engine to skip the full-universe load;
    # membership is checked against the catalog instead of the bars.
    def initialize_universe(self, current_date: str, histories=None) -> bool:
        self.tickers.clear()

        if self.TICKER not in self.available_universe:
            return False

        self.add_ticker(self.TICKER)
        return True

    # Buy the fund once and never trade it again; no stops and no rotation.
    def on_signal(self, ticker: str, data: StockData) -> Order | None:
        if ticker in self.open_tickers:
            return None

        close: float = float(data.close_price[-1])
        if close <= 0:
            return None

        return Order(
            ticker=ticker,
            position_type=PositionType.LONG,
            allocation=self.ALLOCATION,
            order_date=str(data.dates[-1]),
            stop_loss=0.0,
            take_profit=0.0,
        )
