# account_delete.py — Full account erasure.
#
# Deleting an account has to touch three places, and stopping at any one of
# them leaves the person able to sign back in to a half-dead account:
#
#   Turso        portfolios + users rows (the mirror the nightly runner reads)
#   Supabase     public.users profile row
#   Supabase     auth.users — THE ONE THAT MATTERS. This is the credential.
#                While it exists, the same email can sign in again and be
#                silently re-provisioned, which is exactly the bug this
#                endpoint exists to close.
#
# Deleting the auth user last is deliberate: until it is gone the JWT that
# authorised this request is still valid, and we need it to prove the caller
# is the owner. It also cascades on its own — learn_progress and user_awards
# both carry ON DELETE CASCADE to auth.users, so the learn badge rows go with
# it rather than being orphaned against a dead uid.
#
# Only the signed-in owner can call this (get_current_user verifies the JWT),
# and the uid is taken from that verified token — never from the request
# body — so one user cannot delete another.

# -------- Imports --------
import os
from typing import Any

import requests
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException

from app.auth.auth import get_current_user
from app.database import turso

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://jqyqfkrzwimxuzugyuiw.supabase.co")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE")

router = APIRouter()

SUPABASE_TIMEOUT = 15


def _service_headers() -> dict[str, str]:
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }


# -------- Endpoints --------

@router.delete("/api/user/account")
async def delete_account(
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Erase the caller everywhere. Idempotent: already-gone counts as gone.

    Returns a per-store breakdown so the client can tell the user exactly what
    was removed. If the AUTH deletion fails the endpoint fails loudly (409)
    rather than reporting success, because a surviving auth user means the
    account is not actually gone.
    """
    user_id = user["id"]
    removed: dict[str, Any] = {
        "turso_portfolios": 0,
        "turso_users": 0,
        "supabase_profile": False,
        "supabase_auth": False,
    }
    warnings: list[str] = []

    # ---- Turso: portfolios first, then the user row ----
    # (no FK between them today, but portfolio is the dependent record and
    #  this ordering stays correct if one is ever added)
    try:
        await turso.execute("DELETE FROM portfolios WHERE user_id = ?", [user_id])
        removed["turso_portfolios"] = 1
    except Exception as e:  # noqa: BLE001 - report, never abort the cascade
        warnings.append(f"Turso portfolios not deleted: {e}")

    try:
        await turso.execute("DELETE FROM users WHERE id = ?", [user_id])
        removed["turso_users"] = 1
    except Exception as e:  # noqa: BLE001
        warnings.append(f"Turso user row not deleted: {e}")

    # ---- Supabase: the public profile row ----
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        warnings.append("Supabase service key missing — auth user NOT deleted")
    else:
        try:
            resp = requests.delete(
                f"{SUPABASE_URL}/rest/v1/users",
                params={"id": f"eq.{user_id}"},
                headers=_service_headers(),
                timeout=SUPABASE_TIMEOUT,
            )
            # 204/200 both mean the delete was accepted; PostgREST returns 204
            # whether or not a row matched, which is fine — absence is success.
            if resp.status_code in (200, 204):
                removed["supabase_profile"] = True
            else:
                warnings.append(
                    f"Supabase profile row not deleted (HTTP {resp.status_code}): {resp.text[:160]}"
                )
        except Exception as e:  # noqa: BLE001
            warnings.append(f"Supabase profile row not deleted: {e}")

        # ---- Supabase auth: the credential. Last, and load-bearing. ----
        try:
            auth_resp = requests.delete(
                f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}",
                headers=_service_headers(),
                timeout=SUPABASE_TIMEOUT,
            )
            # 200 = deleted, 404 = already gone (idempotent success).
            if auth_resp.status_code in (200, 204, 404):
                removed["supabase_auth"] = True
            else:
                warnings.append(
                    f"Supabase auth user not deleted (HTTP {auth_resp.status_code}): {auth_resp.text[:160]}"
                )
        except Exception as e:  # noqa: BLE001
            warnings.append(f"Supabase auth user not deleted: {e}")

    if not removed["supabase_auth"]:
        # Everything else can be retried; this cannot. The person can still
        # sign in, so we must not claim the account was deleted.
        raise HTTPException(
            status_code=409,
            detail=(
                "Could not delete your sign-in credentials, so the account is still active. "
                + " ".join(warnings)
            ),
        )

    return {"deleted": True, "user_id": user_id, "removed": removed, "warnings": warnings}
