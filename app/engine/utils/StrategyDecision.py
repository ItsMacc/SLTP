# StrategyDecision.py — The output contract of every strategy.
#
# generate_signal() returns one of these per ticker per day. LONG signals
# reach the manager's on_signal; confidence can
# scale position sizing, metrics carry the numeric readouts (close_price is
# expected), and meta_data carries identifiers (ticker, signal_date are
# expected). Both dicts are free-form: add anything useful for debugging.

# -------- Imports --------
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


# -------- Strategy Decision --------
class Signal(Enum):
    LONG = "long"
    SHORT = "short"
    HOLD = "hold"
    EXIT = "exit"


@dataclass()
class StrategyDecision:
    signal: Signal
    confidence: float
    metrics: dict[str, float] = field(default_factory=dict)
    meta_data: dict[str, Any] = field(default_factory=dict)
