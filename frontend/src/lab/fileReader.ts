// fileReader.ts — Reads a local folder into a flat JSON file map.
//
// Two sources, one output shape:
//   - showDirectoryPicker() (File System Access API), where the browser has it.
//   - <input type="file" webkitdirectory>, everywhere else (Safari, Firefox).
//
// The map is plain data -- relative path -> file text -- so it can be shown,
// diffed or posted as JSON. Nothing leaves the browser until the import runs.
//
// The rules the reader follows:
//   - Only Python files are taken; everything else is reported as skipped.
//   - Paths are folded to the letters, digits, _ and - that Python module
//     names allow, so a folder called "my strategies" still imports.
//   - A `core/` folder is never imported. That package is read-only and the
//     server always serves the real one.
//   - When the picked folder contains a `workspace/` folder, that folder is
//     the source, so picking a project root imports exactly its editable half.

/** A file read from disk, with its path relative to the picked folder. */
export interface LocalFile {
  path: string;
  content: string;
}

/** A file that was left out of the map, and why. */
export interface SkippedFile {
  path: string;
  reason: string;
}

/** The JSON file map: relative path -> file text. */
export interface FolderFileMap {
  /** The name of the folder that was picked. */
  root: string;
  /** Relative path -> file text. */
  files: Record<string, string>;
  /** Every folder path under the root, e.g. "core/utils". */
  folders: string[];
  /** Files that were left out, and why. */
  skipped: SkippedFile[];
}

/** The server rejects anything larger, so the reader stops here too. */
export const MAX_FILE_BYTES = 200_000;

/** The read-only package. The server owns it; it is never imported. */
const CORE_FOLDER = 'core';

/** The editable half of a project. */
const WORKSPACE_FOLDER = 'workspace';

/** Folders that hold tooling or build output, never strategy code. */
const IGNORED_FOLDERS = new Set([
  '__pycache__',
  '__MACOSX',
  'node_modules',
  'venv',
  '.venv',
  '.git',
  '.hg',
  '.svn',
  '.mypy_cache',
  '.pytest_cache',
  '.ruff_cache',
  '.idea',
  '.vscode',
]);

/** The browser API used to pick a folder, when it exists. */
type DirectoryPicker = (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;

interface PickerWindow extends Window {
  showDirectoryPicker?: DirectoryPicker;
}

interface WebkitDirectoryInput extends HTMLInputElement {
  webkitdirectory: boolean;
}

/** True when the browser can pick a folder directly. */
export function supportsDirectoryPicker(): boolean {
  return typeof window !== 'undefined' && typeof (window as PickerWindow).showDirectoryPicker === 'function';
}

/**
 * Opens the folder picker and reads the chosen folder.
 * Resolves to null when the user cancels.
 */
export async function pickLocalFolder(): Promise<FolderFileMap | null> {
  if (supportsDirectoryPicker()) {
    try {
      const handle = await (window as PickerWindow).showDirectoryPicker!({ mode: 'read' });
      const entries: RawFile[] = [];
      await walkDirectory(handle, '', entries);
      return buildMap(handle.name, entries);
    } catch (error) {
      // A cancelled picker throws AbortError; anything else is worth surfacing.
      if (error instanceof DOMException && error.name === 'AbortError') return null;
      // A picker that is not allowed in this context falls back to the input.
      if (error instanceof DOMException && error.name === 'SecurityError') return pickWithInput();
      throw error;
    }
  }
  return pickWithInput();
}

/** A file on disk, before it is filtered and sanitised. */
interface RawFile {
  /** Path relative to the picked folder, with forward slashes. */
  path: string;
  file: File;
}

async function walkDirectory(handle: FileSystemDirectoryHandle, prefix: string, out: RawFile[]): Promise<void> {
  for await (const entry of handle.values()) {
    if (entry.kind === 'directory') {
      if (isIgnored(entry.name)) continue;
      await walkDirectory(entry, `${prefix}${entry.name}/`, out);
      continue;
    }
    const file = await entry.getFile();
    out.push({ path: `${prefix}${entry.name}`, file });
  }
}

/** The fallback for browsers without the File System Access API. */
function pickWithInput(): Promise<FolderFileMap | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input') as WebkitDirectoryInput;
    input.type = 'file';
    input.multiple = true;
    input.webkitdirectory = true;
    input.style.display = 'none';
    document.body.appendChild(input);

    let settled = false;
    const finish = (result: FolderFileMap | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onWindowFocus);
      input.remove();
      resolve(result);
    };
    // A cancelled folder picker fires no change event, so the window regaining
    // focus is the only signal that the picker closed without a selection.
    const onWindowFocus = () => {
      window.setTimeout(() => {
        if (!input.files || input.files.length === 0) finish(null);
      }, 300);
    };

    input.addEventListener('change', () => {
      const files = Array.from(input.files ?? []);
      if (files.length === 0) {
        finish(null);
        return;
      }
      // webkitRelativePath starts with the name of the picked folder.
      const root = files[0].webkitRelativePath.split('/')[0] || 'folder';
      const entries = files.map((file) => ({
        path: file.webkitRelativePath.split('/').slice(1).join('/'),
        file,
      }));
      void buildMap(root, entries).then(finish, () => finish(null));
    }, { once: true });

    window.addEventListener('focus', onWindowFocus, { once: true });
    input.click();
  });
}

