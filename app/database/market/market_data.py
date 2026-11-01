# -------- market_data.py --------
# Builds the bar files, the split and dividend file, the ledger and the split audit.
# A daily update appends to the tail and never rewrites history, except for a symbol that split.
# Files: market_data.parquet, market_data_recent.parquet, market_actions.parquet,
# symbol_status.parquet, split_audit.json.
# Commands: init [--force] | update | status | audit, as python -m app.database.market.market_data

# -------- Imports --------
import os
import sys
import json
import shutil
import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.parquet as pq
import yfinance as yf

from time import time
from typing import NamedTuple
from datetime import date

# Engine imports
from app.engine.utils.Dates import CALENDAR, codes_from_labels, labels_from_codes, to_code

# Database imports
from app.database.market.market_data_service import (
    ACTIONS_FILE, ACTION_DIVIDEND, ACTION_SPLIT, RECENT_FILE, bar_files, get_all_ticker_names,
    get_latest_trading_date, get_symbol_categories, refresh_market_data_cache,
)


# -------- Paths & Constants --------
MARKET_DIR: str = os.path.dirname(os.path.abspath(__file__))
SYMBOL_DATA_DIR: str = os.path.join(MARKET_DIR, "..", "symbol_data")
MASTER_FILE: str = os.path.join(MARKET_DIR, "market_data.parquet")
STATUS_FILE: str = os.path.join(SYMBOL_DATA_DIR, "symbol_status.parquet")
SPLIT_AUDIT_FILE: str = os.path.join(SYMBOL_DATA_DIR, "split_audit.json")
PARTS_DIR: str = os.path.join(MARKET_DIR, "init_parts")

START_DATE: str = "1998-01-01"
START_CODE: np.int32 = to_code(START_DATE)
CHUNK_SIZE: int = 500
PRICE_COLS: list[str] = ["Open", "High", "Low", "Close", "Volume"]

MAX_RECENT_SESSIONS: int = 500  # tail sessions before it is folded into the master, about two years
STALE_AFTER_DAYS: int = 30  # a symbol this far behind is downloaded from its last bar, not the last month

PROBE_PERIOD: str = "5d"  # fast answer, but it lies: a live symbol can return nothing for a week
WIDE_PERIOD: str = "1mo"
RECENT_PERIOD: str = "1mo"  # a split is only reported on its own session, so a week would hide it

STOPPED_AFTER_SESSIONS: int = 5
RETRY_STOPPED_AFTER_DAYS: int = 30
RETRY_MISSING_AFTER_DAYS: int = 7
MISSING_ATTEMPTS_BEFORE_BACKOFF: int = 3

BATCH_ATTEMPTS: int = 2
RETRY_BATCH_SIZE: int = 50
PER_TICKER_LIMIT_DAILY: int = 150
PER_TICKER_LIMIT_INIT: int = 40

SEAM_RATIO_TOLERANCE: float = 0.15  # how close a price jump must be to the split ratio to be a seam
SEAM_JUMP_TOLERANCE: float = 0.15  # how big a jump must be before it is worth explaining

# 24 bytes a bar: int32 dates and float32 prices.
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

ACTIONS_SCHEMA: pa.Schema = pa.schema([
    ("Symbol", pa.string()),
    ("Date", pa.int32()),
    ("Kind", pa.int8()),
    ("Amount", pa.float32()),  # split ratio (4.0 is 4-for-1) or dividend per share, both split-adjusted
])

LEDGER_COLUMNS: list[str] = [
    "Symbol", "Name", "Category", "Status", "Bars", "FirstBar", "LastBar", "SplitBasis",
    "SessionsBehind", "Attempts", "LastAttempt", "LastError",
]


# The seams found on one audit, with the ones that were not there last time.
class SplitSeamReport(NamedTuple):
    audited: int
    flagged: int
    new: list[tuple[str, str, float, float]]  # symbol, ex-date, ratio, observed
    cleared: list[str]


