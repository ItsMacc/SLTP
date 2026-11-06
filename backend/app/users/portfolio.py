# portfolio.py — setup wizard endpoints (onboarding state and answers).
#
# Reads and writes the portfolios table and merges wizard answers into the
# profile settings. Notification booleans never live in portfolios: they are
# stripped here and managed from the Settings page.

# -------- Imports --------
from typing import Any

from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends

# Auth imports
from app.auth.jwt_auth import get_current_user

# Database imports
from app.turso import userdata
from app.users import store

router = APIRouter()

# Keys that belong to profile settings (notification preferences), NOT to
# portfolios.preferences. The report reads notification booleans from settings
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


# -------- Helpers --------
# Normalise the wizard's followedStrategies list to plain ids.
def _followed_ids(preferences: dict[str, Any]) -> list[str]:
    # The wizard sends either plain ids or {id, name} objects, so both shapes
    # are normalised here. The ids are stored in preferences; there is no
    # separate strategy_follows table.
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
    pf: dict[str, Any] | None = userdata.get_portfolio(user["id"])
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


# Frontend write: save the wizard answers and the portfolio row.
@router.post("/api/portfolio/complete-setup")
async def complete_setup(
    body: CompleteSetupIn,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    user_id: str = user["id"]

    # Notification preferences never live in portfolios: they are managed from
    # the Settings page and read from profile settings.
    prefs: dict[str, Any] = {k: v for k, v in body.preferences.items() if k not in NOTIFICATION_KEYS}

    userdata.upsert_portfolio(
        user_id,
        name=body.name.strip() or "My Portfolio",
        base_currency=body.base_currency,
        starting_cash=body.starting_cash,
        preferences=prefs,
        onboarded=True,
    )

    # Merge the non-notification wizard answers into profile settings, and
    # autoset the notification booleans for a brand-new user without ever
    # overwriting keys they already chose.
    wizard_answers = {k: v for k, v in prefs.items() if k not in NOTIFICATION_KEYS}
    autoset = {
        "tradeSignals": True,
        "dailySummary": False,
        "priceAlerts": False,
        "securityWarnings": True,
    }
    profile = store.get_profile(user_id) or {}
    existing_settings = profile.get("settings") or {}
    autoset = {k: v for k, v in autoset.items() if k not in existing_settings}
    store.save_settings(user_id, {**existing_settings, **wizard_answers, **autoset})

    return {"onboarded": True, "user_id": user_id, "followed_strategies": _followed_ids(prefs)}
