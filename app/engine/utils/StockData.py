# StockData.py — The market data container passed to strategies.
#
# A single ticker's daily OHLCV history as parallel numpy arrays. The
# backtester and runner slice these arrays up to the current date before
# calling generate_signal, so the last element of every array is "today"
# and lookahead is impossible.

# -------- Imports --------
import numpy as np
from dataclasses import dataclass


# -------- Stock Data --------
@dataclass(frozen=True)
class StockData:
    ticker: str
    dates: np.ndarray
    open_price: np.ndarray
    high: np.ndarray
    low: np.ndarray
    close_price: np.ndarray
    volume: np.ndarray

    def __post_init__(self):
        # Make all underlying NumPy arrays read-only in-place
        for name in ['dates', 'open_price', 'high', 'low', 'close_price', 'volume']:
            arr = getattr(self, name)
            if isinstance(arr, np.ndarray):
                arr.flags.writeable = False