# -------- Initialization --------
# Build the master from the whole catalog. Safe to interrupt: finished chunks stay as staging files.
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
    chunks: list[list[str]] = _chunked(tickers)
    ledger: dict[str, dict] = _load_ledger()
    categories: dict[str, str] = get_symbol_categories()
    started: float = time()
    saved_total: int = 0
    print(f"Initializing {len(tickers)} symbols from {START_DATE} in {len(chunks)} chunk(s) of {CHUNK_SIZE}.")

    for index, chunk in enumerate(chunks):
        path: str = _part_path(index)
        for symbol in chunk:
            ledger.setdefault(symbol, _new_ledger_row(symbol, names.get(symbol, symbol), categories.get(symbol, "stock")))

        if os.path.exists(path):
            print(f"  chunk {index + 1}/{len(chunks)}: already downloaded, keeping it")
            continue

        frames, received, missed, actions = _download_symbols(chunk, names, {"start": START_DATE})
        if frames:
            if actions:  # events first: a crash before the part lands only re-downloads the chunk
                _save_actions(actions)
                _set_split_basis(ledger, actions)
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

    if os.path.exists(RECENT_FILE):  # the rebuilt master covers every date the tail could hold
        os.remove(RECENT_FILE)

    ledger = _refresh_ledger(ledger, today)
    _save_ledger(ledger)
    shutil.rmtree(PARTS_DIR, ignore_errors=True)
    refresh_market_data_cache()
    _print_ledger(ledger)


# -------- Daily Update --------
# Append the newest bars, record their splits and dividends, and refetch whole any symbol that split.
def update_market_data() -> None:
    today: str = _today()
    if date.today().weekday() >= 5:  # Saturday or Sunday
        print("Weekend; skipping daily update.")
        return
    if not os.path.exists(MASTER_FILE):
        print(f"Master file not found at {MASTER_FILE}; run init first.")
        return

    stats, sessions = _stored_bar_stats()
    if not sessions:
        print("Market data has no sessions; run init first.")
        return
    if sessions[-1] >= today:
        print(f"Market data already holds {sessions[-1]}; nothing to do today.")
        return

    names: dict[str, str] = get_all_ticker_names()
    categories: dict[str, str] = get_symbol_categories()
    ledger: dict[str, dict] = _load_ledger()
    seeded: int = _seed_split_basis(ledger)
    if seeded:
        print(f"Split basis: recorded for {seeded} symbol(s) from the bars already stored.")

    recent: list[str] = []
    stale: list[str] = []
    new: list[str] = []
    for symbol in sorted(names):
        row: dict = ledger.get(symbol) or _new_ledger_row(symbol, names.get(symbol, symbol), categories.get(symbol, "stock"))
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
        (stale, {"start": _earliest_last_bar(ledger, stale)}),  # from its last bar, so no split is missed
        (new, {"start": START_DATE}),
    ):
        group_frames, received, missed, group_actions = _download_symbols(group, names, range_kwargs)
        actions += group_actions
        split_symbols |= _split_affected_symbols(group_actions, stats, ledger)
        for frame in group_frames:
            if str(frame["Symbol"].iloc[0]) in split_symbols:
                continue  # its stored bars sit at the old prices; it is refetched whole below
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
                continue  # the symbol simply lags a day and is retried, rather than holding mixed prices
            refreshed.append(history)
            refreshed_actions += events
            print(f"  {symbol}: split since its last bar; refetched {len(history)} bars.")
        if refreshed:
            replaced: set[str] = {str(frame["Symbol"].iloc[0]) for frame in refreshed}
            rewritten: int = _replace_histories(refreshed)
            _save_actions(refreshed_actions, replaced=replaced)  # a split restates every old dividend
            _set_split_basis(ledger, refreshed_actions)
            ledger = _refresh_ledger(ledger, today)
            _save_ledger(ledger)
            refresh_market_data_cache()
            print(f"Splits: rebuilt {os.path.basename(MASTER_FILE)} without {len(refreshed)} old history(ies); {rewritten} rows.")

    if actions:
        total: int = _save_actions(actions)
        print(f"Actions: {total} split(s) and dividend(s) on file.")

    if not frames:
        print("No new bars came back; market data was left untouched.")
        _save_ledger(_refresh_ledger(ledger, today))
        return

    tail_rows, tail_sessions = _append_to_tail(frames)
    ledger = _refresh_ledger(ledger, today)
    _save_ledger(ledger)
    refresh_market_data_cache()
    print(f"Tail updated: {tail_rows} rows over {tail_sessions} session(s), {len(frames)} symbol(s) got new bars.")

    if tail_sessions > MAX_RECENT_SESSIONS:
        print(f"Tail covers {tail_sessions} sessions; folding it into {os.path.basename(MASTER_FILE)} ...")
        folded: int = _fold_tail_into_master()
        ledger = _refresh_ledger(ledger, today)
        _save_ledger(ledger)
        refresh_market_data_cache()
        print(f"Compacted: {folded} rows in {os.path.basename(MASTER_FILE)}.")

    _print_ledger(ledger)


