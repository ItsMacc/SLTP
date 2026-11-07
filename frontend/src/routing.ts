// routing.ts — Every page has an address.
//
// The app is one HTML page served by Vite (and by the API in production), so
// navigation lives in the hash: #/research, #/lab, #/docs/<slug>,
// #/legal/privacy. Hashes need no server rewrite, keep a reload or a shared
// link on the page it names, and give the browser real history entries — which
// is what makes Back and Forward work. Before this, every tab shared "/" and
// Back left the site.

export const TAB_ROUTES = [
  'home',
  'learn',
  'watchlist',
  'strategies',
  'research',
  'lab',
  'docs',
  'settings',
  'guide',
] as const;

export type TabRoute = (typeof TAB_ROUTES)[number];
export type LegalRoute = 'privacy' | 'terms';

export const DOCS_PREFIX = '#/docs/';
const DOCS_ROOT = '#/docs';
const LEGAL_PREFIX = '#/legal/';

const TAB_SET: ReadonlySet<string> = new Set(TAB_ROUTES);

export interface Route {
  tab: TabRoute;
  legal: LegalRoute | null;
}

const isLegal = (value: string): value is LegalRoute => value === 'privacy' || value === 'terms';

/** What the address bar is pointing at, with an unknown hash falling back home. */
export function readLocation(hash: string = window.location.hash): Route {
  if (hash === DOCS_ROOT || hash.startsWith(DOCS_PREFIX)) return { tab: 'docs', legal: null };

  if (hash.startsWith(LEGAL_PREFIX)) {
    const kind = hash.slice(LEGAL_PREFIX.length);
    if (isLegal(kind)) return { tab: 'home', legal: kind };
  }

  const match = /^#\/([a-z-]+)$/.exec(hash);
  if (match && TAB_SET.has(match[1])) return { tab: match[1] as TabRoute, legal: null };

  return { tab: 'home', legal: null };
}

export const hashForTab = (tab: string): string => `#/${tab}`;
export const hashForLegal = (kind: LegalRoute): string => `${LEGAL_PREFIX}${kind}`;

/** True when the hash names a page we have, so a stray "#/x" gets replaced. */
export function isKnownHash(hash: string): boolean {
  if (hash === DOCS_ROOT || hash.startsWith(DOCS_PREFIX)) return true;
  if (hash.startsWith(LEGAL_PREFIX)) return isLegal(hash.slice(LEGAL_PREFIX.length));
  const match = /^#\/([a-z-]+)$/.exec(hash);
  return Boolean(match && TAB_SET.has(match[1]));
}
