// localStore.ts — the Lab's workspaces, projects and files, kept on this device.
//
// The Lab used to read them from the FastAPI project store over a signed-in
// session. The pages below still speak the same language (a workspace holds
// projects, a project holds files), so the same calls and return shapes live
// here against localStorage. Nothing leaves the browser and no account is
// needed, which is also what makes the page work while the server-side runner
// is still being built.
//
// A first visit is seeded with one workspace, one project and the three files
// the editor needs to show a real tree: a read-only core package, an entry file
// and a helper. The seed is replaced the moment the reader creates or deletes
// anything, and a store that loses its shape falls back to the seed instead of
// throwing on a half-written value.

import { getTemplate } from './templates';

export interface LabProject {
  id: string;
  name: string;
  created_at: string;
  /** Number of files in the project. Present on list reads. */
  file_count?: number;
}

export interface LabWorkspace {
  id: string;
  name: string;
  created_at: string;
  projects: LabProject[];
}

export interface LabFile {
  name: string;
  content: string;
  locked: boolean;
}

export interface LabProjectFiles {
  project: { id: string; name: string };
  files: LabFile[];
  folders: string[];
}

export interface LabImportResult {
  /** The project paths that were written, e.g. "workspace/custom.py". */
  imported: string[];
  /** Files that were left out, and why. */
  skipped: { path: string; reason: string }[];
}

interface StoredProject {
  id: string;
  name: string;
  created_at: string;
  files: LabFile[];
}

interface StoredWorkspace {
  id: string;
  name: string;
  created_at: string;
  projects: StoredProject[];
}

interface Store {
  workspaces: StoredWorkspace[];
}

const STORE_KEY = 'sltp.lab.store.v1';
const WORKSPACE_FOLDER = 'workspace';
const CORE_FOLDER = 'core';

let cache: Store | null = null;

function newId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function now(): string {
  return new Date().toISOString();
}

/* ---------- Seed ---------- */

const CORE_INIT = `"""The read-only engine package.

It arrives with the backtest runner, the same way Strategy, Order and
PortfolioManager will. Until then this placeholder keeps the explorer shaped
like a finished project: core is yours to read, workspace is yours to edit.
"""
`;

const SEED_MAIN = `# Run this file with Run, or Cmd/Ctrl + Enter.

prices = [101.5, 99.2, 103.8, 98.4, 105.1]
average = sum(prices) / len(prices)

print(f"{len(prices)} closes, average {average:.2f}")
print()

for price in prices:
    change = (price - average) / average * 100
    print(f"{price:>6.1f}   {change:+5.1f}% from the average")
`;

const SEED_HELPERS = `# A second file, to see how the explorer and tabs behave.
# Run it on its own; files will import each other once the engine lands.


def percent_change(value, base):
    """How far value sits from base, as a percentage."""
    return (value - base) / base * 100


for close in (99.2, 104.8, 97.5):
    print(close, f"{percent_change(close, 100):+.1f}%")
`;

function seed(): Store {
  const workspaceId = newId('ws');
  const created = now();
  return {
    workspaces: [
      {
        id: workspaceId,
        name: 'Python basics',
        created_at: created,
        projects: [
          {
            id: newId('prj'),
            name: 'First steps',
            created_at: created,
            files: [
              { name: `${CORE_FOLDER}/__init__.py`, content: CORE_INIT, locked: true },
              { name: `${WORKSPACE_FOLDER}/main.py`, content: SEED_MAIN, locked: false },
              { name: `${WORKSPACE_FOLDER}/helpers.py`, content: SEED_HELPERS, locked: false },
            ],
          },
        ],
      },
    ],
  };
}

/* ---------- Persistence ---------- */

function isStore(value: unknown): value is Store {
  if (!value || typeof value !== 'object') return false;
  const workspaces = (value as Store).workspaces;
  return Array.isArray(workspaces) && workspaces.every((ws) => Array.isArray(ws.projects));
}

function load(): Store {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isStore(parsed)) {
        cache = parsed;
        return cache;
      }
    }
  } catch {
    /* a blocked or full store runs from memory for this visit */
  }
  cache = seed();
  persist();
  return cache;
}

function persist(): void {
  if (!cache) return;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(cache));
  } catch {
    /* memory only */
  }
}

/* ---------- Lookups ---------- */

function findWorkspace(store: Store, id: string): StoredWorkspace | undefined {
  return store.workspaces.find((workspace) => workspace.id === id);
}

function findProject(store: Store, id: string): StoredProject | undefined {
  for (const workspace of store.workspaces) {
    const project = workspace.projects.find((item) => item.id === id);
    if (project) return project;
  }
  return undefined;
}

function foldersOf(files: LabFile[]): string[] {
  const folders = new Set<string>();
  for (const file of files) {
    const parts = file.name.split('/').slice(0, -1);
    for (let index = 1; index <= parts.length; index += 1) {
      folders.add(parts.slice(0, index).join('/'));
    }
  }
  return [...folders].sort();
}

function toWorkspace(workspace: StoredWorkspace): LabWorkspace {
  return {
    id: workspace.id,
    name: workspace.name,
    created_at: workspace.created_at,
    projects: workspace.projects.map((project) => ({
      id: project.id,
      name: project.name,
      created_at: project.created_at,
      file_count: project.files.length,
    })),
  };
}