# -------- Reporting --------
# Print the tracking file without touching any data.
def print_status() -> None:
    ledger: dict[str, dict] = _load_ledger()
    if not ledger:
        print("No tracking file yet; run init.")
        return

    print(f"Newest session: {get_latest_trading_date()}")
    _print_ledger(ledger)

    stopped: list[str] = sorted(symbol for symbol, row in ledger.items() if row.get("Status") == "stopped")
    missing: list[str] = sorted(symbol for symbol, row in ledger.items() if row.get("Status") == "missing")
    if stopped:
        print(f"Stopped ({len(stopped)}): {', '.join(stopped[:20])}{' ...' if len(stopped) > 20 else ''}")
    if missing:
        print(f"Missing ({len(missing)}): {', '.join(missing[:20])}{' ...' if len(missing) > 20 else ''}")


# Print the whole split audit, for the command line.
def audit_splits(limit: int = 20) -> int:
    flagged, splits, unmeasurable = _split_audit()
    if splits.empty:
        print("No splits on file; nothing to audit.")
        return 0

    continuous: int = len(splits) - len(flagged) - unmeasurable
    print(f"Splits audited: {len(splits)} across {splits['Symbol'].nunique()} symbols "
          f"({continuous} continuous, {len(flagged)} flagged, {unmeasurable} unmeasurable).")
    if not flagged:
        print("No price jumps on a split; stored histories are continuous.")
        return 0

    CALENDAR.register(labels_from_codes(np.array(sorted({code for _s, code, _r, _o in flagged}), dtype=np.int32)))
    print(f"Flagged {len({symbol for symbol, _c, _r, _o in flagged})} symbol(s) whose price jumps on the split:")
    for symbol, code, ratio, observed in flagged[:limit]:
        print(f"  {symbol:8} {CALENDAR.label(code)}  ratio {ratio:>8.4f}  observed {observed:>8.4f}")
    if len(flagged) > limit:
        print(f"  ... and {len(flagged) - limit} more")
    print("A flagged symbol is missing the source's restatement, not a bar: refetch it once the")
    print("source corrects the history, or rebuild with init --force.")
    return len(flagged)


