# -------- daily_runner.py --------
# Nightly market refresh and strategy-signal digests.
#
# Each registered strategy is evaluated once on the latest stored session with the
# production Backtester. Its pending Orders are the entry signals; no order is filled
# by this one-day scan. Signals are shared with onboarded users who follow that
# strategy and have trade-signal emails enabled.
#
# The operator also gets one ops report per day (see usage_report.py), which is skipped
# when it already went out today so a weekend rerun cannot mail the same numbers twice.

# -------- Imports --------
from __future__ import annotations

import os
import json
import asyncio
import argparse
import requests

from typing import Any
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Engine imports
from app.engine.backtesting import Backtester
from app.strategies import REGISTRY

# Database imports
from app.database.turso import turso
from app.database.market.market_data import SplitSeamReport, update_market_data, report_new_split_seams
from app.database.market.market_data_service import get_latest_trading_date

# Notification imports
from app.notification.mailer import admin_recipient, signals_digest_email, split_seam_email
from app.notification.usage_report import format_usage_summary, send_usage_report, sent_today as ops_report_sent_today

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://jqyqfkrzwimxuzugyuiw.supabase.co").rstrip("/")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE")
SUPABASE_PAGE_SIZE: int = 1000

# Which users already got which session, so a rerun of that session sends nothing.
DIGEST_STATE_FILE: str = os.path.join(os.path.dirname(os.path.abspath(__file__)), "digest_state.json")
DIGEST_STATE_SAVE_EVERY: int = 200


# -------- Settings Mirror --------
# Read the authoritative notification settings from the Supabase profile table, one page at a time.
def _fetch_supabase_users() -> list[dict[str, Any]]:
    if not SUPABASE_SERVICE_KEY:
        raise RuntimeError("SUPABASE_SERVICE_ROLE is required to sync daily notification settings.")

    users: list[dict[str, Any]] = []
    start: int = 0
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


# Refresh Turso's notification-settings mirror before selecting recipients.
async def _sync_settings() -> None:
    users = await asyncio.to_thread(_fetch_supabase_users)
    for user in users:
        user_id = user.get("id")
        if not user_id:
            continue

        settings = user.get("settings")
        if isinstance(settings, str):
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


# -------- Strategy Selection --------
# The registered strategy ids a user follows, in their stored order.
def _followed_strategy_ids(preferences: dict[str, Any]) -> list[str]:
    raw = preferences.get("followedStrategies") or []
    ids: list[str] = []
    for item in raw:
        strategy_id = item.get("id") if isinstance(item, dict) else item
        if isinstance(strategy_id, str) and strategy_id in REGISTRY and strategy_id not in ids:
            ids.append(strategy_id)
    return ids


# Run one strategy through the real engine for one completed session.
def _signals_for_strategy(strategy_id: str, signal_date: str) -> list[dict[str, Any]]:
    strategy_cls, _kind = REGISTRY[strategy_id]
    strategy = strategy_cls()

    # The engine requires a non-empty range and indicator strategies need enough prior
    # sessions to evaluate today's signal without lookahead
    warmup_start: str = (datetime.strptime(signal_date, "%Y-%m-%d") - timedelta(days=370)).strftime("%Y-%m-%d")
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

        # The engine already marked the latest close; don't reopen Parquet once per
        # signal just to decorate the email
        close = backtester.manager.last_prices.get(order.ticker)
        if close is not None:
            signal["price"] = float(close)
        signals.append(signal)
    return signals


