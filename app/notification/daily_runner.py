# daily_runner.py — The nightly pipeline, run after market close.
#
# Sequence:
#   1. Update the parquet market data (yfinance -> master parquet).
#   2. Refresh the Turso users cache from Supabase.
#   3. Determine the latest trading date from liquid reference tickers.
#   4. For each followed strategy (across ALL users), run it over its
#      universe at that date and collect signals. Strategies are run once
#      per day and shared by every user that follows them.
#   5. Per user: send ONE signals digest email with all of today's signals
#      (only if they want notifications AND there is at least one signal).
#
# Notification booleans come from users.settings (Supabase mirror);
# followed strategies come from portfolios.preferences_json.

# -------- Imports --------
import asyncio
import traceback
from datetime import datetime, timezone

from app.database import turso
from app.database.db import insert_or_update_data
from app.engine.utils.StrategyDecision import Signal
from app.notification.email import (
    send_notification_email,
    signals_digest_email,
)

# -------- Configuration --------
# Liquid cross-market tickers used to anchor "the latest trading date" —
# a single stale ticker can't misdate the whole run (majority vote).
REFERENCE_TICKERS = ["SPY", "QQQ", "XEQT.TO"]

# Lazy-loaded strategy registry: the same app.strategies.REGISTRY the API
# serves from, imported on first use so FastAPI is never pulled in at runner
# startup.
# -------- Step 1: User Cache --------
def _strategy_registry() -> dict[str, tuple[type, str]]:
    from app.strategies import REGISTRY

    return REGISTRY


# -------- Step 1: Market Data --------

