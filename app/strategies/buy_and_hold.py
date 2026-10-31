# -------- buy_and_hold.py --------
# Passive benchmark strategy: buy once, hold until the end.
#
# Buys each ticker once when its first eligible signal is produced, allocating an
# equal fraction of the initial index per ticker. No stops, targets, or
# discretionary exits: holdings remain open until the backtest's final close.

# -------- Imports --------
# Engine imports
from app.engine.strategy import Strategy
from app.engine.utils.Order import Order
from app.engine.utils.StockData import StockData
from app.engine.utils.PositionType import PositionType
from app.engine.utils.RebalanceFrequency import RebalanceFrequency


# -------- Buy And Hold Strategy --------
class BuyAndHold(Strategy):
    # Every name is held; one order per ticker, no rotation or stop processing.
    def __init__(self):
        super().__init__()

        self.name: str = "Buy & Hold"
        self.description: str = "Standard Buy and Hold benchmark strategy"

        self.MAX_POSITIONS: int | None = None
        self.MAX_LOTS_PER_TICKER: int = 1
        self.REBALANCE_FREQUENCY: RebalanceFrequency = RebalanceFrequency.NEVER
        self.MIN_BARS_REQUIRED: int = 1
        self.LIQUIDATE_ON_END: bool = False

    # Hold one name, picked once at the start of the run.
    def initialize_universe(self, current_date: str, histories: dict[str, StockData]) -> bool:
        self.tickers.clear()
        self.add_ticker("AAPL")
        return bool(self.tickers)

    # Buy the ticker once and never trade it again.
    def on_signal(self, ticker: str, data: StockData) -> Order | None:
        if ticker in self.open_tickers:
            return None

        if not self.tickers:
            return None

        close: float = float(data.close_price[-1])
        if close <= 0:
            return None

        allocation: float = 1.0 / len(self.tickers)
        return Order(
            ticker=ticker,
            position_type=PositionType.LONG,
            allocation=allocation,
            order_date=str(data.dates[-1]),
            stop_loss=0.0,
            take_profit=0.0,
        )