# What the nightly run calls: audit, report only what changed, then remember it.
def report_new_split_seams() -> SplitSeamReport:
    flagged, splits, _unmeasurable = _split_audit()
    details: dict[str, tuple[int, float, float]] = {
        symbol: (code, ratio, observed) for symbol, code, ratio, observed in flagged
    }
    previous: dict[str, int] = _load_split_audit()

    unseen: list[str] = sorted(symbol for symbol, (code, _r, _o) in details.items() if previous.get(symbol) != code)
    cleared: list[str] = sorted(set(previous) - set(details))
    _save_split_audit({symbol: code for symbol, (code, _r, _o) in details.items()})

    if unseen:
        CALENDAR.register(labels_from_codes(np.array(sorted({details[symbol][0] for symbol in unseen}), dtype=np.int32)))
    new: list[tuple[str, str, float, float]] = [
        (symbol, CALENDAR.label(details[symbol][0]), details[symbol][1], details[symbol][2]) for symbol in unseen
    ]

    print(f"Split audit: {len(splits)} checked, {len(details)} flagged, {len(new)} new, {len(cleared)} cleared.")
    for symbol, label, ratio, observed in new:
        print(f"  new {symbol:8} {label}  ratio {ratio:>8.4f}  observed {observed:>8.4f}")
    if cleared:
        print(f"  cleared: {', '.join(cleared[:20])}{' ...' if len(cleared) > 20 else ''}")

    return SplitSeamReport(audited=len(splits), flagged=len(details), new=new, cleared=cleared)


# -------- Ledger --------
# One row per catalog symbol, the only bookkeeping the ingestion keeps.
def _new_ledger_row(symbol: str, name: str, category: str) -> dict:
    return {
        "Symbol": symbol, "Name": name, "Category": category, "Status": "pending",
        "Bars": 0, "FirstBar": "", "LastBar": "", "SplitBasis": 0, "SessionsBehind": -1,
        "Attempts": 0, "LastAttempt": "", "LastError": "",
    }


# The tracking file as symbol -> row, empty on the first run.
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
    frame["SplitBasis"] = frame["SplitBasis"].fillna(0).astype("int32")
    frame["SessionsBehind"] = frame["SessionsBehind"].fillna(-1).astype("int32")
    frame["Attempts"] = frame["Attempts"].fillna(0).astype("int32")
    for column in ["Symbol", "Name", "Category", "Status", "FirstBar", "LastBar", "LastAttempt", "LastError"]:
        frame[column] = frame[column].fillna("").astype(str)
    tmp_file: str = STATUS_FILE + ".tmp"
    frame.to_parquet(tmp_file, compression="snappy", index=False)
    os.replace(tmp_file, STATUS_FILE)


# Record one probe per symbol: attempts go up, and the error column says whether bars came back.
def _mark_attempted(ledger: dict[str, dict], probed: list[str], received: list[str], missed: list[str], today: str) -> None:
    got: set[str] = set(received)
    for symbol in probed:
        row: dict = ledger.setdefault(symbol, _new_ledger_row(symbol, symbol, "stock"))
        row["Attempts"] = int(row.get("Attempts", 0)) + 1
        row["LastAttempt"] = today
        row["LastError"] = "" if symbol in got else "no bars returned"


# Fill bars, dates and status for every catalog symbol, dropping symbols that left the catalog.
def _refresh_ledger(ledger: dict[str, dict], today: str) -> dict[str, dict]:
    stats, sessions = _stored_bar_stats()
    position: dict[str, int] = {session: index for index, session in enumerate(sessions)}
    newest: int = len(sessions) - 1
    names: dict[str, str] = get_all_ticker_names()
    categories: dict[str, str] = get_symbol_categories()

    refreshed: dict[str, dict] = {}
    for symbol, name in names.items():
        row: dict = ledger.get(symbol) or _new_ledger_row(symbol, name, categories.get(symbol, "stock"))
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


# One line per status, plus rows and symbols, so a run is easy to read.
def _print_ledger(ledger: dict[str, dict]) -> None:
    counts: dict[str, int] = {}
    for row in ledger.values():
        status: str = str(row.get("Status") or "pending")
        counts[status] = counts.get(status, 0) + 1
    parts: str = ", ".join(f"{counts[status]} {status}" for status in sorted(counts))
    rows: int = sum(int(row.get("Bars") or 0) for row in ledger.values())
    print(f"Bars: {rows} rows across {len(ledger)} symbols ({parts}).")
    print(f"Tracking: {STATUS_FILE}")


