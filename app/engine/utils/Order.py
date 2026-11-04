# -------- Order.py --------
# A request to open a position, as submitted by a strategy.
#
# An order is a message: the manager consumes it at the next open, copies the risk
# levels onto the resulting Trade, then discards it. Frozen because a queued
# request must not change underneath the fill.
#
# allocation is the size in the unit named by sizing:
#   EQUITY    - a fraction of equity at fill time (0.11 means 11%), the default
#   FIXED     - a cash value in index units (19.90 means 19.90)
#   AVAILABLE - a fraction of equity, capped by the uninvested cash
#
# The manager trims a fill to what the cash can cover after costs, so an EQUITY
# order of 1.0 spends the whole book. stop_loss and take_profit are absolute
# prices, decided from the data available when the order was placed.

# -------- Imports --------
from dataclasses import dataclass
from enum import Enum

from app.engine.utils.PositionType import PositionType


# -------- Order Sizing --------
class OrderSizing(Enum):
    EQUITY = "equity"
    FIXED = "fixed"
    AVAILABLE = "available"


# -------- Order --------
@dataclass(frozen=True)
class Order:
    ticker: str
    position_type: PositionType
    allocation: float
    order_date: str
    stop_loss: float
    take_profit: float
    meta_data: dict | None = None
    sizing: OrderSizing = OrderSizing.EQUITY

    # Resolve the order's size into a fraction of current portfolio equity.
    def calculate_weight(self, current_equity: float, available_cash: float) -> float:
        if self.sizing is OrderSizing.EQUITY:
            return self.allocation

        if self.sizing is OrderSizing.FIXED:
            if current_equity <= 0:
                return 0.0
            return self.allocation / current_equity

        if self.sizing is OrderSizing.AVAILABLE:
            if current_equity <= 0 or available_cash <= 0:
                return 0.0
            return min(self.allocation, available_cash / current_equity)

        raise ValueError(f"Unknown order sizing: {self.sizing}")
