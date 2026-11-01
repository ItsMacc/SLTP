# -------- strategy_curves.py --------
# Draw one strategy against the benchmark, window by window, as SVG.
#
#   python -m app.reports.strategy_curves statistical-mean-reversion
#   python -m app.reports.strategy_curves buy-and-hold --force
#
# The benchmark store is built first when it is missing. Each window becomes
# artifacts/<strategy>/graph_<period>.svg: two labelled lines on one index that
# starts at 100, so the strategy and the market are read on the same scale.

# -------- Imports --------
import os
import math
import argparse

from typing import Any
from datetime import datetime
from xml.sax.saxutils import escape

# Report imports
from app.reports import curve_store
from app.strategies import REGISTRY


# -------- Chart Style --------
# Mid-tone hues stay legible on a white and on a near-black page, and the text and
# grid colours flip with the viewer's theme through the media query in the file.
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


# -------- Chart --------
# Build one SVG comparing the strategy with the benchmark over a single window.
def render_chart(name: str, benchmark: dict[str, Any], strategy: dict[str, Any], period: curve_store.Period) -> str:
    bench_points: list[tuple[str, float]] = _points(benchmark)
    mine_points: list[tuple[str, float]] = _points(strategy)

    left: float = PAD_LEFT
    right: float = WIDTH - PAD_RIGHT
    top: float = PAD_TOP
    bottom: float = HEIGHT - PAD_BOTTOM

    # Both runs are one index starting at 100, so they share one scale and one baseline
    first_day: int = min(_ordinal(day) for day, _ in bench_points + mine_points)
    last_day: int = max(_ordinal(day) for day, _ in bench_points + mine_points)
    values: list[float] = [value for _, value in bench_points + mine_points]
    low: float = min(min(values), 100.0)
    high: float = max(max(values), 100.0)
    margin: float = max(2.0, (high - low) * 0.08)
    low, high = low - margin, high + margin

    # A run can start mid-session, so x is measured in days rather than points
    def x_of(day: str) -> float:
        span: float = max(1, last_day - first_day)
        return left + (_ordinal(day) - first_day) / span * (right - left)

    def y_of(value: float) -> float:
        return bottom - (value - low) / (high - low) * (bottom - top)

    parts: list[str] = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {HEIGHT}" width="{WIDTH}" height="{HEIGHT}" '
        f'font-family="ui-sans-serif, system-ui, -apple-system, \'Segoe UI\', Roboto, sans-serif" role="img" '
        f'aria-label="{escape(name)} against the benchmark, {escape(period.label)}, {benchmark["start"]} to {benchmark["end"]}">',
        _style(),
        _header(name, benchmark, strategy, period),
        _grid(low, high, bench_points, x_of, y_of),
        _series(mine_points, x_of, y_of, STRATEGY_COLOR, 2.6, with_area=True, bottom=bottom),
        _series(bench_points, x_of, y_of, BENCHMARK_COLOR, 2.2, with_area=False, bottom=bottom),
        _end_labels(benchmark, strategy, bench_points, mine_points, x_of, y_of),
        f'<text class="note" x="{left}" y="{HEIGHT - 16}">Index = 100 on the first session · daily closes, '
        f'fees and slippage included</text>',
        "</svg>",
    ]
    return "\n".join(part for part in parts if part)


# -------- Entry Point --------
def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m app.reports.strategy_curves",
        description="Draw a strategy against the benchmark for every reported window.",
    )
    parser.add_argument("strategy", nargs="?", help="strategy id, for example statistical-mean-reversion")
    parser.add_argument("--force", action="store_true", help="re-run the strategy's windows instead of reusing stored curves")
    parser.add_argument("--list", action="store_true", help="print the strategy ids and exit")
    args = parser.parse_args(argv)

    if args.list or not args.strategy:
        _print_strategies()
        return 0 if args.list else 1

    if args.strategy not in REGISTRY:
        raise SystemExit(f"Unknown strategy '{args.strategy}'. Known ids: {', '.join(sorted(REGISTRY))}")

    # A comparison needs both sides, so the benchmark is built before anything is drawn
    benchmark: dict[str, Any] = curve_store.ensure_curves(curve_store.BENCHMARK_ID)
    strategy: dict[str, Any] = curve_store.ensure_curves(args.strategy, force=args.force)

    out_dir: str = curve_store.chart_dir(args.strategy)
    os.makedirs(out_dir, exist_ok=True)

    drawn: int = 0
    missing: list[str] = []
    for period in curve_store.PERIODS:
        bench_curve = benchmark["periods"].get(period.key)
        strategy_curve = strategy["periods"].get(period.key)
        if not bench_curve or not strategy_curve:
            missing.append(period.key)
            continue

        svg: str = render_chart(strategy["name"], bench_curve, strategy_curve, period)
        path: str = os.path.join(out_dir, f"graph_{period.key}.svg")
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(svg)
        print(f"  graph_{period.key}.svg")
        drawn += 1

    print(f"\n{drawn} chart(s) in {out_dir}")
    if missing:
        print(f"Missing curves, skipped: {', '.join(missing)}")
        return 1
    return 0


