# -------- market_data.py --------
# Builds and updates the master daily-bar files.
#
# init_market_data()   Builds the master file once from the whole catalog. Resumable:
#                      chunks already downloaded are kept, so a dropped connection or
#                      a crashed run continues where it stopped instead of restarting.
# update_market_data() Appends the newest bars. Runs at most once per day and skips weekends.
#
# Bars live in two files so a daily run never rewrites history:
#
#   market_data.parquet         every bar up to the last init or compaction
#   market_data_recent.parquet  the bars added since, one session a day
#   market_actions.parquet      splits and dividends, one row per event
#
# The update reads and rewrites only the tail, which is a few megabytes. Once the tail
# holds more sessions than MAX_RECENT_SESSIONS it is folded into the master file and
# cleared, so the expensive full rewrite happens about once every two years rather than
# every night. A bar is only ever written when it is newer than that symbol's newest
# stored bar, so no bar is stored twice and compaction is a plain concatenation.
#
# Splits and dividends come down with the same download as the bars, so they cost no
# extra request. They go to market_actions.parquet as one row per event: a ratio for a
# split (4.0 is 4-for-1, 0.125 is 1-for-8, 1.253 is a spin-off) and a per-share amount for
# a dividend, both already split-adjusted by the source. A split newer than a symbol's
# last stored bar means the stored bars sit at the old prices, so that symbol is refetched
# whole: the one time the update rewrites the master file, and the only bars ever dropped.
#
# No bar is ever dropped for being old. A symbol that stops trading keeps everything it had;
# only its state changes, and that state lives in symbol_status.parquet, the single
# tracking file: status, bar count, first and last bar, sessions behind, attempts, last
# attempt and the last error.
#
#   active   has a bar on the newest session we hold
#   lagging  1 to 4 sessions behind, retried by the next update
#   stopped  5 or more sessions behind: delisted, halted or dead, re-probed monthly
#   missing  never returned a single bar, re-probed weekly after a few attempts
#
# Commands:
#   python -m app.database.market.market_data init [--force]
#   python -m app.database.market.market_data update
#   python -m app.database.market.market_data status

# -------- Imports --------
import os
import sys
import shutil
import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.parquet as pq
import yfinance as yf

from time import time
from datetime import date

# Engine imports
from app.engine.utils.Dates import CALENDAR, codes_from_labels, labels_from_codes, to_code

# Database imports
from app.database.market.market_data_service import (
    ACTIONS_FILE, ACTION_DIVIDEND, ACTION_SPLIT, RECENT_FILE, data_files, get_all_ticker_names,
    get_latest_trading_date, get_symbol_categories, refresh_market_data_cache,
)


# -------- Paths & Constants --------
MARKET_DIR: str = os.path.dirname(os.path.abspath(__file__))
SYMBOL_DATA_DIR: str = os.path.join(MARKET_DIR, "..", "symbol_data")
MASTER_FILE: str = os.path.join(MARKET_DIR, "market_data.parquet")
STATUS_FILE: str = os.path.join(SYMBOL_DATA_DIR, "symbol_status.parquet")
PARTS_DIR: str = os.path.join(MARKET_DIR, "init_parts")

START_DATE: str = "1998-01-01"
START_CODE: np.int32 = to_code(START_DATE)
CHUNK_SIZE: int = 500
PRICE_COLS: list[str] = ["Open", "High", "Low", "Close", "Volume"]

# Sessions the tail may hold before it is folded into the master file. At roughly 250
# sessions a year this is about two years of daily writes, then one full rewrite.
MAX_RECENT_SESSIONS: int = 500

# A short window is the fast answer, but it also lies: a live symbol can return zero
# bars for five days, so a miss is always retried on a month before we believe it.
PROBE_PERIOD: str = "5d"
WIDE_PERIOD: str = "1mo"

# Recent symbols look back a month, not a week: a split is only reported on its own
# session, so a week-long gap between runs would hide the event that caused the seam.
RECENT_PERIOD: str = "1mo"

# Status thresholds. Sessions are counted on the calendar stored in the master file.
STOPPED_AFTER_SESSIONS: int = 5
RETRY_STOPPED_AFTER_DAYS: int = 30
RETRY_MISSING_AFTER_DAYS: int = 7
MISSING_ATTEMPTS_BEFORE_BACKOFF: int = 3
STALE_AFTER_DAYS: int = 30

# A whole batch can come back empty for reasons that have nothing to do with the
# symbols in it, so a batch is tried twice, the leftovers are retried in small
# batches, and a small remainder is asked one ticker at a time.
BATCH_ATTEMPTS: int = 2
RETRY_BATCH_SIZE: int = 50
PER_TICKER_LIMIT_DAILY: int = 150
PER_TICKER_LIMIT_INIT: int = 40

