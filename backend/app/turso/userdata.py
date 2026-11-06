# userdata.py — every Turso read and write, in one file.
#
# Each table carries the Supabase auth uid in a TEXT user_id column, so every
# row traces to exactly one login and every query is scoped to the id from
# the verified JWT, never the request body. JSON columns travel as TEXT and
# are dumped on write, parsed on read.

# -------- Imports --------
import json
import uuid

from typing import Any

from app.config import now_iso
from app.turso.client import execute, execute_one


# -------- Helpers --------
def _new_id() -> str:
    return str(uuid.uuid4())


def _parse_json(value: Any, default: Any) -> Any:
    if value is None:
        return default
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return default


# -------- Portfolios (setup wizard) --------
def get_portfolio(user_id: str) -> dict[str, Any] | None:
    row = execute_one(
        "SELECT user_id, name, starting_cash, base_currency, preferences, onboarded"
        " FROM portfolios WHERE user_id = ?",
        [user_id],
    )
    if not row:
        return None
    return {
        "id": row["user_id"],
        "name": row["name"],
        "starting_cash": row["starting_cash"],
        "base_currency": row["base_currency"],
        "preferences": _parse_json(row["preferences"], {}),
        "onboarded": bool(row["onboarded"]),
    }


def upsert_portfolio(user_id: str, *, name: str, base_currency: str,
                     starting_cash: float, preferences: dict[str, Any], onboarded: bool) -> None:
    execute(
        "INSERT INTO portfolios (user_id, name, starting_cash, base_currency, preferences, onboarded, updated_at)"
        " VALUES (?, ?, ?, ?, ?, ?, ?)"
        " ON CONFLICT(user_id) DO UPDATE SET name = excluded.name, starting_cash = excluded.starting_cash,"
        " base_currency = excluded.base_currency, preferences = excluded.preferences,"
        " onboarded = excluded.onboarded, updated_at = excluded.updated_at",
        [user_id, name, starting_cash, base_currency, json.dumps(preferences),
         1 if onboarded else 0, now_iso()],
    )


def delete_portfolios(user_id: str) -> None:
    execute("DELETE FROM portfolios WHERE user_id = ?", [user_id])


# Raw preferences blobs, for the followed-strategies tally in the report.
def all_portfolio_preferences() -> list[dict[str, Any]]:
    return [_parse_json(row.get("preferences"), {}) for row in execute("SELECT preferences FROM portfolios")]


# -------- API keys (+ tier) --------
# Every key belongs to a tier; today everything is free, and a future premium
# rollout only has to write this column. The tier travels with the list so
# the frontend can already show it.
def list_api_keys(user_id: str) -> list[dict[str, Any]]:
    return [
        {
            "id": row["id"],
            "name": row["name"],
            "key_prefix": row["key_prefix"],
            "tier": row.get("tier") or "free",
            "created_at": row["created_at"],
            "last_used_at": row["last_used_at"],
        }
        for row in execute(
            "SELECT id, name, key_prefix, tier, created_at, last_used_at"
            " FROM api_keys WHERE user_id = ? ORDER BY created_at",
            [user_id],
        )
    ]


def insert_api_key(user_id: str, name: str, prefix: str, key_hash: str) -> str:
    key_id = _new_id()
    execute(
        "INSERT INTO api_keys (id, user_id, name, key_prefix, key_hash, tier, created_at)"
        " VALUES (?, ?, ?, ?, ?, 'free', ?)",
        [key_id, user_id, name, prefix, key_hash, now_iso()],
    )
    return key_id


def delete_api_key(user_id: str, key_id: str) -> bool:
    row = execute_one(
        "SELECT id FROM api_keys WHERE id = ? AND user_id = ?",
        [key_id, user_id],
    )
    if not row:
        return False
    execute("DELETE FROM api_keys WHERE id = ? AND user_id = ?", [key_id, user_id])
    return True


def delete_user_api_keys(user_id: str) -> None:
    execute("DELETE FROM api_keys WHERE user_id = ?", [user_id])


# Future premium hook: move one key to another tier. No endpoint yet.
def set_key_tier(key_id: str, tier: str) -> None:
    execute("UPDATE api_keys SET tier = ? WHERE id = ?", [tier, key_id])


# -------- Watchlists --------
# One symbol list per user, stored as a JSON blob. Small today, but symbol
# metadata per row would bloat Supabase, so it lives here with the rest.
def get_watchlist(user_id: str) -> list[str]:
    row = execute_one("SELECT items FROM watchlists WHERE user_id = ?", [user_id])
    items = _parse_json((row or {}).get("items"), [])
    return [s for s in items if isinstance(s, str)]


def set_watchlist(user_id: str, items: list[str]) -> list[str]:
    clean = [s for s in items if isinstance(s, str)]
    execute(
        "INSERT INTO watchlists (user_id, items, updated_at) VALUES (?, ?, ?)"
        " ON CONFLICT(user_id) DO UPDATE SET items = excluded.items, updated_at = excluded.updated_at",
        [user_id, json.dumps(clean), now_iso()],
    )
    return clean


