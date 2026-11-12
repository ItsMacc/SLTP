// store.ts — the Lab's workspaces, projects and files, stored in Turso.
//
// The Lab pages speak the same words they always did (a workspace holds
// projects, a project holds files). This module is the one place that turns
// those words into the authenticated FastAPI calls in lib/api.ts, so the pages
// never touch a fetch or a session themselves.
//
// Every call takes the Supabase access token from the live session. The Lab is
// behind the sign-in gate, so a missing session means it expired mid-visit:
// the caller gets a plain message it can show instead of a silent empty list.

import { supabase } from '../../lib/supabase';
import {
  createLabFile as apiCreateLabFile,
  createLabProject as apiCreateLabProject,
  createLabWorkspace as apiCreateLabWorkspace,
  deleteLabFile as apiDeleteLabFile,
  deleteLabFolder as apiDeleteLabFolder,
  deleteLabProject as apiDeleteLabProject,
  deleteLabWorkspace as apiDeleteLabWorkspace,
  getLabProjectFiles as apiGetLabProjectFiles,
  importLabFiles as apiImportLabFiles,
  listLabWorkspaces as apiListLabWorkspaces,
  renameLabFile as apiRenameLabFile,
  saveLabFile as apiSaveLabFile,
  type LabFile,
  type LabProject,
  type LabWorkspace,
} from '../../lib/api';

export type { LabFile, LabProject, LabWorkspace };

export interface LabProjectFiles {
  project: { id: string; name: string };
  files: LabFile[];
  folders: string[];
}

async function token(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Your session has expired. Please sign in again.');
  }
  return session.access_token;
}

export async function listLabWorkspaces(): Promise<LabWorkspace[]> {
  return apiListLabWorkspaces(await token());
}

export async function createLabWorkspace(input: {
  workspace_name: string;
  project_name: string;
  template?: string;
}): Promise<LabWorkspace> {
  return apiCreateLabWorkspace(await token(), input);
}

export async function createLabProject(
  workspaceId: string,
  name: string,
  template?: string,
): Promise<LabProject> {
  return apiCreateLabProject(await token(), workspaceId, name, template);
}

export async function deleteLabWorkspace(workspaceId: string): Promise<void> {
  await apiDeleteLabWorkspace(await token(), workspaceId);
}

export async function deleteLabProject(projectId: string): Promise<void> {
  await apiDeleteLabProject(await token(), projectId);
}

export async function getLabProjectFiles(projectId: string): Promise<LabProjectFiles> {
  return apiGetLabProjectFiles(await token(), projectId);
}

export async function createLabFile(projectId: string, name: string): Promise<LabFile> {
  return apiCreateLabFile(await token(), projectId, name);
}

export async function saveLabFile(projectId: string, name: string, content: string): Promise<void> {
  await apiSaveLabFile(await token(), projectId, name, content);
}

export async function renameLabFile(
  projectId: string,
  name: string,
  newName: string,
): Promise<{ name: string; previous: string }> {
  return apiRenameLabFile(await token(), projectId, name, newName);
}

export async function deleteLabFile(projectId: string, name: string): Promise<void> {
  await apiDeleteLabFile(await token(), projectId, name);
}

export async function deleteLabFolder(projectId: string, name: string): Promise<void> {
  await apiDeleteLabFolder(await token(), projectId, name);
}

export async function importLabFiles(
  projectId: string,
  files: { path: string; content: string }[],
  folders: string[] = [],
): Promise<{ imported: string[]; skipped: { path: string; reason: string }[] }> {
  return apiImportLabFiles(await token(), projectId, files, folders);
}
