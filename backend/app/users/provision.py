# provision.py — idempotent account creation.
#
# Called on login: ensures the authenticated user has a profile row (the
# record the API and the operator report read emails and settings from).

# -------- Imports --------
from typing import Any, Optional

from pydantic import BaseModel
from fastapi import APIRouter, Depends

# Auth imports
from app.auth.jwt_auth import get_current_user

# Database imports
from app.turso import userdata
from app.users import store
from app.users.defaults import default_settings

router = APIRouter()


# -------- Request Bodies --------
class ProvisionIn(BaseModel):
    name: Optional[str] = None


# -------- Endpoints --------
# Ensure the authenticated user exists; safe to call on every login.
@router.post("/api/user/provision")
async def provision_user(
    body: ProvisionIn,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    # Only the profile row is created here, deliberately. No portfolio is made:
    # a brand-new user must land on the onboarding wizard first, so the absence
    # of a portfolios row is the signal the frontend uses to show it.
    user_id: str = user["id"]
    email: str | None = user.get("email")
    name: str | None = body.name or user.get("name") or (email.split("@")[0] if email else None)

    existing: dict[str, Any] | None = store.get_profile(user_id)

    # Resolve settings in priority order: the live profile row first, then the
    # token context, and only then the shared defaults. `existing` is None for
    # a brand-new account, so every read tolerates None.
    candidates = [
        (existing or {}).get("settings"),
        user.get("settings"),
    ]
    settings: dict[str, Any] | None = next((dict(c) for c in candidates if isinstance(c, dict) and c), None)
    if settings is None:
        settings = dict(default_settings())

    created: bool = store.ensure_profile(user_id, name, email, settings)

    # Deliberately NOT creating a portfolio here: its absence is what routes
    # the user into onboarding, so the wizard owns the very first portfolio.
    portfolio: dict[str, Any] | None = userdata.get_portfolio(user_id)

    return {
        "provisioned": created,
        "user_id": user_id,
        "needs_onboarding": portfolio is None or not portfolio.get("onboarded"),
    }
