# Event.py — A dated fact that closed a trade.
#
# Immutable, because it records something that already happened and nothing may
# rewrite it afterwards. EventType carries the reason, so a separate reason
# field would only repeat it.

# -------- Imports --------
from dataclasses import dataclass
from app.engine.utils.EventType import EventType


# -------- Event --------
@dataclass(frozen=True)
class Event:
    date: str
    type: EventType
    price: float
