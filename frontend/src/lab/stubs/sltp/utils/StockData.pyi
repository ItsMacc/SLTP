import numpy as np
from dataclasses import dataclass
from sltp.utils.Dates import CALENDAR as CALENDAR, DateLabels as DateLabels, codes_from_labels as codes_from_labels

def _coerce_codes(value) -> np.ndarray: ...

@dataclass(frozen=True, init=False)
class StockData:
    ticker: str
    date_codes: np.ndarray
    open_price: np.ndarray
    high: np.ndarray
    low: np.ndarray
    close_price: np.ndarray
    volume: np.ndarray
    def __init__(self, ticker: str, date_codes=None, open_price=None, high=None, low=None, close_price=None, volume=None, *, dates=None) -> None: ...
    @property
    def dates(self) -> DateLabels: ...
    @property
    def labels(self) -> np.ndarray: ...
