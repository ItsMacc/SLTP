# daily_runner.py — Runs selected strategies over each user's watchlist
import asyncio
import json
import traceback
from datetime import datetime, timezone
from app.database import turso
from app.strategies.buy_and_hold import BuyAndHold
from app.strategies.stock_health_filter import StockHealthFilterStrategy
from app.notification.email import send_notification_email

# Strategies that must never be run by the daily job
BLOCKED_STRATEGIES = {"buy and hold", "buy-and-hold", "buy_and_hold"}

# Registry of runnable strategies: strategy_id -> factory
STRATEGY_REGISTRY: dict[str, type] = {
    "stock-health-filter": StockHealthFilterStrategy,
}


async def refresh_user_cache_from_supabase(limit: int = 500) -> int:
    """
    Pulls all user profiles from Supabase and refreshes the Turso users_cache,
    so the runner always has current emails + notification settings.
    Returns the number of users refreshed.
    """
    import requests
    import os

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE")
    if not url or not key:
        print("  [cache] SUPABASE_URL / SUPABASE_SERVICE_ROLE not set — skipping refresh")
        return 0

    try:
        resp = requests.get(
            f"{url}/rest/v1/users",
            params={"select": "id,name,email,settings", "limit": limit},
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
            timeout=15,
        )
        resp.raise_for_status()
        users = resp.json()
    except Exception as e:
        print(f"  [cache] Supabase refresh failed: {e}")
        return 0

    for u in users:
        try:
            await turso.upsert_user(u["id"], u.get("name"), u.get("email"), u.get("settings"))
        except Exception as e:
            print(f"  [cache] Failed to cache user {u.get('id')}: {e}")
    return len(users)


async def run_for_user(user: dict) -> dict:
    """Runs all of one user's selected strategies over their watchlist."""
    user_id = user["id"]
    name = user.get("name") or "there"
    email = user.get("email")
    stats = {"signals": 0, "notified": 0, "errors": 0}

    tickers = await turso.watchlist_tickers(user_id)
    follows = await turso.list_follows(user_id)

    if not tickers or not follows:
        return stats  # nothing to do for this user

    for follow in follows:
        strategy_id = follow["strategy_id"]
        strategy_name = follow.get("strategy_name") or strategy_id

        if strategy_id.lower() in BLOCKED_STRATEGIES:
            continue
        factory = STRATEGY_REGISTRY.get(strategy_id)
        if factory is None:
            print(f"  [{user_id}] Unknown strategy '{strategy_id}' — skipping")
            continue

        try:
            strategy = factory()
            # Auto-load the user's watchlist into the strategy's manager
            strategy.add_tickers(tickers)
        except Exception:
            print(f"  [{user_id}] Failed to load data for {strategy_name}:")
            traceback.print_exc()
            stats["errors"] += 1
            continue

        for ticker in tickers:
            try:
                history = strategy.manager.histories.get(ticker)
                if history is None or len(history.close_price) < strategy.MIN_BARS_REQUIRED:
                    continue

                decision = strategy.generate_signal(ticker, history)
                price = decision.metrics.get("close_price")
                today = datetime.now(timezone.utc).date().isoformat()

                await turso.insert_signal(
                    strategy_id=strategy_id,
                    ticker=ticker,
                    signal_type=decision.signal,
                    confidence=decision.confidence,
                    price=price,
                    signal_date=today,
                    metrics=decision.metrics,
                )
                stats["signals"] += 1

                # Only actionable signals notify, and only if the user allows emails
                if decision.signal.upper() == "HOLD" or not follow.get("notify_email"):
                    continue
                if not email:
                    continue

                notif_id = await turso.queue_notification(
                    user_id=user_id,
                    kind="trade_signal",
                    title=f"{decision.signal} {ticker} — {strategy_name}",
                    body=f"{strategy_name} generated a {decision.signal} for {ticker}",
                    payload={
                        "strategy_name": strategy_name,
                        "ticker": ticker,
                        "signal_type": decision.signal,
                        "price": price,
                        "confidence": decision.confidence,
                        "note": (decision.meta_data or {}).get("note"),
                        "stop_loss": decision.metrics.get("stop_loss"),
                        "take_profit": decision.metrics.get("take_profit"),
                    },
                )
                if notif_id:
                    stats["notified"] += 1

            except Exception:
                print(f"  [{user_id}] {strategy_name} / {ticker} failed:")
                traceback.print_exc()
                stats["errors"] += 1

    return stats


async def drain_outbox() -> tuple[int, int]:
    """Sends all pending notifications through the templated emails."""
    rows = await turso.pending_notifications()
    sent = failed = 0
    for row in rows:
        user = await turso.get_user(row["user_id"])
        email = (user or {}).get("email")
        if not email:
            await turso.mark_notification_failed(row["id"], "no recipient email in users_cache")
            failed += 1
            continue

        try:
            payload = json.loads(row.get("payload_json") or "{}")
        except (TypeError, ValueError):
            payload = {}

        ok, err = send_notification_email(
            row["kind"], email, user.get("name") or "there", payload
        )
        if ok:
            await turso.mark_notification_sent(row["id"])
            sent += 1
        else:
            await turso.mark_notification_failed(row["id"], err or "unknown error")
            failed += 1
    return sent, failed


async def run() -> dict:
    """Full daily run: refresh cache -> run strategies -> send emails."""
    started = datetime.now(timezone.utc)
    print(f"=== SLTP daily runner — {started.isoformat()} ===")

    refreshed = await refresh_user_cache_from_supabase()
    print(f"[cache] refreshed {refreshed} user(s) from Supabase")

    users = await turso.get_all_users()
    print(f"[run] processing {len(users)} user(s)")

    totals = {"signals": 0, "notified": 0, "errors": 0}
    for user in users:
        try:
            stats = await run_for_user(user)
            totals["signals"] += stats["signals"]
            totals["notified"] += stats["notified"]
            totals["errors"] += stats["errors"]
            print(f"[run] {user.get('email') or user['id']}: {stats}")
        except Exception:
            print(f"[run] user {user.get('id')} failed hard:")
            traceback.print_exc()
            totals["errors"] += 1

    sent, failed = await drain_outbox()
    print(f"[outbox] sent {sent}, failed {failed}")

    await turso.close()
    elapsed = (datetime.now(timezone.utc) - started).total_seconds()
    print(f"=== done in {elapsed:.1f}s | signals {totals['signals']}, "
          f"queued {totals['notified']}, errors {totals['errors']} ===")
    return totals


if __name__ == "__main__":
    asyncio.run(run())
