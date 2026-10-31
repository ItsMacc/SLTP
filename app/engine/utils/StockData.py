# StockData.py — The market data container passed to strategies.
#
# A single ticker's daily OHLCV history as parallel numpy arrays. The backtester
# and runner slice these arrays up to the current date before calling
# generate_signal, so the last element of every array is "today" and lookahead is
# impossible.
#
# Dates are stored as int32 day numbers (see app/engine/utils/Dates.py) to keep a
# full universe at 4 bytes per bar. `dates` still reads as "YYYY-MM-DD" strings so
# existing strategies and docs keep working.

# -------- Imports --------
import numpy as np
from dataclasses import dataclass

from app.engine.utils.Dates import CALENDAR, DateLabels, codes_from_labels

# -------- Helpers --------
def _coerce_codes(value) -> np.ndarray:
    """Accept date codes, "YYYY-MM-DD" labels or datetimes and return int32 codes."""
    if value is None:
        raise TypeError("StockData requires date_codes (or legacy dates).")
    if isinstance(value, DateLabels):
        return value._codes
    array = np.asarray(value)
    if array.dtype == np.int32:
        return array
    if array.dtype.kind in "USOM":
        return codes_from_labels(array)
    if array.dtype.kind in "iu":
        return array.astype(np.int32)
    raise TypeError(f"Cannot build dates from {array.dtype} values.")


# -------- Stock Data --------
@dataclass(frozen=True, init=False)
class StockData:
    ticker: str
    date_codes: np.ndarray
    open_price: np.ndarray
    high: np.ndarray
    low: np.ndarray
    close_price: np.ndarray
    volume: np.ndarray

    def __init__(
        self,
        ticker: str,
        date_codes=None,
        open_price=None,
        high=None,
        low=None,
        close_price=None,
        volume=None,
        *,
        dates=None,
    ):
        # `dates` is the legacy keyword: old readers pass "YYYY-MM-DD" arrays and
        # they are converted to codes here.
        fields = {
            "ticker": ticker,
            "date_codes": _coerce_codes(date_codes if date_codes is not None else dates),
            "open_price": open_price,
            "high": high,
            "low": low,
            "close_price": close_price,
            "volume": volume,
        }
        for name, value in fields.items():
            # Make all underlying NumPy arrays read-only in-place
            if isinstance(value, np.ndarray):
                value.flags.writeable = False
            object.__setattr__(self, name, value)

    # -------- Date views --------
    @property
    def dates(self) -> DateLabels:
        """The bar dates as a sequence of "YYYY-MM-DD" strings."""
        return DateLabels(self.date_codes)

    @property
    def labels(self) -> np.ndarray:
        """The bar dates as a "<U10" array, for JSON and tabular output."""
        return CALENDAR.label_array(self.date_codes)
