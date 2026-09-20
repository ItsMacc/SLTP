import asyncio
import traceback
from datetime import datetime, timezone
from dateutil.relativedelta import relativedelta
from app.database import turso
from app.portfolio.portfolio_manager import REBALANCE_SETTINGS, RebalanceFrequency
from app.strategies.stock_health_filter import StockHealthFilterStrategy
from app.database.db import insert_or_update_data

# Registry of runnable strategies: strategy_id -> factory
STRATEGY_REGISTRY: dict[str, type] = {
    "stock-health-filter": StockHealthFilterStrategy,
}


async def refresh_user_cache_from_supabase(limit: int = 500) -> int:
    """
    Pulls all user profiles from Supabase and refreshes the users table,
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


def _next_rebalance_date(from_date: str, frequency: str) -> str:
    """Same schedule math as the backtester's REBALANCE_SETTINGS."""
    delta = REBALANCE_SETTINGS.get(RebalanceFrequency(frequency))
    base = datetime.strptime(from_date, "%Y-%m-%d")
    return (base + delta).strftime("%Y-%m-%d") if delta else None


async def _maybe_rebalance(user_id: str, follow: dict, today: str, stats: dict) -> None:
    """Checks if a followed strategy's rebalance is due; if so, re-runs its
    rebalance logic over its own universe and persists the new state."""
    strategy_id = follow["strategy_id"]
    universe = await turso.get_strategy_universe(user_id, strategy_id)
    if not universe:
        return  # never initialized — nothing to rebalance

    # Not due yet
    if not universe.get("next_rebalance_date") or today < universe["next_rebalance_date"]:
        return

    factory = STRATEGY_REGISTRY.get(strategy_id)
    if factory is None:
        return

    try:
        strategy = factory()
        # Rebuild the manager from the strategy's own saved universe, then rebalance
        strategy.manager.tickers = list(universe["tickers"])
        strategy.manager.add_tickers(strategy.manager.tickers)
        strategy.manager.on_rebalance(today)

        next_date = _next_rebalance_date(today, universe["rebalance_frequency"])
        await turso.replace_strategy_universe_tickers(user_id, strategy_id,
                                                     list(strategy.manager.tickers))
        await turso.mark_strategy_rebalanced(user_id, strategy_id, today, next_date)
        stats["rebalances"] = stats.get("rebalances", 0) + 1
        print(f"  [{user_id}] {strategy_id} rebalanced on {today} -> next {next_date}")
    except Exception:
        print(f"  [{user_id}] rebalance failed for {strategy_id}:")
        traceback.print_exc()
        stats["errors"] += 1


async def run_for_user(user: dict) -> dict:
    """Runs all of one user's selected strategies over their watchlist."""
    user_id = user["id"]
    stats = {"signals": 0, "rebalances": 0, "errors": 0}
    today = datetime.now(timezone.utc).date().isoformat()

    tickers = await turso.watchlist_tickers(user_id)
    follows = await turso.list_follows(user_id)

    if not follows:
        return stats  # nothing to do for this user

    for follow in follows:
        strategy_id = follow["strategy_id"]
        strategy_name = follow.get("strategy_name") or strategy_id

        # Rebalance check — runs at most once per strategy per day
        await _maybe_rebalance(user_id, follow, today, stats)

        factory = STRATEGY_REGISTRY.get(strategy_id)
        if factory is None:
            print(f"  [{user_id}] Unknown strategy '{strategy_id}' — skipping")
            continue

        # Refresh tickers in case the rebalance just changed the universe
        tickers = await turso.watchlist_tickers(user_id)
        if not tickers:
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

                await turso.insert_signal(
                    strategy_id=strategy_id,
                    ticker=ticker,
                    signal_type=decision.signal,
                    confidence=decision.confidence,
                    price=price,
                    signal_date=today,
                )
                stats["signals"] += 1

            except Exception:
                print(f"  [{user_id}] {strategy_name} / {ticker} failed:")
                traceback.print_exc()
                stats["errors"] += 1

    return stats


async def run() -> dict:
    """Full daily run: refresh cache -> run strategies."""
    started = datetime.now(timezone.utc)
    print(f"=== SLTP daily runner — {started.isoformat()} ===")

    print("[data] Updating daily market bars in Parquet...")
    try:
        await asyncio.to_thread(insert_or_update_data)
        print("[data] Parquet update complete.")
    except Exception as e:
        print(f"[data] Failed to update Parquet file: {e}")

    refreshed = await refresh_user_cache_from_supabase()
    print(f"[cache] refreshed {refreshed} user(s) from Supabase")

    users = await turso.get_all_users()
    print(f"[run] processing {len(users)} user(s)")

    totals = {"signals": 0, "rebalances": 0, "errors": 0}
    for user in users:
        try:
            stats = await run_for_user(user)
            totals["signals"] += stats["signals"]
            totals["rebalances"] += stats.get("rebalances", 0)
            totals["errors"] += stats["errors"]
            print(f"[run] {user.get('email') or user['id']}: {stats}")
        except Exception:
            print(f"[run] user {user.get('id')} failed hard:")
            traceback.print_exc()
            totals["errors"] += 1

    await turso.close()
    elapsed = (datetime.now(timezone.utc) - started).total_seconds()
    print(f"=== done in {elapsed:.1f}s | signals {totals['signals']}, errors {totals['errors']} ===")
    return totals


if __name__ == "__main__":
    asyncio.run(run())
