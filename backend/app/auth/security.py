# security.py — login device security.
#
# On successful sign-in ONLY (never during normal API usage), the frontend
# posts to /api/user/login-event. We record:
#   - a SHA-256 hash of the client IP (the raw IP is never stored)
#   - a SHA-256 hash of the User-Agent plus a friendly label ("Chrome on macOS")
#   - first_seen / last_seen timestamps per device
# Device history lives in profile settings under login_devices (max 10).
#
# Purpose: device security only. The user learns a new device signed in; we
# never use this data for tracking, profiling, or analytics.

# -------- Imports --------
import hashlib

from typing import Any
from datetime import datetime, timezone

from pydantic import BaseModel
from fastapi import APIRouter, Depends, Request

# Auth imports
from app.auth.jwt_auth import get_current_user

# Database imports
from app.users import store

router = APIRouter()

MAX_DEVICES = 10


# -------- Request Bodies --------
class LoginEventIn(BaseModel):
    at: str | None = None
    # The browser's IANA zone, so the alert reads in the reader's own clock.
    tz: str | None = None


# -------- Helpers --------
# The SHA-256 of a value, so the raw value is never stored.
def _hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


# The client IP, preferring the forwarded chain set by proxies.
def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# A readable stamp in the reader's zone ("Nov 13, 2026 at 4:27 AM AEDT").
# The raw ISO string is what used to land in the email; nobody reads that.
def _friendly_time(value: str | None, tz_name: str | None) -> str:
    moment: datetime | None = None
    if value:
        try:
            moment = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            moment = None
    if moment is None:
        moment = datetime.now(timezone.utc)
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)

    zone = timezone.utc
    if tz_name:
        try:
            from zoneinfo import ZoneInfo
            zone = ZoneInfo(tz_name)
        except Exception:
            # An unknown zone must never cost the reader their alert.
            zone = timezone.utc

    local = moment.astimezone(zone)
    hour = local.strftime("%I").lstrip("0") or "12"
    stamp = f"{local:%b} {local.day}, {local.year} at {hour}:{local:%M %p}"
    label = local.tzname()
    return f"{stamp} ({label})" if label else stamp


# A friendly device label from the User-Agent ("Chrome on macOS").
def _device_label(user_agent: str) -> str:
    ua = user_agent.lower()
    if "iphone" in ua or "ipad" in ua:
        device = "iPhone/iPad"
    elif "android" in ua:
        device = "Android"
    elif "mac" in ua:
        device = "macOS"
    elif "windows" in ua:
        device = "Windows"
    elif "linux" in ua:
        device = "Linux"
    else:
        device = "Unknown device"
    if "chrome" in ua and "edg" not in ua:
        browser = "Chrome"
    elif "safari" in ua and "chrome" not in ua:
        browser = "Safari"
    elif "firefox" in ua:
        browser = "Firefox"
    elif "edg" in ua:
        browser = "Edge"
    else:
        browser = "Browser"
    return f"{browser} on {device}"


# -------- Endpoints --------
# Record one sign-in's device. Called once per login, never per request.
@router.post("/api/user/login-event")
async def record_login_event(
    body: LoginEventIn,
    request: Request,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    user_id: str = user["id"]
    profile = store.get_profile(user_id) or {}
    settings: dict[str, Any] = dict(profile.get("settings") or {})

    user_agent: str = request.headers.get("user-agent", "")
    device = {
        "ip_hash": _hash(_client_ip(request)),
        "ua_hash": _hash(user_agent),
        "label": _device_label(user_agent),
        "first_seen": body.at or datetime.now(timezone.utc).isoformat(),
        "last_seen": body.at or datetime.now(timezone.utc).isoformat(),
    }

    devices: list[dict[str, Any]] = [d for d in settings.get("login_devices", []) if isinstance(d, dict)]
    # A device is the browser, not the network. Home and mobile IPs rotate
    # several times a day, and matching on the hash as well turned every one of
    # those into a "new device" email. The IP hash is still recorded; it just no
    # longer decides whether the sign-in is familiar.
    match = next(
        (d for d in devices if d.get("ua_hash") == device["ua_hash"]),
        None,
    )
    is_new = match is None
    if match:
        match["last_seen"] = device["last_seen"]
        match["label"] = device["label"]
    else:
        devices.append(device)
        devices = devices[-MAX_DEVICES:]

    settings["login_devices"] = devices
    store.save_settings(user_id, settings)

    # A new device gets one warning email, unless the user opted out. The IP
    # itself is never mailed either — the label and time are enough to
    # recognise the sign-in.
    emailed = False
    if is_new and settings.get("securityWarnings", True) and user.get("email"):
        from app.notify.mailer import security_warning_email

        ok, _ = security_warning_email(
            user["email"],
            user.get("name") or user["email"],
            "New device sign-in",
            device=device["label"],
            when=_friendly_time(device["last_seen"], body.tz),
        )
        emailed = bool(ok)

    return {"recorded": True, "new_device": is_new, "emailed": emailed}
