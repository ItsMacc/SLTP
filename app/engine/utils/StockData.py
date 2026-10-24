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
@dataclass
class StockData:
    ticker: str
    dates: np.ndarray
    open_price: np.ndarray
    high: np.ndarray
    low: np.ndarray
    close_price: np.ndarray
    volume: np.ndarray