# -------- Downloads --------
# One yfinance call. Returns None only when the call itself raises.
def _download(tickers: list[str], **range_kwargs) -> pd.DataFrame | None:
    try:
        return yf.download(
            tickers=[_yf_symbol(ticker) for ticker in tickers],
            interval="1d",
            group_by="ticker",
            auto_adjust=False,  # prices still come split-adjusted; this only leaves dividends out
            actions=True,
            threads=True,
            progress=False,
            **range_kwargs,
        )
    except Exception as error:
        print(f"  download failed for {len(tickers)} symbol(s): {error}")
        return None


# Download with fallbacks: two batch attempts, a month for thin symbols, small batches, then singles.
def _download_symbols(tickers: list[str], names: dict[str, str], range_kwargs: dict) -> tuple[list[pd.DataFrame], list[str], list[str], list[pd.DataFrame]]:
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

    if "period" in range_kwargs:  # five days is unreliable for thin symbols; ask for a month
        wide_frames, wide_received, missed, wide_actions = _probe(missed, names, {"period": WIDE_PERIOD})
        frames += wide_frames
        received += wide_received
        actions += wide_actions
        if not missed:
            return frames, received, missed, actions

    leftover: list[str] = list(missed)  # small batches are what rescue a chunk that failed whole
    missed = []
    for batch in _chunked(leftover, RETRY_BATCH_SIZE):
        batch_frames, batch_received, batch_missed, batch_actions = _probe(batch, names, range_kwargs)
        frames += batch_frames
        received += batch_received
        missed += batch_missed
        actions += batch_actions
    if not missed:
        return frames, received, missed, actions

    limit: int = PER_TICKER_LIMIT_DAILY if "period" in range_kwargs else PER_TICKER_LIMIT_INIT
    if len(missed) > limit:  # one request per symbol is only worth it for a small remainder
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


# One batch attempt over a ticker list, split into chunk-sized requests.
def _probe(tickers: list[str], names: dict[str, str], range_kwargs: dict) -> tuple[list[pd.DataFrame], list[str], list[str], list[pd.DataFrame]]:
    frames: list[pd.DataFrame] = []
    received: list[str] = []
    missed: list[str] = []
    actions: list[pd.DataFrame] = []
    for chunk in _chunked(tickers):
        frame: pd.DataFrame | None = _download(chunk, **range_kwargs)
        chunk_frames, chunk_received, chunk_missed, chunk_actions = _unpack_download(frame, chunk, names)
        frames += chunk_frames
        received += chunk_received
        missed += chunk_missed
        actions += chunk_actions
    return frames, received, missed, actions


# One downloaded frame into per-ticker frames, splitting received from missed and collecting events.
def _unpack_download(frame: pd.DataFrame | None, tickers: list[str], names: dict[str, str]) -> tuple[list[pd.DataFrame], list[str], list[str], list[pd.DataFrame]]:
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


# One ticker's bars in master-file layout, or None when it has no usable bar.
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

    # After a delisting the source keeps returning dated rows whose prices are all null.
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


# One ticker's split and dividend rows in actions-file layout, or None when the window held no event.
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


# Whether a symbol is worth asking about today, given what the last attempt found.
def _should_probe(row: dict, today: str) -> bool:
    status: str = _text(row.get("Status"))
    since: int = _days_between(_text(row.get("LastAttempt")), today)
    if status == "stopped":
        return since >= RETRY_STOPPED_AFTER_DAYS
    if status == "missing" and int(row.get("Attempts", 0) or 0) >= MISSING_ATTEMPTS_BEFORE_BACKOFF:
        return since >= RETRY_MISSING_AFTER_DAYS
    return True