# -------- Daily Run --------
# Refresh market data, evaluate followed strategies, and send one digest per user.
async def run_daily(*, refresh_market_data: bool = True) -> dict[str, int | str]:
    split_audit: SplitSeamReport | None = None
    if refresh_market_data:
        print("Refreshing local market data...")
        await asyncio.to_thread(update_market_data)

        # The source does not always restate a split, and no split event can reveal that, so the
        # prices are checked daily and only the seams that appeared since last night are emailed.
        split_audit = await asyncio.to_thread(report_new_split_seams)
        if split_audit.new:
            admin: str | None = admin_recipient()
            if admin:
                sent, error = await asyncio.to_thread(split_seam_email, admin, split_audit.new)
                print(f"Split seam alert sent to {admin}." if sent else f"Split seam alert failed: {error}")
            else:
                print("No admin address set; split seams were only logged.")

    await _sync_settings()
    signal_date: str = await asyncio.to_thread(get_latest_trading_date)
    recipients = await turso.get_notification_recipients()

    followed = {
        strategy_id
        for user in recipients
        if (user.get("settings") or {}).get("tradeSignals", True)
        for strategy_id in _followed_strategy_ids(user.get("preferences") or {})
    }

    signals_by_strategy: dict[str, list[dict[str, Any]]] = {}
    for strategy_id in sorted(followed):
        # Buy & Hold is a passive benchmark, not a recurring actionable signal. A
        # one-session scan has no persisted portfolio book, so treating each fresh
        # manager as a new entry would emit the same buy every night.
        if strategy_id == "buy-and-hold":
            continue
        try:
            signals_by_strategy[strategy_id] = await asyncio.to_thread(_signals_for_strategy, strategy_id, signal_date)
            print(f"{strategy_id}: {len(signals_by_strategy[strategy_id])} signal(s) on {signal_date}.")
        except Exception as exc:
            # One broken strategy should not stop the other followed strategies from notifying
            print(f"Strategy {strategy_id} failed for {signal_date}: {exc}")
            signals_by_strategy[strategy_id] = []

    # A weekend run reads the same session as Friday, so an unguarded rerun re-sends the same
    # signals. Each user is remembered per session, and only a sent email is remembered.
    digest_state: dict[str, str] = {user_id: date for user_id, date in _load_digest_state().items() if date == signal_date}

    emails_sent: int = 0
    emails_failed: int = 0
    emails_skipped: int = 0
    for user in recipients:
        settings = user.get("settings") or {}
        if not settings.get("tradeSignals", True):
            continue

        already_sent: bool = digest_state.get(_digest_key(user), "") == signal_date
        if already_sent:
            emails_skipped += 1
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
            digest_state[_digest_key(user)] = signal_date
            if emails_sent % DIGEST_STATE_SAVE_EVERY == 0:
                _save_digest_state(digest_state)
        else:
            emails_failed += 1  # left unrecorded, so the next run retries this user
            print(f"Signal digest failed for {receiver}: {error}")

    _save_digest_state(digest_state)

    # One ops report per day: the scheduler fires this job again on weekends, and a
    # second copy of the same numbers would just be noise in the inbox.
    ops_report_sent: int = 0
    if not admin_recipient():
        print("No admin address set; ops report skipped.")
    elif ops_report_sent_today():
        print("Ops report already sent today.")
    else:
        sent, error, report = await send_usage_report()
        if sent:
            ops_report_sent = 1
            print(f"Ops report sent: {format_usage_summary(report)}")
        else:
            print(f"Ops report failed: {error}")

    summary: dict[str, int | str] = {
        "signal_date": signal_date,
        "strategies_run": len(signals_by_strategy),
        "emails_sent": emails_sent,
        "emails_failed": emails_failed,
        "emails_skipped_duplicate": emails_skipped,
        "split_seams": split_audit.flagged if split_audit else 0,
        "split_seams_new": len(split_audit.new) if split_audit else 0,
        "ops_report_sent": ops_report_sent,
    }
    print(f"Daily signal run complete: {summary}")
    return summary


# -------- Digest State --------
# The session each user was last emailed, so the same session is never sent twice.
def _load_digest_state() -> dict[str, str]:
    if not os.path.exists(DIGEST_STATE_FILE):
        return {}
    try:
        with open(DIGEST_STATE_FILE, "r", encoding="utf-8") as handle:
            return {str(key): str(value) for key, value in json.load(handle).items()}
    except (OSError, ValueError, TypeError):
        return {}


# Written in one step, so a crash cannot truncate the record.
def _save_digest_state(state: dict[str, str]) -> None:
    tmp_file: str = DIGEST_STATE_FILE + ".tmp"
    with open(tmp_file, "w", encoding="utf-8") as handle:
        json.dump(state, handle, indent=2, sort_keys=True)
    os.replace(tmp_file, DIGEST_STATE_FILE)


# A recipient key that falls back to the address when a row has no id.
def _digest_key(user: dict[str, Any]) -> str:
    return str(user.get("id") or user.get("email") or "")


# -------- Entry Point --------
# Parse the command line and run the nightly job.
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
