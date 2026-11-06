# results.py — cached backtest runs, run once and reopen free.
#
# Equity curves and trade lists are the bulkiest JSON in the app, so they
# live in Turso, not Supabase. The frontend saves a finished run, lists past
# runs without the blobs, and opens one in full. Scoped to the verified JWT.

# -------- Imports --------
from typing import Any

from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException

# Auth imports
from app.auth.jwt_auth import get_current_user

# Database imports
from app.turso import userdata

router = APIRouter()

POINTS_MAX: int = 20_000
TRADES_MAX: int = 20_000


# -------- Request Bodies --------
class SaveResultIn(BaseModel):
    strategy_ref: str = Field(default="", description="Which strategy ran: a prebuilt id or a Lab strategy id.")
    params: dict[str, Any] = Field(default={}, description="The run inputs: dates, capital, knobs.")
    metrics: dict[str, Any] = Field(default={}, description="The run outputs: returns, drawdown, ratios.")
    equity: list[Any] = Field(default=[], description="Portfolio value per bar, for the chart.")
    trades: list[Any] = Field(default=[], description="The trade records, for the table.")


# -------- Endpoints --------
# Frontend write: cache a finished run.
@router.post("/api/backtest/results")
async def save_result(
    body: SaveResultIn,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    if len(body.equity) > POINTS_MAX or len(body.trades) > TRADES_MAX:
        raise HTTPException(status_code=400, detail="Result is too large to cache.")
    rid = userdata.save_result(
        user["id"],
        strategy_ref=(body.strategy_ref or "").strip(),
        params=body.params or {},
        metrics=body.metrics or {},
        equity=body.equity or [],
        trades=body.trades or [],
    )
    return {"id": rid}


# Frontend read: past runs, newest first, without the curve and trade blobs.
@router.get("/api/backtest/results")
async def list_results(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    return {"results": userdata.list_results(user["id"])}


# Frontend read: one run in full, chart and trades included.
@router.get("/api/backtest/results/{result_id}")
async def get_result(
    result_id: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    row = userdata.get_result(user["id"], result_id)
    if not row:
        raise HTTPException(status_code=404, detail="Result not found.")
    return row


# Frontend write: drop a cached run.
@router.delete("/api/backtest/results/{result_id}")
async def delete_result(
    result_id: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    if not userdata.delete_result(user["id"], result_id):
        raise HTTPException(status_code=404, detail="Result not found.")
    return {"id": result_id, "deleted": True}
