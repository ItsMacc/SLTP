# -------- curve_store.py --------
# The reported windows, and the on-disk store of the equity curve each one produced.
#
# One backtest per window, cached as JSON under app/reports/artifacts (git-ignored).
# A curve only changes when its strategy changes, so charts can be redrawn without
# re-running anything.
#
#   python -m app.reports.benchmark_curves          # fill the benchmark store
#   python -m app.reports.strategy_curves <id>      # draw a strategy against it

# -------- Imports --------
import os
import json

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

# Engine imports
from app.engine.backtesting.backtester import Backtester
from app.strategies import REGISTRY


# -------- Constants --------
ARTIFACT_DIR: str = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artifacts")
BENCHMARK_ID: str = "buy-and-hold"
CURVES_FILE: str = "curves.json"


# -------- Windows --------
# The windows the site reports on: four declines, then four recoveries, in the order
# they are published. A period is one backtest, so its key is also its file name.
@dataclass(frozen=True)
class Period:
    key: str
    kind: str
    start: str
    end: str
    label: str


PERIODS: list[Period] = [
    Period("bear-dotcom", "bear", "2000-01-01", "2003-03-31", "Dot-com bust"),
    Period("bear-gfc", "bear", "2007-10-01", "2009-03-31", "Global financial crisis"),
    Period("bear-covid", "bear", "2020-02-01", "2020-05-31", "COVID crash"),
    Period("bear-2022", "bear", "2022-01-01", "2023-10-31", "Rate-hike bear market"),
    Period("bull-2012", "bull", "2012-01-01", "2015-05-31", "Slow recovery bull"),
    Period("bull-reopening", "bull", "2020-05-31", "2021-11-30", "Pandemic reopening"),
    Period("bull-ai", "bull", "2023-01-01", "2025-06-30", "AI-led rally"),
    Period("bull-2003", "bull", "2003-04-01", "2007-07-31", "Mid-2000s bull"),
]


# -------- Running --------
# Backtest one strategy over one window and keep its equity points.
def run_window(strategy_id: str, period: Period) -> dict[str, Any]:
    strategy = REGISTRY[strategy_id][0]()
    result: dict[str, Any] = Backtester(strategy, start_date=period.start, end_date=period.end).run()
    metrics: dict[str, Any] = result["metrics"]
    equity: list[dict[str, Any]] = result["equity"]

    return {
        "key": period.key,
        "kind": period.kind,
        "label": period.label,
        "start": str(equity[0]["date"]),
        "end": str(equity[-1]["date"]),
        "metrics": {
            "cagr": metrics.get("cagr", 0.0),
            "sharpe": metrics.get("sharpe", 0.0),
            "max_drawdown": metrics.get("max_drawdown", 0.0),
            "starting_value": metrics.get("starting_value", 0.0),
            "ending_value": metrics.get("ending_value", 0.0),
        },
        "points": [[str(row["date"]), round(float(row["portfolio_value"]), 4)] for row in equity],
    }


# Every window for one strategy, run fresh and printed as it goes.
def run_all(strategy_id: str) -> dict[str, Any]:
    periods: dict[str, Any] = {}
    for period in PERIODS:
        print(f"  {period.key:<16}{period.start} to {period.end} ...", end=" ", flush=True)
        periods[period.key] = run_window(strategy_id, period)
        print(f"{periods[period.key]['metrics']['cagr']:.2f}% CAGR")
    return periods


# -------- Store --------
# The stored file for one strategy.
def curves_path(strategy_id: str) -> str:
    return os.path.join(ARTIFACT_DIR, strategy_id, CURVES_FILE)


# The directory a strategy's charts are written to.
def chart_dir(strategy_id: str) -> str:
    return os.path.join(ARTIFACT_DIR, strategy_id)


# True when this strategy has stored curves on disk.
def has_curves(strategy_id: str) -> bool:
    return os.path.exists(curves_path(strategy_id))


# Read one stored file, or None when it has not been built yet.
def load_curves(strategy_id: str) -> dict[str, Any] | None:
    path: str = curves_path(strategy_id)
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


# Write one strategy's curves in a single step, so a crash cannot truncate the file.
def save_curves(strategy_id: str, periods: dict[str, Any]) -> str:
    path: str = curves_path(strategy_id)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    payload: dict[str, Any] = {
        "strategy": strategy_id,
        "name": strategy_label(strategy_id),
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "periods": periods,
    }
    tmp_file: str = path + ".tmp"
    with open(tmp_file, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
    os.replace(tmp_file, path)
    return path


# The stored curves, running every window only when they are missing or forced.
def ensure_curves(strategy_id: str, force: bool = False) -> dict[str, Any]:
    if not force:
        cached = load_curves(strategy_id)
        if cached is not None:
            return cached

    print(f"Running {strategy_label(strategy_id)} over {len(PERIODS)} windows:")
    periods: dict[str, Any] = run_all(strategy_id)
    save_curves(strategy_id, periods)
    return load_curves(strategy_id) or {"strategy": strategy_id, "name": strategy_label(strategy_id), "periods": periods}


# -------- Helpers --------
# The display name registered for a strategy id.
def strategy_label(strategy_id: str) -> str:
    return REGISTRY[strategy_id][0]().name
