# buy_and_hold.py — Passive benchmark strategy.
#
# Buys each ticker once when its first eligible signal is produced, allocating
# an equal fraction of the initial index per ticker. No stops, targets, or
# discretionary exits: holdings remain open until the backtest's final close.

# -------- Imports --------
from app.engine.strategy import Strategy
from app.engine.utils.Order import Order
from app.engine.utils.PositionType import PositionType
from app.engine.utils.RebalanceFrequency import RebalanceFrequency
from app.engine.utils.StockData import StockData


# -------- Buy And Hold Strategy --------
class BuyAndHold(Strategy):
    def __init__(self):
        super().__init__()

        self.name: str = "Buy & Hold"
        self.description: str = "Standard Buy and Hold benchmark strategy"

        # Every name is held; one order per ticker, no rotation or stop processing.
        self.MAX_POSITIONS = None
        self.MAX_LOTS_PER_TICKER = 1
        self.REBALANCE_FREQUENCY = RebalanceFrequency.NEVER
        self.MIN_BARS_REQUIRED = 1
        self.LIQUIDATE_ON_END = False

    def initialize_universe(self, current_date: str) -> bool:
        # The whole local universe, loaded once
        self.tickers.clear()
        self.add_ticker("AAPL")
        return bool(self.tickers)

    def on_signal(self, ticker: str, data: StockData) -> Order | None:
        # If we already hold this ticker, do nothing
        if ticker in self.open_tickers:
            return None

        if not self.tickers:
            return None

        close = float(data.close_price[-1])
        if close <= 0:
            return None

        allocation = 1.0 / len(self.tickers)
        return Order(
            ticker=ticker,
            position_type=PositionType.LONG,
            allocation=allocation,
            order_date=str(data.dates[-1]),
            stop_loss=0.0,
            take_profit=0.0,
        )
