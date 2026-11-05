# -------- run_backtest.py --------
# Headless backtest for CI. Calls the same function that serves GET /api/backtest/run
# and writes its exact return value to a file, so the frontend contract cannot fork.
#
# The route function is imported directly rather than duplicated: FastAPI's decorator
# returns the original function, and it takes plain arguments, so it runs without a
# server. Nothing here re-implements the response shape.
#
# Usage:
#   python scripts/run_backtest.py --list
#   python scripts/run_backtest.py --strategy momentum-20 --start 2023-01-01 --out result.json

# -------- Imports --------
import argparse
import hashlib
import hmac
import json
import os
import sys
import time
import urllib.request

from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT: Path = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from fastapi import HTTPException

from app.main import run_backtest as run_backtest_endpoint
from app.strategies import REGISTRY


# -------- Helpers --------
# The metrics the step summary shows, in the order a reader wants them.
SUMMARY_KEYS: tuple[tuple[str, str], ...] = (
    ("Total Return", "total_return_pct"),
    ("CAGR", "cagr"),
    ("Sharpe", "sharpe_ratio"),
    ("Max Drawdown", "max_drawdown_pct"),
    ("Win Rate", "win_rate_pct"),
    ("Trades", "total_trades"),
)


# One line per strategy, so a wrong id is obvious before dispatch.
def list_strategies() -> int:
    for key, (strategy_class, strategy_type) in REGISTRY.items():
        instance = strategy_class()
        print(f"{key:28} {strategy_type:10} {instance.name}")
    return 0


# A markdown table for GITHUB_STEP_SUMMARY, so the result is readable in the UI.
def write_step_summary(payload: dict, elapsed: float, out_path: Path) -> None:
    target = os.environ.get("GITHUB_STEP_SUMMARY")
    if not target:
        return

    metrics = payload.get("metrics") or {}
    lines: list[str] = [
        f"## {payload.get('strategy_name', 'Backtest')}",
        "",
        f"`{payload.get('strategy_id')}` · {len(payload.get('chart_data', []))} sessions · "
        f"{len(payload.get('trades', []))} trades · {elapsed:.1f}s",
        "",
        "| Metric | Value |",
        "| --- | --- |",
    ]
    for label, key in SUMMARY_KEYS:
        if key in metrics:
            value = metrics[key]
            rendered = f"{value:,.2f}" if isinstance(value, (int, float)) else str(value)
            lines.append(f"| {label} | {rendered} |")
    lines += ["", f"Result file: `{out_path.name}` ({out_path.stat().st_size:,} bytes)"]

    with open(target, "a", encoding="utf-8") as handle:
        handle.write("\n".join(lines) + "\n")


# POST the result to the caller, signed so the receiver can reject anything forged.
def post_callback(url: str, secret: str | None, body: bytes) -> None:
    headers = {"Content-Type": "application/json"}
    if secret:
        digest = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
        headers["X-Signature-256"] = f"sha256={digest}"

    request = urllib.request.Request(url, data=body, headers=headers, method="POST")
    with urllib.request.urlopen(request, timeout=30) as response:
        print(f"callback {url} -> HTTP {response.status}")


# -------- Entry Point --------
def main() -> int:
    parser = argparse.ArgumentParser(description="Run one backtest without a server.")
    parser.add_argument("--strategy", help="Strategy id from REGISTRY")
    parser.add_argument("--start", default="2023-01-01", help="Start date, YYYY-MM-DD")
    parser.add_argument("--end", default=None, help="End date, YYYY-MM-DD (default: today)")
    parser.add_argument("--out", default="result.json", help="Where to write the JSON result")
    parser.add_argument("--job-id", default="", help="Echoed back in the result for correlation")
    parser.add_argument("--callback-url", default="", help="Optional URL to POST the result to")
    parser.add_argument("--list", action="store_true", help="List strategy ids and exit")
    args = parser.parse_args()

    if args.list:
        return list_strategies()
    if not args.strategy:
        parser.error("--strategy is required unless --list is given")

    started = time.time()
    try:
        payload: dict = run_backtest_endpoint(
            strategy_id=args.strategy,
            start_date=args.start,
            end_date=args.end or None,
        )
    except HTTPException as error:
        print(json.dumps({"error": error.detail, "status": error.status_code}), file=sys.stderr)
        return 1
    except ValueError as error:
        print(json.dumps({"error": str(error), "status": 400}), file=sys.stderr)
        return 1

    elapsed = time.time() - started
    payload["job_id"] = args.job_id or None
    payload["start_date"] = args.start
    payload["end_date"] = args.end or None
    payload["generated_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    payload["elapsed_seconds"] = round(elapsed, 2)

    out_path = Path(args.out)
    body = json.dumps(payload, default=str).encode("utf-8")
    out_path.write_bytes(body)

    metrics = payload.get("metrics") or {}
    print(f"{payload.get('strategy_name')} ({args.strategy}) {args.start}..{args.end or 'today'}")
    for label, key in SUMMARY_KEYS:
        if key in metrics:
            print(f"  {label:14} {metrics[key]}")
    print(f"  chart_data     {len(payload.get('chart_data', []))} points")
    print(f"  trades         {len(payload.get('trades', []))}")
    print(f"  result         {out_path} ({len(body):,} bytes) in {elapsed:.1f}s")

    write_step_summary(payload, elapsed, out_path)

    if args.callback_url:
        post_callback(args.callback_url, os.environ.get("CALLBACK_SECRET") or None, body)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
