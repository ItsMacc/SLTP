# regime_report.py — run every published strategy over the eight reported windows,
# draw one chart per window, and write the numbers the strategy page reads.
#
#   ./.venv/bin/python backend/scripts/regime_report.py
#   ./.venv/bin/python backend/scripts/regime_report.py --force
#
# Outputs
#   frontend/src/assets/strategies/<id>/curve_<window>.svg   buy and hold, one line
#   frontend/src/assets/strategies/<id>/graph_<window>.svg   everything else, two lines
#   frontend/src/data/backtestResults.ts                     the metrics table
#
# Curves are cached under backend/scripts/artifacts/regimes, so a re-render costs
# nothing. --force re-runs every window from the engine.
#
# Conventions in the numbers: cagr and max_drawdown are percentages, and
# max_drawdown is a positive magnitude (33.69 means the worst fall was 33.69%).

# -------- Imports --------
import argparse
import json
import math
import os
import sys

from dataclasses import dataclass
from datetime import datetime
from typing import Any
from xml.sax.saxutils import escape

BACKEND_DIR: str = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO_DIR: str = os.path.dirname(BACKEND_DIR)
sys.path.insert(0, BACKEND_DIR)

from sltp.backtesting import Backtester  # noqa: E402  (needs the path above)

from strategies.adaptive_momentum import AdaptiveMomentum  # noqa: E402
from strategies.benchmark import Benchmark  # noqa: E402
from strategies.global_trend_allocation import GlobalTrendAllocation  # noqa: E402
from strategies.minimum_volatility import MinimumVolatility  # noqa: E402
from strategies.statistical_mean_reversion import StatisticalMeanReversionStrategy  # noqa: E402


# -------- Paths --------
ARTIFACT_DIR: str = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artifacts", "regimes")
ASSET_DIR: str = os.path.join(REPO_DIR, "frontend", "src", "assets", "strategies")
DATA_FILE: str = os.path.join(REPO_DIR, "frontend", "src", "data", "backtestResults.ts")
BENCHMARK_ID: str = "buy-and-hold"


# -------- Windows --------
# Four declines, then four recoveries, in the order the page publishes them.
@dataclass(frozen=True)
class Window:
    key: str
    kind: str
    start: str
    end: str
    label: str


WINDOWS: list[Window] = [
    Window("bear-dotcom", "bear", "2000-01-01", "2003-03-31", "Dot-com bust"),
    Window("bear-gfc", "bear", "2007-10-01", "2009-03-31", "Global financial crisis"),
    Window("bear-covid", "bear", "2020-02-01", "2020-05-31", "COVID crash"),
    Window("bear-2022", "bear", "2022-01-01", "2023-10-31", "Rate-hike bear market"),
    Window("bull-2012", "bull", "2012-01-01", "2015-05-31", "Slow recovery bull"),
    Window("bull-reopening", "bull", "2020-05-31", "2021-11-30", "Pandemic reopening"),
    Window("bull-ai", "bull", "2023-01-01", "2025-06-30", "AI-led rally"),
    Window("bull-2003", "bull", "2003-04-01", "2007-07-31", "Mid-2000s bull"),
]


# -------- Strategies --------
@dataclass(frozen=True)
class Entry:
    id: str
    name: str
    kind: type


STRATEGIES: list[Entry] = [
    Entry("buy-and-hold", "Buy and Hold (SPY)", Benchmark),
    Entry("statistical-mean-reversion", "Statistical Mean Reversion", StatisticalMeanReversionStrategy),
    Entry("adaptive-momentum", "Adaptive Momentum", AdaptiveMomentum),
    Entry("global-trend-allocation", "Global Trend Allocation", GlobalTrendAllocation),
    Entry("minimum-volatility", "Minimum Volatility", MinimumVolatility),
]


# -------- Running --------
def run_window(cls: type, window: Window) -> dict[str, Any]:
    result: dict[str, Any] = Backtester(cls(), window.start, window.end).run()
    metrics: dict[str, Any] = result.get("metrics") or {}
    equity: list[dict[str, Any]] = result.get("equity") or []

    return {
        "key": window.key,
        "kind": window.kind,
        "label": window.label,
        "start": str(equity[0]["date"]),
        "end": str(equity[-1]["date"]),
        "metrics": {
            "ending_value": round(float(metrics.get("ending_value", 0.0)), 4),
            "cagr": round(float(metrics.get("cagr", 0.0)), 4),
            "sharpe": round(float(metrics.get("sharpe", 0.0)), 4),
            "max_drawdown": round(float(metrics.get("max_drawdown", 0.0)), 4),
        },
        "points": [[str(row["date"]), round(float(row["portfolio_value"]), 4)] for row in equity],
    }


