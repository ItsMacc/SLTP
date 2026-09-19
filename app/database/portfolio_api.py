import json
import os
from datetime import datetime, timezone
from typing import Any, Optional

import requests
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import get_current_user
from app.database import turso

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://jqyqfkrzwimxuzugyuiw.supabase.co")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE")

router = APIRouter()


class CompleteSetupIn(BaseModel):
    name: str
    starting_cash: float
    base_currency: str = "USD"
    preferences: dict[str, Any] = {}


async def _get_portfolio(user_id: str) -> dict[str, Any]:
    rows = await turso.execute("SELECT * FROM portfolios WHERE user_id = ?", [user_id])
    return rows[0] if rows else {}


def _mirror_to_supabase(user_id: str, preferences: dict[str, Any]) -> None:
    """Merges the onboarding preferences into Supabase users.settings (best-effort)."""
    if not SUPABASE_SERVICE_KEY:
        return
    try:
        headers = {
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/users",
            params={"select": "settings", "id": f"eq.{user_id}"},
            headers=headers,
            timeout=10,
        )
        existing = {}
        rows = resp.json() if resp.ok else []
        if rows and isinstance(rows[0].get("settings"), dict):
            existing = rows[0]["settings"]

        merged = {**existing, **preferences}
        requests.patch(
            f"{SUPABASE_URL}/rest/v1/users",
            params={"id": f"eq.{user_id}"},
            headers=headers,
            data=json.dumps({"settings": merged}),
            timeout=10,
        ).raise_for_status()
    except Exception as e:
        print(f"Supabase settings mirror failed for {user_id}: {e}")


@router.get("/api/portfolio/status")
async def portfolio_status(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    pf = await _get_portfolio(user["id"])
    onboarded = bool(pf.get("onboarded"))
    preferences: dict[str, Any] = {}
    if pf.get("preferences_json"):
        try:
            preferences = json.loads(pf["preferences_json"])
        except ValueError:
            preferences = {}
    return {
        "onboarded": onboarded,
        "name": pf.get("name", "My Portfolio"),
        "base_currency": pf.get("base_currency", "USD"),
        "starting_cash": pf.get("starting_cash", 0),
        "preferences": preferences,
    }


@router.post("/api/portfolio/complete-setup")
async def complete_setup(
    body: CompleteSetupIn,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = user["id"]
    pf = await _get_portfolio(user_id)
    now = datetime.now(timezone.utc).isoformat()
    prefs = {**body.preferences, "onboardedAt": now}

    if pf:
        await turso.execute(
            """UPDATE portfolios
               SET name = ?, base_currency = ?, starting_cash = ?, preferences_json = ?,
                   onboarded = 1, updated_at = ?
               WHERE user_id = ?""",
            [body.name.strip() or "My Portfolio", body.base_currency, body.starting_cash,
             json.dumps(prefs), now, user_id],
        )
    else:
        # First real write: create the portfolio row with the wizard's answers.
        await turso.execute(
            """INSERT INTO portfolios
               (id, user_id, name, base_currency, starting_cash, preferences_json,
                onboarded, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)""",
            [turso._id(), user_id, body.name.strip() or "My Portfolio", body.base_currency,
             body.starting_cash, json.dumps(prefs), now, now],
        )

    # Persist followed strategies so the daily runner can use them.
    for s in prefs.get("followedStrategies", []):
        if isinstance(s, dict):
            sid, sname = s.get("id"), s.get("name", "")
        else:
            sid, sname = s, ""
        if sid:
            await turso.follow_strategy(user_id, sid, sname, notify_email=True)

    _mirror_to_supabase(user_id, prefs)

    return {"onboarded": True, "user_id": user_id}