# Dates are int32 day numbers and every price column float32: 24 bytes a bar.
MASTER_SCHEMA: pa.Schema = pa.schema([
    ("Symbol", pa.string()),
    ("Name", pa.string()),
    ("Date", pa.int32()),
    ("Open", pa.float32()),
    ("High", pa.float32()),
    ("Low", pa.float32()),
    ("Close", pa.float32()),
    ("Volume", pa.float32()),
])

# Splits and dividends live in their own file: one row per event, not one per bar, so it
# stays a few megabytes while the bar files carry 30M rows. Amount is a ratio (4.0 is
# 4-for-1, 0.125 is 1-for-8, 1.253 is a spin-off) or a dividend per share. Both are
# already split-adjusted by the source, so they line up with the stored closes.
ACTIONS_SCHEMA: pa.Schema = pa.schema([
    ("Symbol", pa.string()),
    ("Date", pa.int32()),
    ("Kind", pa.int8()),
    ("Amount", pa.float32()),
])

LEDGER_COLUMNS: list[str] = [
    "Symbol", "Name", "Category", "Status", "Bars", "FirstBar", "LastBar",
    "SessionsBehind", "Attempts", "LastAttempt", "LastError",
]


# -------- Small Helpers --------
# Today as YYYY-MM-DD.
def _today() -> str:
    return date.today().isoformat()


# A ledger value as text. Parquet round-trips empty cells as NaN, which would turn
# into the string "nan" and break every date comparison downstream.
def _text(value) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return "" if pd.isna(value) else str(value)


# Whole days between two ISO dates; a missing or unreadable date counts as very old.
def _days_between(start: str, end: str) -> int:
    if not start:
        return 9999
    try:
        return (date.fromisoformat(end) - date.fromisoformat(start)).days
    except ValueError:
        return 9999


# yfinance writes share classes with a dash: BRK.B becomes BRK-B.
def _yf_symbol(ticker: str) -> str:
    return ticker.replace(".", "-")


# Split a list into groups of the given size.
def _chunks(items: list[str], size: int = CHUNK_SIZE) -> list[list[str]]:
    return [items[index:index + size] for index in range(0, len(items), size)]


# Status for a symbol that sits this many sessions behind the newest session.
def _status_of(sessions_behind: int) -> str:
    if sessions_behind < 0:
        return "missing"
    if sessions_behind == 0:
        return "active"
    return "lagging" if sessions_behind < STOPPED_AFTER_SESSIONS else "stopped"


# Path of one chunk's staging file.
def _part_path(index: int) -> str:
    return os.path.join(PARTS_DIR, f"chunk_{index:04d}.parquet")


# -------- Tracking File --------
# One row per catalog symbol. This is the only bookkeeping the ingestion keeps.
def _blank_row(symbol: str, name: str, category: str) -> dict:
    return {
        "Symbol": symbol, "Name": name, "Category": category, "Status": "pending",
        "Bars": 0, "FirstBar": "", "LastBar": "", "SessionsBehind": -1,
        "Attempts": 0, "LastAttempt": "", "LastError": "",
    }


# Read the tracking file as symbol -> row, empty on the first run.
def _load_ledger() -> dict[str, dict]:
    if not os.path.exists(STATUS_FILE):
        return {}
    frame: pd.DataFrame = pd.read_parquet(STATUS_FILE)
    return {str(row["Symbol"]): row for row in frame.to_dict("records")}


# Write the tracking file in one step, so a crash cannot leave half a ledger.
def _save_ledger(ledger: dict[str, dict]) -> None:
    os.makedirs(SYMBOL_DATA_DIR, exist_ok=True)
    rows: list[dict] = [ledger[symbol] for symbol in sorted(ledger)]
    frame: pd.DataFrame = pd.DataFrame(rows, columns=LEDGER_COLUMNS)
    frame["Bars"] = frame["Bars"].fillna(0).astype("int64")
    frame["SessionsBehind"] = frame["SessionsBehind"].fillna(-1).astype("int32")
    frame["Attempts"] = frame["Attempts"].fillna(0).astype("int32")
    for column in ["Symbol", "Name", "Category", "Status", "FirstBar", "LastBar", "LastAttempt", "LastError"]:
        frame[column] = frame[column].fillna("").astype(str)
    tmp_file: str = STATUS_FILE + ".tmp"
    frame.to_parquet(tmp_file, compression="snappy", index=False)
    os.replace(tmp_file, STATUS_FILE)


# Record one probe for every symbol in a chunk: attempts go up, and the error column
# says whether bars came back. Bar counts and dates are filled in from the master.
def _mark_attempted(ledger: dict[str, dict], probed: list[str], received: list[str], missed: list[str], today: str) -> None:
    got: set[str] = set(received)
    for symbol in probed:
        row: dict = ledger.setdefault(symbol, _blank_row(symbol, symbol, "stock"))
        row["Attempts"] = int(row.get("Attempts", 0)) + 1
        row["LastAttempt"] = today
        row["LastError"] = "" if symbol in got else "no bars returned"


