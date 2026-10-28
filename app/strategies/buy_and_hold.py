# buy_and_hold.py — Passive benchmark strategy.
#
# Buys every ticker in the universe once, on its first trading day, with an equal
# share of the book, and holds it to the end. No stop-loss, no take-profit, no
# rotation. This is the baseline every active strategy is compared against.

# -------- Imports --------
import math

from app.engine.strategy.strategy import Strategy
from app.engine.utils.Order import Order
from app.engine.utils.PositionType import PositionType
from app.engine.utils.RebalanceFrequency import RebalanceFrequency
from app.engine.utils.StockData import StockData


# -------- Buy And Hold Strategy --------
class BuyAndHold(Strategy):
    name: str = "Buy & Hold"
    description: str = "Standard Buy and Hold benchmark strategy"

    # Every name is held, so there is no position cap and no rotation
    MAX_POSITIONS = None
    MAX_LOTS_PER_TICKER = 1
    REBALANCE_FREQUENCY = RebalanceFrequency.NEVER

    def initialize_universe(self, current_date: str) -> bool:
        # The whole local universe, loaded once
        self.tickers.clear()
        self.add_tickers(self.available_universe)
        return bool(self.tickers)

    def on_signal(self, ticker: str, data: StockData) -> Order | None:
        # Buy once, the first day the ticker trades. Never sell.
        if self.is_open(ticker):
            return None

        close = float(data.close_price[-1])
        if close <= 0:
            return None

        # Round down so the equal shares can never sum past the whole book
        weight = math.floor(10000 / len(self.tickers)) / 10000

        return Order(
            ticker=ticker,
            position_type=PositionType.LONG,
            weight=weight,
            order_date=str(data.dates[-1]),
            stop_loss=0.0,    # 0 disables the stop
            take_profit=0.0,  # 0 disables the target
        )
