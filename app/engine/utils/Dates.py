# Dates.py — Compact date storage for market data.
#
# Every bar keeps an int32 day number (days since 1970-01-01) instead of a
# 10-character string: 4 bytes per bar rather than 40. Every label ("YYYY-MM-DD")
# exists once in the process-wide Calendar, and DateLabels gives strategies, the
# API and the docs the string interface they already use.
#
#   code  = to_code("2024-01-02")     -> 19724
#   label = label(19724)              -> "2024-01-02"
#
# Codes sort exactly like their labels, so searchsorted works unchanged.

# -------- Imports --------
from __future__ import annotations

import threading
from datetime import date
from typing import Iterable, Iterator, Sequence

import numpy as np

# -------- Constants --------
EPOCH = np.datetime64("1970-01-01", "D")
EPOCH_ORDINAL = date(1970, 1, 1).toordinal()


# -------- Calendar --------
class Calendar:
    """Maps int32 day numbers to their "YYYY-MM-DD" labels.

    Labels register themselves the first time market data is read, so the
    calendar costs one copy of each distinct date (a few thousand strings) no
    matter how many bars are loaded.
    """

    __slots__ = ("_first_day", "_labels", "_present", "_label_matrix", "_lock")

    def __init__(self) -> None:
        self._first_day = 0
        self._labels: list[str | None] = []
        self._present = np.zeros(0, dtype=bool)
        self._label_matrix: np.ndarray | None = None
        self._lock = threading.RLock()

    # -------- Registration --------
    def register(self, labels: np.ndarray | Iterable[str]) -> np.ndarray:
        """Add labels to the calendar and return their int32 codes."""
        values = np.asarray(labels)
        if values.size == 0:
            return np.zeros(0, dtype=np.int32)

        codes = codes_from_labels(values)
        unique_codes, first_index = np.unique(codes, return_index=True)
        self._store(values[first_index], unique_codes)
        return codes

    def _store(self, labels: np.ndarray, codes: np.ndarray) -> None:
        with self._lock:
            low, high = int(codes[0]), int(codes[-1])
            if not self._labels or low < self._first_day or high >= self._first_day + len(self._labels):
                self._grow(low, high)

            offsets = codes - self._first_day
            if self._present[offsets].all():
                return

            for label, offset in zip(labels.tolist(), offsets.tolist()):
                self._labels[offset] = label
                self._present[offset] = True
            self._label_matrix = None

    def _grow(self, low: int, high: int) -> None:
        # Rebuild the day table so it spans [low, high], keeping what is stored.
        if self._labels:
            low = min(low, self._first_day)
            high = max(high, self._first_day + len(self._labels) - 1)
        span = high - low + 1
        labels: list[str | None] = [None] * span
        present = np.zeros(span, dtype=bool)
        if self._labels:
            offset = self._first_day - low
            labels[offset : offset + len(self._labels)] = self._labels
            present[offset : offset + len(self._present)] = self._present
        self._labels = labels
        self._present = present
        self._first_day = low
        self._label_matrix = None

    # -------- Lookups --------
    def label(self, code: int) -> str:
        """Return the "YYYY-MM-DD" label for a day number."""
        index = int(code) - self._first_day
        if index < 0 or index >= len(self._labels):
            raise KeyError(
                f"Date code {int(code)} is outside the loaded calendar. Read market data before decoding codes."
            )
        value = self._labels[index]
        if value is None:
            raise KeyError(
                f"Date code {int(code)} has no label. Read the market data that contains it first."
            )
        return value

    def label_array(self, codes: np.ndarray) -> np.ndarray:
        """Return the labels for an int32 code array as a "<U10" array."""
        if len(codes) == 0:
            return np.zeros(0, dtype="<U10")
        matrix = self._label_matrix
        if matrix is None:
            matrix = np.array([value or "" for value in self._labels], dtype="<U10")
            self._label_matrix = matrix
        return matrix[codes - self._first_day]


