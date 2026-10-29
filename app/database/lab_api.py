# lab_api.py — Lab endpoints: workspaces and the projects inside them.
#
# Every query is scoped to the authenticated user's id (never a client-supplied
# id), so one user can never read or write another user's workspace.
# Storage lives in Turso: lab_workspaces -> lab_projects -> lab_files.

import asyncio
import os
import re
import subprocess
import sys
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth.auth import get_current_user
from app.database import turso
from app.database.lab_core import CORE_FILES, CORE_FOLDERS, CORE_ROOT, core_source, is_core_path
from app.database.lab_templates import source_for

router = APIRouter()

NAME_MAX = 60


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clean_name(value: str, label: str) -> str:
    name = (value or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail=f"{label} is required.")
    if len(name) > NAME_MAX:
        raise HTTPException(status_code=400, detail=f"{label} must be {NAME_MAX} characters or fewer.")
    return name


class CreateWorkspaceIn(BaseModel):
    workspace_name: str = Field(description="Name of the workspace that will hold the project.")
    project_name: str = Field(description="Name of the first project inside the workspace.")
    template: str = Field(default="blank", description="Project template to start from.")


class CreateProjectIn(BaseModel):
    name: str = Field(description="Name of the new project.")
    template: str = Field(default="blank", description="Project template to start from.")


# -------- Files --------
# A project has two parts. `core/` is the read-only engine package, mirrored
# from the repo and never editable; `workspace/` holds the user's own files,
# which are the only ones stored in lab_files.
#
# Every editable file lives under `workspace/`, and every folder in the tree
# is implied by a file that exists in it. A file or folder therefore cannot
# be invented: it is either a real file the browser read from disk, or
# something the student wrote.
_REPO_ROOT = Path(__file__).resolve().parents[2]
WORKSPACE_ROOT = "workspace"

async def _store_starter_files(project_id: str, user_id: str, starter_files: dict[str, str], now: str) -> None:
    folders: set[str] = set()
    for name, content in starter_files.items():
        await turso.execute(
            "INSERT INTO lab_files (id, project_id, user_id, name, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [str(uuid.uuid4()), project_id, user_id, name, content, now, now],
        )
        folders.update(_parent_folders(name))
    for folder in sorted(folders):
        await turso.execute(
            "INSERT INTO lab_folders (id, project_id, user_id, name, created_at) VALUES (?, ?, ?, ?, ?)",
            [str(uuid.uuid4()), project_id, user_id, folder, now],
        )


async def _starter_or_400(template: str | None) -> dict[str, str]:
    # Blank projects and templates each receive their starter strategy source.
    sources = source_for(template)
    if sources is None:
        raise HTTPException(status_code=400, detail="Unknown starting template.")
    return sources


# Name/path validation constants follow the backend's persisted relative Python paths.


FILE_CONTENT_MAX = 200_000
FILE_NAME_RE = re.compile(r"^(?:[A-Za-z0-9_-]{1,50}/)*[A-Za-z0-9_-]{1,50}\.py$")
FOLDER_NAME_RE = re.compile(r"^[A-Za-z0-9_-]{1,50}(?:/[A-Za-z0-9_-]{1,50})*$")


def _parent_folders(path: str) -> list[str]:
    parts = path.split("/")[:-1]
    return ["/".join(parts[:index]) for index in range(1, len(parts) + 1)]


async def _ensure_folders(project_id: str, user_id: str, names: list[str], now: str) -> None:
    """Create the folder rows a path needs, skipping the ones that already exist."""
    for folder in names:
        existing = await turso.execute(
            "SELECT id FROM lab_folders WHERE project_id = ? AND user_id = ? AND name = ?",
            [project_id, user_id, folder],
        )
        if not existing:
            await turso.execute(
                "INSERT INTO lab_folders (id, project_id, user_id, name, created_at) VALUES (?, ?, ?, ?, ?)",
                [str(uuid.uuid4()), project_id, user_id, folder, now],
            )


