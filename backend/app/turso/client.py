# client.py — the smallest Turso client that does the job.
#
# It speaks Hrana (the sqld HTTP protocol) with plain requests: one POST per
# statement, positional `?` placeholders, rows back as dicts. No native
# driver, no replica sync, nothing to compile — the data set is per-user app
# state, not a hot path, so a round trip per query is fine.
#
# Values encode to Hrana's typed form (text/integer/float/null).datetimes
# travel as ISO strings and JSON columns as TEXT the callers dump and parse.

# -------- Imports --------
import base64

from typing import Any

import requests

from app.config import TURSO_TIMEOUT, TURSO_TOKEN, TURSO_URL, require_turso


# -------- Value codec --------
def _encode(value: Any) -> dict[str, Any]:
    if value is None:
        return {"type": "null"}
    if isinstance(value, bool):
        return {"type": "integer", "value": str(int(value))}
    if isinstance(value, int):
        return {"type": "integer", "value": str(value)}
    if isinstance(value, float):
        return {"type": "float", "value": value}
    if isinstance(value, (bytes, bytearray)):
        return {"type": "blob", "value": base64.b64encode(bytes(value)).decode("ascii")}
    return {"type": "text", "value": str(value)}


def _decode(value: Any) -> Any:
    if not isinstance(value, dict):
        return value
    kind = value.get("type")
    if kind == "null":
        return None
    if kind == "integer":
        try:
            return int(value.get("value", 0))
        except (TypeError, ValueError):
            return value.get("value")
    if kind == "float":
        try:
            return float(value.get("value", 0.0))
        except (TypeError, ValueError):
            return value.get("value")
    if kind == "blob":
        try:
            return base64.b64decode(value.get("value", ""))
        except Exception:
            return None
    return value.get("value")


# -------- Queries --------
# Run one statement and return every row as a dict.
def execute(sql: str, args: list[Any] | None = None) -> list[dict[str, Any]]:
    require_turso()
    host = TURSO_URL.replace("libsql://", "https://")
    try:
        resp = requests.post(
            f"{host}/v1/execute",
            json={"stmt": {"sql": sql, "args": [_encode(a) for a in (args or [])]}},
            headers={"Authorization": f"Bearer {TURSO_TOKEN}"},
            timeout=TURSO_TIMEOUT,
        )
    except Exception as e:  # noqa: BLE001 - network failure reads as empty upstream
        raise RuntimeError(f"Turso unreachable: {e}") from e
    try:
        body = resp.json()
    except Exception as e:  # noqa: BLE001
        raise RuntimeError(f"Turso bad response HTTP {resp.status_code}") from e
    if "result" not in body:
        raise RuntimeError(f"Turso error: {str(body.get('message', body))[:200]}")
    result = body["result"] or {}
    cols = [c.get("name", "") for c in result.get("cols", [])]
    rows: list[dict[str, Any]] = []
    for raw in result.get("rows", []) or []:
        rows.append({cols[i] if i < len(cols) else str(i): _decode(raw[i]) for i in range(len(raw))})
    return rows


# The first row, or None.
def execute_one(sql: str, args: list[Any] | None = None) -> dict[str, Any] | None:
    rows = execute(sql, args)
    return rows[0] if rows else None
