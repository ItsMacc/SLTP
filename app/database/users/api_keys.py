# -------- api_keys.py --------
# Personal API keys for using the SLTP API from another machine.
#
# A key is shown to the user exactly once. Only its SHA-256 hash is stored in Turso,
# so a leaked database row cannot be used to call the API. The short prefix is stored
# in clear so the user can recognise a key in the list.
#
# Every query is scoped to the authenticated user's id.

# -------- Imports --------
import uuid
import hashlib
import secrets

from typing import Any
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException

# Database imports
from app.database.turso import turso

# Auth imports
from app.auth.auth import get_current_user

router = APIRouter()

KEY_PREFIX: str = "sltp_"
NAME_MAX: int = 60
_table_ready: bool = False


# -------- Helpers --------
# The current time as an ISO string.
def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# The stored form of a key: its SHA-256 hash, never the key itself.
def hash_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


# Create the api_keys table and its index once per process.
async def _ensure_table() -> None:
    global _table_ready
    if _table_ready:
        return
    await turso.execute(
        """
        CREATE TABLE IF NOT EXISTS api_keys (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          key_prefix TEXT NOT NULL,
          key_hash TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL,
          last_used_at TEXT,
          revoked_at TEXT
        )
        """
    )
    await turso.execute("CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id)")
    _table_ready = True


# Hard-delete every API key a user owns; used by account deletion.
async def delete_user_api_keys(user_id: str) -> None:
    await _ensure_table()
    await turso.execute("DELETE FROM api_keys WHERE user_id = ?", [user_id])


# Return the owner of an active key, or None; used by get_current_user.
async def user_id_for_api_key(raw_key: str) -> str | None:
    await _ensure_table()
    rows = await turso.execute(
        "SELECT id, user_id FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL",
        [hash_key(raw_key)],
    )
    if not rows:
        return None
    await turso.execute("UPDATE api_keys SET last_used_at = ? WHERE id = ?", [_now(), rows[0]["id"]])
    return rows[0]["user_id"]


# -------- Request Bodies --------
class CreateApiKeyIn(BaseModel):
    name: str = Field(description="A label for the key, for example 'my laptop'.")


# -------- Endpoints --------
# List the caller's active keys, without the secrets.
@router.get("/api/user/api-keys")
async def list_api_keys(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    await _ensure_table()
    rows = await turso.execute(
        """
        SELECT id, name, key_prefix, created_at, last_used_at
        FROM api_keys
        WHERE user_id = ? AND revoked_at IS NULL
        ORDER BY created_at DESC
        """,
        [user["id"]],
    )
    return {"keys": rows}


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

    await _ensure_table()
    raw_key: str = KEY_PREFIX + secrets.token_urlsafe(32)
    key_id: str = str(uuid.uuid4())
    now: str = _now()
    await turso.execute(
        """
        INSERT INTO api_keys (id, user_id, name, key_prefix, key_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        [key_id, user["id"], name, raw_key[:12], hash_key(raw_key), now],
    )

    # The full key is returned only in this response and never stored
    return {
        "id": key_id,
        "name": name,
        "key_prefix": raw_key[:12],
        "created_at": now,
        "key": raw_key,
    }


# Revoke one of the caller's keys.
@router.delete("/api/user/api-keys/{key_id}")
async def revoke_api_key(
    key_id: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    await _ensure_table()
    rows = await turso.execute(
        "SELECT id FROM api_keys WHERE id = ? AND user_id = ? AND revoked_at IS NULL",
        [key_id, user["id"]],
    )
    if not rows:
        raise HTTPException(status_code=404, detail="API key not found.")

    await turso.execute(
        "UPDATE api_keys SET revoked_at = ? WHERE id = ? AND user_id = ?",
        [_now(), key_id, user["id"]],
    )
    return {"id": key_id, "revoked": True}
