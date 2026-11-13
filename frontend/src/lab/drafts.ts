// drafts.ts — unsaved editor buffers, kept in the browser.
//
// A save reaching Turso is the only durable copy, so anything typed between
// saves used to live in React state alone: a crash, a forced quit, or a tab
// killed on a phone lost it. Every dirty buffer is also written here on a short
// debounce. It is a few kilobytes in localStorage, it needs no network, and it
// is still there when the tab comes back.
//
// The server is still the authority. A draft only says "this file was edited
// and the edit was never confirmed"; it is dropped as soon as the saved content
// matches it, and a draft identical to the server copy is ignored on restore.

const PREFIX = 'st_lab_draft_v1';
// One enormous file is not worth evicting the rest of the store for. The save
// path carries it as soon as it lands, so only crash protection is missing.
const MAX_DRAFT_BYTES = 400_000;

export interface LabDraft {
  content: string;
  at: number;
}

function draftKey(projectId: string, path: string): string {
  return `${PREFIX}:${projectId}:${path}`;
}

function projectPrefix(projectId: string): string {
  return `${PREFIX}:${projectId}:`;
}

export function readDraft(projectId: string, path: string): LabDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(projectId, path));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LabDraft;
    return typeof parsed?.content === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

export function writeDraft(projectId: string, path: string, content: string): void {
  try {
    if (content.length > MAX_DRAFT_BYTES) {
      localStorage.removeItem(draftKey(projectId, path));
      return;
    }
    localStorage.setItem(
      draftKey(projectId, path),
      JSON.stringify({ content, at: Date.now() } satisfies LabDraft),
    );
  } catch {
    // A full quota or a private window must never break typing.
  }
}

export function dropDraft(projectId: string, path: string): void {
  try {
    localStorage.removeItem(draftKey(projectId, path));
  } catch {
    // Nothing to do: the next read simply misses.
  }
}

/** Every draft this project has, by path. */
export function readProjectDrafts(projectId: string): Map<string, string> {
  const drafts = new Map<string, string>();
  try {
    const prefix = projectPrefix(projectId);
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(prefix)) continue;
      const path = key.slice(prefix.length);
      const draft = readDraft(projectId, path);
      if (draft) drafts.set(path, draft.content);
    }
  } catch {
    // An unreadable store simply has no drafts.
  }
  return drafts;
}

export function dropProjectDrafts(projectId: string): void {
  try {
    const prefix = projectPrefix(projectId);
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(prefix)) localStorage.removeItem(key);
    }
  } catch {
    // Best-effort, like every other draft write here.
  }
}
