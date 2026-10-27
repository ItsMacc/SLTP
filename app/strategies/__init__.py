# __init__.py — The strategy registry.
#
# Every tradable strategy lives in this package as a pair of modules: the
# strategy itself (signal generation) and its manager (universe, sizing,
# exits). This module is the one place a strategy is declared, so adding one
# means dropping in its two modules and adding a single line to REGISTRY.
#
# `main.py` and `daily_runner.py` both read REGISTRY instead of keeping copies
# of it. Import the strategy classes from this package only. Inside the
# package, siblings are imported by their full module path
# (app.strategies.<module>) so the package never has to look an attribute up on
# itself mid-initialisation.

# -------- Imports --------
from app.strategies.buy_and_hold import BuyAndHold
from app.strategies.statistical_mean_reversion import StatisticalMeanReversionStrategy
from app.strategies.stock_health_filter import StockHealthFilterStrategy


# -------- Registry --------
# strategy id -> (class, kind)
# kind is "investing" or "trading"; the onboarding wizard filters on it.
REGISTRY: dict[str, tuple[type, str]] = {
    "buy-and-hold": (BuyAndHold, "investing"),
    "stock-health-filter": (StockHealthFilterStrategy, "trading"),
    "statistical-mean-reversion": (StatisticalMeanReversionStrategy, "investing"),
}

__all__ = [
    "REGISTRY",
    "BuyAndHold",
    "StockHealthFilterStrategy",
    "StatisticalMeanReversionStrategy",
]
