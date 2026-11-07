// lib/sessionCache.ts — tab-scoped copies of small reads.
//
// sessionStorage dies with the tab, which is the point: this holds copies
// that are cheap to refetch, never the originals. Settings, Lab structures
// and watchlist data paint instantly from here, then revalidate in the
// background. Keys carry the account id where the value belongs to one
// person. Sign-out and account deletion wipe the whole tab store (see
// clearLocalUserData in lib/api.ts), so nothing here can outlive its owner.
//
// Every access is guarded: denied storage reads as a miss, and a denied
// write is dropped. A cache failure must never break the page it serves.

/** Storage key for one account's copy of `base`. Signed-out use stays separate. */
export function sessionKeyFor(base: string, userId?: string | null): string {
  return `${base}.${userId || 'signed-out'}`;
}

/** The stored copy, or null on a miss, bad JSON or denied access. */
export function readSession<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Replaces the stored copy. Failures stay silent by design (see above). */
export function writeSession(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The page still works for the visit; the next read refetches instead.
  }
}

/** Drops one stored copy. */
export function removeSession(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // The copy is unreachable or already gone; either way there is nothing to do.
  }
}