function isIgnored(name: string): boolean {
  return name.startsWith('.') || IGNORED_FOLDERS.has(name);
}

/** Folds a path segment to the characters a Python module name may use. */
function sanitizeSegment(segment: string): string {
  const cleaned = segment
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
  return cleaned || 'file';
}

/** Folds a file name, keeping the .py extension the server requires. */
function sanitizeFileName(name: string): string {
  const dot = name.lastIndexOf('.');
  const stem = dot === -1 ? name : name.slice(0, dot);
  return `${sanitizeSegment(stem)}.py`;
}

/** Turns the raw listing into the JSON file map. */
async function buildMap(root: string, entries: RawFile[]): Promise<FolderFileMap> {
  const skipped: SkippedFile[] = [];
  const folders = new Set<string>();
  const files: Record<string, string> = {};

  // A workspace/ folder inside the picked folder wins, so picking a project
  // root imports its editable half rather than the whole tree.
  const hasWorkspace = entries.some((entry) => entry.path === WORKSPACE_FOLDER || entry.path.startsWith(`${WORKSPACE_FOLDER}/`));
  const sourceRoot = hasWorkspace ? `${WORKSPACE_FOLDER}/` : '';

  for (const entry of entries) {
    const path = entry.path;
    if (path === CORE_FOLDER || path.startsWith(`${CORE_FOLDER}/`)) {
      skipped.push({ path, reason: `${CORE_FOLDER}/ is read-only and comes from the server.` });
      continue;
    }
    if (sourceRoot && !path.startsWith(sourceRoot)) {
      skipped.push({ path, reason: `Outside ${WORKSPACE_FOLDER}/.` });
      continue;
    }
    const relative = sourceRoot ? path.slice(sourceRoot.length) : path;
    if (!relative) continue;
    if (!relative.endsWith('.py')) {
      skipped.push({ path, reason: 'Not a Python file.' });
      continue;
    }
    if (entry.file.size > MAX_FILE_BYTES) {
      skipped.push({ path, reason: `Larger than ${Math.round(MAX_FILE_BYTES / 1000)} KB.` });
      continue;
    }

    const parts = relative.split('/');
    const name = sanitizeFileName(parts[parts.length - 1]);
    const folderParts = parts.slice(0, -1).map(sanitizeSegment);
    const target = [...folderParts, name].join('/');

    // Two different local names can fold to the same module name; keep both.
    let unique = target;
    let counter = 2;
    while (Object.prototype.hasOwnProperty.call(files, unique)) {
      const dot = name.lastIndexOf('.');
      unique = `${[...folderParts, `${name.slice(0, dot)}_${counter}${name.slice(dot)}`].join('/')}`;
      counter += 1;
    }

    // A folder is only reported when a file really lives in it, so the server
    // can tell a real folder from one that was never on disk.
    for (let index = 1; index <= folderParts.length; index += 1) {
      folders.add(folderParts.slice(0, index).join('/'));
    }
    files[unique] = await entry.file.text();
  }

  return { root, files, folders: [...folders].sort(), skipped };
}
