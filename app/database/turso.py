import os
import uuid
import json
import aiohttp
from datetime import datetime, timezone
from typing import Any
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"))

TURSO_DATABASE_URL = os.environ.get("TURSO_DATABASE_URL")
TURSO_AUTH_TOKEN = os.environ.get("TURSO_AUTH_TOKEN")


# ------------------------------------------------------------------
# Connection
# ------------------------------------------------------------------
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


async def close() -> None:
    global _session
    if _session and not _session.closed:
        await _session.close()
    _session = None


# ------------------------------------------------------------------
# Value encoding / row decoding (Hrana v2 JSON protocol)
# ------------------------------------------------------------------
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


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------
def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _id() -> str:
    return str(uuid.uuid4())


# ------------------------------------------------------------------
# Users cache (Supabase mirror: id, name, email, settings)
# ------------------------------------------------------------------
async def upsert_user(user_id: str, name: str | None, email: str | None,
                      settings: dict[str, Any] | None) -> None:
    await execute("DELETE FROM users_cache WHERE id = ?", [user_id])
    await execute(
        "INSERT INTO users_cache (id, name, email, settings_json, synced_at) VALUES (?, ?, ?, ?, ?)",
        [user_id, name, email, json.dumps(settings or {}), _now()],
    )


async def get_all_users() -> list[dict[str, Any]]:
    """All cached users with parsed settings — the runner's mailing list."""
    rows = await execute("SELECT id, name, email, settings_json FROM users_cache")
    for r in rows:
        try:
            r["settings"] = json.loads(r.pop("settings_json") or "{}")
        except (TypeError, ValueError):
            r["settings"] = {}
    return rows


async def get_user(user_id: str) -> dict[str, Any] | None:
    rows = await execute("SELECT id, name, email, settings_json FROM users_cache WHERE id = ?", [user_id])
    if not rows:
        return None
    r = rows[0]
    try:
        r["settings"] = json.loads(r.pop("settings_json") or "{}")
    except (TypeError, ValueError):
        r["settings"] = {}
    return r


