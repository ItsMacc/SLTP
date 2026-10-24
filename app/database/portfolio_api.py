# portfolio_api.py — Setup wizard endpoints (onboarding state + answers).
#
# Reads/writes the Turso portfolios table and mirrors wizard preferences
# into Supabase users.settings. Notification booleans never live in
# portfolios: they are stripped here and managed from the Settings page.

# -------- Imports --------
import json
import os

import requests
from dotenv import load_dotenv
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from typing import Any

from app.auth.auth import get_current_user
from app.database import turso

load_dotenv()

# -------- Configuration --------
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://jqyqfkrzwimxuzugyuiw.supabase.co")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE")

router = APIRouter()

# Keys that belong to Supabase users.settings (notification preferences),
# NOT to portfolios.preferences_json. The runner reads notification
# booleans from settings and strategy info from portfolios.
NOTIFICATION_KEYS = {
    "wantsSignalNotifications",
    "tradeSignals",
    "dailySummary",
    "priceAlerts",
    "securityWarnings",
    "autoTrackSignals",
}


class CompleteSetupIn(BaseModel):
    name: str = Field(description="Display name for the account.")
    starting_cash: float = Field(description="Cash the portfolio starts with, in the base currency.")
    base_currency: str = Field(default="USD", description="Currency every portfolio value is reported in.")
    preferences: dict[str, Any] = Field(default={}, description="Investor preferences collected during setup.")


def _mirror_to_supabase(user_id: str, preferences: dict[str, Any]) -> None:
    """
    Merges the onboarding preferences into Supabase users.settings (best-effort).
    Notification booleans are autoset here: new users get tradeSignals = true
    (the wizard no longer asks), while anyone who has toggled Settings keeps
    their existing choices — existing keys are never overwritten.
    """
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

        # Only mirror non-notification wizard answers into settings.
        # Notification booleans: autoset only when absent.
        wizard_answers = {k: v for k, v in preferences.items() if k not in NOTIFICATION_KEYS}
        autoset = {
            "tradeSignals": True,
            "dailySummary": False,
            "priceAlerts": False,
            "securityWarnings": True,
        }
        autoset = {k: v for k, v in autoset.items() if k not in existing}

        merged = {**existing, **wizard_answers, **autoset}
        requests.patch(
            f"{SUPABASE_URL}/rest/v1/users",
            params={"id": f"eq.{user_id}"},
            headers=headers,
            data=json.dumps({"settings": merged}),
            timeout=10,
        ).raise_for_status()
    except Exception as e:
        print(f"Supabase settings mirror failed for {user_id}: {e}")


def _followed_ids(preferences: dict[str, Any]) -> list[str]:
    """Normalises the wizard's followedStrategies list to plain ids.

    The wizard sends either plain ids or {id, name} objects, so both shapes
    are normalised here. The ids are stored in preferences_json — there is no
    separate strategy_follows table anymore.
    """
    raw = preferences.get("followedStrategies") or []
    wanted: list[str] = []
    for item in raw:
        sid = item.get("id") if isinstance(item, dict) else item
        if isinstance(sid, str) and sid.strip():
            sid = sid.strip()
            if sid not in wanted:
                wanted.append(sid)
    return wanted


@router.get("/api/portfolio/status")
async def portfolio_status(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    """Frontend read: onboarding state + the saved wizard answers."""
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


class SyncSettingsIn(BaseModel):
    settings: dict[str, Any] = Field(description="The user's settings, as stored in Supabase.")


@router.post("/api/user/sync-settings")
async def sync_settings(
    body: SyncSettingsIn,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Mirrors the caller's settings from Supabase into the Turso users table.

    The Settings page writes straight to Supabase, which is the source of truth.
    This endpoint exists so the Turso mirror does not stay stale until the next
    nightly runner pass - anything that reads notification preferences from
    Turso (the runner, the briefing) would otherwise act on yesterday's values.

    The body is the settings to copy, and it wins outright. The Settings page
    re-reads the row from Supabase after updating and sends that back, so it is
    the authoritative post-save state. Merging the server's cached copy on top
    would silently drop the very change the user just made - an earlier version
    of this endpoint did exactly that and discarded a toggled-on notification.
    """
    user_id = user["id"]
    merged = body.settings or {}

    try:
        await turso.mirror_settings(
            user_id, merged, name=user.get("name"), email=user.get("email"),
        )
    except Exception as e:
        # Never fail the user's save because the mirror lagged; Supabase
        # already has the authoritative copy.
        print(f"Settings mirror to Turso failed for {user_id}: {e}")
        return {"mirrored": False, "reason": "turso-unavailable"}

    return {"mirrored": True, "keys": sorted(merged.keys())}


@router.post("/api/portfolio/complete-setup")
async def complete_setup(
    body: CompleteSetupIn,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Frontend write: save the wizard answers + portfolio row."""
    user_id = user["id"]
    # Notification preferences never live in portfolios: they are read from
    # users.settings by the runner and managed from the Settings page.
    prefs = {k: v for k, v in body.preferences.items() if k not in NOTIFICATION_KEYS}

    await turso.upsert_portfolio(
        user_id,
        name=body.name.strip() or "My Portfolio",
        base_currency=body.base_currency,
        starting_cash=body.starting_cash,
        preferences=prefs,
        onboarded=True,
    )

    _mirror_to_supabase(user_id, prefs)
    followed = _followed_ids(prefs)

    return {"onboarded": True, "user_id": user_id, "followed_strategies": followed}
