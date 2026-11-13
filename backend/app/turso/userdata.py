# userdata.py — every Turso read and write, in one file.
#
# Each table carries the Supabase auth uid in a TEXT user_id column, so every
# row traces to exactly one login and every query is scoped to the id from
# the verified JWT, never the request body. JSON columns travel as TEXT and
# are dumped on write, parsed on read.

# -------- Imports --------
import json
import re
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


# -------- Lab code workspaces (projects, files, folders) --------
# The working tree behind the Lab editor: workspaces hold projects, projects
# hold files, and lab_folders records real-but-empty folders so imports
# round-trip them. Ownership always resolves through the workspace's user_id.
WORKSPACE_NAME_MAX = 60
PROJECT_NAME_MAX = 60
FILE_CONTENT_MAX = 200_000
PATH_MAX = 200
FILES_PER_PROJECT_MAX = 100
FOLDERS_PER_PROJECT_MAX = 50


class LabError(Exception):
    """A client-caused Lab failure. The router turns it into an HTTP error."""
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


def _clean_path(raw: str, *, folder: bool = False) -> str:
    cleaned = (raw or "").replace("\\", "/").strip().strip("/")
    parts = [p for p in cleaned.split("/") if p not in ("", ".")]
    if not parts or any(p == ".." for p in parts):
        raise LabError("Give the file a name, like notes.txt.", 400)
    if any(len(p) > 80 for p in parts):
        raise LabError("That path has a segment over 80 characters.", 400)
    path = "/".join(parts)
    if len(path) > PATH_MAX:
        raise LabError(f"Paths must be {PATH_MAX} characters or fewer.", 400)
    if not folder and path.endswith("/"):
        raise LabError("Give the file a name, like notes.txt.", 400)
    return path


def _project_owned(user_id: str, project_id: str) -> dict[str, Any] | None:
    return execute_one(
        "SELECT p.id, p.workspace_id, p.name, p.template, p.created_at"
        " FROM lab_projects p JOIN lab_workspaces w ON w.id = p.workspace_id"
        " WHERE p.id = ? AND w.user_id = ?",
        [project_id, user_id],
    )


def _file_count(project_id: str) -> int:
    row = execute_one("SELECT COUNT(*) AS n FROM lab_files WHERE project_id = ?", [project_id])
    return int(row["n"]) if row else 0


def _workspace_summaries(user_id: str, workspace_id: str | None = None) -> list[dict[str, Any]]:
    where = "user_id = ?"
    args: list[Any] = [user_id]
    if workspace_id:
        where += " AND id = ?"
        args.append(workspace_id)
    spaces = execute(
        f"SELECT id, name, created_at FROM lab_workspaces WHERE {where} ORDER BY created_at",
        args,
    )
    if not spaces:
        return []
    ids = [space["id"] for space in spaces]
    marks = ",".join(["?"] * len(ids))
    projects = execute(
        f"SELECT id, workspace_id, name, created_at FROM lab_projects"
        f" WHERE workspace_id IN ({marks}) ORDER BY created_at",
        ids,
    )
    file_rows = execute(
        f"SELECT project_id, path FROM lab_files WHERE locked = 0 AND project_id IN"
        f" (SELECT id FROM lab_projects WHERE workspace_id IN ({marks}))"
        f" ORDER BY path",
        ids,
    )
    files_by_project: dict[str, list[str]] = {}
    for row in file_rows:
        files_by_project.setdefault(row["project_id"], []).append(row["path"])
    projects_by_space: dict[str, list[dict[str, Any]]] = {space["id"]: [] for space in spaces}
    for project in projects:
        projects_by_space[project["workspace_id"]].append({
            "id": project["id"],
            "name": project["name"],
            "created_at": project["created_at"],
            "file_count": len(files_by_project.get(project["id"], [])),
        })

    summaries: list[dict[str, Any]] = []
    for space in spaces:
        space_projects = projects_by_space[space["id"]]
        primary = space_projects[0] if space_projects else None
        paths: list[str] = []
        for project in space_projects:
            paths.extend(files_by_project.get(project["id"], []))
        summaries.append({
            "id": space["id"],
            "name": space["name"],
            "created_at": space["created_at"],
            # The editor still stores files against a project row internally;
            # the workspace is the only entity the reader ever sees.
            "project_id": primary["id"] if primary else None,
            "files": [{"path": path} for path in paths],
            "file_count": len(paths),
            "projects": space_projects,
        })
    return summaries


