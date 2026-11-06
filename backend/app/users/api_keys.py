# api_keys.py — personal API keys for calling the API from another machine.
#
# A key is shown to the user exactly once. Only its SHA-256 hash is stored, so
# a leaked database row cannot be used to call the API. The short prefix is
# stored in clear so the user can recognise a key in the list.
#
# Every query is scoped to the authenticated user's id.

# -------- Imports --------
import hashlib
import secrets
import uuid

from typing import Any

from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException

# Auth imports
from app.auth.jwt_auth import get_current_user

# Database imports
from app.users import store

router = APIRouter()

KEY_PREFIX: str = "sltp_"
NAME_MAX: int = 60


# -------- Helpers --------
# The stored form of a key: its SHA-256 hash, never the key itself.
def hash_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


# -------- Request Bodies --------
class CreateApiKeyIn(BaseModel):
    name: str = Field(description="A label for the key, for example 'my laptop'.")


# -------- Endpoints --------
# List the caller's keys, without the secrets.
@router.get("/api/user/api-keys")
async def list_api_keys(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    return {"keys": store.list_api_keys(user["id"])}


# Mint a new key and return it once; only the hash is kept.
@router.post("/api/user/api-keys")
async def create_api_key(
    body: CreateApiKeyIn,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    name: str = (body.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Give the key a name.")
    if len(name) > NAME_MAX:
        raise HTTPException(status_code=400, detail=f"Name must be {NAME_MAX} characters or fewer.")

    raw_key: str = KEY_PREFIX + secrets.token_urlsafe(32)
    key_id = store.insert_api_key(user["id"], name, raw_key[:12], hash_key(raw_key))

    # The full key is returned only in this response and never stored
    return {"id": key_id, "name": name, "key_prefix": raw_key[:12], "key": raw_key}


# Remove one of the caller's keys.
@router.delete("/api/user/api-keys/{key_id}")
async def delete_api_key(
    key_id: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    if not store.delete_api_key(user["id"], key_id):
        raise HTTPException(status_code=404, detail="API key not found.")
    return {"id": key_id, "deleted": True}
