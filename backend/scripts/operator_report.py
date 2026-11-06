#!/usr/bin/env python3
# operator_report.py — the daily operator brief.
#
# Answers, every morning: how many people signed up, how many ever came back,
# how many finished onboarding, how many are building anything, and who left.
#
# Accounts come from Supabase auth, the authoritative signup record, which
# exists before a person ever opens the app. Usage comes from the app tables,
# written on first sign-in and again when the setup wizard completes.
#
# USAGE (from backend/):
#   ../.venv/bin/python scripts/operator_report.py          print today's brief
#   ../.venv/bin/python scripts/operator_report.py --send   mail it to the operator
#   ../.venv/bin/python scripts/operator_report.py --send --force   ignore the already-sent marker
#
# The sent marker lives in ~/.sltp/operator_report_sent (one date per line
# concept: a single ISO date). A rerun on the same day stays quiet unless
# --force is passed.

# -------- Imports --------
import argparse
import sys

from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_TIMEOUT, service_headers
from app.notify.mailer import admin_recipient, ops_report_email
from app.users import store

SUPABASE_PAGE_SIZE: int = 1000
SENT_MARKER: Path = Path.home() / ".sltp" / "operator_report_sent"


# -------- Accounts (Supabase auth) --------
# Every auth account, one page at a time. Paging matters: per_page caps at
# 1000 and the endpoint silently returns the first page again if never advanced.
def fetch_auth_accounts() -> list[dict[str, Any]]:
    if not SUPABASE_SERVICE_KEY:
        raise RuntimeError("SUPABASE_SERVICE_ROLE is required to read the account list.")

    headers = service_headers()
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


# Parse an ISO timestamp, tolerating the formats GoTrue emits.
def _parse_time(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


# Count signups by age and accounts by last activity.
def summarize_accounts(accounts: list[dict[str, Any]], now: datetime) -> dict[str, int]:
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

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


# -------- Report assembly --------
# How many users follow each strategy, most followed first.
def followed_strategies() -> list[tuple[str, int]]:
    counts: dict[str, int] = {}
    for preferences in store.all_portfolio_preferences():
        if not isinstance(preferences, dict):
            continue
        for item in preferences.get("followedStrategies") or []:
            strategy_id = item.get("id") if isinstance(item, dict) else item
            if isinstance(strategy_id, str) and strategy_id:
                counts[strategy_id] = counts.get(strategy_id, 0) + 1
    return sorted(counts.items(), key=lambda pair: (-pair[1], pair[0]))


# Deletions from the churn log, with the 30-day count.
def deletion_summary(now: datetime) -> dict[str, Any]:
    month_ago = now - timedelta(days=30)
    rows = store.list_account_deletions()
    recent = 0
    for row in rows:
        if _parse_time(row.get("deleted_at")) is not None and _parse_time(row.get("deleted_at")) >= month_ago:
            recent += 1
    return {"total": len(rows), "recent_30d": recent}


def build_report() -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    accounts = fetch_auth_accounts()
    return {
        "date": now.date().isoformat(),
        "accounts": summarize_accounts(accounts, now),
        "usage": store.usage_counts(),
        "deletions": deletion_summary(now),
        "followed_strategies": followed_strategies(),
    }


# -------- Presentation --------
def format_text(report: dict[str, Any]) -> str:
    accounts = report.get("accounts", {})
    usage = report.get("usage", {})
    deletions = report.get("deletions", {})

    def val(v: Any) -> str:
        return str(v) if v is not None else "unknown (table missing?)"

    lines = [
        f"SLTP operator brief — {report.get('date')}",
        "",
        "Accounts (Supabase auth)",
        f"  total:            {val(accounts.get('total'))}",
        f"  new in 7 days:    {val(accounts.get('new_7d'))}",
        f"  new in 30 days:   {val(accounts.get('new_30d'))}",
        f"  never signed in:  {val(accounts.get('never_signed_in'))}",
        f"  active in 7 days: {val(accounts.get('active_7d'))}",
        f"  active in 30 days:{val(accounts.get('active_30d'))}",
        "",
        "Usage (app tables)",
        f"  profiles:         {val(usage.get('profiles'))}",
        f"  onboarded:        {val(usage.get('onboarded'))}",
        f"  active API keys:  {val(usage.get('api_keys'))}",
        f"  deletions logged: {val(usage.get('deletions'))}",
        "",
        "Churn",
        f"  deleted in 30d:   {val(deletions.get('recent_30d'))}",
        f"  total deleted:    {val(deletions.get('total'))}",
    ]
    followed = report.get("followed_strategies") or []
    if followed:
        lines += ["", "Followed strategies"]
        lines += [f"  {sid}: {n}" for sid, n in followed]
    return "\n".join(lines)


# -------- Already-sent marker --------
def already_sent_today(date_str: str) -> bool:
    try:
        return SENT_MARKER.read_text(encoding="utf-8").strip() == date_str
    except OSError:
        return False


def mark_sent(date_str: str) -> None:
    SENT_MARKER.parent.mkdir(parents=True, exist_ok=True)
    SENT_MARKER.write_text(date_str + "\n", encoding="utf-8")


# -------- CLI --------
def main() -> int:
    parser = argparse.ArgumentParser(description="Print or mail the daily SLTP operator brief.")
    parser.add_argument("--send", action="store_true", help="mail the brief to the operator address")
    parser.add_argument("--force", action="store_true", help="send even if today's brief already went out")
    args = parser.parse_args()

    report = build_report()
    print(format_text(report))

    if not args.send:
        return 0

    if already_sent_today(report["date"]) and not args.force:
        print(f"Today's brief already went out; pass --force to resend.")
        return 0

    to = admin_recipient()
    if not to:
        print("No operator address: set ADMIN_EMAIL or SENDER_EMAIL in .env")
        return 1
    ok, err = ops_report_email(to, report)
    if not ok:
        print(f"Send FAILED: {err}")
        return 1
    mark_sent(report["date"])
    print(f"Mailed to {to}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
