# projects.py — Lab code workspaces: projects, files and folders in Turso.
#
# The browser owns editing; these endpoints persist the working tree so code
# survives a cleared browser and loads it back. Every row is scoped to the id
# from the verified JWT, never the request body. Failure shapes match the
# frontend's api.ts contract: workspaces carry nested projects with
# file counts, and the file read returns files plus explicit folders.

# -------- Imports --------
from typing import Any

from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException

# Auth imports
from app.auth.jwt_auth import get_current_user

# Database imports
from app.turso import userdata

router = APIRouter()


def _lab_error(err: userdata.LabError) -> HTTPException:
    return HTTPException(status_code=err.status, detail=str(err))


# -------- Request Bodies --------
class WorkspaceCreateIn(BaseModel):
    workspace_name: str = Field(description="New workspace name.")
    strategy_name: str | None = Field(default=None, description="First strategy file, used as its filename.")
    project_name: str | None = Field(default=None, description="Deprecated alias for strategy_name.")
    template: str = Field(default="blank", description="Starter template id. Used when code is not sent.")
    code: str | None = Field(default=None, description="Exact starter code the wizard showed. Overrides the template seed.")


class StrategyCreateIn(BaseModel):
    name: str = Field(description="Strategy file name, without the folder.")
    template: str = Field(default="blank", description="Starter template id. Used when code is not sent.")
    code: str | None = Field(default=None, description="Exact starter code the wizard showed. Overrides the template seed.")


class ProjectCreateIn(BaseModel):
    name: str = Field(description="Project name.")
    template: str = Field(default="blank", description="Starter file set, same ids as above.")


class ProjectRenameIn(BaseModel):
    name: str = Field(description="New project name.")


class FileCreateIn(BaseModel):
    name: str = Field(description="File path, folders separated by slashes.")


class FileSaveIn(BaseModel):
    content: str = Field(default="", description="Full new file content.")


class FileSaveWithPath(BaseModel):
    path: str = Field(description="File path, folders separated by slashes.")
    content: str = Field(default="", description="Full new file content.")


class FileBatchSaveIn(BaseModel):
    files: list[FileSaveWithPath] = Field(default_factory=list, description="Paths with their full new contents.")


class FolderImportIn(BaseModel):
    files: list[FileSaveWithPath] = Field(default_factory=list, description="Files read off disk, stored under workspace/.")
    folders: list[str] = Field(default_factory=list, description="Real-but-empty folders to keep.")


class FileRenameIn(BaseModel):
    name: str = Field(description="New file path.")


class FolderCreateIn(BaseModel):
    name: str = Field(description="Folder path, folders separated by slashes.")


class BacktestCreateIn(BaseModel):
    payload: dict[str, Any] = Field(description="The normalized result the browser produced.")
    name: str | None = Field(default=None, description="Optional first name; the id is used otherwise.")


class BacktestRenameIn(BaseModel):
    name: str = Field(description="New display name.")