# -------- Master & Tail --------
# Every symbol's bar count, first and last date, plus the calendar, across both bar files.
def _stored_bar_stats() -> tuple[dict[str, tuple[int, str, str]], list[str]]:
    if not os.path.exists(MASTER_FILE):
        return {}, []

    table: pa.Table = pq.read_table(bar_files(), columns=["Symbol", "Date"], read_dictionary=["Symbol"])
    frame: pd.DataFrame = table.to_pandas()
    codes = np.unique(frame["Date"].to_numpy())

    CALENDAR.register(labels_from_codes(codes))  # day numbers carry their own labels
    sessions: list[str] = [CALENDAR.label(int(code)) for code in codes]

    grouped = frame.groupby("Symbol", observed=True)["Date"].agg(["size", "min", "max"])
    stats: dict[str, tuple[int, str, str]] = {
        str(symbol): (int(row["size"]), CALENDAR.label(int(row["min"])), CALENDAR.label(int(row["max"])))
        for symbol, row in grouped.iterrows()
    }
    return stats, sessions


# Add the new bars to the recent tail and replace it; history is never read or rewritten.
def _append_to_tail(frames: list[pd.DataFrame]) -> tuple[int, int]:
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


# Fold the tail into the master and clear it, one batch at a time so memory stays flat.
def _fold_tail_into_master() -> int:
    tmp_file: str = MASTER_FILE + ".tmp"
    writer: pq.ParquetWriter | None = None
    rows: int = 0
    try:
        for path in bar_files():
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


# Write one chunk's staging file, renamed into place so a resumed run never merges half a file.
def _write_part(path: str, frames: list[pd.DataFrame]) -> int:
    part: pd.DataFrame = pd.concat(frames, ignore_index=True).drop_duplicates(subset=["Symbol", "Date"], keep="last").sort_values(["Symbol", "Date"])
    table: pa.Table = pa.Table.from_pandas(part, schema=MASTER_SCHEMA, preserve_index=False)
    tmp_file: str = path + ".tmp"
    pq.write_table(table, tmp_file, compression="snappy")
    os.replace(tmp_file, path)
    return len(part)


# Stream the staging files into the master. Catalog order leaves the result sorted by symbol.
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


# Rewrite the bar files without these symbols, then write their whole history back as one block.
def _replace_histories(frames: list[pd.DataFrame]) -> int:
    value_set = pa.array([str(frame["Symbol"].iloc[0]) for frame in frames], type=pa.string())
    tmp_file: str = MASTER_FILE + ".tmp"
    writer: pq.ParquetWriter | None = None
    rows: int = 0
    try:
        for path in bar_files():
            for batch in pq.ParquetFile(path).iter_batches(batch_size=1_000_000):
                table: pa.Table = pa.Table.from_batches([batch]).cast(MASTER_SCHEMA)
                table = table.filter(pc.invert(pc.is_in(table["Symbol"], value_set=value_set)))
                if table.num_rows == 0:
                    continue
                if writer is None:
                    writer = pq.ParquetWriter(tmp_file, MASTER_SCHEMA, compression="snappy")
                writer.write_table(table)
                rows += table.num_rows

        for frame in frames:  # one contiguous block per symbol, so a ticker's bars stay together
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


# Keep only bars newer than what the symbol already stores, so no date is ever written twice.
def _trim_to_new_bars(frame: pd.DataFrame, stats: dict[str, tuple[int, str, str]]) -> pd.DataFrame:
    symbol: str = str(frame["Symbol"].iloc[0])
    last_bar: str = stats.get(symbol, (0, "", ""))[2]
    if not last_bar:
        return frame
    return frame[frame["Date"] > to_code(last_bar)]


# -------- Splits --------
# Merge events into the actions file; a symbol in `replaced` loses its old rows first.
def _save_actions(frames: list[pd.DataFrame], replaced: set[str] | None = None) -> int:
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