# -------- Downloads --------
# One yfinance call. Returns None only when the call itself raises.
def _download(tickers: list[str], **range_kwargs) -> pd.DataFrame | None:
    try:
        return yf.download(
            tickers=[_yf_symbol(ticker) for ticker in tickers],
            interval="1d",
            group_by="ticker",
            auto_adjust=False,
            actions=True,
            threads=True,
            progress=False,
            **range_kwargs,
        )
    except Exception as error:
        print(f"  download failed for {len(tickers)} symbol(s): {error}")
        return None


# One ticker's bars in master-file layout, or None when it has no usable bar.
# Rows without a close are dropped on purpose: after a delisting yfinance keeps
# returning dated rows whose prices are all null.
def _extract_bars(frame: pd.DataFrame, ticker: str, name: str) -> pd.DataFrame | None:
    try:
        stock: pd.DataFrame = frame[_yf_symbol(ticker)] if isinstance(frame.columns, pd.MultiIndex) else frame
    except KeyError:
        return None
    if stock is None or stock.empty:
        return None

    stock = stock.dropna(how="all").copy()
    if stock.empty:
        return None
    try:
        stock.index = pd.to_datetime(stock.index)
    except (TypeError, ValueError):
        return None

    stock.index.name = "Date"
    bars: pd.DataFrame = stock.reset_index()
    bars.columns = [str(column).strip().capitalize() for column in bars.columns]
    if any(column not in bars.columns for column in ["Date"] + PRICE_COLS):
        return None

    bars = bars.dropna(subset=["Close"])
    bars = bars[bars["Close"] > 0]
    if bars.empty:
        return None

    bars = bars[["Date"] + PRICE_COLS].copy()
    bars["Date"] = codes_from_labels(bars["Date"].to_numpy())
    bars = bars[(bars["Date"] >= START_CODE) & (bars["Date"] <= to_code(_today()))]
    bars = bars.drop_duplicates(subset=["Date"]).sort_values("Date")
    if bars.empty:
        return None

    for column in PRICE_COLS:
        bars[column] = bars[column].astype("float32")
    bars.insert(0, "Name", name)
    bars.insert(0, "Symbol", ticker)
    return bars.reset_index(drop=True)


# One ticker's split and dividend rows from a download, in actions-file layout, or None
# when the window held no event. The source only fills these columns on the event date.
def _extract_actions(frame: pd.DataFrame, ticker: str) -> pd.DataFrame | None:
    try:
        stock: pd.DataFrame = frame[_yf_symbol(ticker)] if isinstance(frame.columns, pd.MultiIndex) else frame
    except KeyError:
        return None
    if stock is None or stock.empty:
        return None

    block: pd.DataFrame = stock.dropna(how="all").copy()
    try:
        block.index = pd.to_datetime(block.index)
    except (TypeError, ValueError):
        return None
    block.index.name = "Date"

    events: pd.DataFrame = block.reset_index()
    events.columns = [str(column).strip().capitalize() for column in events.columns]
    if any(column not in events.columns for column in ("Date", "Dividends", "Stock splits")):
        return None

    rows: list[pd.DataFrame] = []
    for column, kind in (("Stock splits", ACTION_SPLIT), ("Dividends", ACTION_DIVIDEND)):
        picked: pd.DataFrame = events[events[column] > 0][["Date", column]]
        if picked.empty:
            continue
        picked = picked.rename(columns={column: "Amount"})
        picked["Symbol"] = ticker
        picked["Kind"] = np.int8(kind)
        picked["Amount"] = picked["Amount"].astype("float32")
        rows.append(picked[["Symbol", "Date", "Kind", "Amount"]])
    if not rows:
        return None

    combined: pd.DataFrame = pd.concat(rows, ignore_index=True)
    combined["Date"] = codes_from_labels(combined["Date"].to_numpy())
    combined = combined[(combined["Date"] >= START_CODE) & (combined["Date"] <= to_code(_today()))]
    return combined.reset_index(drop=True)


# Turn one downloaded frame into per-ticker data frames, splitting received from missed,
# and collect the split and dividend rows that came with the same download.
def _split_frame(frame: pd.DataFrame | None, tickers: list[str], names: dict[str, str]) -> tuple[list[pd.DataFrame], list[str], list[str], list[pd.DataFrame]]:
    frames: list[pd.DataFrame] = []
    received: list[str] = []
    missed: list[str] = []
    actions: list[pd.DataFrame] = []
    for ticker in tickers:
        bars: pd.DataFrame | None = _extract_bars(frame, ticker, names.get(ticker, ticker)) if frame is not None else None
        if bars is None:
            missed.append(ticker)
            continue
        frames.append(bars)
        received.append(ticker)
        events: pd.DataFrame | None = _extract_actions(frame, ticker) if frame is not None else None
        if events is not None:
            actions.append(events)
    return frames, received, missed, actions


