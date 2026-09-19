# auth.py — Supabase JWT verification for FastAPI endpoints.
#
# Newer Supabase projects sign session tokens with ES256 (asymmetric keys
# published at /auth/v1/.well-known/jwks.json) rather than the legacy HS256
# shared secret. We verify via JWKS first and fall back to HS256.
# PyJWKClientError is caught so unknown-key errors become 401s, not 500s.

import os
from typing import Any

import jwt
import requests
from dotenv import load_dotenv
from fastapi import Header, HTTPException
from jwt import PyJWKClient, PyJWKClientError

load_dotenv()

SUPABASE_JWT_SECRET: str | None = os.environ.get("SUPABASE_JWT")
SUPABASE_URL: str | None = os.environ.get("SUPABASE_URL", "https://jqyqfkrzwimxuzugyuiw.supabase.co")
SUPABASE_SERVICE_KEY: str | None = os.environ.get("SUPABASE_SERVICE_ROLE")

_JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient(_JWKS_URL, cache_keys=True, lifespan=3600)
    return _jwks_client


def _verify_token(token: str) -> dict[str, Any]:
    """Verifies the Supabase access token (ES256 via JWKS, HS256 fallback)."""
    last_error: Exception

    try:
        signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience=["authenticated"],
            options={"leeway": 30},
        )
    except (jwt.InvalidTokenError, PyJWKClientError, ValueError) as jwks_err:
        last_error = jwks_err

    if SUPABASE_JWT_SECRET:
        try:
            return jwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience=["authenticated"],
                options={"leeway": 30},
            )
        except jwt.InvalidTokenError as hs_err:
            last_error = hs_err

    if isinstance(last_error, jwt.ExpiredSignatureError):
        raise last_error
    raise jwt.InvalidTokenError(str(last_error))


def _fetch_profile(user_id: str) -> dict[str, Any]:
    """Fetches name/email/settings from the Supabase public.users table."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return {}
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/users",
            params={"select": "id,name,email,settings", "id": f"eq.{user_id}"},
            headers={
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            },
            timeout=10,
        )
        resp.raise_for_status()
        rows = resp.json()
        return rows[0] if rows else {}
    except Exception as e:
        print(f"Supabase profile fetch failed for {user_id}: {e}")
        return {}


async def get_current_user(authorization: str = Header(default="")) -> dict[str, Any]:
    """
    FastAPI dependency: verifies the Supabase access token from the
    Authorization header and returns the authenticated user's context:
      { 'id': <supabase uid>, 'email': ..., 'name': ..., 'settings': {...} }
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = authorization.removeprefix("Bearer ").strip()

    try:
        payload = _verify_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

    user_id: str = payload.get("sub") or ""
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing subject")

    profile = _fetch_profile(user_id)
    settings = profile.get("settings")
    if isinstance(settings, str):
        import json
        try:
            settings = json.loads(settings)
        except ValueError:
            settings = {}

    return {
        "id": user_id,
        "email": profile.get("email") or payload.get("email"),
        "name": profile.get("name") or payload.get("user_metadata", {}).get("name"),
        "settings": settings or {},
    }
