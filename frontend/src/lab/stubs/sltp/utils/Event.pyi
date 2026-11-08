from dataclasses import dataclass
from sltp.utils.EventType import EventType as EventType

@dataclass(frozen=True)
class Event:
    date: str
    type: EventType
    price: float
