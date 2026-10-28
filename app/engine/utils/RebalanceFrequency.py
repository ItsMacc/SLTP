# RebalanceFrequency.py — How often a strategy rebuilds its universe.
#
# The cadence only. The dates themselves belong to the manager, because it owns
# the trading calendar and is the only thing that knows whether a rebalance day
# actually traded. NEVER exists so a strategy can opt out without a null.

# -------- Imports --------
from enum import Enum


# -------- Rebalance Frequency --------
class RebalanceFrequency(Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"
    NEVER = "never"
