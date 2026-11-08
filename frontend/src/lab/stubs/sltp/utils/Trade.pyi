from dataclasses import dataclass
from sltp.utils.Event import Event as Event
from sltp.utils.PositionType import PositionType as PositionType
from sltp.utils.StockData import StockData as StockData

@dataclass
class Trade:
    id: int
    ticker: str
    history: StockData
    position_type: PositionType
    entry_date: str
    entry_price: float
    allocation: float
    equity_at_entry: float
    stop_loss: float
    take_profit: float
    fees: float
    dividend_income: float = ...
    exit: Event | None = ...
    @property
    def is_open(self) -> bool: ...
