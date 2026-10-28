# Trade.py — A filled position and its lifecycle record.
#
# One Trade is one lot. Two entries in the same ticker are two Trades, each
# with its own levels, so a scale-in never averages entry prices or rewrites
# the risk that was committed. Entry facts are set at fill; an exit Event is
# attached when the position closes.
#
# weight is a fraction of equity at entry (0.11 means 11%) and equity_at_entry
# is the equity it was measured against. Both are kept because a weight taken
# from a 10,000 book and one taken from a 20,000 book are not addable: notional
# exposure and per-trade P&L are only recoverable with the equity alongside.

# -------- Imports --------
from dataclasses import dataclass
from app.engine.utils.Event import Event
from app.engine.utils.PositionType import PositionType


# -------- Trade --------
@dataclass
class Trade:
    id: int
    ticker: str
    position_type: PositionType
    entry_date: str
    entry_price: float
    weight: float
    equity_at_entry: float
    stop_loss: float
    take_profit: float
    fees: float
    exit: Event | None = None

    @property
    def is_open(self) -> bool:
        # Open means "has no exit event". The state is derived on purpose so it
        # can never disagree with the event that closed the trade.
        return self.exit is None