# One batch attempt over a ticker list, split into chunk-sized requests.
def _probe(tickers: list[str], names: dict[str, str], range_kwargs: dict) -> tuple[list[pd.DataFrame], list[str], list[str], list[pd.DataFrame]]:
    frames: list[pd.DataFrame] = []
    received: list[str] = []
    missed: list[str] = []
    actions: list[pd.DataFrame] = []
    for chunk in _chunks(tickers):
        frame: pd.DataFrame | None = _download(chunk, **range_kwargs)
        chunk_frames, chunk_received, chunk_missed, chunk_actions = _split_frame(frame, chunk, names)
        frames += chunk_frames
        received += chunk_received
        missed += chunk_missed
        actions += chunk_actions
    return frames, received, missed, actions


# Download a list of tickers with the fallbacks that make a run trustworthy:
# the batch is tried twice, a short window is widened to a month, whatever is left
# is retried in small batches, and a small remainder is asked one ticker at a time.
def _download_group(tickers: list[str], names: dict[str, str], range_kwargs: dict) -> tuple[list[pd.DataFrame], list[str], list[str], list[pd.DataFrame]]:
    if not tickers:
        return [], [], [], []

    frames: list[pd.DataFrame] = []
    received: list[str] = []
    missed: list[str] = list(tickers)
    actions: list[pd.DataFrame] = []

    for _ in range(BATCH_ATTEMPTS):
        batch_frames, batch_received, missed, batch_actions = _probe(missed, names, range_kwargs)
        frames += batch_frames
        received += batch_received
        actions += batch_actions
        if not missed:
            return frames, received, missed, actions

    # A five-day window is unreliable for thin symbols; ask for a month before believing it.
    if "period" in range_kwargs:
        wide_frames, wide_received, missed, wide_actions = _probe(missed, names, {"period": WIDE_PERIOD})
        frames += wide_frames
        received += wide_received
        actions += wide_actions
        if not missed:
            return frames, received, missed, actions

    # Small batches first: this is what rescues a whole chunk that failed as one request.
    leftover: list[str] = list(missed)
    missed = []
    for batch in _chunks(leftover, RETRY_BATCH_SIZE):
        batch_frames, batch_received, batch_missed, batch_actions = _probe(batch, names, range_kwargs)
        frames += batch_frames
        received += batch_received
        missed += batch_missed
        actions += batch_actions
    if not missed:
        return frames, received, missed, actions

    # Individual requests: a malformed symbol in a batch shows up here and nowhere else.
    limit: int = PER_TICKER_LIMIT_DAILY if "period" in range_kwargs else PER_TICKER_LIMIT_INIT
    if len(missed) > limit:
        return frames, received, missed, actions

    singles: list[str] = list(missed)
    missed = []
    for ticker in singles:
        single_frames, single_received, single_missed, single_actions = _probe([ticker], names, range_kwargs)
        frames += single_frames
        received += single_received
        missed += single_missed
        actions += single_actions

    return frames, received, missed, actions


# -------- Master File --------
# Read every symbol's bar count, first and last date, plus the session calendar,
# across both bar files. Symbol and Date are dictionary-encoded, so this stays small
# even at 30M rows.
def _master_stats() -> tuple[dict[str, tuple[int, str, str]], list[str]]:
    if not os.path.exists(MASTER_FILE):
        return {}, []

    table: pa.Table = pq.read_table(data_files(), columns=["Symbol", "Date"], read_dictionary=["Symbol"])
    frame: pd.DataFrame = table.to_pandas()
    codes = np.unique(frame["Date"].to_numpy())

    # Day numbers carry their own labels, so the shared calendar can decode them.
    CALENDAR.register(labels_from_codes(codes))
    sessions: list[str] = [CALENDAR.label(int(code)) for code in codes]

    grouped = frame.groupby("Symbol", observed=True)["Date"].agg(["size", "min", "max"])
    stats: dict[str, tuple[int, str, str]] = {
        str(symbol): (int(row["size"]), CALENDAR.label(int(row["min"])), CALENDAR.label(int(row["max"])))
        for symbol, row in grouped.iterrows()
    }
    return stats, sessions