# -------- Lab strategies (user-written code) --------
# Pyodide and OPFS own the live editing; Turso is the cloud copy, so code
# survives a cleared browser. One row per saved file.
def save_strategy(user_id: str, name: str, code: str, strategy_id: str | None = None) -> str:
    now = now_iso()
    if strategy_id:
        execute(
            "UPDATE user_strategies SET name = ?, code = ?, updated_at = ? WHERE id = ? AND user_id = ?",
            [name, code, now, strategy_id, user_id],
        )
        if execute_one("SELECT id FROM user_strategies WHERE id = ? AND user_id = ?",
                       [strategy_id, user_id]):
            return strategy_id
    sid = _new_id()
    execute(
        "INSERT INTO user_strategies (id, user_id, name, code, created_at, updated_at)"
        " VALUES (?, ?, ?, ?, ?, ?)",
        [sid, user_id, name, code, now, now],
    )
    return sid


def list_strategies(user_id: str) -> list[dict[str, Any]]:
    return [
        {"id": row["id"], "name": row["name"],
         "created_at": row["created_at"], "updated_at": row["updated_at"]}
        for row in execute(
            "SELECT id, name, created_at, updated_at FROM user_strategies"
            " WHERE user_id = ? ORDER BY updated_at DESC",
            [user_id],
        )
    ]


def get_strategy(user_id: str, strategy_id: str) -> dict[str, Any] | None:
    return execute_one(
        "SELECT id, name, code, created_at, updated_at FROM user_strategies"
        " WHERE id = ? AND user_id = ?",
        [strategy_id, user_id],
    )


def delete_strategy(user_id: str, strategy_id: str) -> bool:
    if not get_strategy(user_id, strategy_id):
        return False
    execute("DELETE FROM user_strategies WHERE id = ? AND user_id = ?", [strategy_id, user_id])
    return True


# -------- Backtest results (run once, reopen free) --------
# A cached run: equity curves and trade lists are the bulky JSON Supabase
# should not carry. The list view omits the blobs; the detail view has them.
def save_result(user_id: str, *, strategy_ref: str, params: dict[str, Any],
                metrics: dict[str, Any], equity: list[Any], trades: list[Any]) -> str:
    rid = _new_id()
    execute(
        "INSERT INTO backtest_results (id, user_id, strategy_ref, params, metrics, equity, trades, created_at)"
        " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [rid, user_id, strategy_ref, json.dumps(params), json.dumps(metrics),
         json.dumps(equity), json.dumps(trades), now_iso()],
    )
    return rid


def list_results(user_id: str, limit: int = 50) -> list[dict[str, Any]]:
    rows = execute(
        "SELECT id, strategy_ref, params, metrics, created_at FROM backtest_results"
        " WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
        [user_id, max(1, min(limit, 200))],
    )
    return [
        {"id": row["id"], "strategy_ref": row["strategy_ref"],
         "params": _parse_json(row["params"], {}), "metrics": _parse_json(row["metrics"], {}),
         "created_at": row["created_at"]}
        for row in rows
    ]


def get_result(user_id: str, result_id: str) -> dict[str, Any] | None:
    row = execute_one(
        "SELECT id, strategy_ref, params, metrics, equity, trades, created_at"
        " FROM backtest_results WHERE id = ? AND user_id = ?",
        [result_id, user_id],
    )
    if not row:
        return None
    return {
        "id": row["id"],
        "strategy_ref": row["strategy_ref"],
        "params": _parse_json(row["params"], {}),
        "metrics": _parse_json(row["metrics"], {}),
        "equity": _parse_json(row["equity"], []),
        "trades": _parse_json(row["trades"], []),
        "created_at": row["created_at"],
    }


def delete_result(user_id: str, result_id: str) -> bool:
    if not get_result(user_id, result_id):
        return False
    execute("DELETE FROM backtest_results WHERE id = ? AND user_id = ?", [result_id, user_id])
    return True


# -------- Operator counts --------
# Small aggregates for the morning report. Turso down reads as None instead
# of blanking the rest of the report.
def count_portfolios_onboarded() -> int | None:
    try:
        row = execute_one("SELECT COUNT(*) AS n FROM portfolios WHERE onboarded = 1")
        return int(row["n"]) if row else 0
    except Exception:
        return None


def count_api_keys() -> int | None:
    try:
        row = execute_one("SELECT COUNT(*) AS n FROM api_keys")
        return int(row["n"]) if row else 0
    except Exception:
        return None


# The owner of a key hash, touching last_used_at. None when unknown.
# Used by API-key auth in app/auth/jwt_auth.py.
def user_id_for_key_hash(key_hash: str) -> str | None:
    row = execute_one(
        "SELECT id, user_id FROM api_keys WHERE key_hash = ?",
        [key_hash],
    )
    if not row:
        return None
    execute("UPDATE api_keys SET last_used_at = ? WHERE id = ?", [now_iso(), row["id"]])
    return row.get("user_id")


# -------- Full user wipe (account deletion) --------
def delete_user_lab_data(user_id: str) -> None:
    execute("DELETE FROM watchlists WHERE user_id = ?", [user_id])
    execute("DELETE FROM user_strategies WHERE user_id = ?", [user_id])
    execute("DELETE FROM backtest_results WHERE user_id = ?", [user_id])
