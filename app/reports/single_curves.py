# -------- single_curves.py --------
# Draw one strategy's equity curve on its own: one line, one index, no comparison.
#
#   python -m app.reports.single_curves buy-and-hold
#   python -m app.reports.single_curves statistical-mean-reversion --force
#
# Writes artifacts/<strategy>/curve_<period>.svg. The style, ticks and helpers come
# from the comparison renderer, so a single line looks like one side of a comparison
# chart rather than a different chart altogether.

# -------- Imports --------
import os
import argparse

from typing import Any
from xml.sax.saxutils import escape

# Report imports
from app.reports import curve_store
from app.reports.strategy_curves import (
    HEIGHT,
    PAD_BOTTOM,
    PAD_LEFT,
    PAD_RIGHT,
    PAD_TOP,
    STRATEGY_COLOR,
    WIDTH,
    Y_TICKS,
    _axis_value,
    _nice_ticks,
    _ordinal,
    _points,
    _series,
    _style,
    _x_ticks,
)
from app.strategies import REGISTRY


# The registry names buy-and-hold for the benchmark role; the site lists it as a
# strategy, so its charts are titled the way the page names it.
TITLES: dict[str, str] = {
    "buy-and-hold": "Buy and Hold (SPY)",
}


# -------- Chart --------
def render_curve(name: str, strategy: dict[str, Any], period: curve_store.Period) -> str:
    points: list[tuple[str, float]] = _points(strategy)
    if len(points) < 2:
        return ""

    left: float = float(PAD_LEFT)
    right: float = float(WIDTH - PAD_RIGHT)
    top: float = float(PAD_TOP)
    bottom: float = float(HEIGHT - PAD_BOTTOM)

    first_day: int = _ordinal(points[0][0])
    last_day: int = _ordinal(points[-1][0])
    values: list[float] = [value for _, value in points]
    low: float = min(min(values), 100.0)
    high: float = max(max(values), 100.0)
    margin: float = max(2.0, (high - low) * 0.08)
    low, high = low - margin, high + margin

    span: float = max(1, last_day - first_day)

    def x_of(day: str) -> float:
        return left + (_ordinal(day) - first_day) / span * (right - left)

    def y_of(value: float) -> float:
        return bottom - (value - low) / (high - low) * (bottom - top)

    metrics: dict[str, Any] = strategy.get("metrics") or {}
    stats: str = (
        f'end {float(metrics.get("ending_value", 0.0)):,.1f}  ·  '
        f'CAGR {float(metrics.get("cagr", 0.0)):.1f}%  ·  '
        f'Sharpe {float(metrics.get("sharpe", 0.0)):.2f}  ·  '
        f'max DD {float(metrics.get("max_drawdown", 0.0)):.1f}%'
    )

    last_x: float = x_of(points[-1][0])
    last_y: float = y_of(points[-1][1])

    parts: list[str] = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {HEIGHT}" width="{WIDTH}" height="{HEIGHT}" '
        f'font-family="ui-sans-serif, system-ui, -apple-system, \'Segoe UI\', Roboto, sans-serif" role="img" '
        f'aria-label="{escape(name)}, {escape(period.label)}, {strategy["start"]} to {strategy["end"]}">',
        _style(),
        f'<text class="title" x="40" y="42">{escape(name)}</text>',
        f'<text class="sub" x="40" y="68">{escape(period.label)} · {strategy["start"]} → {strategy["end"]}'
        f' · {last_day - first_day} days</text>',
        f'<line x1="40.0" y1="96.0" x2="62.0" y2="96.0" stroke="{STRATEGY_COLOR}" stroke-width="2.6" stroke-linecap="round"/>',
        f'<text class="legend" x="74.0" y="100.0"><tspan class="legend-name">{escape(name)}</tspan>'
        f'<tspan>  ·  {escape(stats)}</tspan></text>',
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


# Y grid with value labels, the 100 break-even line, and date labels along the bottom.
def _grid(low: float, high: float, points: list[tuple[str, float]], x_of, y_of) -> str:
    left: float = float(PAD_LEFT)
    right: float = float(WIDTH - PAD_RIGHT)
    bottom: float = float(HEIGHT - PAD_BOTTOM)

    parts: list[str] = []
    for tick in _nice_ticks(low, high, Y_TICKS):
        y: float = y_of(tick)
        parts.append(f'<line class="grid" x1="{left:.1f}" y1="{y:.1f}" x2="{right:.1f}" y2="{y:.1f}"/>')
        parts.append(f'<text class="axis" x="{left - 10:.1f}" y="{y + 4:.1f}" text-anchor="end">{_axis_value(tick)}</text>')

    if low < 100.0 < high:
        y = y_of(100.0)
        parts.append(f'<line class="baseline" x1="{left:.1f}" y1="{y:.1f}" x2="{right:.1f}" y2="{y:.1f}"/>')

    ticks: list[tuple[int, str, str]] = _x_ticks(points)
    for position, (_, day, label) in enumerate(ticks):
        x: float = x_of(day)
        anchor: str = "start" if position == 0 else "end" if position == len(ticks) - 1 else "middle"
        parts.append(f'<text class="axis" x="{x:.1f}" y="{bottom + 22:.1f}" text-anchor="{anchor}">{escape(label)}</text>')

    return "\n".join(parts)


# -------- Entry Point --------
def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m app.reports.single_curves",
        description="Draw one strategy's equity curve, without a benchmark overlay.",
    )
    parser.add_argument("strategy", nargs="?", help="strategy id, for example buy-and-hold")
    parser.add_argument("--force", action="store_true", help="re-run the windows instead of reusing stored curves")
    args = parser.parse_args(argv)

    if not args.strategy:
        raise SystemExit(f"Pass a strategy id: {', '.join(sorted(REGISTRY))}")
    if args.strategy not in REGISTRY:
        raise SystemExit(f"Unknown strategy '{args.strategy}'. Known ids: {', '.join(sorted(REGISTRY))}")

    curves: dict[str, Any] = curve_store.ensure_curves(args.strategy, force=args.force)
    name: str = TITLES.get(args.strategy) or curves.get("name") or curve_store.strategy_label(args.strategy)
    out_dir: str = curve_store.chart_dir(args.strategy)
    os.makedirs(out_dir, exist_ok=True)

    drawn: int = 0
    for period in curve_store.PERIODS:
        curve = curves["periods"].get(period.key)
        if not curve:
            continue
        svg: str = render_curve(name, curve, period)
        if not svg:
            continue
        path: str = os.path.join(out_dir, f"curve_{period.key}.svg")
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(svg)
        print(f"  curve_{period.key}.svg")
        drawn += 1

    print(f"\n{drawn} chart(s) in {out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