# Fill bars, dates and status for every catalog symbol, keeping the attempt history.
# Symbols that left the catalog are dropped from the tracking file.
def _refresh_ledger(ledger: dict[str, dict], today: str) -> dict[str, dict]:
    stats, sessions = _master_stats()
    position: dict[str, int] = {session: index for index, session in enumerate(sessions)}
    newest: int = len(sessions) - 1
    names: dict[str, str] = get_all_ticker_names()
    categories: dict[str, str] = get_symbol_categories()

    refreshed: dict[str, dict] = {}
    for symbol, name in names.items():
        row: dict = ledger.get(symbol) or _blank_row(symbol, name, categories.get(symbol, "stock"))
        row["Name"] = name
        row["Category"] = categories.get(symbol, row.get("Category", "stock"))
        bars, first_bar, last_bar = stats.get(symbol, (0, "", ""))
        row["Bars"] = bars
        row["FirstBar"] = first_bar
        row["LastBar"] = last_bar
        behind: int = newest - position[last_bar] if last_bar else -1
        row["SessionsBehind"] = behind
        row["Status"] = _status_of(behind)
        refreshed[symbol] = row

    return refreshed


# Add the new bars to the recent tail and replace it. History is not read and not
# rewritten: the frames handed in only carry bars newer than what is already stored,
# so this touches a few megabytes instead of the whole dataset.
def _append_recent(frames: list[pd.DataFrame]) -> tuple[int, int]:
    parts: list[pd.DataFrame] = []
    if os.path.exists(RECENT_FILE):
        parts.append(pd.read_parquet(RECENT_FILE))
    parts += frames

    combined: pd.DataFrame = (
        pd.concat(parts, ignore_index=True)
        .dropna(subset=["Symbol", "Date"])
        .drop_duplicates(subset=["Symbol", "Date"], keep="last")
        .sort_values(["Symbol", "Date"])
    )
    combined["Name"] = combined["Name"].fillna("")

    table: pa.Table = pa.Table.from_pandas(combined, schema=MASTER_SCHEMA, preserve_index=False)
    tmp_file: str = RECENT_FILE + ".tmp"
    pq.write_table(table, tmp_file, compression="snappy")
    os.replace(tmp_file, RECENT_FILE)
    return len(combined), int(combined["Date"].nunique())


# Fold the recent tail into the master file and clear it. Streaming one batch at a time
# keeps this to a row batch in memory, since compaction is the one write that must touch
# every bar. No row appears in both files, so this is a concatenation, not a merge.
def _compact_master() -> int:
    tmp_file: str = MASTER_FILE + ".tmp"
    writer: pq.ParquetWriter | None = None
    rows: int = 0
    try:
        for path in data_files():
            for batch in pq.ParquetFile(path).iter_batches(batch_size=1_000_000):
                if writer is None:
                    writer = pq.ParquetWriter(tmp_file, MASTER_SCHEMA, compression="snappy")
                table: pa.Table = pa.Table.from_batches([batch]).cast(MASTER_SCHEMA)
                writer.write_table(table)
                rows += table.num_rows
        if writer is not None:
            writer.close()
            writer = None
        os.replace(tmp_file, MASTER_FILE)
    finally:
        if writer is not None:
            writer.close()
        if os.path.exists(tmp_file):
            os.remove(tmp_file)

    if os.path.exists(RECENT_FILE):
        os.remove(RECENT_FILE)
    return rows


# Write one chunk's staging file. Chunks are merged in catalog order at the end.
# The write goes to a temporary name and is renamed into place, because a resumed run
# treats any existing staging file as finished: a half-written file from an interrupted
# run would otherwise be merged as if it were complete.
def _write_part(path: str, frames: list[pd.DataFrame]) -> int:
    part: pd.DataFrame = pd.concat(frames, ignore_index=True).drop_duplicates(subset=["Symbol", "Date"], keep="last").sort_values(["Symbol", "Date"])
    table: pa.Table = pa.Table.from_pandas(part, schema=MASTER_SCHEMA, preserve_index=False)
    tmp_file: str = path + ".tmp"
    pq.write_table(table, tmp_file, compression="snappy")
    os.replace(tmp_file, path)
    return len(part)


# Stream the chunk files into the master file, one part at a time.
# Catalog order means the result is already sorted by symbol.
def _merge_parts(paths: list[str]) -> int:
    tmp_file: str = MASTER_FILE + ".tmp"
    writer: pq.ParquetWriter | None = None
    rows: int = 0
    try:
        for path in paths:
            if not os.path.exists(path):
                continue
            table: pa.Table = pq.read_table(path)
            if table.num_rows == 0:
                continue
            if writer is None:
                writer = pq.ParquetWriter(tmp_file, MASTER_SCHEMA, compression="snappy")
            writer.write_table(table.cast(MASTER_SCHEMA))
            rows += table.num_rows
    finally:
        if writer is not None:
            writer.close()

    if writer is None:
        return 0
    os.replace(tmp_file, MASTER_FILE)
    return rows


# Clear the read layer's cached data so the API serves the updated master file.
def _refresh_api_cache() -> None:
    refresh_market_data_cache()