async def refresh_user_cache_from_supabase(limit: int = 500) -> int:
    """
    Pulls all user profiles from Supabase and refreshes the users table,
    so the runner always has current emails + settings.
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


# -------- Step 2: Latest Trading Date --------

def _latest_trading_date() -> str | None:
    """Latest trading date via majority vote across liquid reference tickers."""
    from app.database.fetch import get_stock_history

    candidates: list[str] = []
    for ticker in REFERENCE_TICKERS:
        try:
            history = get_stock_history(ticker)
            if len(history.dates) > 0:
                candidates.append(str(history.dates[-1]))
        except Exception:
            continue
    if not candidates:
        return None
    return max(set(candidates), key=candidates.count)


# -------- Step 3: Strategy Signals --------

def _initialize_universe_at(strategy, latest_date: str) -> str | None:
    """
    Initializes the strategy universe anchored at latest_date, walking
    BACKWARD day by day (the runner anchors at the newest bar, unlike the
    backtester which walks forward from a past date). Returns the date that
    succeeded, or None.
    """
    from datetime import datetime, timedelta

    current = datetime.strptime(latest_date, "%Y-%m-%d")
    for _ in range(14):  # ~2 weeks of holidays tolerance
        date_str = current.strftime("%Y-%m-%d")
        try:
            if strategy.manager.initialize_universe(date_str):
                return date_str
        except Exception as e:
            print(f"  [signals] universe init failed at {date_str}: {e}")
        current -= timedelta(days=1)
    return None


def _run_strategy_signals(strategy_id: str, latest_date: str) -> list[dict]:
    """
    Runs one strategy over its universe at latest_date and returns today's
    actionable signals:
      [{strategy, ticker, signal_type, price, confidence, stop_loss, take_profit}]
    Returned in memory only — nothing is persisted (no signals table).
    """
    registry = _strategy_registry()
    if strategy_id not in registry:
        print(f"  [signals] unknown strategy '{strategy_id}' — skipping")
        return []

    strategy_cls, _ = registry[strategy_id]
    strategy = strategy_cls()

    anchor = _initialize_universe_at(strategy, latest_date)
    if anchor is None or anchor != latest_date:
        print(f"  [signals] {strategy_id}: could not initialize universe at {latest_date} — skipping")
        return []

    from app.database.fetch import get_stock_history
    from app.engine.utils.StockData import StockData

    collected: list[dict] = []
    sliced = StockData("", [], [], [], [], [], [])

    for ticker in list(strategy.manager.tickers):
        try:
            history = get_stock_history(ticker)
        except Exception:
            continue

        dates = history.dates
        if len(dates) == 0 or dates[-1] != latest_date:
            continue  # stale ticker for this session

        # Slice history strictly up to the latest date (no lookahead)
        sliced.ticker = ticker
        sliced.dates = dates
        sliced.open_price = history.open_price
        sliced.high = history.high
        sliced.low = history.low
        sliced.close_price = history.close_price
        sliced.volume = history.volume

        try:
            decision = strategy.generate_signal(ticker, sliced)
        except ValueError:
            continue  # not enough bars for this ticker
        except Exception as e:
            print(f"  [signals] {strategy_id}/{ticker}: generate_signal failed: {e}")
            continue

        if decision is None or decision.signal not in (Signal.LONG, Signal.SHORT):
            continue

        # Route through the manager to compute direction-aware risk levels
        stop_loss = None
        take_profit = None
        try:
            trade_record = strategy.manager.on_signal(ticker, decision)
            if trade_record is not None:
                stop_loss = trade_record.stop_loss
                take_profit = trade_record.take_profit
        except Exception as e:
            print(f"  [signals] {strategy_id}/{ticker}: on_signal failed: {e}")

        sig = {
            "strategy_id": strategy_id,
            "strategy": strategy.name,
            "ticker": ticker,
            "signal_type": decision.signal.value,
            "price": decision.metrics.get("close_price"),
            "confidence": decision.confidence,
            "stop_loss": stop_loss,
            "take_profit": take_profit,
            "signal_date": latest_date,
        }

        collected.append(sig)

    return collected


async def _run_all_strategies(strategy_ids: set[str], latest_date: str) -> dict[str, list[dict]]:
    """
    Runs every distinct followed strategy once and returns:
      {strategy_id: [signal, ...]}
    Strategies are shared across users — one run serves everyone following it.
    Signals live in memory for this run only; nothing is written to Turso.
    """
    results: dict[str, list[dict]] = {}
    for strategy_id in sorted(strategy_ids):
        try:
            collected = await asyncio.to_thread(
                _run_strategy_signals, strategy_id, latest_date,
            )
        except Exception:
            print(f"  [signals] strategy '{strategy_id}' failed:")
            traceback.print_exc()
            results[strategy_id] = []
            continue

        results[strategy_id] = collected
    return results


# -------- Step 4: User Notification --------

async def _followed_ids_for(user_id: str, portfolio: dict | None) -> list[str]:
    """Strategy IDs a user follows, read from portfolios.preferences_json."""
    if not portfolio:
        return []

    raw = (portfolio.get("preferences") or {}).get("followedStrategies") or []
    return [
        s.get("id") if isinstance(s, dict) else s
        for s in raw
        if (s.get("id") if isinstance(s, dict) else s)
    ]


def _wants(settings: dict, key: str) -> bool:
    """Reads a notification boolean from users.settings with safe defaults."""
    value = settings.get(key)
    if value is None:
        return key in ("tradeSignals", "securityWarnings")  # sensible defaults
    return bool(value)


async def _notify_users(latest_date: str, signals_by_strategy: dict[str, list[dict]]) -> dict:
    """
    Sends per-user emails:
      - ONE signals digest with ALL of today's signals (if tradeSignals on
        and at least one signal exists for their followed strategies)
    """
    users = await turso.get_all_users()
    emails_sent = 0

    for u in users:
        user_id = u.get("id")
        email = u.get("email")
        name = u.get("name") or (email.split("@")[0] if email else "there")
        settings = u.get("settings") or {}
        if not email or not user_id:
            continue

        try:
            portfolio = await turso.get_portfolio(user_id)
        except Exception as e:
            print(f"  [notify] portfolio read failed for {user_id}: {e}")
            portfolio = None

        followed_ids: list[str] = []
        if portfolio and portfolio.get("onboarded"):
            followed_ids = await _followed_ids_for(user_id, portfolio)

        # --- Signals digest: one email, all strategies ---
        if followed_ids and _wants(settings, "tradeSignals"):
            user_signals = [
                sig
                for sid in followed_ids
                for sig in signals_by_strategy.get(sid, [])
            ]
            if user_signals:
                try:
                    ok, err = signals_digest_email(email, name, user_signals, latest_date)
                    if ok:
                        emails_sent += 1
                    elif err:
                        print(f"  [notify] digest to {email} skipped: {err}")
                except Exception as e:
                    print(f"  [notify] digest to {email} failed: {e}")
        # No signals -> no email (by design)

    return {"users_seen": len(users), "emails_sent": emails_sent}


# -------- Full Run --------

async def run() -> dict:
    """Full daily run: data -> cache -> strategies -> notifications."""
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

    latest_date = await asyncio.to_thread(_latest_trading_date)
    if latest_date is None:
        print("[signals] No market data available — aborting signal generation.")
        await turso.close()
        return {"refreshed": refreshed, "signals": {}, "notify": {}}
    print(f"[signals] latest trading date: {latest_date}")

    # Which strategies does anyone actually follow? Read from each user's
    # onboarding answers (portfolios.preferences_json).
    followed: set[str] = set()
    users = await turso.get_all_users()
    for u in users:
        try:
            portfolio = await turso.get_portfolio(u["id"])
        except Exception:
            continue
        if not portfolio or not portfolio.get("onboarded"):
            continue
        for s in (portfolio.get("preferences") or {}).get("followedStrategies") or []:
            sid = s.get("id") if isinstance(s, dict) else s
            if sid:
                followed.add(sid)
    print(f"[signals] strategies in play: {sorted(followed) or 'none'}")

    signals_by_strategy: dict[str, list[dict]] = {}
    if followed:
        signals_by_strategy = await _run_all_strategies(followed, latest_date)
        total = sum(len(v) for v in signals_by_strategy.values())
        print(f"[signals] generated {total} new signal(s) today")

    notify = await _notify_users(latest_date, signals_by_strategy)
    print(f"[notify] {notify}")

    await turso.close()
    elapsed = (datetime.now(timezone.utc) - started).total_seconds()
    print(f"=== done in {elapsed:.1f}s ===")
    return {"refreshed": refreshed, "signals": signals_by_strategy, "notify": notify}


if __name__ == "__main__":
    asyncio.run(run())
