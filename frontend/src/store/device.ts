// device.ts — what kind of browser this is, decided once per session.
//
// Phones get a smaller market plan (the ten newest files, not 29 years)
// and no Pyodide engine: strategy runs stay a desktop feature. Detection is
// UA plus a small touch screen; tablets keep the desktop plan. A device
// does not change class mid-visit, so callers can read the module consts.

/** How many of the newest bar files a phone keeps: the tail + nine years. */
export const MOBILE_PLAN_CHUNKS = 10;

/** Earliest day a phone will ever query (ten years back). The future date
    picker uses this as its min date; queries clamp to the cached chunks. */
export function mobileHistoryStart(today: Date = new Date()): string {
  const cutoff = new Date(today);
  cutoff.setFullYear(cutoff.getFullYear() - 10);
  return cutoff.toISOString().slice(0, 10);
}

export const MOBILE_HISTORY_START = mobileHistoryStart();

/** True on phones (and phone-sized emulation). Tablets stay desktop. */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPod|Mobile/i.test(ua)) return true;
  if (/iPad/i.test(ua)) return false;
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const shortest = Math.min(window.screen?.width ?? 9999, window.screen?.height ?? 9999);
  return coarse && shortest < 500;
}
