# account.py — full account erasure.
#
# Deleting an account has to touch three places. The order matters:
#
#   Supabase  auth.users — FIRST, and load-bearing. This is the credential.
#             While it exists, the same email can sign in again and be
#             silently re-provisioned, which is exactly the bug this
#             endpoint exists to close. Once it is gone the person cannot
#             sign in, so a later failure in the data cleanup below can
#             leave orphaned rows but never a live account with missing data.
#   Supabase  public.users profile row
#   Turso     portfolios, api_keys, watchlists, Lab strategies, cached results
#   Churn log the wipe leaves no trace of the account, so the operator
#             report reads from this log instead.
#
# The caller is authenticated by get_current_user before this handler runs,
# and the uid comes from that verified token, never from the request body, so
# one user cannot delete another. Every step is idempotent (already-gone
# counts as gone), so a retry after a partial failure is safe.

# -------- Imports --------
from typing import Any

import requests
from fastapi import APIRouter, Depends, HTTPException

# Auth imports
from app.auth.jwt_auth import get_current_user

# Database imports
from app.config import SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_TIMEOUT, service_headers
from app.turso import userdata
from app.users import store

router = APIRouter()


# -------- Endpoints --------
# Erase the caller everywhere; already-gone counts as gone.
@router.delete("/api/user/account")
async def delete_account(
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    # The auth credential is removed first. If that fails the endpoint returns
    # 409 before touching any data, because the account is still usable and the
    # person must be able to retry. Once it succeeds the account can no longer
    # sign in, so data-cleanup failures are reported as warnings, never errors.
    user_id: str = user["id"]
    removed: dict[str, Any] = {
        "supabase_auth": False,
        "supabase_profile": False,
        "portfolios": False,
        "api_keys": False,
        "lab_data": False,
    }
    warnings: list[str] = []

    # -------- Supabase Auth: The Credential --------
    # First, and required.
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise HTTPException(
            status_code=409,
            detail="Could not delete your sign-in credentials, so the account is still active. "
            "Supabase service key is missing.",
        )
    try:
        auth_resp = requests.delete(
            f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}",
            headers=service_headers(),
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

    # -------- Churn Log --------
    # The wipe below leaves no trace of this account, so the operator report
    # reads from this log instead. Best-effort: the credential is already gone,
    # so a failed log entry must not turn a completed deletion into an error.
    try:
        store.record_account_deletion(user_id, email=user.get("email"), name=user.get("name"))
    except Exception as e:  # noqa: BLE001
        warnings.append(f"Churn log entry not written: {e}")

    # -------- Profile, Portfolios, API Keys --------
    try:
        store.delete_profile(user_id)
        removed["supabase_profile"] = True
    except Exception as e:  # noqa: BLE001
        warnings.append(f"Profile row not deleted: {e}")

    try:
        userdata.delete_portfolios(user_id)
        removed["portfolios"] = True
    except Exception as e:  # noqa: BLE001 - report, never abort the cascade
        warnings.append(f"Portfolios not deleted: {e}")

    try:
        userdata.delete_user_api_keys(user_id)
        removed["api_keys"] = True
    except Exception as e:  # noqa: BLE001
        warnings.append(f"API keys not deleted: {e}")

    try:
        userdata.delete_user_lab_data(user_id)
        removed["lab_data"] = True
    except Exception as e:  # noqa: BLE001
        warnings.append(f"Lab data not deleted: {e}")

    return {"deleted": True, "user_id": user_id, "removed": removed, "warnings": warnings}
