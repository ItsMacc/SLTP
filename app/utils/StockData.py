from dataclasses import dataclass
import numpy as np


@dataclass
class StockData:
    ticker: str
    dates: np.ndarray
    open_price: np.ndarray
    high: np.ndarray
    low: np.ndarray
    close_price: np.ndarray
    volume: np.ndarray