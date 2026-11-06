# store.py — every database read and write, in one file.
#
# Tables (see backend/schema.sql):
#   users             profile row: id (auth uid), name, email, settings
#   account_deletions churn log: the only trace left after erasure
# (Portfolios, API keys and everything bulky moved to Turso: app/turso/.)
#
# All calls use the service role and are scoped to the authenticated user's id
# from the verified JWT. A missing table (schema.sql not pasted yet) reads as
# empty instead of raising, so the API stays up during setup.

# -------- Imports --------
import json

from typing import Any

import requests

from app.config import SUPABASE_URL, SUPABASE_TIMEOUT, is_missing_table, require_supabase, service_headers


# -------- Low level --------
# One PostgREST call. Returns the decoded body (list, dict or None).
def _rest(method: str, table: str, *, params: dict[str, str] | None = None,
          body: Any = None, single: bool = False) -> Any:
    require_supabase()
    headers = service_headers()
    if single:
        headers["Accept"] = "application/vnd.pgrst.object+json"
    if method in ("POST", "PATCH", "PUT"):
        headers["Prefer"] = "return=representation"
    resp = requests.request(
        method,
        f"{SUPABASE_URL}/rest/v1/{table}",
        params=params or {},
        json=body,
        headers=headers,
        timeout=SUPABASE_TIMEOUT,
    )
    # PostgREST answers an object query over zero rows with 406, not 404:
    # that just means "no row yet", the normal state before onboarding.
    if resp.status_code == 406 and single:
        return None
    if resp.status_code in (200, 201, 204):
        if resp.status_code == 204 or not resp.text:
            return None
        data = resp.json()
        # Writes can answer with a one-row array; unwrap it for object callers.
        if single and isinstance(data, list):
            return data[0] if data else None
        return data
    if resp.status_code == 404 and single:
        return None
    if resp.status_code == 404 and is_missing_table(resp.text):
        raise MissingTable(table)
    raise RuntimeError(f"Supabase {method} {table} HTTP {resp.status_code}: {resp.text[:200]}")


# Raised when schema.sql has not been pasted yet. Reads catch it and act empty.
class MissingTable(RuntimeError):
    pass


# Decode a JSON column that may arrive as text or as an object.
def _parse_json(value: Any, default: Any) -> Any:
    if value is None:
        return default
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return default


# -------- Profiles (public.users) --------
# One profile row with settings decoded, or None.
def get_profile(user_id: str) -> dict[str, Any] | None:
    try:
        row = _rest("GET", "users", params={"id": f"eq.{user_id}"}, single=True)
    except MissingTable:
        return None
    if not row:
        return None
    row["settings"] = _parse_json(row.get("settings"), {})
    return row


# Create the profile row when absent; returns True only when a row was created.
def ensure_profile(user_id: str, name: str | None, email: str | None,
                   settings: dict[str, Any]) -> bool:
    if get_profile(user_id):
        return False
    _rest("POST", "users", body={
        "id": user_id, "name": name, "email": email, "settings": settings or {},
    })
    return True


# Replace the stored settings blob outright and return the merged keys.
def save_settings(user_id: str, settings: dict[str, Any]) -> list[str]:
    _rest("PATCH", "users", params={"id": f"eq.{user_id}"}, body={"settings": settings or {}})
    return sorted((settings or {}).keys())


# Merge patch into the stored settings without dropping untouched keys.
def merge_settings(user_id: str, patch: dict[str, Any]) -> dict[str, Any]:
    profile = get_profile(user_id) or {}
    merged = {**(profile.get("settings") or {}), **(patch or {})}
    _rest("PATCH", "users", params={"id": f"eq.{user_id}"}, body={"settings": merged})
    return merged


# Delete the profile row; absence counts as success.
def delete_profile(user_id: str) -> None:
    try:
        _rest("DELETE", "users", params={"id": f"eq.{user_id}"})
    except MissingTable:
        return


# -------- Churn log --------
# Append one deletion; a repeat call for the same account is ignored.
def record_account_deletion(user_id: str, *, email: str | None = None,
                            name: str | None = None) -> None:
    from app.config import now_iso

    try:
        existing = _rest("GET", "account_deletions", params={"user_id": f"eq.{user_id}"}, single=True)
        if existing:
            return
        _rest("POST", "account_deletions", body={
            "user_id": user_id, "email": email, "name": name, "deleted_at": now_iso(),
        })
    except MissingTable:
        return


# Every recorded deletion, newest first.
def list_account_deletions() -> list[dict[str, Any]]:
    try:
        rows = _rest("GET", "account_deletions", params={"order": "deleted_at.desc"})
    except MissingTable:
        return []
    return rows or []


# -------- Operator counts --------
# Small aggregates for the morning report. A missing table reports as None
# instead of blanking the rest of the report.
def _count(table: str, params: dict[str, str] | None = None, column: str = "id") -> int | None:
    require_supabase()
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/{table}",
            params={**(params or {}), "select": column, "limit": "1"},
            headers=service_headers({"Prefer": "count=exact"}),
            timeout=SUPABASE_TIMEOUT,
        )
    except Exception:
        return None
    if resp.status_code == 404 and is_missing_table(resp.text):
        return None
    if not resp.ok:
        return None
    content_range = resp.headers.get("Content-Range", "")
    try:
        return int(content_range.split("/")[-1])
    except (ValueError, IndexError):
        return None


def usage_counts() -> dict[str, int | None]:
    return {
        "profiles": _count("users"),
        "deletions": _count("account_deletions", column="user_id"),
    }