# -------- Initialization --------
# Build the master file from the whole catalog. Safe to interrupt: finished chunks are
# staging files on disk and are skipped on the next run.
def init_market_data(force: bool = False) -> None:
    if os.path.exists(MASTER_FILE) and not force:
        print(f"Master file already exists at: {MASTER_FILE}")
        print("Run with --force to rebuild it from scratch.")
        return

    names: dict[str, str] = get_all_ticker_names()
    tickers: list[str] = sorted(names)
    if not tickers:
        print("The symbol catalog is empty; nothing to initialize.")
        return

    if force:
        shutil.rmtree(PARTS_DIR, ignore_errors=True)
    os.makedirs(PARTS_DIR, exist_ok=True)

    today: str = _today()
    chunks: list[list[str]] = _chunks(tickers)
    ledger: dict[str, dict] = _load_ledger()
    categories: dict[str, str] = get_symbol_categories()
    started: float = time()
    saved_total: int = 0
    print(f"Initializing {len(tickers)} symbols from {START_DATE} in {len(chunks)} chunk(s) of {CHUNK_SIZE}.")

    for index, chunk in enumerate(chunks):
        path: str = _part_path(index)
        for symbol in chunk:
            ledger.setdefault(symbol, _blank_row(symbol, names.get(symbol, symbol), categories.get(symbol, "stock")))

        if os.path.exists(path):
            print(f"  chunk {index + 1}/{len(chunks)}: already downloaded, keeping it")
            continue

        frames, received, missed, actions = _download_group(chunk, names, {"start": START_DATE})
        if frames:
            # Events first: a run interrupted before the part lands re-downloads the chunk,
            # and re-appending the same events is harmless because they are deduplicated.
            if actions:
                _append_actions(actions)
            _write_part(path, frames)
        _mark_attempted(ledger, chunk, received, missed, today)
        _save_ledger(ledger)
        saved_total += len(received)
        print(f"  chunk {index + 1}/{len(chunks)}: {len(received)} saved, {len(missed)} missing, "
              f"{saved_total} symbols so far, {time() - started:.0f}s elapsed")

    paths: list[str] = [_part_path(index) for index in range(len(chunks))]
    rows: int = _merge_parts(paths)
    if rows == 0:
        print("No bars downloaded; the master file was left untouched.")
        _save_ledger(_refresh_ledger(ledger, today))
        return

    # The rebuilt master covers every date the tail could hold, so it goes away only
    # once the new master is safely in place.
    if os.path.exists(RECENT_FILE):
        os.remove(RECENT_FILE)

    ledger = _refresh_ledger(ledger, today)
    _save_ledger(ledger)
    shutil.rmtree(PARTS_DIR, ignore_errors=True)
    _refresh_api_cache()
    _print_ledger_summary(ledger)


# -------- Actions File --------
# Merge split and dividend rows into the actions file. A symbol in `replaced` loses its
# old rows first, because a split restates every dividend that came before it.
def _append_actions(frames: list[pd.DataFrame], replaced: set[str] | None = None) -> int:
    parts: list[pd.DataFrame] = []
    if os.path.exists(ACTIONS_FILE):
        existing: pd.DataFrame = pd.read_parquet(ACTIONS_FILE)
        if replaced:
            existing = existing[~existing["Symbol"].isin(replaced)]
        parts.append(existing)
    parts += frames
    if not parts:
        return 0

    combined: pd.DataFrame = pd.concat(parts, ignore_index=True).dropna(subset=["Symbol", "Date"])
    combined = (
        combined.drop_duplicates(subset=["Symbol", "Date", "Kind"], keep="last")
        .sort_values(["Symbol", "Date", "Kind"])
        .reset_index(drop=True)
    )
    combined["Date"] = combined["Date"].astype("int32")
    combined["Kind"] = combined["Kind"].astype("int8")
    combined["Amount"] = combined["Amount"].astype("float32")

    table: pa.Table = pa.Table.from_pandas(combined, schema=ACTIONS_SCHEMA, preserve_index=False)
    tmp_file: str = ACTIONS_FILE + ".tmp"
    pq.write_table(table, tmp_file, compression="snappy")
    os.replace(tmp_file, ACTIONS_FILE)
    return len(combined)


# Symbols whose download reported a split after their last stored bar. Their stored bars
# sit at the old prices, so appending restated ones would leave a cliff in the history.
def _split_symbols(actions: list[pd.DataFrame], stats: dict[str, tuple[int, str, str]]) -> set[str]:
    split: set[str] = set()
    for events in actions:
        symbol: str = str(events["Symbol"].iloc[0])
        last_bar: str = stats.get(symbol, (0, "", ""))[2]
        if not last_bar:
            continue
        dates = events[events["Kind"] == ACTION_SPLIT]["Date"].to_numpy()
        if dates.size and int(dates.max()) > to_code(last_bar):
            split.add(symbol)
    return split


# One symbol's whole history again, with every event it ever had.
def _refetch_symbol(symbol: str, names: dict[str, str]) -> tuple[pd.DataFrame | None, list[pd.DataFrame]]:
    frames, _, _, actions = _probe([symbol], names, {"start": START_DATE})
    return (frames[0] if frames else None), actions


