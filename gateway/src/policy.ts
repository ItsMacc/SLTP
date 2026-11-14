// policy.ts — when the market bucket may still be read.
//
// One monthly window, aligned to the R2 billing cycle (it resets on day 6 at
// 00:00 UTC, matching scripts/r2_usage.py), and two ceilings:
//
//   EXISTING_LIMIT  returning devices stop pulling new files here, so the
//                   rest of the month belongs to people with no cache yet;
//   HARD_LIMIT      nobody reads anything past this point.
//
// Reads the edge cache answers never touch R2 and never reach these numbers,
// so a cache hit is served even when the window is closed.
//
// The numbers count one whole object read (one R2 GET or HEAD = one Class B
// operation). They do not count bytes, users or requests that miss the cache
// and find nothing.

export const EXISTING_LIMIT = 9_000_000;
export const HARD_LIMIT = 9_950_000;

/** R2 bills on the 6th: the script's BILLING_RESET_DAY. */
export const BILLING_RESET_DAY = 6;

export type Refusal = 'existing' | 'hard' | null;

export interface Decision {
  allowed: boolean;
  reason: Refusal;
  /** The ceiling that applied to this request. */
  limit: number;
}

/**
 * Decides one read. `used` is the count before this request, so a decision to
 * allow always leaves the counter at most `limit` — the reservation that
 * follows is what makes the ceiling exact.
 */
export function decide(used: number, isNewDevice: boolean): Decision {
  if (used >= HARD_LIMIT) {
    return { allowed: false, reason: 'hard', limit: HARD_LIMIT };
  }
  if (!isNewDevice && used >= EXISTING_LIMIT) {
    return { allowed: false, reason: 'existing', limit: EXISTING_LIMIT };
  }
  return { allowed: true, reason: null, limit: isNewDevice ? HARD_LIMIT : EXISTING_LIMIT };
}

/** Midnight UTC on the 6th that opened the window containing `now`. */
export function windowStart(now: Date): Date {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const start = Date.UTC(year, month, BILLING_RESET_DAY);
  if (now.getTime() >= start) return new Date(start);
  return new Date(Date.UTC(year, month - 1, BILLING_RESET_DAY));
}

/** Stable id for the window, e.g. "2026-11-06". */
export function windowId(now: Date): string {
  return windowStart(now).toISOString().slice(0, 10);
}

/** When the next window opens, e.g. the 6th of next month at 00:00 UTC. */
export function nextReset(now: Date): Date {
  const start = windowStart(now);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, BILLING_RESET_DAY));
}

/** The copy a paused download returns, one voice for every caller. */
export function pauseMessage(reason: Exclude<Refusal, null>, resetsAt: string): string {
  const date = new Date(resetsAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
  if (reason === 'hard') {
    return (
      `We didn't expect this many people. New market-data downloads are paused until ${date}, ` +
      `because this month's allowance is spent. Everything already saved in your browser keeps ` +
      `working, and downloads come back automatically on ${date}. Sorry about that.`
    );
  }
  return (
    `This device has used its share of this month's market-data downloads. Everything you have ` +
    `already saved keeps working, and new downloads resume on ${date}.`
  );
}
