# daily_runner.py — Nightly market refresh and strategy-signal digests.
#
# Each registered strategy is evaluated once on the latest stored session with
# the production Backtester. Its pending Orders are the entry signals; no order
# is filled by this one-day scan. Signals are shared with onboarded users who
# follow that strategy and have trade-signal emails enabled.

from __future__ import annotations

import argparse
import asyncio
import os
from datetime import datetime, timedelta
from typing import Any

import requests
from dotenv import load_dotenv

from app.database import turso
from app.database.db import insert_or_update_data
from app.database.fetch import get_latest_trading_date
from app.notification.mailer import signals_digest_email
from app.strategies import REGISTRY
from app.engine.backtesting import Backtester

load_dotenv()
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://jqyqfkrzwimxuzugyuiw.supabase.co").rstrip("/")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE")
SUPABASE_PAGE_SIZE = 1000


def _fetch_supabase_users() -> list[dict[str, Any]]:
    """Read the authoritative notification settings from the Supabase profile table."""
    if not SUPABASE_SERVICE_KEY:
        raise RuntimeError("SUPABASE_SERVICE_ROLE is required to sync daily notification settings.")

    users: list[dict[str, Any]] = []
    start = 0
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    }
    while True:
        response = requests.get(
            f"{SUPABASE_URL}/rest/v1/users",
            params={"select": "id,name,email,settings", "order": "id"},
            headers={**headers, "Range": f"{start}-{start + SUPABASE_PAGE_SIZE - 1}"},
            timeout=30,
        )
        response.raise_for_status()
        page = response.json()
        if not isinstance(page, list):
            raise RuntimeError("Supabase returned an invalid users response.")
        users.extend(page)
        if len(page) < SUPABASE_PAGE_SIZE:
            break
        start += SUPABASE_PAGE_SIZE
    return users


async def _sync_settings() -> None:
    """Refresh Turso's notification-settings mirror before selecting recipients."""
    users = await asyncio.to_thread(_fetch_supabase_users)
    for user in users:
        user_id = user.get("id")
        if not user_id:
            continue
        settings = user.get("settings")
        if isinstance(settings, str):
            import json
            try:
                settings = json.loads(settings)
            except ValueError:
                settings = {}
        await turso.mirror_settings(
            str(user_id),
            settings if isinstance(settings, dict) else {},
            name=user.get("name"),
            email=user.get("email"),
        )
    print(f"Synced notification settings for {len(users)} Supabase user(s).")


def _followed_strategy_ids(preferences: dict[str, Any]) -> list[str]:
    raw = preferences.get("followedStrategies") or []
    ids: list[str] = []
    for item in raw:
        strategy_id = item.get("id") if isinstance(item, dict) else item
        if isinstance(strategy_id, str) and strategy_id in REGISTRY and strategy_id not in ids:
            ids.append(strategy_id)
    return ids


def _signals_for_strategy(strategy_id: str, signal_date: str) -> list[dict[str, Any]]:
    """Run one strategy through the real engine for one completed session."""
    strategy_cls, _kind = REGISTRY[strategy_id]
    strategy = strategy_cls()
    # The engine requires a non-empty range and indicator strategies need
    # enough prior sessions to evaluate today's signal without lookahead.
    warmup_start = (datetime.strptime(signal_date, "%Y-%m-%d") - timedelta(days=370)).strftime("%Y-%m-%d")
    backtester = Backtester(strategy=strategy, start_date=warmup_start, end_date=signal_date)
    backtester.run()

    signals: list[dict[str, Any]] = []
    for order in backtester.manager.pending_orders:
        signal: dict[str, Any] = {
            "strategy_id": strategy_id,
            "strategy": strategy.name,
            "ticker": order.ticker,
            "signal_type": order.position_type.value.upper(),
            "signal_date": order.order_date,
            "stop_loss": order.stop_loss if order.stop_loss > 0 else None,
            "take_profit": order.take_profit if order.take_profit > 0 else None,
        }
        # The engine already marked the latest close; don't reopen Parquet once
        # per signal just to decorate the email.
        close = backtester.manager.last_prices.get(order.ticker)
        if close is not None:
            signal["price"] = float(close)
        signals.append(signal)
    return signals


async def run_daily(*, refresh_market_data: bool = True) -> dict[str, int | str]:
    """Refresh market data, evaluate followed strategies, and send one digest per user."""
    if refresh_market_data:
        print("Refreshing local market data...")
        await asyncio.to_thread(insert_or_update_data)

    await _sync_settings()
    signal_date = await asyncio.to_thread(get_latest_trading_date)
    recipients = await turso.get_notification_recipients()

    followed = {
        strategy_id
        for user in recipients
        if (user.get("settings") or {}).get("tradeSignals", True)
        for strategy_id in _followed_strategy_ids(user.get("preferences") or {})
    }

    signals_by_strategy: dict[str, list[dict[str, Any]]] = {}
    for strategy_id in sorted(followed):
        # Buy & Hold is a passive benchmark, not a recurring actionable signal.
        # A one-session scan has no persisted portfolio book, so treating each
        # fresh manager as a new entry would emit the same buy every night.
        if strategy_id == "buy-and-hold":
            continue
        try:
            signals_by_strategy[strategy_id] = await asyncio.to_thread(
                _signals_for_strategy, strategy_id, signal_date
            )
            print(f"{strategy_id}: {len(signals_by_strategy[strategy_id])} signal(s) on {signal_date}.")
        except Exception as exc:
            # One broken strategy should not prevent other followed strategies from notifying.
            print(f"Strategy {strategy_id} failed for {signal_date}: {exc}")
            signals_by_strategy[strategy_id] = []

    emails_sent = 0
    emails_failed = 0
    for user in recipients:
        settings = user.get("settings") or {}
        if not settings.get("tradeSignals", True):
            continue
        user_signals = [
            signal
            for strategy_id in _followed_strategy_ids(user.get("preferences") or {})
            for signal in signals_by_strategy.get(strategy_id, [])
        ]
        if not user_signals:
            continue
        receiver = user.get("email")
        if not receiver:
            print(f"Skipping signal digest for user {user.get('id')}: no email address.")
            continue
        sent, error = await asyncio.to_thread(
            signals_digest_email,
            receiver,
            user.get("name") or receiver.split("@")[0],
            user_signals,
            signal_date,
        )
        if sent:
            emails_sent += 1
        else:
            emails_failed += 1
            print(f"Signal digest failed for {receiver}: {error}")

    summary = {
        "signal_date": signal_date,
        "strategies_run": len(signals_by_strategy),
        "emails_sent": emails_sent,
        "emails_failed": emails_failed,
    }
    print(f"Daily signal run complete: {summary}")
    return summary


async def _main() -> None:
    parser = argparse.ArgumentParser(description="Refresh data and send daily strategy signal digests.")
    parser.add_argument(
        "--skip-market-data-refresh",
        action="store_true",
        help="Use the current Parquet snapshot instead of downloading fresh bars.",
    )
    args = parser.parse_args()
    try:
        await run_daily(refresh_market_data=not args.skip_market_data_refresh)
    finally:
        await turso.close()


if __name__ == "__main__":
    asyncio.run(_main())