# -------- Pieces --------
# The stylesheet: light defaults, then the dark-page overrides for text and grid.
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


# Title, window badge, and the two labelled legend rows with their numbers.
def _header(name: str, benchmark: dict[str, Any], strategy: dict[str, Any], period: curve_store.Period) -> str:
    badge_width: float = 74.0
    badge_x: float = WIDTH - 40 - badge_width
    badge_class: str = "badge-bear" if period.kind == "bear" else "badge-bull"
    text_class: str = "badge-text-bear" if period.kind == "bear" else "badge-text-bull"

    return "\n".join([
        f'<text class="title" x="40" y="42">{escape(name)}</text>',
        f'<rect class="{badge_class}" x="{badge_x:.1f}" y="22" width="{badge_width:.1f}" height="24" rx="12"/>',
        f'<text class="badge-text {text_class}" x="{badge_x + badge_width / 2:.1f}" y="38" text-anchor="middle">{period.kind.upper()}</text>',
        f'<text class="sub" x="40" y="68">{escape(period.label)} · {benchmark["start"]} → {benchmark["end"]}'
        f' · {_ordinal(benchmark["end"]) - _ordinal(benchmark["start"])} days</text>',
        _legend_row(74, 100, STRATEGY_COLOR, 2.6, name, strategy),
        _legend_row(74, 124, BENCHMARK_COLOR, 2.2, curve_store.strategy_label(curve_store.BENCHMARK_ID), benchmark),
    ])


# One legend line: a colour swatch, the series name, then its ending value and stats.
def _legend_row(x: float, y: float, color: str, width: float, label: str, curve: dict[str, Any]) -> str:
    metrics: dict[str, Any] = curve.get("metrics") or {}
    stats: str = (
        f'end {float(metrics.get("ending_value", 0.0)):,.1f}  ·  '
        f'CAGR {float(metrics.get("cagr", 0.0)):.1f}%  ·  '
        f'Sharpe {float(metrics.get("sharpe", 0.0)):.2f}  ·  '
        f'max DD {float(metrics.get("max_drawdown", 0.0)):.1f}%'
    )
    return (
        f'<line x1="{x - 34:.1f}" y1="{y - 4:.1f}" x2="{x - 12:.1f}" y2="{y - 4:.1f}" '
        f'stroke="{color}" stroke-width="{width}" stroke-linecap="round"/>'
        f'<text class="legend" x="{x:.1f}" y="{y}"><tspan class="legend-name">{escape(label)}</tspan>'
        f'<tspan>  ·  {escape(stats)}</tspan></text>'
    )


# Y grid with value labels, x date labels, and the 100 break-even line.
def _grid(low: float, high: float, bench_points: list[tuple[str, float]], x_of, y_of) -> str:
    left: float = PAD_LEFT
    right: float = WIDTH - PAD_RIGHT
    bottom: float = HEIGHT - PAD_BOTTOM

    parts: list[str] = []
    for tick in _nice_ticks(low, high, Y_TICKS):
        y: float = y_of(tick)
        parts.append(f'<line class="grid" x1="{left:.1f}" y1="{y:.1f}" x2="{right:.1f}" y2="{y:.1f}"/>')
        parts.append(f'<text class="axis" x="{left - 10:.1f}" y="{y + 4:.1f}" text-anchor="end">{_axis_value(tick)}</text>')

    if low < 100.0 < high:
        y = y_of(100.0)
        parts.append(f'<line class="baseline" x1="{left:.1f}" y1="{y:.1f}" x2="{right:.1f}" y2="{y:.1f}"/>')

    ticks: list[tuple[int, str, str]] = _x_ticks(bench_points)
    for position, (index, day, label) in enumerate(ticks):
        x: float = x_of(day)
        anchor: str = "start" if position == 0 else "end" if position == len(ticks) - 1 else "middle"
        parts.append(f'<text class="axis" x="{x:.1f}" y="{bottom + 22:.1f}" text-anchor="{anchor}">{escape(label)}</text>')

    return "\n".join(parts)


