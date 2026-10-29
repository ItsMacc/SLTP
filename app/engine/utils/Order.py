# Order.py — A request to open a position, as submitted by a strategy.
#
# An order is a message: the manager consumes it at the next open, copies the
# risk levels onto the resulting Trade, then discards it. Frozen because a
# queued request must not change underneath the fill.
#
# weight is a fraction of equity at fill time (0.11 means 11%), never a
# percentage and never a currency amount. stop_loss and take_profit are
# absolute prices, decided from the data available when the order was placed.

# -------- Imports --------
from dataclasses import dataclass
from app.engine.utils.PositionType import PositionType


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
