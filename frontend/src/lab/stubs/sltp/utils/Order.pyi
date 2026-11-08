from dataclasses import dataclass
from enum import Enum
from sltp.utils.PositionType import PositionType as PositionType

class OrderSizing(Enum):
    EQUITY = 'equity'
    FIXED = 'fixed'
    AVAILABLE = 'available'

@dataclass(frozen=True)
class Order:
    ticker: str
    position_type: PositionType
    allocation: float
    order_date: str
    stop_loss: float
    take_profit: float
    meta_data: dict | None = ...
    sizing: OrderSizing = ...
    def calculate_weight(self, current_equity: float, available_cash: float) -> float: ...
