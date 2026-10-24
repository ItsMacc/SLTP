// lib/api.ts — Thin authed fetch helpers for the FastAPI backend.

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export interface PortfolioStatus {
  id?: string | null;
  onboarded: boolean;
  name: string;
  base_currency: string;
  starting_cash: number;
  preferences: Record<string, any>;
}

export interface CompleteSetupInput {
  name: string;
  starting_cash: number;
  base_currency: string;
  preferences: Record<string, any>;
}

async function authedFetch(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    let detail = body;
    try {
      detail = JSON.parse(body).detail || body;
    } catch {
      /* keep raw text */
    }
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return res.json();
}

// ---------- Status / onboarding ----------

/**
 * Portfolio status cache.
 *
 * The Portfolio tab unmounts whenever the user navigates away, but this cache
 * lives at module scope, so the data survives. Returning to the tab renders
 * from cache instantly and revalidates in the background — stale-while-
 * revalidate. The user never waits twice for the same data, and we still pick
 * up database changes without a manual refresh.
 *
 * In-flight requests are shared, so an impatient double-mount cannot fire two
 * requests, and nothing ever blocks rendering on a pending fetch.
 */
const PORTFOLIO_TTL_MS = 30_000;

interface PortfolioCache {
  entry: { data: PortfolioStatus; at: number } | null;
  inflight: Promise<PortfolioStatus> | null;
}

const portfolioCache: PortfolioCache = {
  entry: null,
  inflight: null,
};

/** Last known portfolio status, or null if never loaded. Never triggers I/O. */
export function peekPortfolio(): PortfolioStatus | null {
  return portfolioCache.entry?.data ?? null;
}

/** True when the cached copy is old enough to be worth re-checking. */
export function isPortfolioStale(): boolean {
  if (!portfolioCache.entry) return true;
  return Date.now() - portfolioCache.entry.at > PORTFOLIO_TTL_MS;
}

/**
 * Drops the cached copy so the next read hits the database. Call after any
 * write (completing onboarding, changing settings).
 */
export function invalidatePortfolio(): void {
  portfolioCache.entry = null;
}

/**
 * Wipes every trace of the current user from this browser.
 *
 * Called after account deletion (and on sign-out) so a stale cached badge
 * set, theme or portfolio snapshot can't outlive the account it belonged to.
 * Storage access can throw in private mode, so each store is guarded
 * independently — a failure here must never block the sign-out that follows.
 */
export function clearLocalUserData(): void {
  invalidatePortfolio();
  try {
    // Earned badges + progress, per user (see progress.ts) — remove every
    // learn cache, not just one account's.
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(LEARN_CACHE_PREFIX)) localStorage.removeItem(k);
    }
    // The unscoped key that predates per-account namespacing. It matches no
    // prefix (the prefix carries a trailing dot), so without this it would
    // sit in localStorage forever holding a previous account's badges.
    localStorage.removeItem('sltp_learn_progress');
    localStorage.removeItem('st_user_name');
    localStorage.removeItem('st_user_theme');
  } catch { /* private mode */ }
  try {
    sessionStorage.clear();
  } catch { /* private mode */ }
}

// Shared with learn/progress.ts — the learn cache is namespaced per account.
const LEARN_CACHE_PREFIX = 'sltp_learn_progress.';

/**
 * Asks the API to provision this account in BOTH stores.
 *
 * The server seeds the Turso users row and the Supabase profile row from the
 * shared defaults, and is idempotent, so this is safe on every login. Called
 * after signup too when Supabase hands back a session immediately — with email
 * confirmation on there is no session yet, and the first login covers it.
 *
 * Never throws: provisioning is best-effort and must not block the UI.
 */