def curves_path(strategy_id: str) -> str:
    return os.path.join(ARTIFACT_DIR, f"{strategy_id}.json")


def load_curves(strategy_id: str) -> dict[str, Any] | None:
    path: str = curves_path(strategy_id)
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def save_curves(strategy_id: str, name: str, windows: dict[str, Any]) -> str:
    path: str = curves_path(strategy_id)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    payload: dict[str, Any] = {
        "strategy": strategy_id,
        "name": name,
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "windows": windows,
    }
    tmp_file: str = path + ".tmp"
    with open(tmp_file, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
    os.replace(tmp_file, path)
    return path


def ensure_curves(entry: Entry, force: bool) -> dict[str, Any]:
    if not force:
        cached = load_curves(entry.id)
        if cached is not None and len(cached.get("windows") or {}) == len(WINDOWS):
            return cached

    print(f"{entry.name} over {len(WINDOWS)} windows")
    windows: dict[str, Any] = {}
    for window in WINDOWS:
        print(f"  {window.key:<16}{window.start} to {window.end} ...", end=" ", flush=True)
        windows[window.key] = run_window(entry.kind, window)
        print(f"{windows[window.key]['metrics']['cagr']:>7.2f}% CAGR")
    save_curves(entry.id, entry.name, windows)
    return {"strategy": entry.id, "name": entry.name, "windows": windows}


# -------- Chart style --------
# Mid-tone hues stay legible on a white and on a near-black page; the text and
# grid colours flip with the viewer's theme through the media query.
STRATEGY_COLOR: str = "#6366F1"
BENCHMARK_COLOR: str = "#F59E0B"

WIDTH: int = 1000
HEIGHT: int = 520
PAD_LEFT: int = 72
PAD_RIGHT: int = 132
PAD_TOP: int = 144
PAD_BOTTOM: int = 64
Y_TICKS: int = 6
X_TICKS: int = 5


def _style() -> str:
    return (
        "<style>\n"
        "  .title { fill:#0F172A; font-size:21px; font-weight:650; }\n"
        "  .sub { fill:#475569; font-size:13px; }\n"
        "  .legend { fill:#334155; font-size:12.5px; }\n"
        "  .legend-name { font-weight:600; }\n"
        "  .axis { fill:#64748B; font-size:12px; }\n"
        "  .value { font-size:12.5px; font-weight:600; }\n"
        "  .note { fill:#94A3B8; font-size:11px; }\n"
        "  .grid { stroke:#E2E8F0; stroke-width:1; }\n"
        "  .baseline { stroke:#CBD5E1; stroke-width:1; stroke-dasharray:4 5; }\n"
        "  .badge-bear { fill:#F43F5E; fill-opacity:0.12; }\n"
        "  .badge-bull { fill:#10B981; fill-opacity:0.14; }\n"
        "  .badge-text { font-size:11px; font-weight:700; letter-spacing:0.08em; }\n"
        "  .badge-text-bear { fill:#E11D48; }\n"
        "  .badge-text-bull { fill:#059669; }\n"
        "  @media (prefers-color-scheme: dark) {\n"
        "    .title { fill:#E2E8F0; }\n"
        "    .sub { fill:#94A3B8; }\n"
        "    .legend { fill:#CBD5E1; }\n"
        "    .axis { fill:#94A3B8; }\n"
        "    .note { fill:#64748B; }\n"
        "    .grid { stroke:#1E293B; }\n"
        "    .baseline { stroke:#334155; }\n"
        "    .badge-text-bear { fill:#FB7185; }\n"
        "    .badge-text-bull { fill:#34D399; }\n"
        "  }\n"
        "</style>"
    )


def _points(curve: dict[str, Any]) -> list[tuple[str, float]]:
    return [(str(day), float(value)) for day, value in curve.get("points") or []]


def _ordinal(day: str) -> int:
    return datetime.strptime(day, "%Y-%m-%d").toordinal()


def _month(day: str) -> str:
    return datetime.strptime(day, "%Y-%m-%d").strftime("%b %Y")


def _day_month(day: str) -> str:
    return datetime.strptime(day, "%Y-%m-%d").strftime("%d %b")


def _axis_value(value: float) -> str:
    return f"{value:,.0f}" if abs(value) >= 10 else f"{value:,.1f}"


def _x_ticks(points: list[tuple[str, float]]) -> list[tuple[int, str, str]]:
    if not points:
        return []

    short: bool = _ordinal(points[-1][0]) - _ordinal(points[0][0]) < 240
    count: int = min(X_TICKS, len(points))
    step: int = max(1, (len(points) - 1) // max(1, count - 1))
    picks: list[int] = list(range(0, len(points), step))[:count]
    if picks and picks[-1] != len(points) - 1:
        picks[-1] = len(points) - 1

    ticks: list[tuple[int, str, str]] = []
    seen: set[str] = set()
    for index in picks:
        day: str = points[index][0]
        label: str = _day_month(day) if short else _month(day)
        if label in seen:
            continue
        seen.add(label)
        ticks.append((index, day, label))
    return ticks


def _nice_ticks(low: float, high: float, count: int) -> list[float]:
    span: float = max(1e-9, high - low)
    rough: float = span / max(1, count - 1)
    magnitude: float = 10 ** math.floor(math.log10(rough))
    step: float = magnitude
    for factor in (1.0, 2.0, 2.5, 5.0, 10.0):
        if rough <= factor * magnitude:
            step = factor * magnitude
            break

    ticks: list[float] = []
    tick: float = math.ceil(low / step) * step
    while tick <= high + 1e-9:
        ticks.append(round(tick, 6))
        tick += step
    return ticks


def _grid(low: float, high: float, points: list[tuple[str, float]], x_of, y_of) -> str:
    left: float = PAD_LEFT
    right: float = WIDTH - PAD_RIGHT
    bottom: float = HEIGHT - PAD_BOTTOM

    parts: list[str] = []
    for tick in _nice_ticks(low, high, Y_TICKS):
        y: float = y_of(tick)
        parts.append(f'<line class="grid" x1="{left:.1f}" y1="{y:.1f}" x2="{right:.1f}" y2="{y:.1f}"/>')
        parts.append(
            f'<text class="axis" x="{left - 10:.1f}" y="{y + 4:.1f}" text-anchor="end">{_axis_value(tick)}</text>'
        )

    if low < 100.0 < high:
        y = y_of(100.0)
        parts.append(f'<line class="baseline" x1="{left:.1f}" y1="{y:.1f}" x2="{right:.1f}" y2="{y:.1f}"/>')

    ticks: list[tuple[int, str, str]] = _x_ticks(points)
    for position, (index, day, label) in enumerate(ticks):
        x: float = x_of(day)
        anchor: str = "start" if position == 0 else "end" if position == len(ticks) - 1 else "middle"
        parts.append(
            f'<text class="axis" x="{x:.1f}" y="{bottom + 22:.1f}" text-anchor="{anchor}">{escape(label)}</text>'
        )

    return "\n".join(parts)


def _series(
    points: list[tuple[str, float]],
    x_of,
    y_of,
    color: str,
    width: float,
    with_area: bool,
    bottom: float,
    with_stroke: bool = True,
) -> str:
    if len(points) < 2:
        return ""

    path: list[str] = []
    for index, (day, value) in enumerate(points):
        command: str = "M" if index == 0 else "L"
        path.append(f"{command}{x_of(day):.1f},{y_of(value):.1f}")
    stroke: str = (
        f'<path d="{" ".join(path)}" fill="none" stroke="{color}" stroke-width="{width}" '
        f'stroke-linejoin="round" stroke-linecap="round"/>'
    )

    if not with_area:
        return stroke if with_stroke else ""

    first_x: float = x_of(points[0][0])
    last_x: float = x_of(points[-1][0])
    area: str = (
        f'<path d="{" ".join(path)} L{last_x:.1f},{bottom:.1f} L{first_x:.1f},{bottom:.1f} Z" '
        f'fill="{color}" fill-opacity="0.10" stroke="none"/>'
    )
    return area + "\n" + stroke if with_stroke else area


def _stats(metrics: dict[str, Any]) -> str:
    return (
        f'end {float(metrics.get("ending_value", 0.0)):,.1f}  ·  '
        f'CAGR {float(metrics.get("cagr", 0.0)):.1f}%  ·  '
        f'Sharpe {float(metrics.get("sharpe", 0.0)):.2f}  ·  '
        f'max DD -{float(metrics.get("max_drawdown", 0.0)):.1f}%'
    )


def _legend_row(x: float, y: float, color: str, width: float, label: str, curve: dict[str, Any]) -> str:
    return (
        f'<line x1="{x - 34:.1f}" y1="{y - 4:.1f}" x2="{x - 12:.1f}" y2="{y - 4:.1f}" '
        f'stroke="{color}" stroke-width="{width}" stroke-linecap="round"/>'
        f'<text class="legend" x="{x:.1f}" y="{y}"><tspan class="legend-name">{escape(label)}</tspan>'
        f'<tspan>  ·  {escape(_stats(curve["metrics"]))}</tspan></text>'
    )


def _end_labels(strategy: dict[str, Any], benchmark: dict[str, Any], x_of, y_of, mine_points, bench_points) -> str:
    if not bench_points or not mine_points:
        return ""

    mine_day, mine_value = mine_points[-1]
    bench_day, bench_value = bench_points[-1]
    mine_y: float = y_of(mine_value)
    bench_y: float = y_of(bench_value)

    if abs(mine_y - bench_y) < 15.0:
        middle: float = (mine_y + bench_y) / 2
        mine_y, bench_y = middle - 8.5, middle + 8.5

    return "\n".join([
        f'<circle cx="{x_of(mine_day):.1f}" cy="{y_of(mine_value):.1f}" r="3.4" fill="{STRATEGY_COLOR}"/>',
        f'<circle cx="{x_of(bench_day):.1f}" cy="{y_of(bench_value):.1f}" r="3.4" fill="{BENCHMARK_COLOR}"/>',
        f'<text class="value" x="{x_of(mine_day) + 10:.1f}" y="{mine_y + 4:.1f}" fill="{STRATEGY_COLOR}">'
        f'{float(strategy["metrics"]["ending_value"]):,.1f}</text>',
        f'<text class="value" x="{x_of(bench_day) + 10:.1f}" y="{bench_y + 4:.1f}" fill="{BENCHMARK_COLOR}">'
        f'{float(benchmark["metrics"]["ending_value"]):,.1f}</text>',
    ])


# -------- Charts --------
def _scale(points: list[tuple[str, float]], bench_points: list[tuple[str, float]]):
    all_points: list[tuple[str, float]] = points + bench_points
    first_day: int = min(_ordinal(day) for day, _ in all_points)
    last_day: int = max(_ordinal(day) for day, _ in all_points)
    values: list[float] = [value for _, value in all_points]
    low: float = min(min(values), 100.0)
    high: float = max(max(values), 100.0)
    margin: float = max(2.0, (high - low) * 0.08)
    low, high = low - margin, high + margin

    left: float = PAD_LEFT
    right: float = WIDTH - PAD_RIGHT
    top: float = PAD_TOP
    bottom: float = HEIGHT - PAD_BOTTOM
    span: float = max(1, last_day - first_day)

    def x_of(day: str) -> float:
        return left + (_ordinal(day) - first_day) / span * (right - left)

    def y_of(value: float) -> float:
        return bottom - (value - low) / (high - low) * (bottom - top)

    return low, high, x_of, y_of


def render_comparison(name: str, strategy: dict[str, Any], benchmark: dict[str, Any], window: Window) -> str:
    bench_points: list[tuple[str, float]] = _points(benchmark)
    mine_points: list[tuple[str, float]] = _points(strategy)
    if len(mine_points) < 2 or len(bench_points) < 2:
        return ""

    low, high, x_of, y_of = _scale(mine_points, bench_points)
    bottom: float = float(HEIGHT - PAD_BOTTOM)
    left: float = float(PAD_LEFT)

    badge_width: float = 74.0
    badge_x: float = WIDTH - 40 - badge_width
    badge_class: str = "badge-bear" if window.kind == "bear" else "badge-bull"
    text_class: str = "badge-text-bear" if window.kind == "bear" else "badge-text-bull"
    days: int = _ordinal(strategy["end"]) - _ordinal(strategy["start"])

    parts: list[str] = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {HEIGHT}" width="{WIDTH}" height="{HEIGHT}" '
        f'font-family="ui-sans-serif, system-ui, -apple-system, \'Segoe UI\', Roboto, sans-serif" role="img" '
        f'aria-label="{escape(name)} against buy and hold, {escape(window.label)}, {strategy["start"]} to {strategy["end"]}">',
        _style(),
        f'<text class="title" x="40" y="42">{escape(name)}</text>',
        f'<rect class="{badge_class}" x="{badge_x:.1f}" y="22" width="{badge_width:.1f}" height="24" rx="12"/>',
        f'<text class="badge-text {text_class}" x="{badge_x + badge_width / 2:.1f}" y="38" text-anchor="middle">'
        f'{window.kind.upper()}</text>',
        f'<text class="sub" x="40" y="68">{escape(window.label)} · {strategy["start"]} → {strategy["end"]} · {days} days</text>',
        _legend_row(74, 100, STRATEGY_COLOR, 2.6, name, strategy),
        _legend_row(74, 124, BENCHMARK_COLOR, 2.2, "Buy and Hold (SPY)", benchmark),
        # Fill under the strategy, then the benchmark line, then the wider strategy
        # stroke last so their shared 100 start has one clean edge.
        _series(mine_points, x_of, y_of, STRATEGY_COLOR, 2.6, True, bottom, with_stroke=False),
        _series(bench_points, x_of, y_of, BENCHMARK_COLOR, 2.2, False, bottom),
        _series(mine_points, x_of, y_of, STRATEGY_COLOR, 2.6, False, bottom),
        _end_labels(strategy, benchmark, x_of, y_of, mine_points, bench_points),
        _grid(low, high, bench_points, x_of, y_of),
        f'<text class="note" x="{left}" y="{HEIGHT - 16}">Index = 100 on the first session · daily closes, '
        f'fees, slippage and dividends included</text>',
        "</svg>",
    ]
    return "\n".join(part for part in parts if part)


def render_single(name: str, strategy: dict[str, Any], window: Window) -> str:
    points: list[tuple[str, float]] = _points(strategy)
    if len(points) < 2:
        return ""

    low, high, x_of, y_of = _scale(points, [])
    bottom: float = float(HEIGHT - PAD_BOTTOM)
    left: float = float(PAD_LEFT)

    last_x: float = x_of(points[-1][0])
    last_y: float = y_of(points[-1][1])

    parts: list[str] = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {HEIGHT}" width="{WIDTH}" height="{HEIGHT}" '
        f'font-family="ui-sans-serif, system-ui, -apple-system, \'Segoe UI\', Roboto, sans-serif" role="img" '
        f'aria-label="{escape(name)}, {escape(window.label)}, {strategy["start"]} to {strategy["end"]}">',
        _style(),
        f'<text class="title" x="40" y="42">{escape(name)}</text>',
        f'<text class="sub" x="40" y="68">{escape(window.label)} · {strategy["start"]} → {strategy["end"]} · '
        f'{_ordinal(strategy["end"]) - _ordinal(strategy["start"])} days</text>',
        f'<line x1="40.0" y1="96.0" x2="62.0" y2="96.0" stroke="{STRATEGY_COLOR}" stroke-width="2.6" stroke-linecap="round"/>',
        f'<text class="legend" x="74.0" y="100.0"><tspan class="legend-name">{escape(name)}</tspan>'
        f'<tspan>  ·  {escape(_stats(strategy["metrics"]))}</tspan></text>',
        _grid(low, high, points, x_of, y_of),
        _series(points, x_of, y_of, STRATEGY_COLOR, 2.6, True, bottom),
        f'<circle cx="{last_x:.1f}" cy="{last_y:.1f}" r="3.4" fill="{STRATEGY_COLOR}"/>',
        f'<text class="value" x="{last_x + 10:.1f}" y="{last_y + 4:.1f}" fill="{STRATEGY_COLOR}">'
        f'{float(strategy["metrics"]["ending_value"]):,.1f}</text>',
        f'<text class="note" x="{left}" y="{HEIGHT - 16}">Index = 100 on the first session · daily closes, '
        f'fees, slippage and dividends included</text>',
        "</svg>",
    ]
    return "\n".join(part for part in parts if part)


