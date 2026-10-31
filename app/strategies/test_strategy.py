# -------- test_strategy.py --------
# Single-ticker scratch strategy for testing and debugging.

# -------- Imports --------
# Engine imports
from app.engine.strategy import Strategy
from app.engine.utils.Order import Order
from app.engine.utils.StockData import StockData


# -------- Single Stock Strategy --------
class SingleStockStrategy(Strategy):
    # Set the name and description; the base class owns the rest.
    def __init__(self):
        self.name: str = "Single Stock Strategy"
        self.description: str = "Testing and debugging purposes"

    # Hold one name only.
    def initialize_universe(self, current_date: str) -> bool:
        self.add_ticker("AAPL")
        return True

    # Placeholder hook: no signal while debugging.
    def on_signal(self, ticker: str, data: StockData) -> Order | None:
        pass
