# jwt_auth.py — Supabase JWT verification for FastAPI endpoints.
#
# Newer Supabase projects sign session tokens with ES256 (asymmetric keys
# published at /auth/v1/.well-known/jwks.json) rather than the legacy HS256
# shared secret. We verify via JWKS first and fall back to HS256.
# PyJWKClientError is caught so unknown-key errors become 401s, not 500s.

# -------- Imports --------
import os

from typing import Any

import jwt
import requests
from fastapi import Header, HTTPException
from jwt import PyJWKClient, PyJWKClientError

from app.config import SUPABASE_URL

# -------- Configuration --------
SUPABASE_JWT_SECRET: str | None = os.environ.get("SUPABASE_JWT")

_JWKS_URL: str = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
_jwks_client: PyJWKClient | None = None

# Tolerance for clock drift between this host and Supabase's servers, in
# seconds. PyJWT only accepts `leeway` as a top-level decode argument (the
# `options` dict key is ignored), so it must be passed explicitly.
LEEWAY_S: int = 120


# -------- Helper Methods --------
# The cached JWKS client.
def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient(_JWKS_URL, cache_keys=True, lifespan=3600)
    return _jwks_client


# Verify the Supabase access token: JWKS first, HS256 fallback.
def _verify_token(token: str) -> dict[str, Any]:
    last_error: Exception = jwt.InvalidTokenError("Token verification failed")

    try:
        signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256", "ES256", "HS256"],
            audience=["authenticated"],
            leeway=LEEWAY_S,
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
                leeway=LEEWAY_S,
            )
        except jwt.InvalidTokenError as hs_err:
            last_error = hs_err

    if isinstance(last_error, jwt.ExpiredSignatureError):
        raise last_error
    raise jwt.InvalidTokenError(str(last_error))


# -------- FastAPI Dependency --------
# Verify the access token from the Authorization header and return the user context.
async def get_current_user(authorization: str = Header(default="")) -> dict[str, Any]:
    # Returns { 'id': <supabase uid>, 'email': ..., 'name': ..., 'settings': {...} }
    from app.users import store
    from app.turso import userdata

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token: str = authorization.removeprefix("Bearer ").strip()

    # Personal API keys (issued in Settings) are checked against the api_keys
    # table. Imported here because api_keys imports this module.
    if token.startswith("sltp_"):
        import hashlib

        key_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        key_user_id: str | None = userdata.user_id_for_key_hash(key_hash)
        if not key_user_id:
            raise HTTPException(status_code=401, detail="Invalid API key")
        profile = store.get_profile(key_user_id) or {}
        return {
            "id": key_user_id,
            "email": profile.get("email"),
            "name": profile.get("name"),
            "settings": profile.get("settings") or {},
        }

    try:
        payload: dict[str, Any] = _verify_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

    user_id: str = payload.get("sub") or ""
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing subject")

    profile = store.get_profile(user_id) or {}

    return {
        "id": user_id,
        "email": profile.get("email") or payload.get("email"),
        "name": profile.get("name") or payload.get("user_metadata", {}).get("name"),
        "settings": profile.get("settings") or {},
    }
