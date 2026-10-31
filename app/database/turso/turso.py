# -------- turso.py --------
# Data layer over Turso (LibSQL HTTP pipeline).
#
# Two tables live here:
#   users      - Supabase auth mirror, refreshed by the runner and the settings-sync endpoint.
#   portfolios - setup wizard answers (onboarding).
#
# Every function is a small focused read or write shared by the API and the daily runner.

# -------- Imports --------
import os
import json
import uuid
import aiohttp

from typing import Any
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"))

TURSO_DATABASE_URL = os.environ.get("TURSO_DATABASE_URL")
TURSO_AUTH_TOKEN = os.environ.get("TURSO_AUTH_TOKEN")


# -------- Connection --------
_session: aiohttp.ClientSession | None = None
_pipeline_url: str | None = None


# The Turso pipeline endpoint, derived from the database URL once.
def _get_pipeline_url() -> str:
    global _pipeline_url
    if _pipeline_url is None:
        if not TURSO_DATABASE_URL or not TURSO_AUTH_TOKEN:
            raise RuntimeError("Turso is not configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env")
        _pipeline_url = TURSO_DATABASE_URL.replace("libsql://", "https://").rstrip("/") + "/v2/pipeline"
    return _pipeline_url


# The shared HTTP session, opened on first use.
async def _get_session() -> aiohttp.ClientSession:
    global _session
    if _session is None or _session.closed:
        _session = aiohttp.ClientSession(headers={"Authorization": f"Bearer {TURSO_AUTH_TOKEN}"})
    return _session


# Close the shared HTTP session.
async def close() -> None:
    global _session
    if _session and not _session.closed:
        await _session.close()
    _session = None


# -------- Settings Mirror --------
# Supabase is authoritative; this mirror lets the nightly runner read preferences without calling PostgREST.
async def mirror_settings(user_id: str, settings: dict[str, Any], *,
                          name: str | None = None,
                          email: str | None = None) -> bool:
    payload: str = json.dumps(settings or {})
    now: str = _now()

    existing = await execute("SELECT id, name, email FROM users WHERE id = ?", [user_id])
    if not existing:
        await execute(
            """INSERT INTO users (id, name, email, settings_json, created_at)
               VALUES (?, ?, ?, ?, ?)""",
            [user_id, name, email, payload, now],
        )
        return True

    # name and email are only ever filled in, never blanked
    await execute(
        """UPDATE users
           SET settings_json = ?,
               name = COALESCE(?, name),
               email = COALESCE(?, email)
           WHERE id = ?""",
        [payload, name, email, user_id],
    )
    return True


# -------- Helper Methods --------
# Encode one Python value for the Turso pipeline.
def _enc(value: Any) -> dict[str, Any]:
    if value is None:
        return {"type": "null", "value": None}
    if isinstance(value, bool):
        return {"type": "integer", "value": int(value)}
    if isinstance(value, int):
        return {"type": "integer", "value": str(value)}
    if isinstance(value, float):
        return {"type": "float", "value": value}
    return {"type": "text", "value": str(value)}


# Turn a Turso result set into a list of dicts, one per row.
def _dec_rows(result: dict[str, Any]) -> list[dict[str, Any]]:
    cols = [c["name"] for c in result.get("cols", [])]
    rows = []
    for raw in result.get("rows", []):
        rows.append({
            cols[i]: (cell.get("value") if isinstance(cell, dict) else cell)
            for i, cell in enumerate(raw)
        })
    return rows


# Run one statement and return its rows as dicts.
async def execute(sql: str, args: list[Any] | None = None) -> list[dict[str, Any]]:
    session = await _get_session()
    stmt: dict[str, Any] = {"sql": sql}
    if args:
        stmt["args"] = [_enc(a) for a in args]
    payload = {"requests": [{"type": "execute", "stmt": stmt}, {"type": "close"}]}
    async with session.post(_get_pipeline_url(), json=payload) as resp:
        body = await resp.text()
        if resp.status != 200:
            raise RuntimeError(f"Turso HTTP {resp.status}: {body[:300]}")
        data = json.loads(body)

    result = data["results"][0]
    if result.get("type") == "error":
        raise RuntimeError(f"Turso error: {result.get('error', {}).get('message', result)}")
    return _dec_rows(result.get("response", {}).get("result", {}))


