# registry.py — the prebuilt strategies this API can run.
#
# Sources are plain sltp strategies (``from sltp import Strategy, ...``), so
# the engine owns the math and this file only decides which id runs which
# class. Adding a strategy means dropping its .py file into backend/strategies
# and adding one entry here.

from strategies.benchmark import Benchmark
from strategies.global_trend_allocation import GlobalTrendAllocation
from strategies.low_volatility import LowVolatility30
from strategies.momentum_20 import Momentum20
from strategies.statistical_mean_reversion import StatisticalMeanReversionStrategy

STRATEGIES = [
    {
        "id": "buy-and-hold",
        "name": "Buy and Hold",
        "description": "Owns the S&P 500 through one fund for the whole run. The benchmark.",
        "cls": Benchmark,
    },
    {
        "id": "momentum-20",
        "name": "Momentum 20",
        "description": "Holds the 20 strongest liquid US stocks while SPY is above its 200-day average.",
        "cls": Momentum20,
    },
    {
        "id": "global-trend-allocation",
        "name": "Global Trend Allocation",
        "description": "Five-ETF book from trend, correlation and momentum. Exits a sleeve when its trend breaks.",
        "cls": GlobalTrendAllocation,
    },
    {
        "id": "low-volatility-30",
        "name": "Low Volatility 30",
        "description": "Equal-weighted 30 least volatile liquid US stocks, rebuilt quarterly.",
        "cls": LowVolatility30,
    },
    {
        "id": "statistical-mean-reversion",
        "name": "Statistical Mean Reversion",
        "description": "Buys stocks that fell further than their volatility explains, then waits for the snap back.",
        "cls": StatisticalMeanReversionStrategy,
    },
]


def strategy_by_id(strategy_id: str) -> dict | None:
    return next((entry for entry in STRATEGIES if entry["id"] == strategy_id), None)