# -------- Writing --------
def write_charts(entry: Entry, curves: dict[str, Any], benchmark: dict[str, Any]) -> int:
    out_dir: str = os.path.join(ASSET_DIR, entry.id)
    os.makedirs(out_dir, exist_ok=True)

    single: bool = entry.id == BENCHMARK_ID
    drawn: int = 0
    for window in WINDOWS:
        curve = curves["windows"].get(window.key)
        bench_curve = benchmark["windows"].get(window.key)
        if not curve:
            continue

        if single:
            svg: str = render_single(entry.name, curve, window)
            prefix: str = "curve"
        else:
            if not bench_curve:
                continue
            svg = render_comparison(entry.name, curve, bench_curve, window)
            prefix = "graph"

        if not svg:
            continue
        with open(os.path.join(out_dir, f"{prefix}_{window.key}.svg"), "w", encoding="utf-8") as handle:
            handle.write(svg)
        drawn += 1
    return drawn


def write_data(all_curves: dict[str, dict[str, Any]]) -> str:
    def metrics_block(metrics: dict[str, Any]) -> str:
        return (
            "{\n"
            f"        ending_value: {metrics['ending_value']:.4f},\n"
            f"        cagr: {metrics['cagr']:.4f},\n"
            f"        sharpe: {metrics['sharpe']:.4f},\n"
            f"        max_drawdown: {metrics['max_drawdown']:.4f},\n"
            "      }"
        )

    lines: list[str] = [
        "// backtestResults.ts — the reported windows, generated by",
        "// backend/scripts/regime_report.py. Do not edit by hand: a rerun of that",
        "// script is the only way a figure here changes.",
        "//",
        "// Every strategy is run over the same eight windows, four declines and four",
        "// recoveries. Each row keeps the strategy side and, for everything except the",
        "// benchmark, the buy-and-hold side over the same dates.",
        "",
        "export interface BacktestMetrics {",
        "  ending_value: number;",
        "  cagr: number;",
        "  sharpe: number;",
        "  max_drawdown: number;",
        "}",
        "",
        "export interface BacktestRow {",
        "  key: string;",
        "  kind: 'bear' | 'bull';",
        "  label: string;",
        "  start: string;",
        "  end: string;",
        "  strategy: BacktestMetrics;",
        "  benchmark: BacktestMetrics | null;",
        "}",
        "",
        "export const BACKTESTS: Record<string, BacktestRow[]> = {",
    ]

    for entry in STRATEGIES:
        curves = all_curves[entry.id]
        window_rows: list[str] = []
        for window in WINDOWS:
            curve = curves["windows"].get(window.key)
            if not curve:
                continue
            bench = None if entry.id == BENCHMARK_ID else all_curves[BENCHMARK_ID]["windows"].get(window.key)
            window_rows.append(
                "    {\n"
                f"      key: '{window.key}',\n"
                f"      kind: '{window.kind}',\n"
                f"      label: '{window.label}',\n"
                f"      start: '{curve['start']}',\n"
                f"      end: '{curve['end']}',\n"
                f"      strategy: {metrics_block(curve['metrics'])},\n"
                f"      benchmark: {metrics_block(bench['metrics']) if bench else 'null'},\n"
                "    },"
            )
        lines.append(f"  '{entry.id}': [")
        lines.extend(window_rows)
        lines.append("  ],")

    lines.extend(["};", ""])
    content: str = "\n".join(lines)

    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    with open(DATA_FILE, "w", encoding="utf-8") as handle:
        handle.write(content)
    return DATA_FILE


# -------- Entry point --------
def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python backend/scripts/regime_report.py",
        description="Run every strategy over the eight reported windows and rebuild the charts and metrics.",
    )
    parser.add_argument("--force", action="store_true", help="re-run the windows instead of reusing stored curves")
    parser.add_argument("--only", help="one strategy id, for example adaptive-momentum")
    args = parser.parse_args(argv)

    entries: list[Entry] = STRATEGIES
    if args.only:
        entries = [entry for entry in STRATEGIES if entry.id == args.only]
        if not entries:
            raise SystemExit(f"Unknown strategy '{args.only}'. Known ids: {', '.join(e.id for e in STRATEGIES)}")

    all_curves: dict[str, dict[str, Any]] = {}
    for entry in STRATEGIES:
        force: bool = args.force or entry.id == args.only
        all_curves[entry.id] = ensure_curves(entry, force=force)

    benchmark = all_curves[BENCHMARK_ID]
    for entry in entries:
        drawn: int = write_charts(entry, all_curves[entry.id], benchmark)
        print(f"  {drawn} chart(s) in frontend/src/assets/strategies/{entry.id}")

    path: str = write_data(all_curves)
    print(f"\nWrote {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
