# strategies.py — cloud copies of user-written Lab strategies.
#
# The browser owns editing (Pyodide) and live files (OPFS). These endpoints
# only persist named snapshots to Turso so code survives a cleared browser,
# and load them back. Every row is scoped to the id from the verified JWT.

# -------- Imports --------
from typing import Any

from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException

# Auth imports
from app.auth.jwt_auth import get_current_user

# Database imports
from app.turso import userdata

router = APIRouter()

NAME_MAX: int = 80
CODE_MAX: int = 200_000


# -------- Request Bodies --------
class SaveStrategyIn(BaseModel):
    name: str = Field(description="Display name, for example 'My momentum'.")
    code: str = Field(default="", description="The strategy source code.")
    id: str | None = Field(default=None, description="Pass an existing id to overwrite it.")


# -------- Endpoints --------
# Frontend read: every saved strategy, without the code blobs.
@router.get("/api/lab/strategies")
async def list_strategies(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    return {"strategies": userdata.list_strategies(user["id"])}


# Frontend write: save a new snapshot, or overwrite the given id.
@router.post("/api/lab/strategies")
async def save_strategy(
    body: SaveStrategyIn,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Give the strategy a name.")
    if len(name) > NAME_MAX:
        raise HTTPException(status_code=400, detail=f"Name must be {NAME_MAX} characters or fewer.")
    if len(body.code or "") > CODE_MAX:
        raise HTTPException(status_code=400, detail="Strategy code is too large to save.")
    sid = userdata.save_strategy(user["id"], name, body.code or "", body.id)
    return {"id": sid, "name": name}


# Frontend read: one strategy with its code.
@router.get("/api/lab/strategies/{strategy_id}")
async def get_strategy(
    strategy_id: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    row = userdata.get_strategy(user["id"], strategy_id)
    if not row:
        raise HTTPException(status_code=404, detail="Strategy not found.")
    return {"id": row["id"], "name": row["name"], "code": row["code"],
            "created_at": row["created_at"], "updated_at": row["updated_at"]}


# Frontend write: delete a saved strategy.
@router.delete("/api/lab/strategies/{strategy_id}")
async def delete_strategy(
    strategy_id: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    if not userdata.delete_strategy(user["id"], strategy_id):
        raise HTTPException(status_code=404, detail="Strategy not found.")
    return {"id": strategy_id, "deleted": True}
