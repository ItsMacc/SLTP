# EventType.py — Why a trade closed.
#
# Exit causes only. Keeping this set closed is what lets Event stay a small
# record hanging off a Trade; if non-exit events are ever needed they get their
# own type rather than another value here.

# -------- Imports --------
from enum import Enum


# -------- Event Type --------
class EventType(Enum):
    STOP_LOSS = "stop_loss"
    TAKE_PROFIT = "take_profit"
    SIGNAL = "signal"
    END_OF_BACKTEST = "end_of_backtest"
