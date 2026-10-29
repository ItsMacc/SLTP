# Tests a single ticker to see if strategy is working.
# Also useful for testing

from app.engine.strategy.strategy import Strategy
from app.engine.utils.Order import Order
from app.engine.utils.StockData import StockData


class SingleStockStrategy(Strategy):
    def __init__(self):
        self.name = "Single Stock Strategy"
        self.description = "Testing and debugging purposes"

    def initialize_universe(self, current_date: str) -> bool:
        self.add_ticker("AAPL")
        return True

    def on_signal(self, ticker: str, data: StockData) -> Order | None:
        pass