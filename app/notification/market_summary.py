# market_summary.py — Computes the daily market recap from the parquet store.
#
# Looks at the last two trading sessions across the whole tradable universe
# (everything in the master parquet file) and produces a mood-classified
# summary: biggest gainers, biggest decliners, market breadth, and a
# spotlight on the single biggest mover. Three moods cover the session:
#   risk_on  — broad advance (>= 60% of tickers closed up)
#   risk_off — broad selloff (<= 40% closed up)
#   mixed    — everything in between
# A fourth quiet fallback handles days with no fresh closes.
#
# Excluded from the rankings: ETFs/commodities (they track indexes, not
# single-stock moves) — only tickers ending in ".TO" style stock listings
# and plain equities participate. Actually simpler: we exclude a small
# denylist of well-known index/commodity funds so the leaderboard shows
# companies, not funds.
# market_summary.py — Computes the daily market recap from the parquet store.
#
# Looks at the last two trading sessions across the whole tradable universe
# (everything in the master parquet file) and produces a mood-classified
# summary: biggest gainers, biggest decliners, market breadth, and a
# spotlight on the single biggest mover. Three moods cover the session:
#   risk_on  — broad advance (>= 60% of tickers closed up)
#   risk_off — broad selloff (<= 40% closed up)
#   mixed    — everything in between
# A fourth quiet fallback handles days with no fresh closes.
#
# Excluded from the rankings: a small denylist of well-known index and
# commodity funds, so the leaderboard shows companies, not funds.

# -------- Imports --------
import os
from typing import Any

import numpy as np

from app.database.fetch import get_all_tickers, get_stock_history

# -------- Configuration --------
# Index funds / commodities that shouldn't headline a "biggest movers" list.
# Kept small and explicit — extend as the universe grows.
FUND_DENYLIST = {
    "SPY", "QQQ", "DIA", "IWM", "VTI", "VOO", "GLD", "SLV", "USO", "TLT",
    "XEQT.TO", "VEQT.TO", "VFV.TO", "VDY.TO", "XEI.TO", "XIU.TO", "XIC.TO",
    "VAB.TO", "XBB.TO", "CASH.TO", "PSA.TO",
}

TOP_N = 5          # gainers / decliners shown
MIN_PCT_MOVE = 1.0  # moves below this don't qualify for the tables

MOOD_RISK_ON = "risk_on"
MOOD_RISK_OFF = "risk_off"
MOOD_MIXED = "mixed"
MOOD_QUIET = "quiet"


# -------- Public API --------
def build_market_summary(reference_tickers: list[str] | None = None) -> dict[str, Any]:
    """
    Builds the market summary for the latest trading session.

    reference_tickers: tickers used to detect the latest trading date (a
    liquid cross-market set so a single stale ticker can't misdate the run).
    Returns a dict shaped for market_summary_email().
    """
    all_tickers = [t for t in get_all_tickers() if t not in FUND_DENYLIST]

    # --- Determine the latest trading date from reference tickers ---
    if reference_tickers is None:
        reference_tickers = ["SPY", "QQQ", "XEQT.TO"]
    latest_date = _latest_trading_date(reference_tickers)
    if latest_date is None:
        return _quiet_summary("Market data is still syncing — no fresh closes yet.")

    # --- Collect the last close and prior close for every ticker ---
    movers: list[dict[str, Any]] = []
    up_count = 0
    down_count = 0
    for ticker in all_tickers:
        try:
            history = get_stock_history(ticker)
        except ValueError:
            continue
        except Exception:
            continue

        dates = history.dates
        if len(dates) == 0 or dates[-1] != latest_date:
            continue  # not fresh for this session

        closes = history.close_price
        if len(closes) < 2:
            continue

        prev_close = float(closes[-2])
        last_close = float(closes[-1])
        if prev_close <= 0:
            continue

        change_pct = (last_close - prev_close) / prev_close * 100.0
        if change_pct >= 0:
            up_count += 1
        else:
            down_count += 1

        movers.append({
            "ticker": ticker,
            "change_pct": round(change_pct, 2),
            "close": round(last_close, 2),
        })

    total = up_count + down_count
    if total < 20 or not movers:
        return _quiet_summary(
            "Today's session had limited fresh data across the universe — full coverage returns tomorrow."
        )

    breadth_pct = up_count / total * 100.0

    gainers = sorted(
        (m for m in movers if m["change_pct"] >= MIN_PCT_MOVE),
        key=lambda m: m["change_pct"], reverse=True,
    )[:TOP_N]
    losers = sorted(
        (m for m in movers if m["change_pct"] <= -MIN_PCT_MOVE),
        key=lambda m: m["change_pct"],
    )[:TOP_N]

    spotlight = max(movers, key=lambda m: abs(m["change_pct"]))
    spotlight = {**spotlight, "note": _spotlight_note(spotlight, breadth_pct)}

    mood, headline = _classify_mood(breadth_pct, gainers, losers)

    return {
        "mood": mood,
        "headline": headline,
        "trading_date": str(latest_date),
        "breadth_pct": round(breadth_pct, 1),
        "gainers": gainers,
        "losers": losers,
        "spotlight": spotlight,
    }


# -------- Helper Methods --------

def _latest_trading_date(reference_tickers: list[str]) -> str | None:
    """Latest trading date agreed on by the reference tickers (majority vote)."""
    candidates: list[str] = []
    for ticker in reference_tickers:
        try:
            history = get_stock_history(ticker)
            if len(history.dates) > 0:
                candidates.append(str(history.dates[-1]))
        except Exception:
            continue
    if not candidates:
        return None
    # Majority vote guards against one stale reference skewing the date
    return max(set(candidates), key=candidates.count)


def _classify_mood(breadth_pct: float, gainers: list, losers: list) -> tuple[str, str]:
    if breadth_pct >= 60.0:
        return MOOD_RISK_ON, "Risk-on rally: buyers swept the board"
    if breadth_pct <= 40.0:
        return MOOD_RISK_OFF, "Risk-off session: sellers had the upper hand"

    spread = abs(len(gainers) - len(losers))
    if len(gainers) > len(losers):
        detail = "advancers edged out decliners" if spread <= 2 else "a handful of strong leaders carried the tape"
        return MOOD_MIXED, f"Mixed session: {detail}"
    detail = "decliners nudged ahead" if spread <= 2 else "the laggers outnumbered the leaders"
    return MOOD_MIXED, f"Mixed session: {detail}"


def _spotlight_note(spot: dict[str, Any], breadth_pct: float) -> str:
    direction = "gainer" if spot["change_pct"] >= 0 else "decliner"
    if abs(spot["change_pct"]) >= 8.0:
        return f"An outlier move for a top {direction} — usually earnings or company news."
    if breadth_pct >= 60.0 and spot["change_pct"] >= 0:
        return "Rode the broad advance."
    if breadth_pct <= 40.0 and spot["change_pct"] < 0:
        return "Fell hardest in the broad retreat."
    return "Stood out on an otherwise balanced tape."


def _quiet_summary(note: str) -> dict[str, Any]:
    return {
        "mood": MOOD_QUIET,
        "headline": "A quiet day on the tape",
        "trading_date": "",
        "breadth_pct": None,
        "gainers": [],
        "losers": [],
        "spotlight": None,
        "flat_note": note,
    }
