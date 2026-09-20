import json
import os
from datetime import datetime, timedelta

import requests
from dotenv import load_dotenv
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Any

from app.auth import get_current_user
from app.database import turso
from app.strategies.base import Strategy
from app.strategies.stock_health_filter import StockHealthFilterStrategy
from app.portfolio.portfolio_manager import REBALANCE_SETTINGS, RebalanceFrequency

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://jqyqfkrzwimxuzugyuiw.supabase.co")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE")

router = APIRouter()

# strategy_id -> (strategy factory, rebalance frequency)
FOLLOWABLE_STRATEGIES: dict[str, tuple[type[Strategy], RebalanceFrequency]] = {
    "stock-health-filter": (StockHealthFilterStrategy, RebalanceFrequency.QUARTERLY),
}


def _init_universe_from(strategy: Strategy, start_date: str, max_attempts: int = 60) -> str | None:
    """Same pattern as the Backtester: walk forward day-by-day until the
    manager finds enough data to build its universe. Returns the date it
    succeeded on, or None."""
    current = datetime.strptime(start_date, "%Y-%m-%d")
    for _ in range(max_attempts):
        date_str = current.strftime("%Y-%m-%d")
        if strategy.manager.initialize_universe(date_str):
            return date_str
        current += timedelta(days=1)
    return None


class CompleteSetupIn(BaseModel):
    name: str
    starting_cash: float
    base_currency: str = "USD"
    preferences: dict[str, Any] = {}


def _mirror_to_supabase(user_id: str, preferences: dict[str, Any]) -> None:
    """Merges the onboarding preferences into Supabase users.settings (best-effort)."""
    if not SUPABASE_SERVICE_KEY:
        return
    try:
        headers = {
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/users",
            params={"select": "settings", "id": f"eq.{user_id}"},
            headers=headers,
            timeout=10,
        )
        existing = {}
        rows = resp.json() if resp.ok else []
        if rows and isinstance(rows[0].get("settings"), dict):
            existing = rows[0]["settings"]

        merged = {**existing, **preferences}
        requests.patch(
            f"{SUPABASE_URL}/rest/v1/users",
            params={"id": f"eq.{user_id}"},
            headers=headers,
            data=json.dumps({"settings": merged}),
            timeout=10,
        ).raise_for_status()
    except Exception as e:
        print(f"Supabase settings mirror failed for {user_id}: {e}")


@router.get("/api/portfolio/status")
async def portfolio_status(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    """Frontend read: portfolio summary + onboarding state."""
    pf = await turso.get_portfolio(user["id"])
    if not pf:
        return {"id": None, "onboarded": False, "name": "My Portfolio",
                "base_currency": "USD", "starting_cash": 0, "preferences": {}}
    return {
        "id": pf.get("id"),
        "onboarded": bool(pf.get("onboarded")),
        "name": pf.get("name", "My Portfolio"),
        "base_currency": pf.get("base_currency", "USD"),
        "starting_cash": pf.get("starting_cash", 0),
        "preferences": pf.get("preferences", {}),
    }


@router.post("/api/portfolio/complete-setup")
async def complete_setup(
    body: CompleteSetupIn,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Frontend write: save the wizard answers, portfolio row, and followed strategies."""
    user_id = user["id"]
    prefs = {**body.preferences}

    await turso.upsert_portfolio(
        user_id,
        name=body.name.strip() or "My Portfolio",
        base_currency=body.base_currency,
        starting_cash=body.starting_cash,
        preferences=prefs,
        onboarded=True,
    )

    # Tickers the user custom-added before onboarding finished: these go into
    # every strategy's watchlist regardless of what each universe computes.
    custom_tickers = await turso.watchlist_tickers(user_id)

    for s in prefs.get("followedStrategies", []):
        sid = s.get("id") if isinstance(s, dict) else s
        sname = s.get("name", "") if isinstance(s, dict) else ""
        if not sid:
            continue

        entry = FOLLOWABLE_STRATEGIES.get(sid)
        if entry is None:
            print(f"Ignoring non-followable strategy '{sid}' for user {user_id}")
            await turso.unfollow_strategy(user_id, sid)
            continue

        strategy_cls, rebalance_frequency = entry
        await turso.follow_strategy(user_id, sid, sname, notify_email=True)

        # Initialize this strategy's own universe with today's date.
        # Best-effort: onboarding must not fail if data isn't ready.
        today = datetime.now().strftime("%Y-%m-%d")
        try:
            strategy = strategy_cls()
            init_date = _init_universe_from(strategy, today)
            if init_date is None:
                print(f"Universe init for '{sid}' failed from {today} — no snapshot saved")
                continue

            # Save the strategy's OWN tickers (kept separate per strategy so
            # strategy A's universe never collides with strategy B's).
            next_rebalance = (datetime.strptime(init_date, "%Y-%m-%d")
                              + REBALANCE_SETTINGS[rebalance_frequency]).strftime("%Y-%m-%d")
            await turso.upsert_strategy_universe(
                user_id, sid, list(strategy.manager.tickers),
                initialized_date=init_date,
                rebalance_frequency=rebalance_frequency.value,
                next_rebalance_date=next_rebalance,
            )

            # Merge strategy universe + user-custom tickers into the watchlist.
            for ticker in list(strategy.manager.tickers) + custom_tickers:
                await turso.add_watchlist_item(user_id, ticker,
                                               note=f"{sid} universe @ {init_date}")
        except Exception as e:
            print(f"Universe init failed for user {user_id} / strategy '{sid}': {e}")

    _mirror_to_supabase(user_id, prefs)

    return {"onboarded": True, "user_id": user_id}


@router.get("/api/portfolio/watchlist")
async def get_watchlist(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    """Frontend read: the user's watchlist tickers + followed strategies."""
    user_id = user["id"]
    return {
        "watchlist": await turso.list_watchlist(user_id),
        "followed_strategies": await turso.list_follows(user_id),
    }


@router.post("/api/portfolio/watchlist/{ticker}")
async def add_ticker(ticker: str, user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    """Frontend write: add a ticker to the watchlist."""
    item = await turso.add_watchlist_item(user["id"], ticker)
    return {"added": True, **item}


@router.delete("/api/portfolio/watchlist/{ticker}")
async def delete_ticker(ticker: str, user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    """Frontend write: remove a ticker from the watchlist."""
    await turso.remove_watchlist_item(user["id"], ticker)
    return {"removed": True, "ticker": ticker.upper()}


@router.get("/api/portfolio/signals")
async def list_signals(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    """Frontend read: latest signals from followed strategies."""
    return {"signals": await turso.get_signals(user["id"])}
