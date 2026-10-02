# turso.py — Data layer over Turso (LibSQL HTTP pipeline).
#
# The app's two tables live here: users (Supabase auth mirror, refreshed
# by the runner) and portfolios (setup wizard answers). Also owns the
# signals table: strategy outputs written by the daily runner, deduped
# per (strategy, ticker, date) so re-runs are idempotent.
#
# Every function is a small focused read or write shared by the API
# and the daily runner.

# -------- Imports --------
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

# -------- Portfolio vocabulary --------
# Position lifecycle.
POSITION_OPEN = "open"
POSITION_CLOSED = "closed"

# Where a simulated position came from. Stored in positions.source and
# portfolio_snapshots.source so callers filter on this instead of on whether
# strategy_id happens to be NULL:
#   strategy -> produced by a strategy signal; strategy_id names it
#   manual   -> the user opened it themselves, no strategy involved
POSITION_SOURCE_STRATEGY = "strategy"
POSITION_SOURCE_MANUAL = "manual"
POSITION_SOURCES = {POSITION_SOURCE_STRATEGY, POSITION_SOURCE_MANUAL}

# Simulated deposits and withdrawals.
CASH_FLOW_KINDS = {"deposit", "withdrawal"}

# -------- Connection --------
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


# -------- Settings mirror (Supabase is authoritative) --------
async def mirror_settings(user_id: str, settings: dict[str, Any], *,
                          name: str | None = None,
                          email: str | None = None) -> bool:
    """Copies Supabase users.settings into this table's settings_json.

    Supabase is the source of truth for settings; this mirror exists so the
    nightly runner can read notification preferences without calling PostgREST
    per user. Previously the mirror only refreshed during a runner pass, which
    left it stale in Turso for the whole day after any settings change.

    name/email come from the verified token so a row created here is complete.
    They are only ever filled in, never blanked, so a call without them cannot
    wipe what an earlier write or the runner already stored.
    """
    payload = json.dumps(settings or {})
    now = _now()

    existing = await execute(
        "SELECT id, name, email FROM users WHERE id = ?", [user_id]
    )
    if not existing:
        await execute(
            """INSERT INTO users (id, name, email, settings_json, created_at)
               VALUES (?, ?, ?, ?, ?)""",
            [user_id, name, email, payload, now],
        )
        return True

    await execute(
        """UPDATE users
           SET settings_json = ?,
               name = COALESCE(?, name),
               email = COALESCE(?, email)
           WHERE id = ?""",
        [payload, name, email, user_id],
    )
    return True


async def close() -> None:
    global _session
    if _session and not _session.closed:
        await _session.close()
    _session = None


# -------- Helper Methods --------
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


# -------- Users (mirror of Supabase auth users) --------
async def upsert_user(user_id: str, name: str | None, email: str | None,
                      settings: dict[str, Any] | None) -> None:
    """Creates or refreshes the users row in ONE statement.

    Idempotent, so it is safe to fire on every sign-in. This deliberately
    creates NOTHING else: no portfolio, no follows, no positions. Those only
    appear once the user finishes onboarding.

    Previously this was DELETE-then-INSERT, which left a window where the row
    did not exist at all - anything reading concurrently saw no user, and a
    failure between the two statements lost the row entirely. ON CONFLICT is
    atomic and only overwrites fields we actually have values for, so a call
    with no email can never blank an email we already know.
    """
    await execute(
        """INSERT INTO users (id, name, email, settings_json, created_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
               name = COALESCE(excluded.name, name),
               email = COALESCE(excluded.email, email),
               settings_json = excluded.settings_json""",
        [user_id, name, email, json.dumps(settings or {}), _now()],
    )


async def get_user(user_id: str) -> dict[str, Any] | None:
    rows = await execute(
        "SELECT id, name, email, settings_json FROM users WHERE id = ?", [user_id]
    )
    if not rows:
        return None
    r = rows[0]
    r["settings"] = _parse_json(r.pop("settings_json"), {})
    return r


async def get_all_users() -> list[dict[str, Any]]:
    rows = await execute("SELECT id, name, email, settings_json FROM users")
    for r in rows:
        r["settings"] = _parse_json(r.pop("settings_json"), {})
    return rows