# Rewrite the bar files without the given symbols, then write their whole history back.
# A symbol must never hold its pre-split and post-split bars together, so this is the one
# update path that rewrites the master file. The tail is folded in on the way through.
def _replace_symbols(frames: list[pd.DataFrame]) -> int:
    value_set = pa.array([str(frame["Symbol"].iloc[0]) for frame in frames], type=pa.string())
    tmp_file: str = MASTER_FILE + ".tmp"
    writer: pq.ParquetWriter | None = None
    rows: int = 0
    try:
        for path in data_files():
            for batch in pq.ParquetFile(path).iter_batches(batch_size=1_000_000):
                table: pa.Table = pa.Table.from_batches([batch]).cast(MASTER_SCHEMA)
                table = table.filter(pc.invert(pc.is_in(table["Symbol"], value_set=value_set)))
                if table.num_rows == 0:
                    continue
                if writer is None:
                    writer = pq.ParquetWriter(tmp_file, MASTER_SCHEMA, compression="snappy")
                writer.write_table(table)
                rows += table.num_rows

        # The fresh history goes in as one block per symbol, so runs stay contiguous.
        for frame in frames:
            if writer is None:
                writer = pq.ParquetWriter(tmp_file, MASTER_SCHEMA, compression="snappy")
            table = pa.Table.from_pandas(frame, schema=MASTER_SCHEMA, preserve_index=False)
            writer.write_table(table)
            rows += table.num_rows

        if writer is not None:
            writer.close()
            writer = None
        os.replace(tmp_file, MASTER_FILE)
    finally:
        if writer is not None:
            writer.close()
        if os.path.exists(tmp_file):
            os.remove(tmp_file)

    if os.path.exists(RECENT_FILE):
        os.remove(RECENT_FILE)
    return rows


# -------- Daily Update --------
# Append the newest bars to the recent tail and record the splits and dividends that came
# with them. Misses are retried, stopped symbols are left alone for a month, and a symbol
# that split is refetched whole instead of being appended to.
def update_market_data() -> None:
    today: str = _today()
    if date.today().weekday() >= 5:  # Saturday or Sunday
        print("Weekend; skipping daily update.")
        return
    if not os.path.exists(MASTER_FILE):
        print(f"Master file not found at {MASTER_FILE}; run init first.")
        return

    stats, sessions = _master_stats()
    if not sessions:
        print("Market data has no sessions; run init first.")
        return
    if sessions[-1] >= today:
        print(f"Market data already holds {sessions[-1]}; nothing to do today.")
        return

    names: dict[str, str] = get_all_ticker_names()
    categories: dict[str, str] = get_symbol_categories()
    ledger: dict[str, dict] = _load_ledger()

    recent: list[str] = []
    stale: list[str] = []
    new: list[str] = []
    for symbol in sorted(names):
        row: dict = ledger.get(symbol) or _blank_row(symbol, names.get(symbol, symbol), categories.get(symbol, "stock"))
        ledger[symbol] = row
        last_bar: str = _text(row.get("LastBar"))
        if last_bar and last_bar >= today:
            continue
        if not _should_probe(row, today):
            continue
        if not last_bar:
            new.append(symbol)
        elif _days_between(last_bar, today) >= STALE_AFTER_DAYS:
            stale.append(symbol)
        else:
            recent.append(symbol)

    skipped: int = len(names) - len(recent) - len(stale) - len(new)
    print(f"Updating: {len(recent)} recent, {len(stale)} stale, {len(new)} never seen, {skipped} skipped.")

    frames: list[pd.DataFrame] = []
    actions: list[pd.DataFrame] = []
    split_symbols: set[str] = set()
    for group, range_kwargs in (
        (recent, {"period": RECENT_PERIOD}),
        (stale, {"start": _earliest_last_bar(ledger, stale)}),
        (new, {"start": START_DATE}),
    ):
        group_frames, received, missed, group_actions = _download_group(group, names, range_kwargs)
        actions += group_actions
        split_symbols |= _split_symbols(group_actions, stats)
        for frame in group_frames:
            if str(frame["Symbol"].iloc[0]) in split_symbols:
                continue
            kept: pd.DataFrame = _trim_to_new_bars(frame, stats)
            if not kept.empty:
                frames.append(kept)
        _mark_attempted(ledger, group, received, missed, today)

    if split_symbols:
        actions = [events for events in actions if str(events["Symbol"].iloc[0]) not in split_symbols]
        refreshed: list[pd.DataFrame] = []
        refreshed_actions: list[pd.DataFrame] = []
        for symbol in sorted(split_symbols):
            history, events = _refetch_symbol(symbol, names)
            if history is None:
                continue
            refreshed.append(history)
            refreshed_actions += events
            print(f"  {symbol}: split since its last bar; refetched {len(history)} bars.")
        if refreshed:
            replaced: set[str] = {str(frame["Symbol"].iloc[0]) for frame in refreshed}
            rows: int = _replace_symbols(refreshed)
            _append_actions(refreshed_actions, replaced=replaced)
            ledger = _refresh_ledger(ledger, today)
            _save_ledger(ledger)
            _refresh_api_cache()
            print(f"Splits: rebuilt {os.path.basename(MASTER_FILE)} without {len(refreshed)} old history(ies); {rows} rows.")

    if actions:
        total: int = _append_actions(actions)
        print(f"Actions: {total} split(s) and dividend(s) on file.")

    if not frames:
        print("No new bars came back; market data was left untouched.")
        _save_ledger(_refresh_ledger(ledger, today))
        return

    tail_rows, tail_sessions = _append_recent(frames)
    ledger = _refresh_ledger(ledger, today)
    _save_ledger(ledger)
    _refresh_api_cache()
    print(f"Tail updated: {tail_rows} rows over {tail_sessions} session(s), {len(frames)} symbol(s) got new bars.")

    if tail_sessions > MAX_RECENT_SESSIONS:
        print(f"Tail covers {tail_sessions} sessions; folding it into {os.path.basename(MASTER_FILE)} ...")
        rows: int = _compact_master()
        ledger = _refresh_ledger(ledger, today)
        _save_ledger(ledger)
        _refresh_api_cache()
        print(f"Compacted: {rows} rows in {os.path.basename(MASTER_FILE)}.")

    _print_ledger_summary(ledger)