# Older projects kept their editable files in `strategy/` and `manager/` and
# imported the engine from `base/`. The engine now lives in `core/` and the
# editable files in `workspace/`, so those files are moved across and their
# imports rewritten. A file whose new name is already taken is left alone.
_LEGACY_PREFIXES = ("strategy/", "manager/")
_LEGACY_IMPORT_REWRITES: tuple[tuple[str, str], ...] = (
    ("from base.strategy import", "from core.strategy.base_strategy import"),
    ("from base.portfolio_manager import", "from core.portfolio.portfolio_manager import"),
    ("from base import", "from core.strategy.base_strategy import"),
    ("from portfolio_manager import", "from core.portfolio.portfolio_manager import"),
    ("from app.engine.utils.", "from core.utils."),
    ("from manager.", "from workspace."),
    ("from strategy.", "from workspace."),
)


async def _migrate_legacy_layout(project_id: str, user_id: str) -> None:
    """Move a pre-`workspace/` project onto the current layout. Idempotent."""
    rows = await turso.execute(
        "SELECT id, name, content FROM lab_files WHERE project_id = ? AND user_id = ? ORDER BY name",
        [project_id, user_id],
    )
    legacy = [row for row in rows if row["name"].startswith(_LEGACY_PREFIXES)]
    if not legacy:
        return

    now = _now()
    taken = {row["name"] for row in rows}
    moved: list[str] = []
    for row in legacy:
        new_name = f"{WORKSPACE_ROOT}/{row['name'].split('/')[-1]}"
        if new_name in taken:
            continue
        content = row["content"]
        for old, new in _LEGACY_IMPORT_REWRITES:
            content = content.replace(old, new)
        await turso.execute(
            "UPDATE lab_files SET name = ?, content = ?, updated_at = ? WHERE id = ?",
            [new_name, content, now, row["id"]],
        )
        taken.add(new_name)
        moved.append(new_name)

    if not moved:
        return
    for name in moved:
        await _ensure_folders(project_id, user_id, _parent_folders(name), now)
    await turso.execute(
        "DELETE FROM lab_folders WHERE project_id = ? AND user_id = ? AND name IN ('strategy', 'manager')",
        [project_id, user_id],
    )


def _clean_folder_name(value: str) -> str:
    name = (value or "").strip().strip("/")
    if not FOLDER_NAME_RE.fullmatch(name):
        raise HTTPException(status_code=400, detail="Folder names may contain letters, numbers, _ and - only.")
    return name


def _clean_file_name(value: str) -> str:
    name = (value or "").strip().strip("/")
    parts = name.split("/")
    if not FILE_NAME_RE.fullmatch(name) or any(part in {".", ".."} for part in parts):
        raise HTTPException(
            status_code=400,
            detail="File paths must use letters, numbers, _ or -, optional folders, and end in .py.",
        )
    if is_core_path(name):
        raise HTTPException(status_code=403, detail=f"{CORE_ROOT}/ is read-only and cannot be changed.")
    return name


def _clean_workspace_file_name(value: str) -> str:
    """A file the student owns. It always lives under `workspace/`."""
    name = _clean_file_name(value)
    if not name.startswith(f"{WORKSPACE_ROOT}/"):
        raise HTTPException(
            status_code=400,
            detail=f"Your files live in {WORKSPACE_ROOT}/. {name} belongs in {WORKSPACE_ROOT}/{name}.",
        )
    return name


def _clean_workspace_folder_name(value: str) -> str:
    """A folder the student owns. It always lives under `workspace/`."""
    name = _clean_folder_name(value)
    if not name.startswith(f"{WORKSPACE_ROOT}/"):
        raise HTTPException(
            status_code=400,
            detail=f"Your folders live in {WORKSPACE_ROOT}/. Use {WORKSPACE_ROOT}/{name}.",
        )
    return name