# The current time as an ISO string, for created_at and updated_at columns.
def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# A fresh uuid, for primary keys that do not come from the user id.
def _id() -> str:
    return str(uuid.uuid4())


# Decode a JSON text column, falling back to the default on bad or empty data.
def _parse_json(text: Any, default: Any) -> Any:
    try:
        return json.loads(text) if text else default
    except (TypeError, ValueError):
        return default


# -------- Users (mirror of Supabase auth users) --------
# Create or refresh the users row in one atomic statement; safe on every sign-in.
async def upsert_user(user_id: str, name: str | None, email: str | None,
                      settings: dict[str, Any] | None) -> None:
    # ON CONFLICT is atomic and only overwrites fields we actually have values for,
    # so a call with no email can never blank an email we already know.
    await execute(
        """INSERT INTO users (id, name, email, settings_json, created_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
               name = COALESCE(excluded.name, name),
               email = COALESCE(excluded.email, email),
               settings_json = excluded.settings_json""",
        [user_id, name, email, json.dumps(settings or {}), _now()],
    )


# One user row with its settings decoded, or None.
async def get_user(user_id: str) -> dict[str, Any] | None:
    rows = await execute("SELECT id, name, email, settings_json FROM users WHERE id = ?", [user_id])
    if not rows:
        return None
    row = rows[0]
    row["settings"] = _parse_json(row.pop("settings_json"), {})
    return row


# Every user row with its settings decoded.
async def get_all_users() -> list[dict[str, Any]]:
    rows = await execute("SELECT id, name, email, settings_json FROM users")
    for row in rows:
        row["settings"] = _parse_json(row.pop("settings_json"), {})
    return rows


# Users with an onboarded portfolio, plus decoded settings and preferences.
async def get_notification_recipients() -> list[dict[str, Any]]:
    rows = await execute(
        """SELECT u.id, u.name, u.email, u.settings_json, p.preferences_json
             FROM users AS u
             JOIN portfolios AS p ON p.user_id = u.id
            WHERE p.onboarded = 1"""
    )
    for row in rows:
        row["settings"] = _parse_json(row.pop("settings_json", None), {})
        row["preferences"] = _parse_json(row.pop("preferences_json", None), {})
    return rows


# -------- Portfolios (setup wizard answers) --------
# One user's portfolio with its preferences decoded, or None.
async def get_portfolio(user_id: str) -> dict[str, Any] | None:
    rows = await execute("SELECT * FROM portfolios WHERE user_id = ?", [user_id])
    if not rows:
        return None
    row = rows[0]
    row["preferences"] = _parse_json(row.pop("preferences_json", None), {})
    return row


# Write the wizard answers, called when the user completes onboarding.
async def upsert_portfolio(user_id: str, *, name: str, base_currency: str,
                           starting_cash: float, preferences: dict[str, Any],
                           onboarded: bool) -> None:
    now: str = _now()
    existing = await execute("SELECT id FROM portfolios WHERE user_id = ?", [user_id])
    if existing:
        await execute(
            """UPDATE portfolios
               SET name = ?, base_currency = ?, starting_cash = ?, preferences_json = ?,
                   onboarded = ?, updated_at = ?
               WHERE user_id = ?""",
            [name, base_currency, starting_cash, json.dumps(preferences),
             int(onboarded), now, user_id],
        )
    else:
        await execute(
            """INSERT INTO portfolios
               (id, user_id, name, base_currency, starting_cash, preferences_json,
                onboarded, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [_id(), user_id, name, base_currency, starting_cash,
             json.dumps(preferences), int(onboarded), now, now],
        )
