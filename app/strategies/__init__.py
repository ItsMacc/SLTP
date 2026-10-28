# __init__.py — The strategy registry.
#
# Each strategy is one module in this package: a Strategy subclass that holds
# its universe, signals and exits. This module is the one place a strategy is
# declared. Adding one means dropping in its module and adding a line to REGISTRY.
#
# `main.py` reads REGISTRY instead of keeping its own copy. Import the strategy
# classes from this package only.

# -------- Imports --------
from app.strategies.buy_and_hold import BuyAndHold
from app.strategies.statistical_mean_reversion import StatisticalMeanReversionStrategy


# -------- Registry --------
# strategy id -> (class, kind)
# kind is "investing" or "trading"; the onboarding wizard filters on it.
REGISTRY: dict[str, tuple[type, str]] = {
    "buy-and-hold": (BuyAndHold, "investing"),
    "statistical-mean-reversion": (StatisticalMeanReversionStrategy, "investing"),
}

__all__ = [
    "REGISTRY",
    "BuyAndHold",
    "StatisticalMeanReversionStrategy",
]