export async function provisionAccount(token: string, name?: string | null): Promise<boolean> {
  try {
    const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    const res = await fetch(`${base}/api/user/provision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: name ?? null }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fetches portfolio status, reusing a fresh cache entry when possible.
 * `force` bypasses the freshness check but still shares an in-flight request.
 */
export async function getPortfolioStatus(
  token: string,
  options: { force?: boolean } = {},
): Promise<PortfolioStatus> {
  const { entry, inflight } = portfolioCache;
  if (!options.force && entry && !isPortfolioStale()) return entry.data;
  if (inflight) return inflight;

  const request = authedFetch('/api/portfolio/status', token)
    .then((data: PortfolioStatus) => {
      portfolioCache.entry = { data, at: Date.now() };
      portfolioCache.inflight = null;
      return data;
    })
    .catch((err) => {
      portfolioCache.inflight = null;
      // Keep serving the stale copy if we have one — a failed background
      // revalidation should never blank out a working page.
      throw err;
    });

  portfolioCache.inflight = request;
  return request;
}

export async function completeSetup(token: string, input: CompleteSetupInput) {
  const res = await authedFetch('/api/portfolio/complete-setup', token, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  // The portfolio just changed server-side; the cached copy is now wrong.
  invalidatePortfolio();
  return res;
}

export interface LabProject {
  id: string;
  name: string;
  created_at: string;
  /** Number of files in the project. Present on list reads; 0 right after create. */
  file_count?: number;
}

export interface LabWorkspace {
  id: string;
  name: string;
  created_at: string;
  projects: LabProject[];
}

export async function listLabWorkspaces(token: string): Promise<LabWorkspace[]> {
  const data = await authedFetch('/api/lab/workspaces', token);
  return data.workspaces;
}

export async function createLabWorkspace(
  token: string,
  input: { workspace_name: string; project_name: string; template?: string },
): Promise<LabWorkspace> {
  return authedFetch('/api/lab/workspaces', token, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export interface LabFile {
  name: string;
  content: string;
  locked: boolean;
}

export async function getLabProjectFiles(
  token: string,
  projectId: string,
): Promise<{ project: { id: string; name: string }; files: LabFile[]; folders: string[] }> {
  return authedFetch(`/api/lab/projects/${projectId}/files`, token);
}

export async function createLabFolder(token: string, projectId: string, name: string): Promise<{ name: string }> {
  return authedFetch(`/api/lab/projects/${projectId}/folders`, token, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function deleteLabFolder(token: string, projectId: string, name: string): Promise<void> {
  await authedFetch(`/api/lab/projects/${projectId}/folders/${name.split('/').map(encodeURIComponent).join('/')}`, token, {
    method: 'DELETE',
  });
}

export async function createLabFile(token: string, projectId: string, name: string): Promise<LabFile> {
  return authedFetch(`/api/lab/projects/${projectId}/files`, token, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function saveLabFile(
  token: string,
  projectId: string,
  name: string,
  content: string,
): Promise<void> {
  await authedFetch(
    `/api/lab/projects/${projectId}/files/${name.split('/').map(encodeURIComponent).join('/')}`,
    token,
    { method: 'PUT', body: JSON.stringify({ content }) },
  );
}

export async function renameLabFile(
  token: string,
  projectId: string,
  name: string,
  newName: string,
): Promise<{ name: string; previous: string }> {
  return authedFetch(
    `/api/lab/projects/${projectId}/files/${name.split('/').map(encodeURIComponent).join('/')}`,
    token,
    { method: 'PATCH', body: JSON.stringify({ name: newName }) },
  );
}

export async function deleteLabFile(token: string, projectId: string, name: string): Promise<void> {
  await authedFetch(
    `/api/lab/projects/${projectId}/files/${name.split('/').map(encodeURIComponent).join('/')}`,
    token,
    { method: 'DELETE' },
  );
}

export interface LabImportResult {
  /** The project paths that were written, e.g. "workspace/custom_strategy.py". */
  imported: string[];
  /** Files that were left out, and why. */
  skipped: { path: string; reason: string }[];
}

// Writes files the browser read from a local folder into the project's workspace.
// Each path is relative to the picked folder, so "custom_strategy.py" is stored
// as "workspace/custom_strategy.py". The folders the browser walked are sent
// along, so the server can tell a real folder from one that was never on disk.
// Existing files with the same name are replaced.
export async function importLabFiles(
  token: string,
  projectId: string,
  files: { path: string; content: string }[],
  folders: string[] = [],
): Promise<LabImportResult> {
  return authedFetch(`/api/lab/projects/${projectId}/import`, token, {
    method: 'POST',
    body: JSON.stringify({ files, folders }),
  });
}

export interface LabDiagnostic {
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning';
  message: string;
  code: string | null;
}

export interface LabCheckResult {
  ok: boolean;
  diagnostics: LabDiagnostic[];
  tool_error: string | null;
  checked: string[];
}

// Sends the editor's unsaved drafts; the server overlays them on the stored files and runs mypy.
export async function checkLabProject(
  token: string,
  projectId: string,
  files: { name: string; content: string }[],
): Promise<LabCheckResult> {
  return authedFetch(`/api/lab/projects/${projectId}/check`, token, {
    method: 'POST',
    body: JSON.stringify({ files }),
  });
}

export async function createLabProject(
  token: string,
  workspaceId: string,
  name: string,
  template?: string,
): Promise<LabProject> {
  return authedFetch(`/api/lab/workspaces/${workspaceId}/projects`, token, {
    method: 'POST',
    body: JSON.stringify({ name, template: template ?? 'blank' }),
  });
}

export async function renameLabProject(token: string, projectId: string, name: string): Promise<LabProject> {
  return authedFetch(`/api/lab/projects/${projectId}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export async function deleteLabProject(token: string, projectId: string): Promise<void> {
  await authedFetch(`/api/lab/projects/${projectId}`, token, { method: 'DELETE' });
}

export async function deleteLabWorkspace(token: string, workspaceId: string): Promise<void> {
  await authedFetch(`/api/lab/workspaces/${workspaceId}`, token, { method: 'DELETE' });
}

// ---------- Personal API keys ----------

export interface ApiKeySummary {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
}

export interface CreatedApiKey extends ApiKeySummary {
  key: string;
}

export async function listApiKeys(token: string): Promise<ApiKeySummary[]> {
  const data = await authedFetch('/api/user/api-keys', token);
  return data.keys;
}

export async function createApiKey(token: string, name: string): Promise<CreatedApiKey> {
  return authedFetch('/api/user/api-keys', token, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function revokeApiKey(token: string, keyId: string): Promise<void> {
  await authedFetch(`/api/user/api-keys/${keyId}`, token, { method: 'DELETE' });
}

export async function getAllTickers(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/stock/all-tickers`);
  if (!res.ok) return [];
  return res.json();
}