def list_workspaces(user_id: str) -> list[dict[str, Any]]:
    return _workspace_summaries(user_id)


def get_workspace(user_id: str, workspace_id: str) -> dict[str, Any] | None:
    rows = _workspace_summaries(user_id, workspace_id)
    return rows[0] if rows else None


def _strategy_slug(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", (name or "").strip().lower()).strip("_")
    return (slug or "strategy")[:48]


def _template_code(template: str) -> str:
    template = (template or "blank").strip().lower()
    if template not in TEMPLATE_SEEDS:
        template = "blank"
    return TEMPLATE_SEEDS[template][0][1]


def _unique_strategy_path(project_id: str, name: str) -> str:
    base = _strategy_slug(name)
    candidate = f"workspace/{base}.py"
    suffix = 2
    while execute_one(
        "SELECT path FROM lab_files WHERE project_id = ? AND path = ?",
        [project_id, candidate],
    ):
        candidate = f"workspace/{base}_{suffix}.py"
        suffix += 1
    return candidate


def create_workspace(user_id: str, name: str) -> dict[str, Any]:
    name = (name or "").strip()
    if not name:
        raise LabError("Name the workspace.", 400)
    if len(name) > WORKSPACE_NAME_MAX:
        raise LabError(f"Workspace names must be {WORKSPACE_NAME_MAX} characters or fewer.", 400)
    wid = _new_id()
    now = now_iso()
    execute(
        "INSERT INTO lab_workspaces (id, user_id, name, created_at) VALUES (?, ?, ?, ?)",
        [wid, user_id, name, now],
    )
    return {"id": wid, "name": name, "created_at": now, "projects": []}


def delete_workspace(user_id: str, workspace_id: str) -> bool:
    row = execute_one(
        "SELECT id FROM lab_workspaces WHERE id = ? AND user_id = ?", [workspace_id, user_id]
    )
    if not row:
        return False
    project_ids = [r["id"] for r in execute(
        "SELECT id FROM lab_projects WHERE workspace_id = ?", [workspace_id]
    )]
    for pid in project_ids:
        execute("DELETE FROM lab_files WHERE project_id = ?", [pid])
        execute("DELETE FROM lab_folders WHERE project_id = ?", [pid])
        execute("DELETE FROM lab_backtests WHERE project_id = ?", [pid])
    execute("DELETE FROM lab_projects WHERE workspace_id = ?", [workspace_id])
    execute("DELETE FROM lab_workspaces WHERE id = ?", [workspace_id])
    return True


def create_project(
    user_id: str,
    workspace_id: str,
    name: str,
    template: str,
    file_name: str | None = None,
    *,
    code: str | None = None,
) -> dict[str, Any]:
    owner = execute_one(
        "SELECT id FROM lab_workspaces WHERE id = ? AND user_id = ?", [workspace_id, user_id]
    )
    if not owner:
        raise LabError("Workspace not found.", 404)
    name = (name or "").strip()
    if not name:
        raise LabError("Name the project.", 400)
    if len(name) > PROJECT_NAME_MAX:
        raise LabError(f"Project names must be {PROJECT_NAME_MAX} characters or fewer.", 400)
    if code is not None and len(code) > FILE_CONTENT_MAX:
        raise LabError("That file is too large to save.", 400)
    pid = _new_id()
    now = now_iso()
    template = (template or "blank").strip().lower()
    seeds = TEMPLATE_SEEDS.get(template)
    if seeds is None:
        # A template the server does not ship (the browser's custom strategies)
        # still creates one file: the code the wizard sent, or the blank seed.
        if code is None:
            template = "blank"
            seeds = TEMPLATE_SEEDS["blank"]
        else:
            seeds = [("workspace/main.py", "")]
    execute(
        "INSERT INTO lab_projects (id, workspace_id, name, template, created_at)"
        " VALUES (?, ?, ?, ?, ?)",
        [pid, workspace_id, name, template, now],
    )
    for index, (path, content) in enumerate(seeds):
        if index == 0 and file_name and path.endswith("main.py"):
            path = f"workspace/{_strategy_slug(file_name)}.py"
        if index == 0 and code is not None:
            content = code
        execute(
            "INSERT INTO lab_files (project_id, path, content, locked, updated_at)"
            " VALUES (?, ?, ?, 0, ?)",
            [pid, path, content, now],
        )
    return {"id": pid, "name": name, "created_at": now, "file_count": len(seeds)}


def add_workspace_strategy(
    user_id: str,
    workspace_id: str,
    name: str,
    template: str,
    *,
    code: str | None = None,
) -> dict[str, Any]:
    owner = execute_one(
        "SELECT id, name FROM lab_workspaces WHERE id = ? AND user_id = ?",
        [workspace_id, user_id],
    )
    if not owner:
        raise LabError("Workspace not found.", 404)
    name = (name or "").strip()
    if not name:
        raise LabError("Name the strategy.", 400)
    if len(name) > PROJECT_NAME_MAX:
        raise LabError(f"Strategy names must be {PROJECT_NAME_MAX} characters or fewer.", 400)
    primary = execute_one(
        "SELECT id FROM lab_projects WHERE workspace_id = ? ORDER BY created_at LIMIT 1",
        [workspace_id],
    )
    if not primary:
        create_project(user_id, workspace_id, name, template, _strategy_slug(name), code=code)
    else:
        path = _unique_strategy_path(primary["id"], name)
        save_project_file(
            user_id, primary["id"], path, code if code is not None else _template_code(template),
        )
    summary = get_workspace(user_id, workspace_id)
    if not summary:
        raise LabError("Could not read the workspace after saving the strategy.", 500)
    return summary


def rename_project(user_id: str, project_id: str, name: str) -> dict[str, Any] | None:
    if not _project_owned(user_id, project_id):
        return None
    name = (name or "").strip()
    if not name:
        raise LabError("Name the project.", 400)
    if len(name) > PROJECT_NAME_MAX:
        raise LabError(f"Project names must be {PROJECT_NAME_MAX} characters or fewer.", 400)
    execute("UPDATE lab_projects SET name = ? WHERE id = ?", [name, project_id])
    row = _project_owned(user_id, project_id)
    assert row is not None
    return {"id": row["id"], "name": row["name"], "created_at": row["created_at"],
            "file_count": _file_count(project_id)}


def delete_project(user_id: str, project_id: str) -> bool:
    if not _project_owned(user_id, project_id):
        return False
    execute("DELETE FROM lab_files WHERE project_id = ?", [project_id])
    execute("DELETE FROM lab_folders WHERE project_id = ?", [project_id])
    execute("DELETE FROM lab_backtests WHERE project_id = ?", [project_id])
    execute("DELETE FROM lab_projects WHERE id = ?", [project_id])
    return True


def get_project_tree(user_id: str, project_id: str) -> dict[str, Any] | None:
    project = _project_owned(user_id, project_id)
    if not project:
        return None
    files = execute(
        "SELECT path, content, locked FROM lab_files WHERE project_id = ? ORDER BY path",
        [project_id],
    )
    explicit = [
        r["path"] for r in execute(
            "SELECT path FROM lab_folders WHERE project_id = ? ORDER BY path", [project_id]
        )
    ]
    # Folders implied by file paths join the explicit ones, so the tree shows
    # every level even when nothing recorded it.
    derived: set[str] = set()
    for f in files:
        parts = f["path"].split("/")[:-1]
        for i in range(1, len(parts) + 1):
            derived.add("/".join(parts[:i]))
    folders = sorted(set(explicit) | derived)
    return {
        "project": {"id": project["id"], "name": project["name"]},
        "files": [
            {"name": f["path"], "content": f["content"], "locked": bool(f["locked"])}
            for f in files
        ],
        "folders": folders,
    }


def create_project_file(user_id: str, project_id: str, name: str) -> dict[str, Any]:
    if not _project_owned(user_id, project_id):
        raise LabError("Project not found.", 404)
    path = _clean_path(name)
    if _file_count(project_id) >= FILES_PER_PROJECT_MAX:
        raise LabError(f"Projects hold at most {FILES_PER_PROJECT_MAX} files.", 400)
    if execute_one("SELECT path FROM lab_files WHERE project_id = ? AND path = ?",
                   [project_id, path]):
        raise LabError("A file with that name already exists.", 409)
    now = now_iso()
    execute(
        "INSERT INTO lab_files (project_id, path, content, locked, updated_at)"
        " VALUES (?, ?, '', 0, ?)",
        [project_id, path, now],
    )
    return {"name": path, "content": "", "locked": False}


def save_project_file(user_id: str, project_id: str, path: str, content: str) -> dict[str, Any]:
    if not _project_owned(user_id, project_id):
        raise LabError("Project not found.", 404)
    path = _clean_path(path)
    if len(content or "") > FILE_CONTENT_MAX:
        raise LabError("That file is too large to save.", 400)
    row = execute_one("SELECT locked FROM lab_files WHERE project_id = ? AND path = ?",
                      [project_id, path])
    if row and row["locked"]:
        raise LabError("That file is locked and cannot be edited.", 400)
    now = now_iso()
    if row:
        execute("UPDATE lab_files SET content = ?, updated_at = ? WHERE project_id = ? AND path = ?",
                [content or "", now, project_id, path])
    else:
        if _file_count(project_id) >= FILES_PER_PROJECT_MAX:
            raise LabError(f"Projects hold at most {FILES_PER_PROJECT_MAX} files.", 400)
        execute(
            "INSERT INTO lab_files (project_id, path, content, locked, updated_at)"
            " VALUES (?, ?, ?, 0, ?)",
            [project_id, path, content or "", now],
        )
    return {"name": path, "content": content or "", "locked": False}


def save_project_files(user_id: str, project_id: str, files: list[dict[str, Any]]) -> dict[str, Any]:
    # One flush for everything the editor autosaves: ownership, the locked
    # check and the upsert are three round trips no matter how many files are
    # dirty, so rapid typing costs one write transaction instead of one per
    # file. A single multi-row statement is atomic server-side, which is what
    # keeps concurrent saves from tripping over each other's write locks.
    project = _project_owned(user_id, project_id)
    if not project:
        raise LabError("Project not found.", 404)
    cleaned: list[tuple[str, str]] = []
    for entry in files or []:
        path = _clean_path(str(entry.get("path", "")))
        content = str(entry.get("content", "") or "")
        if len(content) > FILE_CONTENT_MAX:
            raise LabError(f"{path} is too large to save.", 400)
        cleaned.append((path, content))
    if not cleaned:
        return {"saved": [], "locked_skipped": []}
    if len(cleaned) > FILES_PER_PROJECT_MAX:
        raise LabError(f"Projects hold at most {FILES_PER_PROJECT_MAX} files.", 400)
    existing_rows = execute(
        f"SELECT path, locked FROM lab_files WHERE project_id = ?"
        f" AND path IN ({','.join(['?'] * len(cleaned))})",
        [project_id, *[path for path, _ in cleaned]],
    )
    existing = {row["path"] for row in existing_rows}
    new_only = sum(1 for path, _ in cleaned if path not in existing)
    if _file_count(project_id) + new_only > FILES_PER_PROJECT_MAX:
        raise LabError(f"Projects hold at most {FILES_PER_PROJECT_MAX} files.", 400)
    locked = {row["path"] for row in existing_rows if row["locked"]}
    writable = [(path, content) for path, content in cleaned if path not in locked]
    if writable:
        now = now_iso()
        values = ", ".join(["(?, ?, ?, 0, ?)"] * len(writable))
        args: list[Any] = []
        for path, content in writable:
            args.extend([project_id, path, content, now])
        execute(
            f"INSERT INTO lab_files (project_id, path, content, locked, updated_at)"
            f" VALUES {values}"
            f" ON CONFLICT (project_id, path) DO UPDATE SET"
            f" content = excluded.content, updated_at = excluded.updated_at",
            args,
        )
    return {"saved": [path for path, _ in writable], "locked_skipped": sorted(locked)}


def import_project_files(
    user_id: str, project_id: str, files: list[dict[str, Any]], folders: list[str] | None = None,
) -> dict[str, Any]:
    # The folder import writes through the same single-statement upsert as
    # autosave, so a 40-file import is one write transaction, not forty.
    # Existing files with the same name are replaced.
    project = _project_owned(user_id, project_id)
    if not project:
        raise LabError("Project not found.", 404)
    result = save_project_files(user_id, project_id, files or [])
    imported = result["saved"]
    skipped = [{"path": path, "reason": "That file is locked and cannot be replaced."}
               for path in result["locked_skipped"]]
    for raw in folders or []:
        try:
            folder = _clean_path(str(raw), folder=True)
        except LabError:
            continue
        count = execute_one("SELECT COUNT(*) AS n FROM lab_folders WHERE project_id = ?", [project_id])
        if int((count or {}).get("n", 0)) >= FOLDERS_PER_PROJECT_MAX:
            break
        execute("INSERT OR IGNORE INTO lab_folders (project_id, path) VALUES (?, ?)",
                [project_id, folder])
    return {"imported": imported, "skipped": skipped}


def rename_project_file(user_id: str, project_id: str, old: str, new: str) -> dict[str, Any]:
    if not _project_owned(user_id, project_id):
        raise LabError("Project not found.", 404)
    old_path = _clean_path(old)
    new_path = _clean_path(new)
    row = execute_one("SELECT locked FROM lab_files WHERE project_id = ? AND path = ?",
                      [project_id, old_path])
    if not row:
        raise LabError("File not found.", 404)
    if row["locked"]:
        raise LabError("That file is locked and cannot be renamed.", 400)
    if old_path != new_path and execute_one(
            "SELECT path FROM lab_files WHERE project_id = ? AND path = ?", [project_id, new_path]):
        raise LabError("A file with that name already exists.", 409)
    execute("UPDATE lab_files SET path = ?, updated_at = ? WHERE project_id = ? AND path = ?",
            [new_path, now_iso(), project_id, old_path])
    return {"name": new_path, "previous": old_path}


def delete_project_file(user_id: str, project_id: str, path: str) -> bool:
    if not _project_owned(user_id, project_id):
        raise LabError("Project not found.", 404)
    clean = _clean_path(path)
    row = execute_one("SELECT locked FROM lab_files WHERE project_id = ? AND path = ?",
                      [project_id, clean])
    if not row:
        return False
    if row["locked"]:
        raise LabError("That file is locked and cannot be deleted.", 400)
    execute("DELETE FROM lab_files WHERE project_id = ? AND path = ?", [project_id, clean])
    return True


def create_project_folder(user_id: str, project_id: str, name: str) -> dict[str, Any]:
    if not _project_owned(user_id, project_id):
        raise LabError("Project not found.", 404)
    path = _clean_path(name, folder=True)
    count = execute_one("SELECT COUNT(*) AS n FROM lab_folders WHERE project_id = ?", [project_id])
    if int((count or {}).get("n", 0)) >= FOLDERS_PER_PROJECT_MAX:
        raise LabError(f"Projects hold at most {FOLDERS_PER_PROJECT_MAX} folders.", 400)
    execute("INSERT OR IGNORE INTO lab_folders (project_id, path) VALUES (?, ?)", [project_id, path])
    return {"name": path}


def delete_project_folder(user_id: str, project_id: str, path: str) -> bool:
    if not _project_owned(user_id, project_id):
        raise LabError("Project not found.", 404)
    clean = _clean_path(path, folder=True)
    prefix = clean + "/"
    has_files = execute_one(
        "SELECT path FROM lab_files WHERE project_id = ? AND path LIKE ? LIMIT 1",
        [project_id, prefix + "%"],
    )
    has_folders = execute_one(
        "SELECT path FROM lab_folders WHERE project_id = ? AND (path = ? OR path LIKE ?)",
        [project_id, clean, prefix + "%"],
    )
    if not has_files and not has_folders:
        return False
    execute("DELETE FROM lab_files WHERE project_id = ? AND path LIKE ?", [project_id, prefix + "%"])
    execute("DELETE FROM lab_folders WHERE project_id = ? AND (path = ? OR path LIKE ?)",
            [project_id, clean, prefix + "%"])
    return True


def delete_user_lab_projects(user_id: str) -> None:
    project_ids = [r["id"] for r in execute(
        "SELECT p.id FROM lab_projects p"
        " JOIN lab_workspaces w ON w.id = p.workspace_id WHERE w.user_id = ?", [user_id]
    )]
    for pid in project_ids:
        execute("DELETE FROM lab_files WHERE project_id = ?", [pid])
        execute("DELETE FROM lab_folders WHERE project_id = ?", [pid])
        execute("DELETE FROM lab_backtests WHERE project_id = ?", [pid])
    execute(
        "DELETE FROM lab_projects WHERE workspace_id IN"
        " (SELECT id FROM lab_workspaces WHERE user_id = ?)", [user_id],
    )
    execute("DELETE FROM lab_workspaces WHERE user_id = ?", [user_id])


# -------- Lab backtests --------
# One saved run per row. The whole result (stats, equity, trades, benchmark,
# logs) is the JSON payload, so reopening a saved backtest is one read and the
# list stays cheap. The id doubles as the first display name.
BACKTEST_NAME_MAX = 80
BACKTEST_PAYLOAD_MAX = 5_000_000


def _new_backtest_id() -> str:
    for _ in range(10):
        candidate = "backtest#" + uuid.uuid4().hex[:8]
        if not execute_one("SELECT id FROM lab_backtests WHERE id = ?", [candidate]):
            return candidate
    raise LabError("Could not allocate a backtest id. Try again.", 503)


def _backtest_summary(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "project_id": row["project_id"],
        "name": row["name"],
        "strategy_name": row.get("strategy_name") or "",
        "total_return": float(row.get("total_return") or 0.0),
        "cagr": None if row.get("cagr") is None else float(row["cagr"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _payload_return(payload: dict[str, Any]) -> tuple[float, float | None]:
    equity = payload.get("equity") if isinstance(payload.get("equity"), list) else []
    total = 0.0
    if len(equity) >= 2:
        try:
            first = float(equity[0]["value"])
            last = float(equity[-1]["value"])
            total = ((last - first) / first * 100.0) if first else 0.0
        except (KeyError, TypeError, ValueError):
            total = 0.0
    stats = payload.get("stats") if isinstance(payload.get("stats"), dict) else {}
    cagr = stats.get("cagr")
    try:
        cagr_value = None if cagr is None else float(cagr)
    except (TypeError, ValueError):
        cagr_value = None
    return total, cagr_value


def list_lab_backtests(user_id: str, project_id: str) -> list[dict[str, Any]]:
    if not _project_owned(user_id, project_id):
        raise LabError("Project not found.", 404)
    rows = execute(
        "SELECT id, project_id, name, strategy_name, total_return, cagr, created_at, updated_at"
        " FROM lab_backtests WHERE project_id = ? ORDER BY created_at DESC",
        [project_id],
    )
    return [_backtest_summary(row) for row in rows]


def create_lab_backtest(
    user_id: str,
    project_id: str,
    payload: dict[str, Any],
    name: str | None = None,
) -> dict[str, Any]:
    if not _project_owned(user_id, project_id):
        raise LabError("Project not found.", 404)
    if not isinstance(payload, dict) or not payload.get("equity"):
        raise LabError("That result has no equity curve to save.", 400)
    encoded = json.dumps(payload, separators=(",", ":"))
    if len(encoded) > BACKTEST_PAYLOAD_MAX:
        raise LabError("That backtest is too large to save.", 413)
    backtest_id = _new_backtest_id()
    display = (name or "").strip() or backtest_id
    if len(display) > BACKTEST_NAME_MAX:
        raise LabError(f"Backtest names must be {BACKTEST_NAME_MAX} characters or fewer.", 400)
    now = now_iso()
    total, cagr = _payload_return(payload)
    strategy_name = str(payload.get("strategy_name") or "")
    execute(
        "INSERT INTO lab_backtests"
        " (id, user_id, project_id, name, strategy_name, total_return, cagr, payload, created_at, updated_at)"
        " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [backtest_id, user_id, project_id, display, strategy_name, total, cagr, encoded, now, now],
    )
    return {
        "id": backtest_id, "project_id": project_id, "name": display,
        "strategy_name": strategy_name, "total_return": total, "cagr": cagr,
        "created_at": now, "updated_at": now,
    }


def get_lab_backtest(user_id: str, backtest_id: str) -> dict[str, Any] | None:
    row = execute_one(
        "SELECT b.id, b.project_id, b.name, b.strategy_name, b.total_return, b.cagr,"
        " b.payload, b.created_at, b.updated_at"
        " FROM lab_backtests b"
        " JOIN lab_projects p ON p.id = b.project_id"
        " JOIN lab_workspaces w ON w.id = p.workspace_id"
        " WHERE b.id = ? AND w.user_id = ?",
        [backtest_id, user_id],
    )
    if not row:
        return None
    summary = _backtest_summary(row)
    summary["payload"] = _parse_json(row.get("payload"), {})
    return summary


def rename_lab_backtest(user_id: str, backtest_id: str, name: str) -> dict[str, Any] | None:
    current = get_lab_backtest(user_id, backtest_id)
    if not current:
        return None
    display = (name or "").strip()
    if not display:
        raise LabError("Give the backtest a name.", 400)
    if len(display) > BACKTEST_NAME_MAX:
        raise LabError(f"Backtest names must be {BACKTEST_NAME_MAX} characters or fewer.", 400)
    now = now_iso()
    execute(
        "UPDATE lab_backtests SET name = ?, updated_at = ? WHERE id = ?",
        [display, now, backtest_id],
    )
    current.update({"name": display, "updated_at": now})
    current.pop("payload", None)
    return current


def delete_lab_backtest(user_id: str, backtest_id: str) -> bool:
    if not get_lab_backtest(user_id, backtest_id):
        return False
    execute("DELETE FROM lab_backtests WHERE id = ? AND user_id = ?", [backtest_id, user_id])
    return True


# -------- Template seeds --------
# The starter file each project template creates. Ids match the Lab wizard's
# template list, so the preview it shows is the file the project opens with.
_BLANK_SEED = '''\
from sltp import Order, StockData, Strategy


class MyStrategy(Strategy):
    """A strategy skeleton. Fill in on_signal to return orders."""

    def __init__(self):
        super().__init__()
        self.name = "My strategy"
        self.MAX_POSITIONS = 10
        self.ALLOCATION = 0.10
        self.MIN_BARS_REQUIRED = 60

    def initialize_universe(self, current_date, histories):
        # The names this strategy is allowed to trade. Change them freely;
        # the engine hands each one's history to on_signal.
        self.add_tickers(["AAPL", "MSFT", "NVDA", "SPY"])
        return True

    def on_signal(self, ticker: str, data: StockData) -> Order | None:
        # Return an Order to trade, or None to leave this ticker alone.
        return None
'''

_MOVING_AVERAGE_SEED = '''\
import numpy as np

from sltp import Order, OrderSizing, PositionType, StockData, Strategy


class MovingAverageCrossover(Strategy):
    """Buy when the 20-day average crosses above the 50-day average."""

    def __init__(self):
        super().__init__()
        self.name = "Moving average crossover"
        self.MAX_POSITIONS = 10
        self.ALLOCATION = 0.10
        self.MIN_BARS_REQUIRED = 60

    def initialize_universe(self, current_date, histories):
        # The names this strategy is allowed to trade. Change them freely;
        # the engine hands each one's history to on_signal.
        self.add_tickers(["AAPL", "MSFT", "NVDA", "SPY"])
        return True

    def on_signal(self, ticker: str, data: StockData) -> Order | None:
        if ticker in self.open_tickers:
            return None
        closes = data.close_price
        if len(closes) < 51:
            return None

        fast_now = float(np.mean(closes[-20:]))
        fast_prev = float(np.mean(closes[-21:-1]))
        slow_now = float(np.mean(closes[-50:]))
        slow_prev = float(np.mean(closes[-51:-1]))

        if not (fast_prev <= slow_prev and fast_now > slow_now):
            return None

        close = float(closes[-1])
        return Order(
            ticker=ticker,
            position_type=PositionType.LONG,
            allocation=self.ALLOCATION,
            sizing=OrderSizing.EQUITY,
            order_date=str(data.dates[-1]),
            stop_loss=round(close * 0.92, 2),
            take_profit=round(close * 1.16, 2),
        )
'''

_LOOPS_SEED = '''\
from sltp import Order, OrderSizing, PositionType, StockData, Strategy


class TwentyDayBreakout(Strategy):
    """Buy when the close clears the highest close of the last 20 days."""

    def __init__(self):
        super().__init__()
        self.name = "20-day breakout"
        self.MAX_POSITIONS = 10
        self.ALLOCATION = 0.10
        self.MIN_BARS_REQUIRED = 60

    def initialize_universe(self, current_date, histories):
        # The names this strategy is allowed to trade. Change them freely;
        # the engine hands each one's history to on_signal.
        self.add_tickers(["AAPL", "MSFT", "NVDA", "SPY"])
        return True

    def on_signal(self, ticker: str, data: StockData) -> Order | None:
        if ticker in self.open_tickers:
            return None
        closes = data.close_price
        if len(closes) < 21:
            return None

        highest = max(float(close) for close in closes[-21:-1])
        close = float(closes[-1])
        if close <= highest:
            return None

        return Order(
            ticker=ticker,
            position_type=PositionType.LONG,
            allocation=self.ALLOCATION,
            sizing=OrderSizing.EQUITY,
            order_date=str(data.dates[-1]),
            stop_loss=round(close * 0.93, 2),
            take_profit=round(close * 1.18, 2),
        )
'''

_FUNCTIONS_SEED = '''\
from sltp import Order, OrderSizing, PositionType, StockData, Strategy


def momentum(closes, days: int) -> float:
    """How far the last close sits above the close N days ago, as a fraction."""
    if len(closes) <= days:
        return 0.0
    past = float(closes[-days - 1])
    return (float(closes[-1]) - past) / past if past else 0.0


class Momentum(Strategy):
    """Buy the ticker when its 20-day momentum turns positive."""

    def __init__(self):
        super().__init__()
        self.name = "20-day momentum"
        self.MAX_POSITIONS = 10
        self.ALLOCATION = 0.10
        self.MIN_BARS_REQUIRED = 60

    def initialize_universe(self, current_date, histories):
        # The names this strategy is allowed to trade. Change them freely;
        # the engine hands each one's history to on_signal.
        self.add_tickers(["AAPL", "MSFT", "NVDA", "SPY"])
        return True

    def on_signal(self, ticker: str, data: StockData) -> Order | None:
        if ticker in self.open_tickers:
            return None
        closes = data.close_price
        if momentum(closes, 20) <= 0.03:
            return None

        close = float(closes[-1])
        return Order(
            ticker=ticker,
            position_type=PositionType.LONG,
            allocation=self.ALLOCATION,
            sizing=OrderSizing.EQUITY,
            order_date=str(data.dates[-1]),
            stop_loss=round(close * 0.90, 2),
            take_profit=round(close * 1.20, 2),
        )
'''

TEMPLATE_SEEDS: dict[str, list[tuple[str, str]]] = {
    "blank": [("workspace/main.py", _BLANK_SEED)],
    "moving-average": [("workspace/main.py", _MOVING_AVERAGE_SEED)],
    "loops": [("workspace/main.py", _LOOPS_SEED)],
    "functions": [("workspace/main.py", _FUNCTIONS_SEED)],
}

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
    execute("DELETE FROM lab_backtests WHERE user_id = ?", [user_id])
    delete_user_lab_projects(user_id)
