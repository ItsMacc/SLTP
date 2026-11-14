// device.ts — what kind of browser this is, decided once per session.
//
// Phones get a smaller market plan (the six newest files, not 29 years) and
// can run strategies only from the five years those files cover. The window
// is deliberately short: ten years of bars was enough for iOS Safari to kill
// the tab while drawing a chart. Detection is UA plus a small touch screen;
// tablets keep the desktop plan. A device does not change class mid-visit, so
// callers can read the module consts.

/** How many of the newest bar files a phone keeps: the tail + five years. */
export const MOBILE_PLAN_CHUNKS = 6;

/** Earliest day a phone will ever query (five years back). The date picker
    uses this as its min date; queries clamp to the cached chunks. */
export function mobileHistoryStart(today: Date = new Date()): string {
  const cutoff = new Date(today);
  cutoff.setFullYear(cutoff.getFullYear() - 5);
  return cutoff.toISOString().slice(0, 10);
}

export const MOBILE_HISTORY_START = mobileHistoryStart();

/** `?phone=1` runs the phone plan on any browser and `?phone=0` runs the
    desktop one, so mobile behaviour can be tested without a device (or a UA
    switcher). Nothing else sets these. */
function phoneOverride(): boolean | null {
  if (typeof window === 'undefined') return null;
  const value = new URLSearchParams(window.location.search).get('phone');
  if (value === '1') return true;
  if (value === '0') return false;
  return null;
}

/** True on phones (and phone-sized emulation). Tablets stay desktop. */
export function isMobileDevice(): boolean {
  const forced = phoneOverride();
  if (forced !== null) return forced;
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPod|Mobile/i.test(ua)) return true;
  if (/iPad/i.test(ua)) return false;
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const shortest = Math.min(window.screen?.width ?? 9999, window.screen?.height ?? 9999);
  return coarse && shortest < 500;
}

/** The answer for this session, so callers do not each re-parse the UA. */
export const IS_MOBILE = isMobileDevice();
