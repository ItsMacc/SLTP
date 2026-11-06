# settings.py — save and load the user's settings blob.
#
# The Supabase profile row is the single source of truth: the Settings page
# writes here and every other reader (auth context, portfolio wizard, report)
# reads from here. There is no mirror, so there is nothing to drift.

# -------- Imports --------
from typing import Any

from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException

# Auth imports
from app.auth.jwt_auth import get_current_user

# Database imports
from app.users import store

router = APIRouter()


# -------- Request Bodies --------
class SaveSettingsIn(BaseModel):
    settings: dict[str, Any] = Field(description="The user's settings, replacing what is stored.")


# -------- Endpoints --------
# Read the caller's stored settings.
@router.get("/api/user/settings")
async def load_settings(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    profile = store.get_profile(user["id"])
    if profile is None:
        raise HTTPException(status_code=404, detail="Account not provisioned yet.")
    return {"settings": profile.get("settings") or {}}


# Replace the caller's stored settings outright and return what was saved.
@router.post("/api/user/sync-settings")
async def save_settings(
    body: SaveSettingsIn,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    # The body wins outright: the Settings page re-reads the row after writing
    # and sends that back, so merging a cached copy would silently drop the
    # change the user just made.
    keys = store.save_settings(user["id"], body.settings or {})
    return {"saved": True, "keys": keys}
