# -------- usage_report.py --------
# Operator report: the state of the whole user base, mailed to ADMIN_EMAIL.
#
# The app shows each person their own data; nothing shows you the aggregate. This report
# answers what you need before paying for anything: how many people registered, how many
# ever came back, how many finished onboarding, how many are actually building or running
# something, and who left.
#
# Accounts come from Supabase auth, which is the authoritative signup record and exists
# before a person ever opens the app. Usage comes from Turso, which is written on first
# sign-in and again when the setup wizard completes.
#
# USAGE: python -m app.notification.usage_report [--to you@example.com]

# -------- Imports --------
from __future__ import annotations

import os
import json
import asyncio
import argparse
import requests

from typing import Any
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

# Database imports
from app.database.turso import turso

# Notification imports
from app.notification.mailer import admin_recipient, usage_report_email

load_dotenv()

SUPABASE_URL: str = os.environ.get("SUPABASE_URL", "https://jqyqfkrzwimxuzugyuiw.supabase.co").rstrip("/")
SUPABASE_SERVICE_KEY: str | None = os.environ.get("SUPABASE_SERVICE_ROLE")
SUPABASE_PAGE_SIZE: int = 1000
SUPABASE_TIMEOUT: int = 30

# -------- Accounts (Supabase) --------
# Every auth account, one page at a time. Paging matters: per_page caps at 1000 and the
# endpoint silently returns the first page again if the page is never advanced.
def fetch_auth_accounts() -> list[dict[str, Any]]:
    if not SUPABASE_SERVICE_KEY:
        raise RuntimeError("SUPABASE_SERVICE_ROLE is required to read the account list.")

    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    }
    accounts: list[dict[str, Any]] = []
    page: int = 1
    while True:
        response = requests.get(
            f"{SUPABASE_URL}/auth/v1/admin/users",
            params={"page": page, "per_page": SUPABASE_PAGE_SIZE},
            headers=headers,
            timeout=SUPABASE_TIMEOUT,
        )
        response.raise_for_status()
        body = response.json()

        # Newer GoTrue wraps the list; older builds return a bare array
        batch = body.get("users") if isinstance(body, dict) else body
        if not isinstance(batch, list) or not batch:
            break
        accounts.extend(batch)
        if len(batch) < SUPABASE_PAGE_SIZE:
            break
        page += 1
    return accounts


# Count signups by age and accounts by last activity.
def summarize_accounts(accounts: list[dict[str, Any]], now: datetime) -> dict[str, int]:
    week_ago: datetime = now - timedelta(days=7)
    month_ago: datetime = now - timedelta(days=30)

    summary: dict[str, int] = {
        "total": len(accounts),
        "new_7d": 0,
        "new_30d": 0,
        "never_signed_in": 0,
        "active_7d": 0,
        "active_30d": 0,
    }
    for account in accounts:
        created = _parse_time(account.get("created_at"))
        if created is not None:
            if created >= week_ago:
                summary["new_7d"] += 1
            if created >= month_ago:
                summary["new_30d"] += 1

        # last_sign_in_at is null until the person completes a first sign-in
        last_seen = _parse_time(account.get("last_sign_in_at"))
        if last_seen is None:
            summary["never_signed_in"] += 1
            continue
        if last_seen >= week_ago:
            summary["active_7d"] += 1
        if last_seen >= month_ago:
            summary["active_30d"] += 1
    return summary


# -------- Usage (Turso) --------
# The counters behind "is anyone using this". Each read is independent so one absent
# table reports as unknown instead of blanking the rest of the report.
async def collect_usage_counts() -> dict[str, int | None]:
    provisioned = await _count("SELECT COUNT(*) AS n FROM users")
    onboarded = await _count("SELECT COUNT(*) AS n FROM portfolios WHERE onboarded = 1")
    return {
        "provisioned": provisioned,
        "onboarded": onboarded,
        "not_onboarded": provisioned - onboarded if provisioned is not None and onboarded is not None else None,
        "lab_projects": await _count("SELECT COUNT(*) AS n FROM lab_projects"),
        "lab_users": await _count("SELECT COUNT(DISTINCT user_id) AS n FROM lab_projects"),
        "api_keys": await _count("SELECT COUNT(*) AS n FROM api_keys WHERE revoked_at IS NULL"),
    }


# How many users follow each strategy, most followed first.
async def collect_followed_strategies() -> list[tuple[str, int]]:
    try:
        rows = await turso.execute("SELECT preferences_json FROM portfolios")
    except Exception:  # noqa: BLE001 - an unreadable table is not worth failing the report
        return []

    counts: dict[str, int] = {}
    for row in rows:
        try:
            preferences = json.loads(row.get("preferences_json") or "{}")
        except (TypeError, ValueError):
            continue
        for item in preferences.get("followedStrategies") or []:
            strategy_id = item.get("id") if isinstance(item, dict) else item
            if isinstance(strategy_id, str) and strategy_id:
                counts[strategy_id] = counts.get(strategy_id, 0) + 1
    return sorted(counts.items(), key=lambda pair: (-pair[1], pair[0]))


