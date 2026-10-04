# turso.py — Data layer over Turso (LibSQL HTTP pipeline).
#
# Two tables live here:
#   users      — Supabase auth mirror, refreshed by the runner and the
#                settings-sync endpoint.
#   portfolios — setup wizard answers (onboarding).
#
# Every function is a small focused read or write shared by the API
# and the daily runner.

# -------- Imports --------
import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any

import aiohttp
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"))

TURSO_DATABASE_URL = os.environ.get("TURSO_DATABASE_URL")
TURSO_AUTH_TOKEN = os.environ.get("TURSO_AUTH_TOKEN")

# -------- Connection --------
_session: aiohttp.ClientSession | None = None
_pipeline_url: str | None = None


def _get_pipeline_url() -> str:
    global _pipeline_url
    if _pipeline_url is None:
        if not TURSO_DATABASE_URL or not TURSO_AUTH_TOKEN:
            raise RuntimeError("Turso is not configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env")
        _pipeline_url = TURSO_DATABASE_URL.replace("libsql://", "https://").rstrip("/") + "/v2/pipeline"
    return _pipeline_url


async def _get_session() -> aiohttp.ClientSession:
    global _session
    if _session is None or _session.closed:
        _session = aiohttp.ClientSession(headers={"Authorization": f"Bearer {TURSO_AUTH_TOKEN}"})
    return _session


# -------- Settings mirror (Supabase is authoritative) --------
async def mirror_settings(user_id: str, settings: dict[str, Any], *,
                          name: str | None = None,
                          email: str | None = None) -> bool:
    """Copies Supabase users.settings into this table's settings_json.

    Supabase is the source of truth for settings; this mirror exists so the
    nightly runner can read notification preferences without calling PostgREST
    per user. Previously the mirror only refreshed during a runner pass, which
    left it stale in Turso for the whole day after any settings change.

    name/email come from the verified token so a row created here is complete.
    They are only ever filled in, never blanked, so a call without them cannot
    wipe what an earlier write or the runner already stored.
    """
    payload = json.dumps(settings or {})
    now = _now()

    existing = await execute(
        "SELECT id, name, email FROM users WHERE id = ?", [user_id]
    )
    if not existing:
        await execute(
            """INSERT INTO users (id, name, email, settings_json, created_at)
               VALUES (?, ?, ?, ?, ?)""",
            [user_id, name, email, payload, now],
        )
        return True

    await execute(
        """UPDATE users
           SET settings_json = ?,
               name = COALESCE(?, name),
               email = COALESCE(?, email)
           WHERE id = ?""",
        [payload, name, email, user_id],
    )
    return True


async def close() -> None:
    global _session
    if _session and not _session.closed:
        await _session.close()
    _session = None


# -------- Helper Methods --------
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


def _dec_rows(result: dict[str, Any]) -> list[dict[str, Any]]:
    cols = [c["name"] for c in result.get("cols", [])]
    rows = []
    for raw in result.get("rows", []):
        rows.append({
            cols[i]: (cell.get("value") if isinstance(cell, dict) else cell)
            for i, cell in enumerate(raw)
        })
    return rows


async def execute(sql: str, args: list[Any] | None = None) -> list[dict[str, Any]]:
    """Runs one statement and returns rows as a list of dicts."""
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


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _id() -> str:
    return str(uuid.uuid4())


def _parse_json(text: Any, default: Any) -> Any:
    try:
        return json.loads(text) if text else default
    except (TypeError, ValueError):
        return default


# -------- Users (mirror of Supabase auth users) --------
async def upsert_user(user_id: str, name: str | None, email: str | None,
                      settings: dict[str, Any] | None) -> None:
    """Creates or refreshes the users row in ONE statement.

    Idempotent, so it is safe to fire on every sign-in. This deliberately
    creates NOTHING else: no portfolio, no follows. Those only appear once
    the user finishes onboarding.

    Previously this was DELETE-then-INSERT, which left a window where the row
    did not exist at all - anything reading concurrently saw no user, and a
    failure between the two statements lost the row entirely. ON CONFLICT is
    atomic and only overwrites fields we actually have values for, so a call
    with no email can never blank an email we already know.
    """
    await execute(
        """INSERT INTO users (id, name, email, settings_json, created_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
               name = COALESCE(excluded.name, name),
               email = COALESCE(excluded.email, email),
               settings_json = excluded.settings_json""",
        [user_id, name, email, json.dumps(settings or {}), _now()],
    )


async def get_user(user_id: str) -> dict[str, Any] | None:
    rows = await execute(
        "SELECT id, name, email, settings_json FROM users WHERE id = ?", [user_id]
    )
    if not rows:
        return None
    r = rows[0]
    r["settings"] = _parse_json(r.pop("settings_json"), {})
    return r


async def get_all_users() -> list[dict[str, Any]]:
    rows = await execute("SELECT id, name, email, settings_json FROM users")
    for r in rows:
        r["settings"] = _parse_json(r.pop("settings_json"), {})
    return rows


# -------- Portfolios (setup wizard answers) --------
async def get_portfolio(user_id: str) -> dict[str, Any] | None:
    rows = await execute("SELECT * FROM portfolios WHERE user_id = ?", [user_id])
    if not rows:
        return None
    r = rows[0]
    r["preferences"] = _parse_json(r.pop("preferences_json", None), {})
    return r


async def upsert_portfolio(user_id: str, *, name: str, base_currency: str,
                           starting_cash: float, preferences: dict[str, Any],
                           onboarded: bool) -> None:
    """Write: called when the user completes the setup wizard."""
    now = _now()
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
