# provision.py — Idempotent user provisioning in Turso.
#
# Called on login: ensures the authenticated user has a row in the users
# table (the Supabase mirror the runner reads emails/settings from).

# -------- Imports --------
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
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
    Safe to call on every login."""
    user_id = user["id"]
    email = user.get("email")
    name = body.name or user.get("name") or (email.split("@")[0] if email else None)

    if not email:
        raise HTTPException(status_code=400, detail="Account has no email — cannot provision")

    existing = await turso.get_user(user_id)

    if existing is None:
        settings = dict(user.get("settings") or {}) or DEFAULT_SETTINGS
        await turso.upsert_user(user_id, name, email, settings)
        created = True
    else:
        await turso.execute(
            "UPDATE users SET name = ?, email = ? WHERE id = ?",
            [name, email, user_id],
        )
        created = False

    return {"provisioned": created, "user_id": user_id}