# Deletions from the churn log, with the 30-day count and the most recent rows.
async def collect_deletions(now: datetime) -> dict[str, Any]:
    month_ago: datetime = now - timedelta(days=30)
    rows = await turso.get_account_deletions()

    recent_30d: int = 0
    for row in rows:
        deleted_at = _parse_time(row.get("deleted_at"))
        if deleted_at is not None and deleted_at >= month_ago:
            recent_30d += 1

    return {"total": len(rows), "last_30d": recent_30d, "recent": rows[:10]}


# -------- Assembly --------
# One snapshot of the user base. A failing source degrades to None and adds a note,
# because a partial report beats no report at all.
async def collect_usage_report() -> dict[str, Any]:
    now: datetime = datetime.now(timezone.utc)
    errors: list[str] = []

    accounts: dict[str, int] | None
    try:
        accounts = summarize_accounts(await asyncio.to_thread(fetch_auth_accounts), now)
    except Exception as exc:  # noqa: BLE001
        accounts = None
        errors.append(f"Supabase account list unavailable: {exc}")

    try:
        usage: dict[str, int | None] = await collect_usage_counts()
    except Exception as exc:  # noqa: BLE001
        usage = {}
        errors.append(f"Usage counts unavailable: {exc}")

    try:
        churn: dict[str, Any] = await collect_deletions(now)
    except Exception as exc:  # noqa: BLE001
        churn = {"total": None, "last_30d": None, "recent": []}
        errors.append(f"Churn log unavailable: {exc}")

    return {
        "generated_at": now.strftime("%Y-%m-%d %H:%M UTC"),
        "accounts": accounts,
        "usage": usage,
        "churn": churn,
        "strategies": await collect_followed_strategies(),
        "errors": errors,
    }


# -------- Sending --------
# Mail the report to the operator and record the date it went out. The address is the
# given one, else ADMIN_EMAIL, else the account that sends the mail (see admin_recipient).
async def send_usage_report(receiver: str | None = None) -> tuple[bool, str | None, dict[str, Any]]:
    admin: str = (receiver or admin_recipient() or "").strip()
    if not admin:
        return False, "No admin address: set ADMIN_EMAIL or SENDER_EMAIL", {}

    report: dict[str, Any] = await collect_usage_report()
    sent, error = await asyncio.to_thread(usage_report_email, admin, report)
    if sent:
        await turso.record_ops_report(_today())
    return sent, error, report


# True when today's report already went out, so a repeated nightly run stays quiet.
async def sent_today() -> bool:
    return await turso.ops_report_sent_on(_today())


# One line for the runner log and the CLI.
def format_usage_summary(report: dict[str, Any]) -> str:
    accounts = report.get("accounts") or {}
    usage = report.get("usage") or {}
    churn = report.get("churn") or {}
    return (
        f"accounts={_label(accounts.get('total'))} "
        f"active_7d={_label(accounts.get('active_7d'))} "
        f"onboarded={_label(usage.get('onboarded'))} "
        f"deleted={_label(churn.get('total'))}"
    )


# -------- Helpers --------
# Parse a Supabase ISO timestamp; naive values are treated as UTC.
def _parse_time(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


# Run one COUNT and return it as an int, or None when the table cannot be read.
async def _count(sql: str) -> int | None:
    try:
        rows = await turso.execute(sql)
    except Exception:  # noqa: BLE001
        return None
    if not rows:
        return 0

    # Turso sends integers as strings, so both forms have to be accepted here
    value = rows[0].get("n")
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str) and value.strip():
        try:
            return int(value)
        except ValueError:
            return None
    return None


# "n/a" when a number could not be read, so a gap never looks like zero.
def _label(value: Any) -> str:
    return "n/a" if value is None else f"{value:,}" if isinstance(value, int) else str(value)


# The UTC date of the last report that sent.
def _today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


# -------- Entry Point --------
# Send the report on demand and print the same summary the nightly run logs.
async def _main() -> None:
    parser = argparse.ArgumentParser(description="Email the operator a summary of the user base.")
    parser.add_argument("--to", default=None, help="Override ADMIN_EMAIL for this one report.")
    args = parser.parse_args()

    try:
        sent, error, report = await send_usage_report(args.to)
    finally:
        await turso.close()

    if not sent:
        print(f"Ops report not sent: {error}")
        raise SystemExit(1)
    print(f"Ops report sent: {format_usage_summary(report)}")
    for line in report.get("errors") or []:
        print(f"WARNING {line}")


if __name__ == "__main__":
    asyncio.run(_main())