/** The first editable file becomes the entry point of a new project. */
function filesForTemplate(template: string | undefined): LabFile[] {
  const chosen = getTemplate((template ?? 'blank') as Parameters<typeof getTemplate>[0]);
  return [{ name: `${WORKSPACE_FOLDER}/main.py`, content: chosen.code, locked: false }];
}

/* ---------- API used by the pages ---------- */

export async function listLabWorkspaces(): Promise<LabWorkspace[]> {
  return load().workspaces.map(toWorkspace);
}

export async function createLabWorkspace(input: {
  workspace_name: string;
  project_name: string;
  template?: string;
}): Promise<LabWorkspace> {
  const store = load();
  const created = now();
  const workspace: StoredWorkspace = {
    id: newId('ws'),
    name: input.workspace_name.trim() || 'Untitled workspace',
    created_at: created,
    projects: [
      {
        id: newId('prj'),
        name: input.project_name.trim() || 'Untitled project',
        created_at: created,
        files: filesForTemplate(input.template),
      },
    ],
  };
  store.workspaces.push(workspace);
  persist();
  return toWorkspace(workspace);
}

export async function createLabProject(
  workspaceId: string,
  name: string,
  template?: string,
): Promise<LabProject> {
  const store = load();
  const workspace = findWorkspace(store, workspaceId);
  if (!workspace) throw new Error('That workspace no longer exists.');
  const project: StoredProject = {
    id: newId('prj'),
    name: name.trim() || 'Untitled project',
    created_at: now(),
    files: filesForTemplate(template),
  };
  workspace.projects.push(project);
  persist();
  return { id: project.id, name: project.name, created_at: project.created_at, file_count: project.files.length };
}

export async function deleteLabWorkspace(workspaceId: string): Promise<void> {
  const store = load();
  store.workspaces = store.workspaces.filter((workspace) => workspace.id !== workspaceId);
  persist();
}

export async function deleteLabProject(projectId: string): Promise<void> {
  const store = load();
  for (const workspace of store.workspaces) {
    workspace.projects = workspace.projects.filter((project) => project.id !== projectId);
  }
  persist();
}

export async function getLabProjectFiles(projectId: string): Promise<LabProjectFiles> {
  const project = findProject(load(), projectId);
  if (!project) throw new Error('That project no longer exists.');
  return {
    project: { id: project.id, name: project.name },
    // Copies, so a draft typed into one read cannot change the store behind it.
    files: project.files.map((file) => ({ ...file })),
    folders: foldersOf(project.files),
  };
}

export async function createLabFile(projectId: string, name: string): Promise<LabFile> {
  const project = findProject(load(), projectId);
  if (!project) throw new Error('That project no longer exists.');
  if (project.files.some((file) => file.name === name)) {
    throw new Error(`${name} already exists in this project.`);
  }
  const file: LabFile = { name, content: `# ${name.split('/').at(-1) ?? name}\n`, locked: false };
  project.files.push(file);
  persist();
  return { ...file };
}

export async function saveLabFile(projectId: string, name: string, content: string): Promise<void> {
  const project = findProject(load(), projectId);
  if (!project) throw new Error('That project no longer exists.');
  const file = project.files.find((item) => item.name === name);
  if (!file) throw new Error(`${name} is no longer in this project.`);
  if (file.locked) throw new Error(`${name} is read-only.`);
  file.content = content;
  persist();
}

export async function renameLabFile(
  projectId: string,
  name: string,
  newName: string,
): Promise<{ name: string; previous: string }> {
  const project = findProject(load(), projectId);
  if (!project) throw new Error('That project no longer exists.');
  const file = project.files.find((item) => item.name === name);
  if (!file) throw new Error(`${name} is no longer in this project.`);
  if (file.locked) throw new Error(`${name} is read-only.`);
  if (project.files.some((item) => item.name === newName && item !== file)) {
    throw new Error(`${newName} already exists in this project.`);
  }
  file.name = newName;
  persist();
  return { name: newName, previous: name };
}

export async function deleteLabFile(projectId: string, name: string): Promise<void> {
  const project = findProject(load(), projectId);
  if (!project) throw new Error('That project no longer exists.');
  const file = project.files.find((item) => item.name === name);
  if (file?.locked) throw new Error(`${name} is read-only.`);
  project.files = project.files.filter((item) => item.name !== name);
  persist();
}

export async function deleteLabFolder(projectId: string, name: string): Promise<void> {
  const project = findProject(load(), projectId);
  if (!project) throw new Error('That project no longer exists.');
  const prefix = `${name}/`;
  project.files = project.files.filter((item) => !item.name.startsWith(prefix));
  persist();
}

export async function importLabFiles(
  projectId: string,
  files: { path: string; content: string }[],
  _folders: string[] = [],
): Promise<LabImportResult> {
  const project = findProject(load(), projectId);
  if (!project) throw new Error('That project no longer exists.');

  const imported: string[] = [];
  const skipped: { path: string; reason: string }[] = [];

  for (const entry of files) {
    const relative = entry.path.replace(/^\/+/, '');
    if (!relative.endsWith('.py')) {
      skipped.push({ path: entry.path, reason: 'Only Python files are imported.' });
      continue;
    }
    const name = `${WORKSPACE_FOLDER}/${relative}`;
    const existing = project.files.find((file) => file.name === name);
    if (existing) {
      existing.content = entry.content;
    } else {
      project.files.push({ name, content: entry.content, locked: false });
    }
    imported.push(name);
  }

  persist();
  return { imported, skipped };
}
