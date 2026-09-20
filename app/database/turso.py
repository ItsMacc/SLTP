import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any

import aiohttp
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


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _id() -> str:
    return str(uuid.uuid4())


def _parse_json(text: Any, default: Any) -> Any:
    try:
        return json.loads(text) if text else default
    except (TypeError, ValueError):
        return default


# ------------------------------------------------------------------
# Users (mirror of Supabase auth users)
# ------------------------------------------------------------------
async def upsert_user(user_id: str, name: str | None, email: str | None,
                      settings: dict[str, Any] | None) -> None:
    await execute("DELETE FROM users WHERE id = ?", [user_id])
    await execute(
        "INSERT INTO users (id, name, email, settings_json, created_at) VALUES (?, ?, ?, ?, ?)",
        [user_id, name, email, json.dumps(settings or {}), _now()],
    )


async def get_user(user_id: str) -> dict[str, Any] | None:
    """Read: user name/email/settings (frontend: settings page, runner: emails)."""
    rows = await execute(
        "SELECT id, name, email, settings_json FROM users WHERE id = ?", [user_id]
    )
    if not rows:
        return None
    r = rows[0]
    r["settings"] = _parse_json(r.pop("settings_json"), {})
    return r


async def get_all_users() -> list[dict[str, Any]]:
    """Read: every cached user — the runner's mailing list."""
    rows = await execute("SELECT id, name, email, settings_json FROM users")
    for r in rows:
        r["settings"] = _parse_json(r.pop("settings_json"), {})
    return rows


# ------------------------------------------------------------------
# Portfolios
# ------------------------------------------------------------------
async def get_portfolio(user_id: str) -> dict[str, Any] | None:
    """Read: onboarding status + summary (frontend: portfolio page)."""
    rows = await execute("SELECT * FROM portfolios WHERE user_id = ?", [user_id])
    if not rows:
        return None
    r = rows[0]
    r["preferences"] = _parse_json(r.pop("preferences_json", None), {})
    return r