# -------- Portfolios (setup wizard answers) --------
async def get_portfolio(user_id: str) -> dict[str, Any] | None:
    rows = await execute("SELECT * FROM portfolios WHERE user_id = ?", [user_id])
    if not rows:
        return None
    r = rows[0]
    r["preferences"] = _parse_json(r.pop("preferences_json", None), {})
    return r


async def upsert_portfolio(user_id: str, *, name: str, base_currency: str,
                           starting_cash: float, preferences: dict[str, Any],
                           onboarded: bool) -> None:
    """Write: called when the user completes the setup wizard."""
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


# -------- Signals (written by the daily runner) --------
async def insert_signal(strategy_id: str, ticker: str, signal_type: str,
                        confidence: float | None, price: float | None,
                        signal_date: str) -> bool:
    """Inserts one signal. Returns False if an identical signal for the same
    (strategy, ticker, date) already exists — keeps runner re-runs idempotent."""
    existing = await execute(
        """SELECT id FROM signals
           WHERE strategy_id = ? AND ticker = ? AND signal_date = ? LIMIT 1""",
        [strategy_id, ticker, signal_date],
    )
    if existing:
        return False
    await execute(
        """INSERT INTO signals (id, strategy_id, ticker, signal_type, confidence,
                                price, signal_date, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        [_id(), strategy_id, ticker, signal_type, confidence, price,
         signal_date, _now()],
    )
    return True


async def get_signals(strategy_ids: list[str], signal_date: str) -> list[dict[str, Any]]:
    """Read: all signals for the given strategies on a date (Invest tab seam)."""
    if not strategy_ids:
        return []
    placeholders = ", ".join("?" for _ in strategy_ids)
    rows = await execute(
        f"""SELECT strategy_id, ticker, signal_type, confidence, price, signal_date
            FROM signals
            WHERE strategy_id IN ({placeholders}) AND signal_date = ?
            ORDER BY confidence DESC""",
        [*strategy_ids, signal_date],
    )
    return rows


# ============================================================
# Portfolio tables (migrations/migrations.sql)
#
# Everything below is SIMULATED. SLTP holds no assets and places no
# trades; positions and snapshots record what a strategy *would* have done,
# or what the user recorded doing by hand after their own research.
#
# The recurring convention: `source` tags a row as POSITION_SOURCE_STRATEGY
# (produced by a strategy signal, provenance in strategy_id) or
# POSITION_SOURCE_MANUAL (the user opened it themselves). Filter on `source`
# rather than on whether strategy_id is NULL.
# ============================================================


# -------- Strategy follows --------
async def follow_strategy(user_id: str, strategy_id: str) -> bool:
    """Starts following a strategy. Idempotent; returns True if newly added.

    Replaces the followedStrategies array that used to sit inside
    portfolios.preferences_json, which could not be queried or indexed.
    """
    rows = await execute(
        "SELECT strategy_id FROM strategy_follows WHERE user_id = ? AND strategy_id = ?",
        [user_id, strategy_id],
    )
    if rows:
        return False
    await execute(
        "INSERT INTO strategy_follows (id, user_id, strategy_id, created_at) VALUES (?, ?, ?, ?)",
        [_id(), user_id, strategy_id, _now()],
    )
    return True


async def unfollow_strategy(user_id: str, strategy_id: str) -> bool:
    """Stops following a strategy. Returns True if a row was removed.

    Positions are intentionally left alone: history should not disappear
    because someone stopped following a strategy.
    """
    rows = await execute(
        "SELECT id FROM strategy_follows WHERE user_id = ? AND strategy_id = ?",
        [user_id, strategy_id],
    )
    if not rows:
        return False
    await execute(
        "DELETE FROM strategy_follows WHERE user_id = ? AND strategy_id = ?",
        [user_id, strategy_id],
    )
    return True


async def get_followed_strategies(user_id: str) -> list[str]:
    """The strategy IDs a user follows, oldest first."""
    rows = await execute(
        "SELECT strategy_id FROM strategy_follows WHERE user_id = ? ORDER BY created_at",
        [user_id],
    )
    return [r["strategy_id"] for r in rows]


async def get_followed_strategies_all() -> list[str]:
    """Every strategy anyone follows, deduplicated.

    Lets the runner work out which strategies are in play with one query
    instead of loading every user's portfolio and parsing JSON out of it.
    """
    rows = await execute("SELECT DISTINCT strategy_id FROM strategy_follows")
    return [r["strategy_id"] for r in rows]


async def get_strategy_follow_counts() -> dict[str, int]:
    """How many users follow each strategy - used by the strategies page."""
    rows = await execute(
        "SELECT strategy_id, COUNT(*) AS followers FROM strategy_follows GROUP BY strategy_id"
    )
    return {r["strategy_id"]: r["followers"] for r in rows}


# -------- Positions (simulated holdings) --------
async def create_position(user_id: str, ticker: str, *, shares: float, entry_price: float,
                          entry_date: str, source: str = POSITION_SOURCE_MANUAL,
                          strategy_id: str | None = None,
                          stop_loss: float | None = None, take_profit: float | None = None,
                          transaction_cost: float = 0.0, signal_id: str | None = None,
                          note: str | None = None) -> dict[str, Any]:
    """Opens a simulated position and returns the stored row.

    Pass source="strategy" (with strategy_id) when a strategy produced the
    entry, or leave the default "manual" for a position the user opened by
    hand. The partial unique index allows one open position per
    (user, source, strategy, ticker), so a second open position for the same
    combination raises rather than silently duplicating - callers wanting to
    add to an existing position should average in application code.
    """
    if source not in POSITION_SOURCES:
        raise ValueError(
            f"source must be one of {sorted(POSITION_SOURCES)}, got {source!r}"
        )
    if source == POSITION_SOURCE_STRATEGY and not strategy_id:
        raise ValueError("strategy_id is required when source is 'strategy'")

    now = _now()
    row = {
        "id": _id(),
        "user_id": user_id,
        "source": source,
        "strategy_id": strategy_id,
        "ticker": ticker.upper(),
        "status": POSITION_OPEN,
        "shares": shares,
        "entry_price": entry_price,
        "entry_date": entry_date,
        "stop_loss": stop_loss,
        "take_profit": take_profit,
        "transaction_cost": transaction_cost,
        "signal_id": signal_id,
        "note": note,
        "created_at": now,
        "updated_at": now,
    }
    await execute(
        """INSERT INTO positions
             (id, user_id, source, strategy_id, ticker, status, shares, entry_price,
              entry_date, stop_loss, take_profit, transaction_cost, signal_id,
              note, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        [row["id"], row["user_id"], row["source"], row["strategy_id"], row["ticker"],
         row["status"], row["shares"], row["entry_price"], row["entry_date"],
         row["stop_loss"], row["take_profit"], row["transaction_cost"],
         row["signal_id"], row["note"], row["created_at"], row["updated_at"]],
    )
    return row


async def close_position(position_id: str, exit_price: float, exit_date: str,
                         transaction_cost: float = 0.0,
                         realized_return_pct: float | None = None) -> bool:
    """Closes a simulated position. Returns False if unknown or already closed.

    Pass realized_return_pct to store a strategy's own figure; otherwise it is
    derived from the entry and exit prices so the field is never null.
    """
    rows = await execute(
        "SELECT entry_price, status FROM positions WHERE id = ?", [position_id]
    )
    if not rows:
        return False

    row = rows[0]
    if row["status"] != POSITION_OPEN:
        return False

    if realized_return_pct is None:
        entry = row.get("entry_price")
        if entry:
            realized_return_pct = (exit_price - entry) / entry * 100.0

    await execute(
        """UPDATE positions
           SET status = ?, exit_price = ?, exit_date = ?, realized_return_pct = ?,
               transaction_cost = transaction_cost + ?, updated_at = ?
           WHERE id = ?""",
        [POSITION_CLOSED, exit_price, exit_date, realized_return_pct,
         transaction_cost, _now(), position_id],
    )
    return True


async def get_positions(user_id: str, *, source: str | None = None,
                        strategy_id: str | None = None,
                        status: str | None = None) -> list[dict[str, Any]]:
    """Lists a user's positions, newest entry first.

    Both filters are optional and combine: source="manual" for hand-entered
    positions, source="strategy" for the strategies' own, strategy_id to pin
    one strategy. No filter returns the whole book.
    """
    clauses = ["user_id = ?"]
    args: list[Any] = [user_id]

    if source is not None:
        clauses.append("source = ?")
        args.append(source)

    if strategy_id is not None:
        clauses.append("strategy_id = ?")
        args.append(strategy_id)

    if status is not None:
        clauses.append("status = ?")
        args.append(status)

    return await execute(
        f"""SELECT * FROM positions
            WHERE {' AND '.join(clauses)}
            ORDER BY entry_date DESC, created_at DESC""",
        args,
    )


async def get_open_positions(user_id: str, *, source: str | None = None) -> list[dict[str, Any]]:
    """Just the currently open book - the common read for the portfolio page."""
    return await get_positions(user_id, source=source, status=POSITION_OPEN)


async def get_position(position_id: str) -> dict[str, Any] | None:
    rows = await execute("SELECT * FROM positions WHERE id = ?", [position_id])
    return rows[0] if rows else None


async def get_book_summary(user_id: str) -> dict[str, Any]:
    """One aggregate read for the portfolio header: counts and realized result.

    Done as a single query so the page does not fan out into a row per position
    just to render a handful of numbers. Splits the book by source, which is
    the split users care about: what they chose vs what a strategy chose.
    """
    rows = await execute(
        """SELECT
             COUNT(*) AS total_positions,
             SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open_positions,
             SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed_positions,
             SUM(CASE WHEN source = 'manual' THEN 1 ELSE 0 END) AS manual_positions,
             SUM(CASE WHEN source = 'strategy' THEN 1 ELSE 0 END) AS strategy_positions,
             AVG(CASE WHEN status = 'closed' THEN realized_return_pct END)
               AS avg_realized_return_pct
           FROM positions
           WHERE user_id = ?""",
        [user_id],
    )
    summary = rows[0] if rows else {}
    return {
        "total_positions": summary.get("total_positions") or 0,
        "open_positions": summary.get("open_positions") or 0,
        "closed_positions": summary.get("closed_positions") or 0,
        "manual_positions": summary.get("manual_positions") or 0,
        "strategy_positions": summary.get("strategy_positions") or 0,
        "avg_realized_return_pct": summary.get("avg_realized_return_pct") or 0.0,
    }


# -------- Portfolio snapshots (simulated daily equity) --------
async def put_snapshot(user_id: str, snapshot_date: str, portfolio_value: float, *,
                       source: str = POSITION_SOURCE_MANUAL,
                       strategy_id: str | None = None,
                       active_positions: int = 0,
                       transaction_cost: float = 0.0) -> None:
    """Records one simulated equity point. Idempotent per day.

    Re-running the pipeline for a date overwrites that day's value instead of
    appending a duplicate, which keeps the chart honest after a correction.
    """
    if source not in POSITION_SOURCES:
        raise ValueError(
            f"source must be one of {sorted(POSITION_SOURCES)}, got {source!r}"
        )

    now = _now()
    await execute(
        """INSERT INTO portfolio_snapshots
             (id, user_id, source, strategy_id, snapshot_date, portfolio_value,
              active_positions, transaction_cost, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id, source, ifnull(strategy_id, ''), snapshot_date)
             DO UPDATE SET
               portfolio_value = excluded.portfolio_value,
               active_positions = excluded.active_positions,
               transaction_cost = excluded.transaction_cost""",
        [_id(), user_id, source, strategy_id, snapshot_date, portfolio_value,
         active_positions, transaction_cost, now],
    )


async def get_snapshots(user_id: str, *, source: str | None = None,
                        strategy_id: str | None = None,
                        start: str | None = None, end: str | None = None,
                        limit: int | None = None) -> list[dict[str, Any]]:
    """The equity curve, oldest first, so a chart can plot it directly.

    source="manual" returns the discretionary series; source="strategy" plus
    strategy_id returns one strategy's own curve.
    """
    clauses = ["user_id = ?"]
    args: list[Any] = [user_id]

    if source is not None:
        clauses.append("source = ?")
        args.append(source)
    if strategy_id is not None:
        clauses.append("strategy_id = ?")
        args.append(strategy_id)
    if start is not None:
        clauses.append("snapshot_date >= ?")
        args.append(start)
    if end is not None:
        clauses.append("snapshot_date <= ?")
        args.append(end)

    # Newest first when limiting, then reversed, so a capped query keeps the
    # most recent points rather than the oldest.
    order = "DESC" if limit else "ASC"
    tail = ""
    if limit:
        tail = " LIMIT ?"
        args.append(limit)

    rows = await execute(
        f"""SELECT * FROM portfolio_snapshots
            WHERE {' AND '.join(clauses)}
            ORDER BY snapshot_date {order}{tail}""",
        args,
    )
    return list(reversed(rows)) if limit else rows


# -------- Watchlist --------
async def add_to_watchlist(user_id: str, ticker: str, note: str | None = None) -> bool:
    """Adds a ticker. Returns False if it was already on the list."""
    ticker = ticker.upper()
    rows = await execute(
        "SELECT id FROM watchlist_items WHERE user_id = ? AND ticker = ?",
        [user_id, ticker],
    )
    if rows:
        return False
    await execute(
        "INSERT INTO watchlist_items (id, user_id, ticker, note, added_at) VALUES (?, ?, ?, ?, ?)",
        [_id(), user_id, ticker, note, _now()],
    )
    return True


async def remove_from_watchlist(user_id: str, ticker: str) -> bool:
    """Removes a ticker. Returns True if a row was deleted."""
    ticker = ticker.upper()
    rows = await execute(
        "SELECT id FROM watchlist_items WHERE user_id = ? AND ticker = ?",
        [user_id, ticker],
    )
    if not rows:
        return False
    await execute(
        "DELETE FROM watchlist_items WHERE user_id = ? AND ticker = ?",
        [user_id, ticker],
    )
    return True


async def get_watchlist(user_id: str) -> list[dict[str, Any]]:
    return await execute(
        "SELECT * FROM watchlist_items WHERE user_id = ? ORDER BY added_at DESC",
        [user_id],
    )


# -------- Cash flows (simulated deposits / withdrawals) --------
async def add_cash_flow(user_id: str, amount: float, kind: str = "deposit", *,
                        occurred_at: str | None = None,
                        note: str | None = None) -> dict[str, Any]:
    """Records a simulated deposit or withdrawal. Amount is stored positive;
    `kind` carries the direction. Defaults occurred_at to now."""
    if kind not in CASH_FLOW_KINDS:
        raise ValueError(f"kind must be one of {sorted(CASH_FLOW_KINDS)}, got {kind!r}")
    if amount <= 0:
        raise ValueError("amount must be positive; use kind to express direction")

    now = _now()
    row = {
        "id": _id(),
        "user_id": user_id,
        "amount": amount,
        "kind": kind,
        "occurred_at": occurred_at or now,
        "note": note,
        "created_at": now,
    }
    await execute(
        """INSERT INTO cash_flows (id, user_id, amount, kind, occurred_at, note, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        [row["id"], row["user_id"], row["amount"], row["kind"],
         row["occurred_at"], row["note"], row["created_at"]],
    )
    return row


async def get_cash_flows(user_id: str, *, limit: int | None = None) -> list[dict[str, Any]]:
    """Cash flows newest first. Summarise with net_cash_flow() for a total."""
    sql = ("SELECT * FROM cash_flows WHERE user_id = ? "
           "ORDER BY occurred_at DESC, created_at DESC")
    args: list[Any] = [user_id]
    if limit:
        sql += " LIMIT ?"
        args.append(limit)
    return await execute(sql, args)


async def net_cash_flow(user_id: str) -> float:
    """Deposits minus withdrawals: the capital currently in the simulated book."""
    rows = await execute(
        """SELECT
             SUM(CASE WHEN kind = 'deposit' THEN amount ELSE 0 END)
           - SUM(CASE WHEN kind = 'withdrawal' THEN amount ELSE 0 END) AS net
           FROM cash_flows WHERE user_id = ?""",
        [user_id],
    )
    return (rows[0].get("net") if rows else None) or 0.0