# Symbols whose download reported a split their stored bars do not cover yet; the basis decides.
def _split_affected_symbols(actions: list[pd.DataFrame], stats: dict[str, tuple[int, str, str]], ledger: dict[str, dict]) -> set[str]:
    split: set[str] = set()
    for events in actions:
        symbol: str = str(events["Symbol"].iloc[0])
        last_bar: str = stats.get(symbol, (0, "", ""))[2]
        if not last_bar:
            continue
        dates = events[events["Kind"] == ACTION_SPLIT]["Date"].to_numpy()
        if not dates.size:
            continue
        applied: int = int(ledger.get(symbol, {}).get("SplitBasis") or 0)
        reference: int = applied if applied else to_code(last_bar)
        if int(dates.max()) > reference:
            split.add(symbol)
    return split


# Record the newest split a symbol's freshly written bars already include.
def _set_split_basis(ledger: dict[str, dict], actions: list[pd.DataFrame]) -> None:
    for events in actions:
        row: dict | None = ledger.get(str(events["Symbol"].iloc[0]))
        if row is None:
            continue
        dates = events[events["Kind"] == ACTION_SPLIT]["Date"].to_numpy()
        if dates.size:
            row["SplitBasis"] = int(dates.max())


# Fill the basis for ledgers written before the column existed, from splits inside their own bars.
def _seed_split_basis(ledger: dict[str, dict]) -> int:
    if not os.path.exists(ACTIONS_FILE):
        return 0

    frame: pd.DataFrame = pd.read_parquet(ACTIONS_FILE, columns=["Symbol", "Date", "Kind"])
    splits: pd.DataFrame = frame[frame["Kind"] == ACTION_SPLIT]
    if splits.empty:
        return 0

    newest = splits.assign(Symbol=splits["Symbol"].astype(str)).groupby("Symbol")["Date"].max()
    seeded: int = 0
    for symbol, code in newest.items():
        row: dict | None = ledger.get(symbol)
        if row is None or int(row.get("SplitBasis") or 0):
            continue
        last_bar: str = _text(row.get("LastBar"))
        if last_bar and int(code) <= to_code(last_bar):
            row["SplitBasis"] = int(code)
            seeded += 1
    return seeded


# One symbol's whole history again, with every event it ever had.
def _refetch_symbol(symbol: str, names: dict[str, str]) -> tuple[pd.DataFrame | None, list[pd.DataFrame]]:
    frames, _, _, actions = _probe([symbol], names, {"start": START_DATE})
    return (frames[0] if frames else None), actions


