import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Any, Optional

from app.auth import get_current_user
from app.database import turso

router = APIRouter()

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


@router.post("/api/user/provision")
async def provision_user(
    body: ProvisionIn,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Idempotently ensures the authenticated user exists in Turso with
    default values. Safe to call on every login — existing rows are untouched.
    """
    user_id = user["id"]
    email = user.get("email")
    name = body.name or user.get("name") or (email.split("@")[0] if email else None)

    if not email:
        raise HTTPException(status_code=400, detail="Account has no email — cannot provision")

    existing = await turso.get_user(user_id)
    now = datetime.now(timezone.utc).isoformat()

    if existing is None:
        # First time seeing this user: create with defaults
        settings = dict(user.get("settings") or {}) or DEFAULT_SETTINGS
        await turso.execute(
            """INSERT INTO users_cache (id, name, email, settings_json, created_at, synced_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            [user_id, name, email, json.dumps(settings), now, now],
        )
        created = True
    else:
        # Keep their original created_at; refresh profile fields only
        await turso.execute(
            "UPDATE users_cache SET name = ?, email = ?, synced_at = ? WHERE id = ?",
            [name, email, now, user_id],
        )
        created = False

    # NOTE: we deliberately do NOT create a portfolio row here.
    # A portfolio is only created when the user completes the onboarding
    # wizard (POST /api/portfolio/complete-setup), so "no row" reliably
    # means "hasn't onboarded yet".

    return {"provisioned": created, "user_id": user_id}
