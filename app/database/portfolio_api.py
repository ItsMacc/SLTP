import json
import os

import requests
from dotenv import load_dotenv
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Any

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
    """Frontend read: onboarding state + the saved wizard answers."""
    pf = await turso.get_portfolio(user["id"])
    if not pf:
        return {"id": None, "onboarded": False, "name": "My Portfolio",
                "base_currency": "USD", "starting_cash": 0, "preferences": {}}
    return {
        "id": pf.get("id"),
        "onboarded": bool(pf.get("onboarded")),
        "name": pf.get("name", "My Portfolio"),
        "base_currency": pf.get("base_currency", "USD"),
        "starting_cash": pf.get("starting_cash", 0),
        "preferences": pf.get("preferences", {}),
    }


@router.post("/api/portfolio/complete-setup")
async def complete_setup(
    body: CompleteSetupIn,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Frontend write: save the wizard answers + portfolio row."""
    user_id = user["id"]
    prefs = {**body.preferences}

    await turso.upsert_portfolio(
        user_id,
        name=body.name.strip() or "My Portfolio",
        base_currency=body.base_currency,
        starting_cash=body.starting_cash,
        preferences=prefs,
        onboarded=True,
    )

    _mirror_to_supabase(user_id, prefs)

    return {"onboarded": True, "user_id": user_id}
