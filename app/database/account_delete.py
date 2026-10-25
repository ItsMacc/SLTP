# account_delete.py — Full account erasure.
#
# Deleting an account has to touch three places. The order matters:
#
#   Supabase     auth.users — FIRST, and load-bearing. This is the credential.
#                While it exists, the same email can sign in again and be
#                silently re-provisioned, which is exactly the bug this
#                endpoint exists to close. Once it is gone the person cannot
#                sign in, so a later failure in the data cleanup below can
#                leave orphaned rows but never a live account with missing data.
#   Supabase     public.users profile row
#   Turso        Lab work, API keys, portfolios and the users row
#                (the mirror the nightly runner reads)
#
# The caller is authenticated by get_current_user before this handler runs, and
# the uid comes from that verified token, never from the request body, so one
# user cannot delete another. Every step is idempotent (already-gone counts as
# gone), so a retry after a partial failure is safe.
#
# learn_progress and user_awards both carry ON DELETE CASCADE to auth.users, so
# the learn badge rows go with the auth user rather than being orphaned.

# -------- Imports --------
import os
from typing import Any

import requests
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException

from app.auth.auth import get_current_user
from app.database import turso
from app.database.api_keys import delete_user_api_keys

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

    The auth credential is removed first. If that fails the endpoint returns 409
    before touching any data, because the account is still usable and the
    person must be able to retry. Once it succeeds the account can no longer
    sign in, so data-cleanup failures are reported as warnings for retry rather
    than failing the request.
    """
    user_id = user["id"]
    removed: dict[str, Any] = {
        "supabase_auth": False,
        "supabase_profile": False,
        "turso_lab": 0,
        "turso_api_keys": 0,
        "turso_portfolios": 0,
        "turso_users": 0,
    }
    warnings: list[str] = []

    # ---- Supabase auth: the credential. First, and required. ----
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise HTTPException(
            status_code=409,
            detail="Could not delete your sign-in credentials, so the account is still active. "
            "Supabase service key is missing.",
        )
    try:
        auth_resp = requests.delete(
            f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}",
            headers=_service_headers(),
            timeout=SUPABASE_TIMEOUT,
        )
        # 200 = deleted, 404 = already gone (idempotent success).
        if auth_resp.status_code not in (200, 204, 404):
            raise HTTPException(
                status_code=409,
                detail=(
                    "Could not delete your sign-in credentials, so the account is still active. "
                    f"Supabase auth user not deleted (HTTP {auth_resp.status_code}): {auth_resp.text[:160]}"
                ),
            )
        removed["supabase_auth"] = True
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(
            status_code=409,
            detail=f"Could not delete your sign-in credentials, so the account is still active. {e}",
        ) from e

    # ---- Supabase: the public profile row ----
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

    # ---- Turso: Lab work, deepest rows first (files, folders, projects,
    #      workspaces). Child rows are deleted explicitly because Turso may
    #      not enforce ON DELETE CASCADE. ----
    try:
        for table in ("lab_files", "lab_folders", "lab_projects", "lab_workspaces"):
            await turso.execute(f"DELETE FROM {table} WHERE user_id = ?", [user_id])
        removed["turso_lab"] = 1
    except Exception as e:  # noqa: BLE001 - report, never abort the cascade
        warnings.append(f"Turso Lab data not deleted: {e}")

    # ---- Turso: API keys ----
    try:
        await delete_user_api_keys(user_id)
        removed["turso_api_keys"] = 1
    except Exception as e:  # noqa: BLE001
        warnings.append(f"Turso API keys not deleted: {e}")

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

    return {"deleted": True, "user_id": user_id, "removed": removed, "warnings": warnings}
