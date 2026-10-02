# provision.py — Idempotent user provisioning in Turso.
#
# Called on login: ensures the authenticated user has a row in the users
# table (the Supabase mirror the runner reads emails/settings from).

# -------- Imports --------
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Any, Optional

from app.auth import get_current_user
from app.database import turso

router = APIRouter()

# -------- Configuration --------
DEFAULT_SETTINGS = {
    "theme": "Light",
    "priceAlerts": False,
    "dailySummary": False,
    "tradeSignals": True,
    "riskTolerance": "Medium",
    "defaultTimeframe": "1y",
    "securityWarnings": True,
    "autoTrackSignals": False,
}


class ProvisionIn(BaseModel):
    name: Optional[str] = None


# -------- Endpoints --------
@router.post("/api/user/provision")
async def provision_user(
    body: ProvisionIn,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Idempotently ensures the authenticated user exists in the users table.
    Safe to call on every login.

    Only the users row is created here, deliberately. No portfolio is made:
    a brand-new user must land on the onboarding wizard first, so the absence
    of a portfolios row is the signal the frontend uses to show it (see
    PortfolioPage, which renders the wizard while onboarded is false).
    """
    user_id = user["id"]
    email = user.get("email")
    name = body.name or user.get("name") or (email.split("@")[0] if email else None)

    existing = await turso.get_user(user_id)

    # Keep whatever settings the profile already had; only brand-new users get
    # the defaults, and an empty settings blob falls back to them too.
    settings = dict(user.get("settings") or {}) or dict(existing["settings"] or {})
    if not settings:
        settings = dict(DEFAULT_SETTINGS)

    await turso.upsert_user(user_id, name, email, settings)
    created = existing is None

    # Deliberately NOT creating a portfolio here. Its absence is what routes
    # the user into onboarding, so the wizard owns the very first portfolio.
    portfolio = await turso.get_portfolio(user_id)

    return {
        "provisioned": created,
        "user_id": user_id,
        "needs_onboarding": portfolio is None or not portfolio.get("onboarded"),
    }
