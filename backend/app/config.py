# config.py — one place for environment, Supabase access and tiny helpers.
#
# Single-store design: Supabase holds auth, the profile row, portfolios,
# API keys and the churn log. There is no second database, so there is no
# mirror to keep in sync.

# -------- Imports --------
import os

from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv


# -------- Environment --------
# Load the repo-root .env by walking upward, so a module move cannot break it.
def _load_env() -> None:
    for parent in Path(__file__).resolve().parents:
        candidate = parent / ".env"
        if candidate.is_file():
            load_dotenv(candidate)
            return


_load_env()

SUPABASE_URL: str = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_KEY: str | None = os.environ.get("SUPABASE_SERVICE_ROLE")
SUPABASE_TIMEOUT: int = 15


# -------- Supabase REST --------
# Service-role headers. The backend is a trusted client: it bypasses RLS and
# every query is scoped to the user id from the verified JWT, never the body.
def service_headers(extra: dict[str, str] | None = None) -> dict[str, str]:
    headers: dict[str, str] = {
        "apikey": SUPABASE_SERVICE_KEY or "",
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY or ''}",
        "Content-Type": "application/json",
    }
    if extra:
        headers.update(extra)
    return headers


def require_supabase() -> None:
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise RuntimeError("Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE in .env")


# -------- Helpers --------
# The current time as an ISO string, for created_at and updated_at columns.
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# True when a PostgREST error means "this table does not exist yet" (schema.sql
# not pasted). Callers treat that as empty, so reads work before setup.
def is_missing_table(body: str) -> bool:
    return "42P01" in body or "Could not find the table" in body