async def upsert_portfolio(user_id: str, *, name: str, base_currency: str,
                           starting_cash: float, preferences: dict[str, Any],
                           onboarded: bool) -> None:
    """Write: called once when the user completes the setup wizard."""
    now = _now()
    existing = await execute("SELECT id FROM portfolios WHERE user_id = ?", [user_id])
    if existing:
        await execute(
            """UPDATE portfolios
               SET name = ?, base_currency = ?, starting_cash = ?, preferences_json = ?,
                   onboarded = ?, updated_at = ?
               WHERE user_id = ?""",
            [name, base_currency, starting_cash, json.dumps(preferences),
             int(onboarded), now, user_id],
        )
    else:
        await execute(
            """INSERT INTO portfolios
               (id, user_id, name, base_currency, starting_cash, preferences_json,
                onboarded, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [_id(), user_id, name, base_currency, starting_cash,
             json.dumps(preferences), int(onboarded), now, now],
        )


# ------------------------------------------------------------------
# Watchlist
# ------------------------------------------------------------------
async def list_watchlist(user_id: str) -> list[dict[str, Any]]:
    """Read: the user's tickers (frontend: portfolio/watchlist views)."""
    return await execute(
        "SELECT id, ticker, note, created_at FROM watchlist_items WHERE user_id = ? ORDER BY created_at DESC",
        [user_id],
    )


async def watchlist_tickers(user_id: str) -> list[str]:
    """Read: just the ticker symbols (runner: signal generation)."""
    rows = await execute("SELECT ticker FROM watchlist_items WHERE user_id = ?", [user_id])
    return [r["ticker"] for r in rows]


async def add_watchlist_item(user_id: str, ticker: str, note: str | None = None) -> dict[str, Any]:
    """Write: add one ticker (idempotent per user+ticker)."""
    now = _now()
    item_id = _id()
    ticker = ticker.upper()
    await execute(
        """INSERT OR IGNORE INTO watchlist_items (id, user_id, ticker, note, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        [item_id, user_id, ticker, note, now, now],
    )
    return {"id": item_id, "ticker": ticker}


async def remove_watchlist_item(user_id: str, ticker: str) -> None:
    """Write: remove one ticker."""
    await execute("DELETE FROM watchlist_items WHERE user_id = ? AND ticker = ?",
                  [user_id, ticker.upper()])


# ------------------------------------------------------------------
# Strategy follows
# ------------------------------------------------------------------
async def list_follows(user_id: str) -> list[dict[str, Any]]:
    """Read: which strategies the user follows (frontend + runner)."""
    return await execute(
        """SELECT id, strategy_id, strategy_name, notify_email, created_at
           FROM strategy_follows WHERE user_id = ? ORDER BY created_at DESC""",
        [user_id],
    )


async def follow_strategy(user_id: str, strategy_id: str, strategy_name: str,
                          notify_email: bool = True) -> None:
    """Write: follow a strategy (idempotent per user+strategy)."""
    now = _now()
    existing = await execute(
        "SELECT id FROM strategy_follows WHERE user_id = ? AND strategy_id = ?",
        [user_id, strategy_id],
    )
    if existing:
        await execute(
            """UPDATE strategy_follows
               SET strategy_name = ?, notify_email = ?, updated_at = ?
               WHERE user_id = ? AND strategy_id = ?""",
            [strategy_name, int(notify_email), now, user_id, strategy_id],
        )
    else:
        await execute(
            """INSERT INTO strategy_follows
               (id, user_id, strategy_id, strategy_name, notify_email, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            [_id(), user_id, strategy_id, strategy_name, int(notify_email), now, now],
        )


async def unfollow_strategy(user_id: str, strategy_id: str) -> None:
    """Write: stop following a strategy."""
    await execute("DELETE FROM strategy_follows WHERE user_id = ? AND strategy_id = ?",
                  [user_id, strategy_id])


# ------------------------------------------------------------------
# Strategy universes (per user+strategy universe + rebalance state)
# ------------------------------------------------------------------
async def upsert_strategy_universe(user_id: str, strategy_id: str, tickers: list[str],
                                   initialized_date: str, rebalance_frequency: str,
                                   next_rebalance_date: str | None) -> None:
    """Write: create or replace a strategy's universe snapshot + rebalance schedule."""
    now = _now()
    existing = await execute(
        "SELECT id FROM strategy_universes WHERE user_id = ? AND strategy_id = ?",
        [user_id, strategy_id],
    )
    if existing:
        await execute(
            """UPDATE strategy_universes
               SET tickers_json = ?, initialized_date = ?, rebalance_frequency = ?,
                   next_rebalance_date = ?, updated_at = ?
               WHERE user_id = ? AND strategy_id = ?""",
            [json.dumps(tickers), initialized_date, rebalance_frequency,
             next_rebalance_date, now, user_id, strategy_id],
        )
    else:
        await execute(
            """INSERT INTO strategy_universes
               (id, user_id, strategy_id, tickers_json, initialized_date,
                rebalance_frequency, next_rebalance_date, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [_id(), user_id, strategy_id, json.dumps(tickers), initialized_date,
             rebalance_frequency, next_rebalance_date, now, now],
        )


async def get_strategy_universe(user_id: str, strategy_id: str) -> dict[str, Any] | None:
    """Read: one strategy's universe state (runner: rebalance check, frontend: display)."""
    rows = await execute(
        "SELECT * FROM strategy_universes WHERE user_id = ? AND strategy_id = ?",
        [user_id, strategy_id],
    )
    if not rows:
        return None
    r = rows[0]
    r["tickers"] = _parse_json(r.pop("tickers_json"), [])
    return r


async def mark_strategy_rebalanced(user_id: str, strategy_id: str,
                                   rebalance_date: str, next_rebalance_date: str) -> None:
    """Write: after the runner executes on_rebalance, record last/next dates."""
    await execute(
        """UPDATE strategy_universes
           SET last_rebalance_date = ?, next_rebalance_date = ?, updated_at = ?
           WHERE user_id = ? AND strategy_id = ?""",
        [rebalance_date, next_rebalance_date, _now(), user_id, strategy_id],
    )


async def replace_strategy_universe_tickers(user_id: str, strategy_id: str,
                                            tickers: list[str]) -> None:
    """Write: update only the ticker list (after a rebalance swaps holdings)."""
    await execute(
        """UPDATE strategy_universes
           SET tickers_json = ?, updated_at = ?
           WHERE user_id = ? AND strategy_id = ?""",
        [json.dumps(tickers), _now(), user_id, strategy_id],
    )


# ------------------------------------------------------------------
# Signals
# ------------------------------------------------------------------
async def insert_signal(strategy_id: str, ticker: str, signal_type: str,
                        confidence: float | None, price: float | None,
                        signal_date: str) -> str:
    """Write: one signal from the daily runner."""
    signal_id = _id()
    await execute(
        """INSERT INTO signals
           (id, strategy_id, ticker, signal_type, confidence, price, signal_date, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        [signal_id, strategy_id, ticker.upper(), signal_type.upper(), confidence, price,
         signal_date, _now()],
    )
    return signal_id


async def get_signals(user_id: str, limit: int = 50) -> list[dict[str, Any]]:
    """Read: latest signals for strategies the user follows (frontend: signals feed)."""
    return await execute(
        """SELECT s.id, s.strategy_id, s.ticker, s.signal_type, s.confidence, s.price,
                  s.signal_date, s.created_at
           FROM signals s
           JOIN strategy_follows f
             ON f.user_id = ? AND f.strategy_id = s.strategy_id
           ORDER BY s.signal_date DESC, s.created_at DESC
           LIMIT ?""",
        [user_id, limit],
    )