# One line, optionally with a soft fill underneath it.
def _series(points: list[tuple[str, float]], x_of, y_of, color: str, width: float, with_area: bool, bottom: float) -> str:
    if len(points) < 2:
        return ""

    path: list[str] = []
    for index, (day, value) in enumerate(points):
        command: str = "M" if index == 0 else "L"
        path.append(f"{command}{x_of(day):.1f},{y_of(value):.1f}")
    stroke: str = f'<path d="{" ".join(path)}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linejoin="round" stroke-linecap="round"/>'

    if not with_area:
        return stroke

    first_x: float = x_of(points[0][0])
    last_x: float = x_of(points[-1][0])
    area: str = (
        f'<path d="{" ".join(path)} L{last_x:.1f},{bottom:.1f} L{first_x:.1f},{bottom:.1f} Z" '
        f'fill="{color}" fill-opacity="0.10" stroke="none"/>'
    )
    return area + "\n" + stroke


# A dot and a value at the end of each line, nudged apart when the two lines meet.
def _end_labels(benchmark: dict[str, Any], strategy: dict[str, Any], bench_points: list[tuple[str, float]], mine_points: list[tuple[str, float]], x_of, y_of) -> str:
    if not bench_points or not mine_points:
        return ""

    mine_day, mine_value = mine_points[-1]
    bench_day, bench_value = bench_points[-1]
    mine_y: float = y_of(mine_value)
    bench_y: float = y_of(bench_value)

    # Keep the two labels readable when the lines finish within a few pixels
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


# -------- Helpers --------
# Stored points as (day, value) tuples.
def _points(curve: dict[str, Any]) -> list[tuple[str, float]]:
    return [(str(day), float(value)) for day, value in curve.get("points") or []]


# Days since year one, so a date can be placed on the x axis.
def _ordinal(day: str) -> int:
    return datetime.strptime(day, "%Y-%m-%d").toordinal()


# A short axis label, month and year.
def _month(day: str) -> str:
    return datetime.strptime(day, "%Y-%m-%d").strftime("%b %Y")


# A day-level axis label, for windows measured in weeks.
def _day_month(day: str) -> str:
    return datetime.strptime(day, "%Y-%m-%d").strftime("%d %b")


# Rounded axis values: 120, not 120.0000001.
def _axis_value(value: float) -> str:
    return f"{value:,.0f}" if abs(value) >= 10 else f"{value:,.1f}"


# Evenly spaced dates from the benchmark, first and last included.
def _x_ticks(points: list[tuple[str, float]]) -> list[tuple[int, str, str]]:
    if not points:
        return []

    # A short window reads in days, a long one in months
    short: bool = _ordinal(points[-1][0]) - _ordinal(points[0][0]) < 240
    count: int = min(X_TICKS, len(points))
    step: int = max(1, (len(points) - 1) // max(1, count - 1))
    picks: list[int] = list(range(0, len(points), step))[:count]
    if picks and picks[-1] != len(points) - 1:
        picks[-1] = len(points) - 1

    # Two picks can land in the same month, so a label is only used once
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


# Ticks on a 1, 2, 2.5, 5 or 10 step, so the labels stay round.
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


# The strategy ids and kinds, so a typo can be fixed without reading code.
def _print_strategies() -> None:
    print("Strategies")
    for strategy_id, (factory, kind) in sorted(REGISTRY.items()):
        print(f"  {strategy_id:<30}{kind:<12}{factory().name}")


if __name__ == "__main__":
    raise SystemExit(main())