# ------------------------------------------------------------------
# Portfolios
# ------------------------------------------------------------------
async def get_or_create_portfolio(user_id: str, name: str | None = None) -> dict[str, Any]:
    rows = await execute("SELECT * FROM portfolios WHERE user_id = ?", [user_id])
    if rows:
        return rows[0]
    now = _now()
    pid = _id()
    await execute(
        """INSERT INTO portfolios (id, user_id, name, base_currency, starting_cash, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        [pid, user_id, name or "My Portfolio", "USD", 10000.0, now, now],
    )
    return (await execute("SELECT * FROM portfolios WHERE id = ?", [pid]))[0]


async def update_portfolio(user_id: str, *, name: str | None = None,
                           base_currency: str | None = None,
                           starting_cash: float | None = None) -> None:
    sets, args = [], []
    if name is not None:
        sets.append("name = ?"); args.append(name)
    if base_currency is not None:
        sets.append("base_currency = ?"); args.append(base_currency)
    if starting_cash is not None:
        sets.append("starting_cash = ?"); args.append(starting_cash)
    if not sets:
        return
    sets.append("updated_at = ?"); args.extend([_now(), user_id])
    await execute(f"UPDATE portfolios SET {', '.join(sets)} WHERE user_id = ?", args)


# ------------------------------------------------------------------
# Watchlist
# ------------------------------------------------------------------
async def list_watchlist(user_id: str) -> list[dict[str, Any]]:
    return await execute(
        "SELECT * FROM watchlist_items WHERE user_id = ? ORDER BY created_at DESC", [user_id]
    )


async def watchlist_tickers(user_id: str) -> list[str]:
    rows = await execute("SELECT ticker FROM watchlist_items WHERE user_id = ?", [user_id])
    return [r["ticker"] for r in rows]


async def add_watchlist_item(user_id: str, ticker: str, note: str | None = None,
                             target_price: float | None = None,
                             alert_above: float | None = None,
                             alert_below: float | None = None) -> dict[str, Any]:
    now = _now()
    item_id = _id()
    await execute(
        """INSERT OR IGNORE INTO watchlist_items
           (id, user_id, ticker, note, target_price, alert_above, alert_below, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        [item_id, user_id, ticker.upper(), note, target_price, alert_above, alert_below, now, now],
    )
    return {"id": item_id, "ticker": ticker.upper()}


async def remove_watchlist_item(user_id: str, ticker: str) -> None:
    await execute("DELETE FROM watchlist_items WHERE user_id = ? AND ticker = ?",
                  [user_id, ticker.upper()])


# ------------------------------------------------------------------
# Strategy follows
# ------------------------------------------------------------------
async def list_follows(user_id: str) -> list[dict[str, Any]]:
    return await execute(
        "SELECT * FROM strategy_follows WHERE user_id = ? ORDER BY created_at DESC", [user_id]
    )


async def follow_strategy(user_id: str, strategy_id: str, strategy_name: str,
                          notify_email: bool = True, auto_track: bool = False) -> None:
    now = _now()
    existing = await execute(
        "SELECT id FROM strategy_follows WHERE user_id = ? AND strategy_id = ?",
        [user_id, strategy_id],
    )
    if existing:
        await execute(
            """UPDATE strategy_follows
               SET strategy_name = ?, notify_email = ?, auto_track = ?, updated_at = ?
               WHERE user_id = ? AND strategy_id = ?""",
            [strategy_name, int(notify_email), int(auto_track), now, user_id, strategy_id],
        )
    else:
        await execute(
            """INSERT INTO strategy_follows
               (id, user_id, strategy_id, strategy_name, notify_email, auto_track, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            [_id(), user_id, strategy_id, strategy_name, int(notify_email), int(auto_track), now, now],
        )


async def unfollow_strategy(user_id: str, strategy_id: str) -> None:
    await execute("DELETE FROM strategy_follows WHERE user_id = ? AND strategy_id = ?",
                  [user_id, strategy_id])


# ------------------------------------------------------------------
# Signals
# ------------------------------------------------------------------
async def insert_signal(strategy_id: str, ticker: str, signal_type: str,
                        confidence: float | None, price: float | None,
                        signal_date: str, metrics: dict[str, Any] | None = None) -> str:
    signal_id = _id()
    await execute(
        """INSERT INTO signals
           (id, strategy_id, ticker, signal_type, confidence, price, signal_date, metrics_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        [signal_id, strategy_id, ticker.upper(), signal_type.upper(), confidence, price,
         signal_date, json.dumps(metrics or {}), _now()],
    )
    return signal_id


async def get_signals_for_date(signal_date: str, strategy_id: str | None = None) -> list[dict[str, Any]]:
    if strategy_id:
        return await execute(
            """SELECT * FROM signals WHERE signal_date = ? AND strategy_id = ?
               ORDER BY created_at DESC""",
            [signal_date, strategy_id],
        )
    return await execute(
        "SELECT * FROM signals WHERE signal_date = ? ORDER BY created_at DESC", [signal_date]
    )


# ------------------------------------------------------------------
# Notification outbox
# ------------------------------------------------------------------
async def queue_notification(user_id: str, kind: str, title: str, body: str,
                             payload: dict[str, Any] | None = None) -> str | None:
    """
    Writes a pending outbox row, respecting the user's settings gate
    (e.g. tradeSignals controls trade_signal notifications).
    Returns the notification id, or None when gated off.
    """
    user = await get_user(user_id)
    settings = (user or {}).get("settings", {})
    gates = {"trade_signal": "tradeSignals", "price_alert": "priceAlerts",
             "daily_summary": "dailySummary"}
    flag = gates.get(kind)
    if flag is not None and not settings.get(flag, False):
        return None

    notif_id = _id()
    await execute(
        """INSERT INTO notifications_outbox
           (id, user_id, kind, title, body, payload_json, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)""",
        [notif_id, user_id, kind, title, body, json.dumps(payload or {}), _now()],
    )
    return notif_id


async def pending_notifications(limit: int = 100) -> list[dict[str, Any]]:
    return await execute(
        """SELECT * FROM notifications_outbox WHERE status = 'pending'
           ORDER BY created_at ASC LIMIT ?""",
        [limit],
    )


async def mark_notification_sent(notif_id: str) -> None:
    await execute("UPDATE notifications_outbox SET status = 'sent', sent_at = ? WHERE id = ?",
                  [_now(), notif_id])


async def mark_notification_failed(notif_id: str, error: str) -> None:
    await execute("UPDATE notifications_outbox SET status = 'failed', error = ? WHERE id = ?",
                  [error[:500], notif_id])