# -------- Workspaces --------
# Frontend read: every workspace with its projects and their file counts.
@router.get("/api/lab/workspaces")
async def list_workspaces(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    return {"workspaces": userdata.list_workspaces(user["id"])}


# Frontend write: a new workspace with its first strategy file. Projects remain
# a storage detail; the response is the workspace the editor opens.
@router.post("/api/lab/workspaces")
async def create_workspace(
    body: WorkspaceCreateIn,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        space = userdata.create_workspace(user["id"], body.workspace_name)
        strategy_name = (body.strategy_name or body.project_name or "main").strip()
        userdata.create_project(
            user["id"], space["id"], strategy_name, body.template, strategy_name,
            code=body.code,
        )
        summary = userdata.get_workspace(user["id"], space["id"])
    except userdata.LabError as err:
        raise _lab_error(err)
    if not summary:
        raise HTTPException(status_code=500, detail="Could not read the workspace after creating it.")
    return summary


@router.post("/api/lab/workspaces/{workspace_id}/strategies")
async def create_workspace_strategy(
    workspace_id: str,
    body: StrategyCreateIn,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        return userdata.add_workspace_strategy(
            user["id"], workspace_id, body.name, body.template, code=body.code,
        )
    except userdata.LabError as err:
        raise _lab_error(err)


# Frontend write: removes the workspace and everything inside it.
@router.delete("/api/lab/workspaces/{workspace_id}")
async def delete_workspace(
    workspace_id: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    if not userdata.delete_workspace(user["id"], workspace_id):
        raise HTTPException(status_code=404, detail="Workspace not found.")
    return {"id": workspace_id, "deleted": True}


# -------- Projects --------
# Frontend write: the wizard's existing-workspace branch — a seeded project.
@router.post("/api/lab/workspaces/{workspace_id}/projects")
async def create_project(
    workspace_id: str,
    body: ProjectCreateIn,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        return userdata.create_project(user["id"], workspace_id, body.name, body.template)
    except userdata.LabError as err:
        raise _lab_error(err)


# Frontend write: rename a project.
@router.patch("/api/lab/projects/{project_id}")
async def rename_project(
    project_id: str,
    body: ProjectRenameIn,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        project = userdata.rename_project(user["id"], project_id, body.name)
    except userdata.LabError as err:
        raise _lab_error(err)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    return project


# Frontend write: removes the project with all of its files and folders.
@router.delete("/api/lab/projects/{project_id}")
async def delete_project(
    project_id: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    if not userdata.delete_project(user["id"], project_id):
        raise HTTPException(status_code=404, detail="Project not found.")
    return {"id": project_id, "deleted": True}


# -------- Backtests --------
# The editor saves every completed run here, and the history window reads it
# back. The payload is the same JSON the report and the download are built
# from, so no result is ever recomputed to be reopened.
@router.get("/api/lab/projects/{project_id}/backtests")
async def list_project_backtests(
    project_id: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        return {"backtests": userdata.list_lab_backtests(user["id"], project_id)}
    except userdata.LabError as err:
        raise _lab_error(err)


@router.post("/api/lab/projects/{project_id}/backtests")
async def create_project_backtest(
    project_id: str,
    body: BacktestCreateIn,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        return userdata.create_lab_backtest(user["id"], project_id, body.payload, body.name)
    except userdata.LabError as err:
        raise _lab_error(err)


@router.get("/api/lab/backtests/{backtest_id}")
async def get_project_backtest(
    backtest_id: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    row = userdata.get_lab_backtest(user["id"], backtest_id)
    if not row:
        raise HTTPException(status_code=404, detail="Backtest not found.")
    return row


@router.patch("/api/lab/backtests/{backtest_id}")
async def rename_project_backtest(
    backtest_id: str,
    body: BacktestRenameIn,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        row = userdata.rename_lab_backtest(user["id"], backtest_id, body.name)
    except userdata.LabError as err:
        raise _lab_error(err)
    if not row:
        raise HTTPException(status_code=404, detail="Backtest not found.")
    return row


@router.delete("/api/lab/backtests/{backtest_id}")
async def delete_project_backtest(
    backtest_id: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    if not userdata.delete_lab_backtest(user["id"], backtest_id):
        raise HTTPException(status_code=404, detail="Backtest not found.")
    return {"id": backtest_id, "deleted": True}


# -------- Files --------
# Frontend read: the editor's project — every file with content, every folder.
@router.get("/api/lab/projects/{project_id}/files")
async def get_project_files(
    project_id: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    tree = userdata.get_project_tree(user["id"], project_id)
    if not tree:
        raise HTTPException(status_code=404, detail="Project not found.")
    return tree


# Frontend write: a new empty file at the given path.
@router.post("/api/lab/projects/{project_id}/files")
async def create_project_file(
    project_id: str,
    body: FileCreateIn,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        return userdata.create_project_file(user["id"], project_id, body.name)
    except userdata.LabError as err:
        raise _lab_error(err)


# Frontend write: overwrite a file's content, creating it when it is new.
@router.put("/api/lab/projects/{project_id}/files/{file_path:path}")
async def save_project_file(
    project_id: str,
    file_path: str,
    body: FileSaveIn,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        return userdata.save_project_file(user["id"], project_id, file_path, body.content)
    except userdata.LabError as err:
        raise _lab_error(err)


# Frontend write: the autosave flush — every dirty file in one write
# transaction, so rapid typing cannot stack up conflicting writes.
@router.put("/api/lab/projects/{project_id}/files")
async def save_project_files(
    project_id: str,
    body: FileBatchSaveIn,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        return userdata.save_project_files(
            user["id"], project_id, [item.model_dump() for item in body.files]
        )
    except userdata.LabError as err:
        raise _lab_error(err)


# Frontend write: the folder import — same single-transaction upsert.
@router.post("/api/lab/projects/{project_id}/import")
async def import_project_files(
    project_id: str,
    body: FolderImportIn,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        return userdata.import_project_files(
            user["id"], project_id,
            [item.model_dump() for item in body.files], body.folders,
        )
    except userdata.LabError as err:
        raise _lab_error(err)


# Frontend write: move or rename a file.
@router.patch("/api/lab/projects/{project_id}/files/{file_path:path}")
async def rename_project_file(
    project_id: str,
    file_path: str,
    body: FileRenameIn,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        return userdata.rename_project_file(user["id"], project_id, file_path, body.name)
    except userdata.LabError as err:
        raise _lab_error(err)


# Frontend write: removes one file.
@router.delete("/api/lab/projects/{project_id}/files/{file_path:path}")
async def delete_project_file(
    project_id: str,
    file_path: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        found = userdata.delete_project_file(user["id"], project_id, file_path)
    except userdata.LabError as err:
        raise _lab_error(err)
    if not found:
        raise HTTPException(status_code=404, detail="File not found.")
    return {"name": file_path, "deleted": True}


# -------- Folders --------
# Frontend write: records a real folder, even when it stays empty.
@router.post("/api/lab/projects/{project_id}/folders")
async def create_project_folder(
    project_id: str,
    body: FolderCreateIn,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        return userdata.create_project_folder(user["id"], project_id, body.name)
    except userdata.LabError as err:
        raise _lab_error(err)


# Frontend write: removes a folder with everything under it.
@router.delete("/api/lab/projects/{project_id}/folders/{folder_path:path}")
async def delete_project_folder(
    project_id: str,
    folder_path: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        found = userdata.delete_project_folder(user["id"], project_id, folder_path)
    except userdata.LabError as err:
        raise _lab_error(err)
    if not found:
        raise HTTPException(status_code=404, detail="Folder not found.")
    return {"name": folder_path, "deleted": True}