# -------- Conversions --------
def codes_from_labels(labels: np.ndarray) -> np.ndarray:
    """Convert "YYYY-MM-DD" labels (or datetimes) to int32 day numbers."""
    values = np.asarray(labels)
    if values.size == 0:
        return np.zeros(0, dtype=np.int32)
    if values.dtype.kind in "USO":
        return (values.astype("datetime64[D]") - EPOCH).astype(np.int32)
    if values.dtype.kind == "M":
        return (values.astype("datetime64[D]") - EPOCH).astype(np.int32)
    if values.dtype.kind in "iu":
        return values.astype(np.int32)
    raise TypeError(f"Cannot convert {values.dtype} values to date codes.")


def to_code(value: str) -> np.int32:
    """Convert one "YYYY-MM-DD" label to a code.

    Returns np.int32 so that searchsorted stays on its fast path; a plain Python
    int makes NumPy widen the key and search ~140x slower.
    """
    return np.int32(date.fromisoformat(value).toordinal() - EPOCH_ORDINAL)


def label(code: int) -> str:
    """Return the "YYYY-MM-DD" label for one code."""
    return CALENDAR.label(code)


def label_array(codes: np.ndarray) -> np.ndarray:
    """Return the labels for an int32 code array."""
    return CALENDAR.label_array(codes)


def register(labels: np.ndarray | Iterable[str]) -> np.ndarray:
    """Register labels with the shared calendar and return their codes."""
    return CALENDAR.register(labels)


# -------- Label view --------
class DateLabels(Sequence):
    """Array-like view over int32 date codes that yields "YYYY-MM-DD" strings.

    Strategies keep working unchanged: len(data.dates), data.dates[-1] and
    str(data.dates[-1]) all behave as they did with a string array. Comparisons
    and slicing stay on the fast code path.
    """

    __slots__ = ("_codes",)

    def __init__(self, codes: np.ndarray) -> None:
        self._codes = codes

    # -------- Sequence --------
    def __len__(self) -> int:
        return len(self._codes)

    def __getitem__(self, index):
        if isinstance(index, slice):
            return DateLabels(self._codes[index])
        if isinstance(index, np.ndarray):
            return DateLabels(self._codes[index])
        return CALENDAR.label(int(self._codes[index]))

    def __iter__(self) -> Iterator[str]:
        for code in self._codes.tolist():
            yield CALENDAR.label(code)

    # -------- Comparisons --------
    def _other_codes(self, other):
        if isinstance(other, DateLabels):
            return other._codes
        if isinstance(other, str):
            return to_code(other)
        return None

    def __eq__(self, other):
        codes = self._other_codes(other)
        return NotImplemented if codes is None else self._codes == codes

    def __ne__(self, other):
        codes = self._other_codes(other)
        return NotImplemented if codes is None else self._codes != codes

    def __lt__(self, other):
        codes = self._other_codes(other)
        return NotImplemented if codes is None else self._codes < codes

    def __le__(self, other):
        codes = self._other_codes(other)
        return NotImplemented if codes is None else self._codes <= codes

    def __gt__(self, other):
        codes = self._other_codes(other)
        return NotImplemented if codes is None else self._codes > codes

    def __ge__(self, other):
        codes = self._other_codes(other)
        return NotImplemented if codes is None else self._codes >= codes

    __hash__ = None

    # -------- Array interop --------
    def __array__(self, dtype=None, copy=None) -> np.ndarray:
        # Escape hatch for code that hands dates to NumPy directly.
        labels = CALENDAR.label_array(self._codes)
        return labels.astype(dtype) if dtype is not None else labels

    def tolist(self) -> list[str]:
        return list(self)

    def __repr__(self) -> str:
        count = len(self._codes)
        if count == 0:
            return "DateLabels([])"
        if count <= 4:
            return f"DateLabels({[CALENDAR.label(int(code)) for code in self._codes]})"
        return f"DateLabels({CALENDAR.label(int(self._codes[0]))} .. {CALENDAR.label(int(self._codes[-1]))}, {count} bars)"


# -------- Shared instance --------
CALENDAR = Calendar()