# -------- Split Audit --------
# A split leaves no trace in an adjusted series, so a jump that lands on the ratio means the source never restated it.
def _split_audit() -> tuple[list[tuple[str, int, float, float]], pd.DataFrame, int]:
    if not os.path.exists(MASTER_FILE) or not os.path.exists(ACTIONS_FILE):
        return [], pd.DataFrame(columns=["Symbol", "Date", "Kind", "Amount"]), 0

    events: pd.DataFrame = pd.read_parquet(ACTIONS_FILE, columns=["Symbol", "Date", "Kind", "Amount"])
    events["Symbol"] = events["Symbol"].astype(str)
    splits: pd.DataFrame = events[events["Kind"] == ACTION_SPLIT]
    if splits.empty:
        return [], splits, 0

    # Read only the split symbols, dictionary-encoded, so this is a partial pass rather than the universe.
    value_set = pa.array(sorted(set(splits["Symbol"])), type=pa.string())
    parts: list[pa.Table] = []
    for path in bar_files():
        for batch in pq.ParquetFile(path).iter_batches(batch_size=1_000_000):
            table: pa.Table = pa.Table.from_batches([batch]).select(["Symbol", "Date", "Close"])
            parts.append(table.filter(pc.is_in(table["Symbol"], value_set=value_set)))
    if not parts:
        return [], splits, len(splits)

    table = pa.concat_tables(parts).sort_by([("Symbol", "ascending"), ("Date", "ascending")])
    encoded = pc.dictionary_encode(table["Symbol"].combine_chunks())
    ids = encoded.indices.to_numpy()
    labels: list[str] = encoded.dictionary.to_pylist()
    dates = table["Date"].to_numpy()
    closes = table["Close"].to_numpy()

    edges: np.ndarray = np.flatnonzero(ids[1:] != ids[:-1]) + 1
    starts = np.concatenate((np.zeros(1, dtype=np.int64), edges)).tolist()
    ends = np.concatenate((edges, np.array([len(ids)], dtype=np.int64))).tolist()
    series: dict[str, tuple[np.ndarray, np.ndarray]] = {
        str(labels[ids[start]]): (dates[start:end], closes[start:end]) for start, end in zip(starts, ends)
    }

    flagged: list[tuple[str, int, float, float]] = []
    unmeasurable: int = 0
    for row in splits.itertuples(index=False):
        entry: tuple[np.ndarray, np.ndarray] | None = series.get(row.Symbol)
        if entry is None:
            unmeasurable += 1
            continue
        codes, prices = entry
        code: int = int(row.Date)
        position: int = int(np.searchsorted(codes, code))
        if position >= len(codes) or int(codes[position]) != code or position == 0:
            unmeasurable += 1  # the event has no bar of its own stored, so there is nothing to compare
            continue
        before: float = float(prices[position - 1])
        after: float = float(prices[position])
        if before <= 0 or after <= 0:
            unmeasurable += 1
            continue
        observed: float = before / after
        ratio: float = float(row.Amount)
        on_ratio: bool = abs(observed - ratio) <= SEAM_RATIO_TOLERANCE * max(ratio, 1e-9)
        if on_ratio and abs(observed - 1.0) > SEAM_JUMP_TOLERANCE:
            flagged.append((row.Symbol, code, ratio, observed))

    return flagged, splits, unmeasurable


# The seams reported last time, so a nightly run can say what changed instead of repeating itself.
def _load_split_audit() -> dict[str, int]:
    if not os.path.exists(SPLIT_AUDIT_FILE):
        return {}
    try:
        with open(SPLIT_AUDIT_FILE, "r", encoding="utf-8") as handle:
            return {str(symbol): int(code) for symbol, code in json.load(handle).items()}
    except (OSError, ValueError, TypeError):
        return {}


# The current seams, written in one step like the ledger.
def _save_split_audit(current: dict[str, int]) -> None:
    os.makedirs(SYMBOL_DATA_DIR, exist_ok=True)
    tmp_file: str = SPLIT_AUDIT_FILE + ".tmp"
    with open(tmp_file, "w", encoding="utf-8") as handle:
        json.dump(current, handle, indent=2, sort_keys=True)
    os.replace(tmp_file, SPLIT_AUDIT_FILE)


# -------- Small Helpers --------
# Today as YYYY-MM-DD.
def _today() -> str:
    return date.today().isoformat()


# A ledger value as text: parquet gives NaN for empty cells, which would poison date comparisons.
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


# yfinance writes share classes with a dash: BRK.B is BRK-B.
def _yf_symbol(ticker: str) -> str:
    return ticker.replace(".", "-")


# Split a list into groups of the given size.
def _chunked(items: list[str], size: int = CHUNK_SIZE) -> list[list[str]]:
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


# Oldest last bar in a group, used as the single start date for a backfill download.
def _earliest_last_bar(ledger: dict[str, dict], symbols: list[str]) -> str:
    dates: list[str] = [_text(ledger[symbol].get("LastBar")) for symbol in symbols if ledger.get(symbol)]
    return min([value for value in dates if value] or [START_DATE])


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
    elif command == "audit":
        audit_splits()
    else:
        print("usage: python3 -m app.database.market.market_data [init [--force] | update | status | audit]")
