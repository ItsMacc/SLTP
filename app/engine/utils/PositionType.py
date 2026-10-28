# PositionType.py — Which way a position is held.
#
# LONG or SHORT only. Buy/sell is an action taken at the venue and is
# deliberately not represented here: a buy can open a long or cover a short,
# so direction and action must never share one field.

# -------- Imports --------
from enum import Enum


# -------- Position Type --------
class PositionType(Enum):
    LONG = "long"
    SHORT = "short"
