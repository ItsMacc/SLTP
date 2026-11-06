# watchlist.py — the user's tracked symbols, one list per account.
#
# Stored as a single JSON blob in Turso (it will grow symbol metadata later).
# Scoped to the id from the verified JWT, like everything else.

# -------- Imports --------
from typing import Any

from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException

# Auth imports
from app.auth.jwt_auth import get_current_user

# Database imports
from app.turso import userdata

router = APIRouter()

SYMBOLS_MAX: int = 200


# -------- Request Bodies --------
class WatchlistIn(BaseModel):
    items: list[str] = Field(description="Ticker symbols, for example ['SPY', 'QQQ'].")


# -------- Endpoints --------
# Frontend read: the saved symbol list, empty when never set.
@router.get("/api/user/watchlist")
async def get_watchlist(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    return {"items": userdata.get_watchlist(user["id"])}


# Frontend write: replace the whole list.
@router.put("/api/user/watchlist")
async def set_watchlist(
    body: WatchlistIn,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    if len(body.items) > SYMBOLS_MAX:
        raise HTTPException(status_code=400, detail=f"Watchlist holds at most {SYMBOLS_MAX} symbols.")
    clean = [s.strip().upper() for s in body.items if isinstance(s, str) and s.strip()]
    return {"items": userdata.set_watchlist(user["id"], clean)}
