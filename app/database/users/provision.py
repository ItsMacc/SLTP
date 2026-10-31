# -------- provision.py --------
# Idempotent user provisioning in Turso.
#
# Called on login: ensures the authenticated user has a row in the users table (the
# Supabase mirror the runner reads emails and settings from).

# -------- Imports --------
import os
import json
import requests

from typing import Any, Optional
from datetime import datetime, timezone
from dotenv import load_dotenv
from pydantic import BaseModel
from fastapi import APIRouter, Depends

# Database imports
from app.database.turso import turso
from app.database.users.defaults import default_settings

# Auth imports
from app.auth.auth import get_current_user

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://jqyqfkrzwimxuzugyuiw.supabase.co")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE")

router = APIRouter()


# -------- Helpers --------
# Service-role headers, used only for the profile seed below.
def _service_headers() -> dict[str, str]:
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }


# -------- Request Bodies --------
class ProvisionIn(BaseModel):
    name: Optional[str] = None


# -------- Endpoints --------
# Ensure the authenticated user exists in the users table; safe to call on every login.
@router.post("/api/user/provision")
async def provision_user(
    body: ProvisionIn,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    # Only the users row is created here, deliberately. No portfolio is made: a
    # brand-new user must land on the onboarding wizard first, so the absence of a
    # portfolios row is the signal the frontend uses to show it (see PortfolioPage,
    # which renders the wizard while onboarded is false).
    user_id: str = user["id"]
    email: str | None = user.get("email")
    name: str | None = body.name or user.get("name") or (email.split("@")[0] if email else None)

    existing: dict[str, Any] | None = await turso.get_user(user_id)

    # Resolve settings in priority order: what the caller sent, then what the Supabase
    # profile already holds, then what the Turso row already holds, and only then the
    # shared defaults. `existing` is None for a brand-new account, which is the only
    # case where every other source is empty too, so each read has to tolerate None.
    candidates = [
        user.get("settings"),
        (existing or {}).get("settings"),
    ]
    settings: dict[str, Any] | None = next((dict(c) for c in candidates if isinstance(c, dict) and c), None)
    if settings is None:
        settings = default_settings()

    # Seed the Supabase profile row too, so a brand-new account exists in both stores
    # with the same defaults from the very first authenticated request
    supabase_profile: bool = await _ensure_supabase_profile(user_id, name, email, settings)

    await turso.upsert_user(user_id, name, email, settings)
    created: bool = existing is None

    # Deliberately NOT creating a portfolio here: its absence is what routes the user
    # into onboarding, so the wizard owns the very first portfolio
    portfolio: dict[str, Any] | None = await turso.get_portfolio(user_id)

    return {
        "provisioned": created,
        "user_id": user_id,
        "supabase_profile_created": supabase_profile,
        "needs_onboarding": portfolio is None or not portfolio.get("onboarded"),
    }


# Create the Supabase public.users profile row if it is missing; True only when a row was created.
async def _ensure_supabase_profile(
    user_id: str,
    name: str | None,
    email: str | None,
    settings: dict[str, Any],
) -> bool:
    # Uses the service-role key because a brand-new user has no row to write and the
    # client's own RLS insert policy may not cover the first write yet. Best-effort: if
    # Supabase is unreachable the account still provisions in Turso, which is what the
    # rest of the app actually reads.
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return False

    try:
        existing = requests.get(
            f"{SUPABASE_URL}/rest/v1/users",
            params={"select": "id", "id": f"eq.{user_id}"},
            headers=_service_headers(),
            timeout=10,
        )
        if existing.status_code == 200 and existing.json():
            return False  # already there, never overwrite saved settings

        created = requests.post(
            f"{SUPABASE_URL}/rest/v1/users",
            headers=_service_headers(),
            json={"id": user_id, "name": name, "email": email, "settings": settings},
            timeout=10,
        )
        return created.status_code in (200, 201)
    except Exception as e:  # noqa: BLE001 - never block provisioning on this
        print(f"Supabase profile seed skipped for {user_id}: {e}")
        return False
