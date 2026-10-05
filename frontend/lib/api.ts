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
    localStorage.removeItem('sltp_learn_progress'); // earned badges + progress
    localStorage.removeItem('st_user_name');
    localStorage.removeItem('st_user_theme');
  } catch { /* private mode */ }
  try {
    sessionStorage.clear();
  } catch { /* private mode */ }
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

export async function getAllTickers(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/stock/all-tickers`);
  if (!res.ok) return [];
  return res.json();
}