async def _owned_project(project_id: str, user_id: str) -> dict[str, Any]:
    rows = await turso.execute(
        "SELECT id, name FROM lab_projects WHERE id = ? AND user_id = ?",
        [project_id, user_id],
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Project not found.")
    return rows[0]


class CreateFileIn(BaseModel):
    name: str = Field(description="File name, including its extension.")


class SaveFileIn(BaseModel):
    content: str = Field(description="Full text of the file as it should be stored.")


class CreateFolderIn(BaseModel):
    name: str = Field(description="Name of the new folder.")


class NameIn(BaseModel):
    name: str = Field(description="New name for the file or folder.")


@router.get("/api/lab/workspaces")
async def list_workspaces(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    """The signed-in user's workspaces, each with its projects (oldest first)."""
    user_id = user["id"]
    workspaces = await turso.execute(
        "SELECT id, name, created_at FROM lab_workspaces WHERE user_id = ? ORDER BY created_at",
        [user_id],
    )
    # The file count is a correlated subquery so the panel can show how big each
    # project is without a second round trip per project.
    projects = await turso.execute(
        """SELECT p.id, p.workspace_id, p.name, p.created_at,
                  (SELECT COUNT(*) FROM lab_files f
                    WHERE f.project_id = p.id AND f.user_id = p.user_id) AS file_count
             FROM lab_projects p
            WHERE p.user_id = ?
            ORDER BY p.created_at""",
        [user_id],
    )
    by_workspace: dict[str, list[dict[str, Any]]] = {}
    for p in projects:
        by_workspace.setdefault(p["workspace_id"], []).append(
            {
                "id": p["id"],
                "name": p["name"],
                "created_at": p["created_at"],
                "file_count": int(p.get("file_count") or 0),
            }
        )
    return {
        "workspaces": [
            {
                "id": w["id"],
                "name": w["name"],
                "created_at": w["created_at"],
                "projects": by_workspace.get(w["id"], []),
            }
            for w in workspaces
        ]
    }


@router.post("/api/lab/workspaces")
async def create_workspace(
    body: CreateWorkspaceIn,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Create a workspace together with its first project."""
    user_id = user["id"]
    workspace_name = _clean_name(body.workspace_name, "Workspace name")
    project_name = _clean_name(body.project_name, "Project name")
    starter_files = await _starter_or_400(body.template)

    now = _now()
    workspace_id = str(uuid.uuid4())
    project_id = str(uuid.uuid4())

    await turso.execute(
        "INSERT INTO lab_workspaces (id, user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        [workspace_id, user_id, workspace_name, now, now],
    )
    await turso.execute(
        """INSERT INTO lab_projects (id, workspace_id, user_id, name, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        [project_id, workspace_id, user_id, project_name, now, now],
    )

    await _store_starter_files(project_id, user_id, starter_files, now)

    return {
        "id": workspace_id,
        "name": workspace_name,
        "created_at": now,
        "projects": [{"id": project_id, "name": project_name, "created_at": now}],
    }


@router.get("/api/lab/projects/{project_id}/files")
async def list_files(
    project_id: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """The project's files: the read-only core/ package from the repo, then the user's own."""
    user_id = user["id"]
    project = await _owned_project(project_id, user_id)
    await _migrate_legacy_layout(project_id, user_id)

    files: list[dict[str, Any]] = [
        {"name": name, "content": core_source(name), "locked": True}
        for name in CORE_FILES
    ]
    rows = await turso.execute(
        "SELECT name, content FROM lab_files WHERE project_id = ? AND user_id = ? ORDER BY name",
        [project_id, user_id],
    )
    files += [{"name": r["name"], "content": r["content"], "locked": False} for r in rows]
    folders = await turso.execute(
        "SELECT name FROM lab_folders WHERE project_id = ? AND user_id = ? ORDER BY name",
        [project_id, user_id],
    )
    # The core package and the workspace root are part of the tree even though
    # only the workspace is stored, so the editor can draw both packages.
    tree_folders = {*CORE_FOLDERS, WORKSPACE_ROOT, *(r["name"] for r in folders)}
    return {
        "project": {"id": project["id"], "name": project["name"]},
        "files": files,
        "folders": sorted(tree_folders),
    }


@router.post("/api/lab/projects/{project_id}/files")
async def create_file(
    project_id: str,
    body: CreateFileIn,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = user["id"]
    await _owned_project(project_id, user_id)
    name = _clean_workspace_file_name(body.name)

    existing = await turso.execute(
        "SELECT id FROM lab_files WHERE project_id = ? AND name = ?",
        [project_id, name],
    )
    if existing:
        raise HTTPException(status_code=409, detail=f"{name} already exists.")

    now = _now()
    await turso.execute(
        """INSERT INTO lab_files (id, project_id, user_id, name, content, created_at, updated_at)
           VALUES (?, ?, ?, ?, '', ?, ?)""",
        [str(uuid.uuid4()), project_id, user_id, name, now, now],
    )
    await _ensure_folders(project_id, user_id, _parent_folders(name), now)
    return {"name": name, "content": "", "locked": False}


@router.post("/api/lab/projects/{project_id}/folders")
async def create_folder(
    project_id: str,
    body: CreateFolderIn,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = user["id"]
    await _owned_project(project_id, user_id)
    name = _clean_workspace_folder_name(body.name)
    now = _now()
    try:
        await turso.execute(
            "INSERT INTO lab_folders (id, project_id, user_id, name, created_at) VALUES (?, ?, ?, ?, ?)",
            [str(uuid.uuid4()), project_id, user_id, name, now],
        )
    except RuntimeError as exc:
        if "UNIQUE" in str(exc).upper():
            raise HTTPException(status_code=409, detail=f"Folder {name} already exists.") from exc
        raise
    for parent in _parent_folders(f"{name}/placeholder.py"):
        if parent == name:
            continue
        parent_exists = await turso.execute(
            "SELECT id FROM lab_folders WHERE project_id = ? AND user_id = ? AND name = ?",
            [project_id, user_id, parent],
        )
        if not parent_exists:
            await turso.execute(
                "INSERT INTO lab_folders (id, project_id, user_id, name, created_at) VALUES (?, ?, ?, ?, ?)",
                [str(uuid.uuid4()), project_id, user_id, parent, now],
            )
    return {"name": name}


@router.delete("/api/lab/projects/{project_id}/folders/{folder_name:path}")
async def delete_folder(
    project_id: str,
    folder_name: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = user["id"]
    await _owned_project(project_id, user_id)
    name = _clean_folder_name(folder_name)
    if is_core_path(name):
        raise HTTPException(status_code=403, detail=f"{CORE_ROOT}/ is read-only and cannot be changed.")
    if name == WORKSPACE_ROOT:
        # The workspace root holds every file the student wrote. It is not a
        # folder they can throw away.
        raise HTTPException(status_code=400, detail="The workspace root cannot be deleted.")
    prefix = f"{name}/"
    folders = await turso.execute(
        "SELECT name FROM lab_folders WHERE project_id = ? AND user_id = ? AND name = ?",
        [project_id, user_id, name],
    )
    if not folders:
        raise HTTPException(status_code=404, detail="Folder not found.")
    await turso.execute(
        "DELETE FROM lab_files WHERE project_id = ? AND user_id = ? AND substr(name, 1, ?) = ?",
        [project_id, user_id, len(prefix), prefix],
    )
    await turso.execute(
        "DELETE FROM lab_folders WHERE project_id = ? AND user_id = ? AND (name = ? OR substr(name, 1, ?) = ?)",
        [project_id, user_id, name, len(prefix), prefix],
    )
    return {"deleted": True, "kind": "folder", "name": name}


@router.put("/api/lab/projects/{project_id}/files/{file_name:path}")
async def save_file(
    project_id: str,
    file_name: str,
    body: SaveFileIn,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = user["id"]
    await _owned_project(project_id, user_id)
    name = _clean_workspace_file_name(file_name)
    if len(body.content) > FILE_CONTENT_MAX:
        raise HTTPException(status_code=400, detail="File is too large.")

    await turso.execute(
        "UPDATE lab_files SET content = ?, updated_at = ? WHERE project_id = ? AND user_id = ? AND name = ?",
        [body.content, _now(), project_id, user_id, name],
    )
    return {"name": name, "saved": True}


@router.patch("/api/lab/projects/{project_id}/files/{file_name:path}")
async def rename_file(
    project_id: str,
    file_name: str,
    body: NameIn,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = user["id"]
    await _owned_project(project_id, user_id)
    old_name = _clean_workspace_file_name(file_name)  # 403 for the locked repo files
    new_name = _clean_workspace_file_name(body.name)  # 403 if the new name is a locked name
    if new_name == old_name:
        return {"name": old_name, "previous": old_name}

    source = await turso.execute(
        "SELECT id FROM lab_files WHERE project_id = ? AND user_id = ? AND name = ?",
        [project_id, user_id, old_name],
    )
    if not source:
        raise HTTPException(status_code=404, detail="File not found.")
    clash = await turso.execute(
        "SELECT id FROM lab_files WHERE project_id = ? AND name = ?",
        [project_id, new_name],
    )
    if clash:
        raise HTTPException(status_code=409, detail=f"{new_name} already exists.")

    await turso.execute(
        "UPDATE lab_files SET name = ?, updated_at = ? WHERE project_id = ? AND user_id = ? AND name = ?",
        [new_name, _now(), project_id, user_id, old_name],
    )
    now = _now()
    await _ensure_folders(project_id, user_id, _parent_folders(new_name), now)
    old_folders = _parent_folders(old_name)
    for folder in reversed(old_folders):
        if folder in _parent_folders(new_name):
            continue
        remaining_files = await turso.execute(
            "SELECT id FROM lab_files WHERE project_id = ? AND user_id = ? AND substr(name, 1, ?) = ? LIMIT 1",
            [project_id, user_id, len(f"{folder}/"), f"{folder}/"],
        )
        remaining_folders = await turso.execute(
            "SELECT id FROM lab_folders WHERE project_id = ? AND user_id = ? AND substr(name, 1, ?) = ? LIMIT 1",
            [project_id, user_id, len(f"{folder}/"), f"{folder}/"],
        )
        if not remaining_files and not remaining_folders:
            await turso.execute(
                "DELETE FROM lab_folders WHERE project_id = ? AND user_id = ? AND name = ?",
                [project_id, user_id, folder],
            )
    return {"name": new_name, "previous": old_name}


@router.delete("/api/lab/projects/{project_id}/files/{file_name:path}")
async def delete_file(
    project_id: str,
    file_name: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = user["id"]
    await _owned_project(project_id, user_id)
    name = _clean_workspace_file_name(file_name)  # 403 for the locked repo files

    existing = await turso.execute(
        "SELECT id FROM lab_files WHERE project_id = ? AND user_id = ? AND name = ?",
        [project_id, user_id, name],
    )
    if not existing:
        raise HTTPException(status_code=404, detail="File not found.")
    await turso.execute(
        "DELETE FROM lab_files WHERE project_id = ? AND user_id = ? AND name = ?",
        [project_id, user_id, name],
    )
    for folder in reversed(_parent_folders(name)):
        remaining_files = await turso.execute(
            "SELECT id FROM lab_files WHERE project_id = ? AND user_id = ? AND substr(name, 1, ?) = ? LIMIT 1",
            [project_id, user_id, len(f"{folder}/"), f"{folder}/"],
        )
        remaining_folders = await turso.execute(
            "SELECT id FROM lab_folders WHERE project_id = ? AND user_id = ? AND substr(name, 1, ?) = ? LIMIT 1",
            [project_id, user_id, len(f"{folder}/"), f"{folder}/"],
        )
        if not remaining_files and not remaining_folders:
            await turso.execute(
                "DELETE FROM lab_folders WHERE project_id = ? AND user_id = ? AND name = ?",
                [project_id, user_id, folder],
            )
    return {"deleted": True, "kind": "file", "name": name}


# -------- Import --------
# The browser reads a local folder into a JSON file map and posts it here. Each
# path is relative to the picked folder, so "custom_strategy.py" is stored as
# "workspace/custom_strategy.py".
#
# The map is the only source of truth. The server writes the files that are in
# it, in the folders that were really walked on disk, and nothing else: a file
# whose folder the browser never saw is skipped, and a folder is created only
# once a file lands in it. Anything left out comes back in `skipped` with the
# reason, so the editor can show what did not make it in.

IMPORT_MAX_FILES = 200
IMPORT_MAX_TOTAL_BYTES = 2_000_000


class ImportFileIn(BaseModel):
    path: str = Field(description="Path of the file relative to the imported folder.")
    content: str = Field(description="Full text of the imported file.")


class ImportIn(BaseModel):
    files: list[ImportFileIn] = Field(default=[], description="Files to import.")
    # The folders the browser walked, relative to the picked folder. A file is
    # only imported when the folder it lives in is in this list.
    folders: list[str] = Field(default=[], description="Folder paths, relative to the picked folder, to import.")


@router.post("/api/lab/projects/{project_id}/import")
async def import_files(
    project_id: str,
    body: ImportIn,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Write a batch of files the browser read from a local folder into the project."""
    user_id = user["id"]
    await _owned_project(project_id, user_id)

    if not body.files:
        raise HTTPException(status_code=400, detail="There are no files to import.")
    if len(body.files) > IMPORT_MAX_FILES:
        raise HTTPException(status_code=400, detail=f"Import at most {IMPORT_MAX_FILES} files at a time.")
    total = sum(len(entry.content.encode("utf-8")) for entry in body.files)
    if total > IMPORT_MAX_TOTAL_BYTES:
        raise HTTPException(status_code=400, detail="The selected folder is too large to import.")

    # The folders the browser actually walked. A file is only real if the
    # folder it sits in is one of them.
    known_folders = {(folder or "").strip().strip("/") for folder in body.folders}
    known_folders.discard("")

    # A path cannot be a file and a folder at the same time, so the deeper one
    # is dropped when they collide.
    paths = [(entry.path or "").strip().strip("/") for entry in body.files]
    file_paths = {path for path in paths if path}
    shadowed = {
        path for path in file_paths
        if any(other.startswith(f"{path}/") for other in file_paths)
    }

    now = _now()
    imported: list[str] = []
    skipped: list[dict[str, str]] = []
    seen: set[str] = set()
    for entry, relative in zip(body.files, paths):
        if not relative:
            skipped.append({"path": entry.path, "reason": "The file has no path."})
            continue
        if relative in seen:
            skipped.append({"path": entry.path, "reason": "The same path was listed twice."})
            continue
        seen.add(relative)
        if relative in shadowed:
            skipped.append({"path": entry.path, "reason": "Another file lives inside this path."})
            continue

        try:
            name = _clean_workspace_file_name(f"{WORKSPACE_ROOT}/{relative}")
        except HTTPException as exc:
            skipped.append({"path": entry.path, "reason": str(exc.detail)})
            continue
        if len(entry.content) > FILE_CONTENT_MAX:
            skipped.append({"path": entry.path, "reason": "The file is too large."})
            continue

        # The folder the file lives in has to be one the browser walked. The
        # folders are relative to the picked folder, so they line up with the
        # relative path, not with the stored one.
        relative_parent = "/".join(relative.split("/")[:-1])
        if relative_parent and relative_parent not in known_folders:
            skipped.append({
                "path": entry.path,
                "reason": f"The folder {relative_parent} was not in the folder you picked.",
            })
            continue

        existing = await turso.execute(
            "SELECT id FROM lab_files WHERE project_id = ? AND user_id = ? AND name = ?",
            [project_id, user_id, name],
        )
        if existing:
            await turso.execute(
                "UPDATE lab_files SET content = ?, updated_at = ? WHERE project_id = ? AND user_id = ? AND name = ?",
                [entry.content, now, project_id, user_id, name],
            )
        else:
            await turso.execute(
                """INSERT INTO lab_files (id, project_id, user_id, name, content, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                [str(uuid.uuid4()), project_id, user_id, name, entry.content, now, now],
            )
        await _ensure_folders(project_id, user_id, _parent_folders(name), now)
        imported.append(name)

    return {"imported": imported, "skipped": skipped}


@router.post("/api/lab/workspaces/{workspace_id}/projects")
async def create_project(
    workspace_id: str,
    body: CreateProjectIn,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Add a project to an existing workspace, seeded with the chosen starter file."""
    user_id = user["id"]
    workspace = await turso.execute(
        "SELECT id FROM lab_workspaces WHERE id = ? AND user_id = ?",
        [workspace_id, user_id],
    )
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found.")
    project_name = _clean_name(body.name, "Project name")
    starter_files = await _starter_or_400(body.template)

    now = _now()
    project_id = str(uuid.uuid4())
    await turso.execute(
        """INSERT INTO lab_projects (id, workspace_id, user_id, name, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        [project_id, workspace_id, user_id, project_name, now, now],
    )
    await _store_starter_files(project_id, user_id, starter_files, now)
    return {"id": project_id, "name": project_name, "created_at": now}


@router.patch("/api/lab/projects/{project_id}")
async def rename_project(
    project_id: str,
    body: NameIn,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = user["id"]
    await _owned_project(project_id, user_id)
    name = _clean_name(body.name, "Project name")
    await turso.execute(
        "UPDATE lab_projects SET name = ?, updated_at = ? WHERE id = ? AND user_id = ?",
        [name, _now(), project_id, user_id],
    )
    return {"id": project_id, "name": name}


@router.delete("/api/lab/projects/{project_id}")
async def delete_project(
    project_id: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Delete a project and every file in it, from Turso.

    Turso is not guaranteed to enforce the ON DELETE CASCADE from the schema,
    so the child rows are removed explicitly, files first.
    """
    user_id = user["id"]
    project = await _owned_project(project_id, user_id)
    await turso.execute(
        "DELETE FROM lab_files WHERE project_id = ? AND user_id = ?",
        [project_id, user_id],
    )
    await turso.execute(
        "DELETE FROM lab_folders WHERE project_id = ? AND user_id = ?",
        [project_id, user_id],
    )
    await turso.execute(
        "DELETE FROM lab_projects WHERE id = ? AND user_id = ?",
        [project_id, user_id],
    )
    return {"deleted": True, "kind": "project", "name": project["name"]}


@router.delete("/api/lab/workspaces/{workspace_id}")
async def delete_workspace(
    workspace_id: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Delete a workspace with all of its projects and files, from Turso.

    Child rows are removed explicitly, deepest first (files, projects, then the
    workspace), because Turso may not enforce the ON DELETE CASCADE.
    """
    user_id = user["id"]
    workspace = await turso.execute(
        "SELECT id, name FROM lab_workspaces WHERE id = ? AND user_id = ?",
        [workspace_id, user_id],
    )
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found.")

    project_rows = await turso.execute(
        "SELECT id FROM lab_projects WHERE workspace_id = ? AND user_id = ?",
        [workspace_id, user_id],
    )
    await turso.execute(
        """DELETE FROM lab_files WHERE user_id = ? AND project_id IN
           (SELECT id FROM lab_projects WHERE workspace_id = ? AND user_id = ?)""",
        [user_id, workspace_id, user_id],
    )
    await turso.execute(
        """DELETE FROM lab_folders WHERE user_id = ? AND project_id IN
           (SELECT id FROM lab_projects WHERE workspace_id = ? AND user_id = ?)""",
        [user_id, workspace_id, user_id],
    )
    await turso.execute(
        "DELETE FROM lab_projects WHERE workspace_id = ? AND user_id = ?",
        [workspace_id, user_id],
    )
    await turso.execute(
        "DELETE FROM lab_workspaces WHERE id = ? AND user_id = ?",
        [workspace_id, user_id],
    )
    return {
        "deleted": True,
        "kind": "workspace",
        "name": workspace[0]["name"],
        "projects_deleted": len(project_rows),
    }


# -------- Type check --------
# Runs mypy over a project's Python files in a temp directory. The read-only
# current-engine core/ package is written beside the user's files so their imports resolve,
# and MYPYPATH points at the repo so `from app.* import ...` resolves too. Only
# the user's files are reported; errors inside imported modules are silenced
# with --follow-imports=silent.
CHECK_TIMEOUT_S = 60
CHECK_MAX_FILES = 40
_DIAG_RE = re.compile(
    r"^(?P<file>[^:\n]+):(?P<line>\d+):(?:(?P<col>\d+):)? (?P<severity>error|warning): (?P<message>.*?)(?:\s+\[(?P<code>[\w-]+)\])?$"
)


class DraftFileIn(BaseModel):
    name: str
    content: str


# The server may run on an interpreter that does not have mypy installed (the
# repo's .venv does). The interpreter is picked once and reused, so every check
# does not pay for the lookup.
_mypy_python: str | None = None
_mypy_python_found = False


def _mypy_interpreter() -> str | None:
    """The first Python that can import mypy: the repo venv, then the server's own."""
    global _mypy_python, _mypy_python_found
    if _mypy_python_found:
        return _mypy_python
    _mypy_python_found = True

    candidates = [_REPO_ROOT / ".venv" / "bin" / "python", Path(sys.executable)]
    for candidate in candidates:
        try:
            probe = subprocess.run(
                [str(candidate), "-c", "import mypy"],
                capture_output=True,
                text=True,
                timeout=20,
            )
        except (OSError, subprocess.TimeoutExpired):
            continue
        if probe.returncode == 0:
            _mypy_python = str(candidate)
            break
    return _mypy_python


class CheckIn(BaseModel):
    # Unsaved editor drafts. They override the stored content of the same file.
    files: list[DraftFileIn] = []


def _run_type_check(sources: dict[str, str]) -> dict[str, Any]:
    interpreter = _mypy_interpreter()
    if interpreter is None:
        return {
            "ok": False,
            "diagnostics": [],
            "tool_error": "The type checker (mypy) is not installed on the server.",
        }

    with tempfile.TemporaryDirectory(prefix="lab-check-") as tmp:
        tmp_path = Path(tmp)
        for name in CORE_FILES:
            target_path = tmp_path / name
            target_path.parent.mkdir(parents=True, exist_ok=True)
            target_path.write_text(core_source(name), encoding="utf-8")
        for name, content in sources.items():
            target_path = tmp_path / name
            target_path.parent.mkdir(parents=True, exist_ok=True)
            target_path.write_text(content, encoding="utf-8")

        cmd = [
            interpreter,
            "-m",
            "mypy",
            "--no-incremental",
            f"--cache-dir={os.devnull}",
            "--follow-imports=silent",
            # The project is two packages, `core` and `workspace`, without
            # __init__.py files. Explicit bases keep source modules consistently
            # named under their package during checking.
            "--explicit-package-bases",
            # Check bodies of unannotated functions too; strategy code is mostly unannotated.
            "--check-untyped-defs",
            # Third-party packages without type stubs (e.g. yfinance) are not errors in the user's code.
            "--disable-error-code=import-untyped",
            "--show-column-numbers",
            "--show-error-codes",
            "--no-error-summary",
            "--no-pretty",
            "--no-color-output",
            *sorted(sources),
        ]
        env = {**os.environ, "MYPYPATH": str(_REPO_ROOT)}
        try:
            proc = subprocess.run(
                cmd, cwd=tmp, env=env, capture_output=True, text=True, timeout=CHECK_TIMEOUT_S
            )
        except subprocess.TimeoutExpired:
            return {
                "ok": False,
                "diagnostics": [],
                "tool_error": f"The type check timed out after {CHECK_TIMEOUT_S} seconds.",
            }

    diagnostics: list[dict[str, Any]] = []
    for line in proc.stdout.splitlines():
        m = _DIAG_RE.match(line)
        if not m or m["file"] not in sources:
            continue
        diagnostics.append(
            {
                "file": m["file"],
                "line": int(m["line"]),
                "column": int(m["col"]) if m["col"] else 1,
                "severity": m["severity"],
                "message": m["message"],
                "code": m["code"],
            }
        )

    # mypy exits 0 (clean) or 1 (errors found). It also exits 2 on a syntax error, but then it
    # still prints the diagnostics, so exit 2 only counts as a tool failure when none were parsed.
    # A non-zero exit with nothing parsed and something on stderr is a broken run, not a clean
    # project: report it instead of pretending the files are fine.
    tool_error = None
    if not diagnostics and proc.returncode != 0:
        stderr = (proc.stderr or "").strip()
        if proc.returncode not in (0, 1) or stderr:
            tool_error = stderr[-2000:] or f"mypy exited with code {proc.returncode}."
    return {
        "ok": not diagnostics and tool_error is None,
        "diagnostics": diagnostics[:500],
        "tool_error": tool_error,
    }


@router.post("/api/lab/projects/{project_id}/check")
async def check_project(
    project_id: str,
    body: CheckIn,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = user["id"]
    await _owned_project(project_id, user_id)

    rows = await turso.execute(
        "SELECT name, content FROM lab_files WHERE project_id = ? AND user_id = ?",
        [project_id, user_id],
    )
    sources: dict[str, str] = {r["name"]: r["content"] for r in rows if not is_core_path(r["name"])}
    for draft in body.files:
        if is_core_path(draft.name):
            continue
        name = _clean_workspace_file_name(draft.name)
        if len(draft.content) > FILE_CONTENT_MAX:
            raise HTTPException(status_code=400, detail=f"{name} is too large to check.")
        sources[name] = draft.content

    if len(sources) > CHECK_MAX_FILES:
        raise HTTPException(status_code=400, detail=f"Check at most {CHECK_MAX_FILES} files at a time.")
    if not sources:
        return {"ok": True, "diagnostics": [], "tool_error": None, "checked": []}

    result = await asyncio.to_thread(_run_type_check, sources)
    return {**result, "checked": sorted(sources)}
