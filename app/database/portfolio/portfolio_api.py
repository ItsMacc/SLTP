# -------- portfolio_api.py --------
# Setup wizard endpoints (onboarding state and answers).
#
# Reads and writes the Turso portfolios table and mirrors wizard preferences into
# Supabase users.settings. Notification booleans never live in portfolios: they are
# stripped here and managed from the Settings page.

# -------- Imports --------
import os
import json
import requests

from typing import Any
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends

# Auth imports
from app.auth.auth import get_current_user

# Database imports
from app.database.turso import turso

load_dotenv()


# -------- Configuration --------
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://jqyqfkrzwimxuzugyuiw.supabase.co")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE")

router = APIRouter()

# Keys that belong to Supabase users.settings (notification preferences), NOT to
# portfolios.preferences_json. The runner reads notification booleans from settings
# and strategy info from portfolios.
NOTIFICATION_KEYS = {
    "wantsSignalNotifications",
    "tradeSignals",
    "dailySummary",
    "priceAlerts",
    "securityWarnings",
    "autoTrackSignals",
}


# -------- Request Bodies --------
class CompleteSetupIn(BaseModel):
    name: str = Field(description="Display name for the account.")
    starting_cash: float = Field(description="Cash the portfolio starts with, in the base currency.")
    base_currency: str = Field(default="USD", description="Currency every portfolio value is reported in.")
    preferences: dict[str, Any] = Field(default={}, description="Investor preferences collected during setup.")


class SyncSettingsIn(BaseModel):
    settings: dict[str, Any] = Field(description="The user's settings, as stored in Supabase.")


# -------- Helpers --------
# Merge the onboarding preferences into Supabase users.settings, best-effort.
def _mirror_to_supabase(user_id: str, preferences: dict[str, Any]) -> None:
    # Notification booleans are autoset here: new users get tradeSignals = true (the
    # wizard no longer asks), while anyone who has toggled Settings keeps their
    # existing choices. Existing keys are never overwritten.
    if not SUPABASE_SERVICE_KEY:
        return
    try:
        headers: dict[str, str] = {
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
        existing: dict[str, Any] = {}
        rows = resp.json() if resp.ok else []
        if rows and isinstance(rows[0].get("settings"), dict):
            existing = rows[0]["settings"]

        # Only mirror non-notification wizard answers into settings
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


# Normalise the wizard's followedStrategies list to plain ids.
def _followed_ids(preferences: dict[str, Any]) -> list[str]:
    # The wizard sends either plain ids or {id, name} objects, so both shapes are
    # normalised here. The ids are stored in preferences_json; there is no separate
    # strategy_follows table anymore.
    raw = preferences.get("followedStrategies") or []
    wanted: list[str] = []
    for item in raw:
        sid = item.get("id") if isinstance(item, dict) else item
        if isinstance(sid, str) and sid.strip():
            sid = sid.strip()
            if sid not in wanted:
                wanted.append(sid)
    return wanted


# -------- Endpoints --------
# Frontend read: onboarding state plus the saved wizard answers.
@router.get("/api/portfolio/status")
async def portfolio_status(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    pf: dict[str, Any] | None = await turso.get_portfolio(user["id"])
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


# Mirror the caller's settings from Supabase into the Turso users table.
@router.post("/api/user/sync-settings")
async def sync_settings(
    body: SyncSettingsIn,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    # The Settings page writes straight to Supabase, which is the source of truth.
    # This endpoint keeps the Turso mirror from staying stale until the next nightly
    # runner pass. The body wins outright: the Settings page re-reads the row after
    # updating and sends that back, so merging a cached copy would silently drop the
    # change the user just made.
    user_id: str = user["id"]
    merged: dict[str, Any] = body.settings or {}

    try:
        await turso.mirror_settings(user_id, merged, name=user.get("name"), email=user.get("email"))
    except Exception as e:
        # Never fail the user's save because the mirror lagged; Supabase already has
        # the authoritative copy
        print(f"Settings mirror to Turso failed for {user_id}: {e}")
        return {"mirrored": False, "reason": "turso-unavailable"}

    return {"mirrored": True, "keys": sorted(merged.keys())}


# Frontend write: save the wizard answers and the portfolio row.
@router.post("/api/portfolio/complete-setup")
async def complete_setup(
    body: CompleteSetupIn,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    user_id: str = user["id"]

    # Notification preferences never live in portfolios: the runner reads them from
    # users.settings and the Settings page manages them
    prefs: dict[str, Any] = {k: v for k, v in body.preferences.items() if k not in NOTIFICATION_KEYS}

    await turso.upsert_portfolio(
        user_id,
        name=body.name.strip() or "My Portfolio",
        base_currency=body.base_currency,
        starting_cash=body.starting_cash,
        preferences=prefs,
        onboarded=True,
    )

    _mirror_to_supabase(user_id, prefs)
    followed: list[str] = _followed_ids(prefs)

    return {"onboarded": True, "user_id": user_id, "followed_strategies": followed}
