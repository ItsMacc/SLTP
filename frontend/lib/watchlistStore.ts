// lib/watchlistStore.ts — the watchlist lives in this browser, per account.
//
// Frontend-only by design: no backend write happens here, so the page works
// without touching the API. Keys carry the account id, which keeps one
// person's tickers off another person's screen on a shared machine. Storage
// can throw in private mode, so every access is guarded — a failure reads as
// empty rather than breaking the page.

export interface WatchlistSetup {
  onboarded: boolean;
  experience: string;
  goal: string;
  followed: string[];
  items: string[];
}

const SETUP_PREFIX = 'sltp_watchlist_setup.';
const ITEMS_PREFIX = 'sltp_watchlist.';

function keyFor(prefix: string, userId?: string | null): string {
  return `${prefix}${userId || 'signed-out'}`;
}

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode: the page still works for the visit, it just forgets.
  }
}

/** The saved setup, or null when this account never finished the wizard. */
export function loadWatchlistSetup(userId?: string | null): WatchlistSetup | null {
  const data = readJson(keyFor(SETUP_PREFIX, userId));
  if (!data || typeof data !== 'object') return null;
  const setup = data as Partial<WatchlistSetup>;
  if (setup.onboarded !== true) return null;
  return {
    onboarded: true,
    experience: typeof setup.experience === 'string' ? setup.experience : '',
    goal: typeof setup.goal === 'string' ? setup.goal : '',
    followed: normalizeFollowed(setup.followed),
    items: normalizeTickers(setup.items),
  };
}

export function saveWatchlistSetup(userId: string | null | undefined, setup: WatchlistSetup): void {
  writeJson(keyFor(SETUP_PREFIX, userId), setup);
}

/** Tickers on the list, newest last. Empty when never saved. */
export function loadWatchlistItems(userId?: string | null): string[] {
  const data = readJson(keyFor(ITEMS_PREFIX, userId));
  return normalizeTickers(data);
}

export function saveWatchlistItems(userId: string | null | undefined, items: string[]): void {
  writeJson(keyFor(ITEMS_PREFIX, userId), normalizeTickers(items));
}

// Prefixes swept on sign-out and account deletion (see api.clearLocalUserData).
export const WATCHLIST_STORAGE_PREFIXES = [SETUP_PREFIX, ITEMS_PREFIX];

/** Accepts the shapes the old portfolio setup stored: ids or {id,name} rows. */
export function normalizeFollowed(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((s: unknown) => (typeof s === 'string' ? s : (s as { id?: unknown; name?: unknown })?.id ?? (s as { name?: unknown })?.name))
    .filter((s): s is string => typeof s === 'string' && s.length > 0);
}

/** Uppercase, trimmed, de-duplicated; anything else is dropped. */
export function normalizeTickers(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const symbol = entry.trim().toUpperCase();
    if (symbol && !seen.has(symbol)) seen.add(symbol);
  }
  return [...seen];
}
