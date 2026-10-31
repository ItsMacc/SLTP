# -------- security.py --------
# Login device security.
#
# On successful sign-in ONLY (never during normal API usage), the frontend posts to
# /api/user/login-event. We record:
#   - a SHA-256 hash of the client IP (the raw IP is never stored)
#   - a SHA-256 hash of the User-Agent plus a friendly label ("Chrome on macOS")
#   - first_seen / last_seen timestamps per device
# Device history lives in Supabase users.settings.login_devices (max 10).
#
# Purpose: device security only. The user learns a new device signed in; we never use
# this data for tracking, profiling, or analytics.

# -------- Imports --------
import os
import json
import hashlib
import requests

from typing import Any
from datetime import datetime, timezone
from dotenv import load_dotenv
from pydantic import BaseModel
from fastapi import APIRouter, Depends, Request

# Auth imports
from app.auth.auth import get_current_user

# Notification imports
from app.notification.mailer import security_warning_email

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://jqyqfkrzwimxuzugyuiw.supabase.co")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE")
HASH_SALT = os.environ.get("LOGIN_HASH_SALT", "sltp-login-device-salt-v1")


# -------- Configuration --------
MAX_DEVICES: int = 10

router = APIRouter()


# -------- Request Bodies --------
class LoginEventIn(BaseModel):
    # Optional client hint; the server derives IP and device itself. Cosmetic only.
    screen: str | None = None


# -------- Helper Methods --------
# SHA-256 with an app salt; one-way, raw values are never stored.
def _hash(value: str) -> str:
    return hashlib.sha256(f"{HASH_SALT}:{value}".encode()).hexdigest()


# First hop of X-Forwarded-For (set by the proxy), else the socket host.
def _client_ip(request: Request) -> str:
    forwarded: str = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# Friendly one-liner like "Chrome on macOS" from the User-Agent.
def _device_label(user_agent: str) -> str:
    ua: str = user_agent.lower()

    browser: str = "Browser"
    if "edg/" in ua:
        browser = "Edge"
    elif "chrome" in ua and "chromium" not in ua:
        browser = "Chrome"
    elif "firefox" in ua:
        browser = "Firefox"
    elif "safari" in ua and "chrome" not in ua:
        browser = "Safari"

    os_name: str = "an unknown device"
    if "iphone" in ua:
        os_name = "iPhone"
    elif "ipad" in ua:
        os_name = "iPad"
    elif "android" in ua:
        os_name = "Android device"
    elif "mac os" in ua or "macintosh" in ua:
        os_name = "macOS"
    elif "windows" in ua:
        os_name = "Windows"
    elif "cros" in ua:
        os_name = "ChromeOS"
    elif "linux" in ua:
        os_name = "Linux"

    return f"{browser} on {os_name}"


# Service-role headers, used for the settings read and write below.
def _supabase_headers() -> dict[str, str]:
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


# Read one user's settings blob from Supabase.
def _load_settings(user_id: str) -> dict[str, Any]:
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/users",
        params={"select": "settings", "id": f"eq.{user_id}"},
        headers=_supabase_headers(),
        timeout=10,
    )
    resp.raise_for_status()
    rows = resp.json()
    settings = rows[0].get("settings") if rows else {}
    return settings if isinstance(settings, dict) else {}


# Write one user's settings blob back to Supabase.
def _save_settings(user_id: str, settings: dict[str, Any]) -> None:
    requests.patch(
        f"{SUPABASE_URL}/rest/v1/users",
        params={"id": f"eq.{user_id}"},
        headers=_supabase_headers(),
        data=json.dumps({"settings": settings}),
        timeout=10,
    ).raise_for_status()


# -------- Endpoints --------
# Record a sign-in device check; called by the frontend right after login, never during normal traffic.
@router.post("/api/user/login-event")
async def record_login_event(
    request: Request,
    body: LoginEventIn | None = None,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    if not SUPABASE_SERVICE_KEY:
        return {"recorded": False, "reason": "not-configured"}

    user_id: str = user["id"]
    email: str | None = user.get("email")
    name: str = (user.get("name") or (email.split("@")[0] if email else "")) or "there"

    ip_hash: str = _hash(_client_ip(request))
    ua: str = request.headers.get("user-agent", "")
    device_hash: str = _hash(ua)
    device_label: str = _device_label(ua)
    now: str = datetime.now(timezone.utc).isoformat()

    try:
        settings = _load_settings(user_id)
    except Exception as e:
        print(f"[security] settings read failed for {user_id}: {e}")
        return {"recorded": False, "reason": "storage-error"}

    devices: list[dict[str, Any]] = settings.get("login_devices") or []
    known = next((d for d in devices if d.get("device_hash") == device_hash), None)

    is_first_device_ever: bool = len(devices) == 0
    is_new_device: bool = known is None

    if known:
        known["last_seen"] = now
        known["ip_hash"] = ip_hash  # refresh so IP changes are detectable later
    else:
        devices.append({
            "device_hash": device_hash,
            "label": device_label,
            "ip_hash": ip_hash,
            "first_seen": now,
            "last_seen": now,
        })

        # Cap history: keep the 10 most recently seen devices
        devices.sort(key=lambda d: d.get("last_seen", ""), reverse=True)
        devices = devices[:MAX_DEVICES]

    settings["login_devices"] = devices

    try:
        _save_settings(user_id, settings)
    except Exception as e:
        print(f"[security] settings write failed for {user_id}: {e}")
        return {"recorded": False, "reason": "storage-error"}

    # Notify on a NEW device only, never on the very first one (the user just signed
    # up on it)
    emailed: bool = False
    if is_new_device and not is_first_device_ever and email:
        when: str = datetime.now(timezone.utc).strftime("%b %d at %H:%M UTC")
        try:
            security_warning_email(
                email, name,
                event="New sign-in from an unrecognized device",
                ip_address=None,  # raw IP is never stored, so never shown
                device=device_label,
                when=when,
            )
            emailed = True
        except Exception as e:
            print(f"[security] alert email failed for {user_id}: {e}")

    return {
        "recorded": True,
        "new_device": is_new_device,
        "notified": emailed,
        "device_label": device_label,
    }