# Whether a symbol is worth asking about today, given what the last attempt found.
def _should_probe(row: dict, today: str) -> bool:
    status: str = _text(row.get("Status"))
    since: int = _days_between(_text(row.get("LastAttempt")), today)
    if status == "stopped":
        return since >= RETRY_STOPPED_AFTER_DAYS
    if status == "missing" and int(row.get("Attempts", 0) or 0) >= MISSING_ATTEMPTS_BEFORE_BACKOFF:
        return since >= RETRY_MISSING_AFTER_DAYS
    return True


# Oldest last bar in a group, used as the single start date for a backfill download.
def _earliest_last_bar(ledger: dict[str, dict], symbols: list[str]) -> str:
    dates: list[str] = [_text(ledger[symbol].get("LastBar")) for symbol in symbols if ledger.get(symbol)]
    return min([value for value in dates if value] or [START_DATE])


# Keep only bars newer than what the symbol already stores, so a bar is never written
# twice and the read layer never sees a duplicated date.
def _trim_to_new_bars(frame: pd.DataFrame, stats: dict[str, tuple[int, str, str]]) -> pd.DataFrame:
    symbol: str = str(frame["Symbol"].iloc[0])
    last_bar: str = stats.get(symbol, (0, "", ""))[2]
    if not last_bar:
        return frame
    return frame[frame["Date"] > to_code(last_bar)]


# -------- Reporting --------
# One line per status, plus rows and symbols, so a run is easy to read.
def _print_ledger_summary(ledger: dict[str, dict]) -> None:
    counts: dict[str, int] = {}
    for row in ledger.values():
        status: str = str(row.get("Status") or "pending")
        counts[status] = counts.get(status, 0) + 1
    parts: str = ", ".join(f"{counts[status]} {status}" for status in sorted(counts))
    rows: int = sum(int(row.get("Bars") or 0) for row in ledger.values())
    print(f"Bars: {rows} rows across {len(ledger)} symbols ({parts}).")
    print(f"Tracking: {STATUS_FILE}")


# Print the current tracking file without touching any data.
def print_status() -> None:
    ledger: dict[str, dict] = _load_ledger()
    if not ledger:
        print("No tracking file yet; run init.")
        return

    print(f"Newest session: {get_latest_trading_date()}")
    _print_ledger_summary(ledger)

    stopped: list[str] = sorted(symbol for symbol, row in ledger.items() if row.get("Status") == "stopped")
    missing: list[str] = sorted(symbol for symbol, row in ledger.items() if row.get("Status") == "missing")
    if stopped:
        print(f"Stopped ({len(stopped)}): {', '.join(stopped[:20])}{' ...' if len(stopped) > 20 else ''}")
    if missing:
        print(f"Missing ({len(missing)}): {', '.join(missing[:20])}{' ...' if len(missing) > 20 else ''}")


# -------- Entry Point --------
if __name__ == "__main__":
    command: str = sys.argv[1].lower() if len(sys.argv) > 1 else ""
    flags: set[str] = {value.lower() for value in sys.argv[2:]}

    if command == "init":
        init_market_data(force="--force" in flags)
    elif command == "update":
        update_market_data()
    elif command == "status":
        print_status()
    else:
        print("usage: python3 -m app.database.market.market_data [init [--force] | update | status]")
