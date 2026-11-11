// TODO(copy): wording needs rework on all pages — headlines, ledes and card
// text were written at different times and do not share one voice yet.
// App.tsx — Root shell: auth session, tab routing, legal pages
import { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import { AuthCard } from './components/AuthCard';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import SiteGuide from './components/SiteGuide';
import 'driver.js/dist/driver.css';
import SettingsPage from './pages/SettingsPage';
import { applyAndStoreUserSettings, readSessionUserSettings, readStoredUserSettings } from '../lib/settings';
import LegalPage, { type LegalPageKind } from './pages/LegalPage';
import DocsPage from './pages/DocsPage';
import ResearchPage from './pages/ResearchPage';
import StrategiesPage from './pages/StrategiesPage';
import Sltp404Page from './pages/Sltp404Page';
import WatchlistPage from './pages/WatchlistPage';
import ErrorToast from './ui/ErrorToast';
import { Loader, LoaderOverlay } from './ui/Loader';
import { supabase } from '../lib/supabase';
import { bootMarketSync } from './store';
import { invalidatePortfolio, provisionAccount } from '../lib/api';
import { pageTitleFor, usePageTitle } from './usePageTitle';
import {
  DOCS_PREFIX,
  hashForLegal,
  hashForTab,
  isKnownHash,
  readLocation,
} from './routing';
import './index.css';

export interface UserProfile {
  id?: string;
  email: string;
  name?: string | null;
  settings?: { theme?: string; [key: string]: any };
}

const LEGAL_TITLES: Record<LegalPageKind, string> = {
  privacy: 'Privacy Policy — SLTP',
  terms: 'Terms of Service — SLTP',
};

const AUTH_TITLES = {
  login: 'Sign in — SLTP',
  signup: 'Create an account — SLTP',
};

/* The address bar is the source of truth: #/research, #/lab, #/docs/<slug>,
   #/legal/privacy. A reload, a shared link and the Back button all land on the
   page they name instead of dropping the visitor on Home. */
const initialRoute = readLocation();

export default function App() {
  const [activeTab, setActiveTab] = useState<string>(initialRoute.tab);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | null>(null);
  const [legalPage, setLegalPage] = useState<LegalPageKind | null>(initialRoute.legal);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  // One account sync per user at a time. The sign-in card and the auth
  // listener both ask for it, and the Turso write must only happen once.
  const syncsRef = useRef(new Map<string, Promise<void>>());

  // The hash listener is registered once, so it reads the signed-in user from a
  // ref rather than a stale closure.
  const userRef = useRef(user);
  // Where a legal page goes back to when its Back button is pressed.
  const legalReturnRef = useRef<string>(initialRoute.tab);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  /** Applies whatever the address bar says — on first load and on Back/Forward. */
  const syncFromLocation = useCallback(() => {
    const route = readLocation();

    if (route.legal) {
      // Keep the tab the visitor came from: the legal page replaces the body, so
      // the nav should still show where Back will take them.
      setLegalPage(route.legal);
      setAuthMode(null);
      setAuthNotice(null);
      return;
    }

    setLegalPage(null);
    // Settings is the only page behind a sign-in now.
    const gated = route.tab === 'settings' && !userRef.current?.id;

    setActiveTab(route.tab);
    if (gated) {
      setAuthMode('signup');
      setAuthNotice('You must be logged in to use these features');
      return;
    }
    setAuthMode(null);
    setAuthNotice(null);
    // Docs scrolls itself: a section link has to land on its heading.
    if (route.tab !== 'docs') window.scrollTo(0, 0);
  }, []);

  // A visit to "/" gets a real address (#/home), so history entries are never
  // bare and Back always has a page to return to.
  useEffect(() => {
    if (!window.location.hash || !isKnownHash(window.location.hash)) {
      history.replaceState(null, '', hashForTab(initialRoute.tab));
    }
    window.addEventListener('hashchange', syncFromLocation);
    return () => window.removeEventListener('hashchange', syncFromLocation);
  }, [syncFromLocation]);

  // The session check decides whether a deep link needs the sign-in card.
  useEffect(() => {
    if (!loading) syncFromLocation();
  }, [loading, syncFromLocation]);

  /**
   * Loads the profile and writes the account row in Turso.
   *
   * The Turso write is the slow part of a sign-in, so the caller waits for
   * it: the sign-in loader stays up until the account row has landed.
   * Concurrent callers share one run, so the row is written once.
   */
  const syncUser = useCallback(async (userId: string, email: string) => {
    const running = syncsRef.current.get(userId);
    if (running) return running;

    const run = (async () => {
      // maybeSingle, not single: a brand-new user has no profile row yet, and
      // single() reports that as an error rather than an empty result.
      const { data } = await supabase
        .from('users')
        .select('name, settings')
        .eq('id', userId)
        .maybeSingle();
      const name = data?.name || email;
      // Supabase is the source of truth, but the cached copy fills in when the
      // profile cannot be read, so the user keeps their chart style offline
      // instead of silently dropping back to the defaults.
      const settings = { ...readSessionUserSettings(userId), ...readStoredUserSettings(userId), ...(data?.settings || {}) };

      applyAndStoreUserSettings(settings, name, userId);
      setUser({ id: userId, email, name, settings });

      // Ensure the user exists in BOTH stores with the shared defaults
      // (Turso users row + Supabase profile). Idempotent, so safe every login.
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (token) await provisionAccount(token, name);
      } catch {
        // Provisioning is best-effort; never block the UI on it
      }
    })();

    syncsRef.current.set(userId, run);
    return run;
  }, []);

  // Market data downloads itself in the background from the first visit: the
  // recent eras land in OPFS while the visitor reads, so charts open warm.
  // Fire-and-forget on purpose — progress lives in the sync status store.
  useEffect(() => {
    void bootMarketSync();
  }, []);

  // Navigation is manual here (tabs, the docs route, anchor jumps). Leaving the
  // browser's own scroll restoration on lets it yank a new page back to a saved
  // offset, which is how a docs link could open halfway down.
  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  }, []);

  // Signing out closes the session and clears what this browser kept.
  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      syncsRef.current.clear();
      history.replaceState(null, '', hashForTab('home'));
      setActiveTab('home');
      setUser(null);
      invalidatePortfolio();
      setAuthMode(null);
      setLegalPage(null);
      await supabase.auth.signOut();
    } finally {
      setSigningOut(false);
    }
  }, []);

  /** Navigates to a page. The address bar leads and the hash listener applies
      the change — including the sign-in gate — so Back/Forward take that same
      path rather than a second, divergent one. */
  const handleTabChange = (tab: string) => {
    // Docs keeps its current page in the hash; asking for "docs" must not drop
    // it back to the introduction.
    if (tab === 'docs' && window.location.hash.startsWith(DOCS_PREFIX)) {
      syncFromLocation();
      return;
    }

    setLegalPage(null);
    const target = hashForTab(tab);
    if (window.location.hash === target) {
      syncFromLocation();
      return;
    }
    window.location.hash = target.slice(1);
  };

  /** Legal pages are addresses too, so Back leaves one the way it left a tab. */
  const openLegalPage = (page: LegalPageKind) => {
    legalReturnRef.current = activeTab;
    setAuthMode(null);
    const target = hashForLegal(page);
    if (window.location.hash === target) setLegalPage(page);
    else window.location.hash = target.slice(1);
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) await syncUser(session.user.id, session.user.email || '');
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_, session) => {
      if (session?.user) {
        // A different account must never inherit the cached portfolio.
        setUser((prev) => {
          if (prev?.id && prev.id !== session.user.id) invalidatePortfolio();
          return prev;
        });
        await syncUser(session.user.id, session.user.email || '');
      } else {
        setUser(null);
        invalidatePortfolio();
        sessionStorage.clear();
        document.documentElement.removeAttribute('data-theme');
      }
    });

    return () => subscription.unsubscribe();
  }, [syncUser]);

  // Opening Terms / Privacy swaps the whole page body but leaves the window
  // scroll offset untouched, so arriving from the middle of a long page
  // dropped you into the middle of the legal text instead of its title.
  // Smooth on the way in, instant on the way back out.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: legalPage ? 'smooth' : 'auto' });
  }, [legalPage]);

  // One title for whatever is on screen: the legal page wins over the tab,
  // then the auth card, then the page itself.
  const title = legalPage
    ? LEGAL_TITLES[legalPage]
    : authMode
      ? AUTH_TITLES[authMode]
      : pageTitleFor(activeTab);
  usePageTitle(title);

  // The session check is the first thing that talks to the network, so it
  // gets the stock loader instead of a blank page.
  if (loading) {
    return (
      <div className="app-boot">
        <Loader label="Loading SLTP…" sub="Restoring your session." />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Header 
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onAuthClick={(mode) => { setAuthMode(mode); setLegalPage(null); }}
        sessionUserName={user?.name}
        sessionUserEmail={user?.email}
        onSignOut={() => { void handleSignOut(); }}
        onSettingsClick={() => { handleTabChange('settings'); }}
      />

      {/* Site guide slideshow lives at app level so it can navigate tabs
          mid-tour (Driver.js spotlights real elements on real pages). */}
      <SiteGuide
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        onNavigate={handleTabChange}
      />

      <main className="app-main">
        {legalPage ? (
          <LegalPage page={legalPage} onBack={() => { handleTabChange(legalReturnRef.current); }} />
        ) : (
          <div key={authMode || activeTab} className="page-transition">
            {authMode ? (
              <AuthCard initialMode={authMode} onSuccess={async (u) => {
                setUser((prev) => ({
                  id: u.id ?? prev?.id,
                  email: u.email,
                  name: u.name,
                  settings: prev?.settings,
                }));
                // The account row in Turso is written before the card goes
                // away, so the sign-in loader stays up until it lands.
                if (u.id) await syncUser(u.id, u.email);
                setAuthMode(null);
              }} />
            ) : activeTab === 'settings' && user?.id ? (
              <SettingsPage 
                userId={user.id}
                userEmail={user.email}
                initialName={user.name}
                onProfileUpdated={(newName, newSettings) => setUser((prev) => (
                  prev ? { ...prev, name: newName, settings: newSettings ?? prev.settings } : null
                ))}
                onAccountDeleted={async () => {
                  await handleSignOut();
                }}
              />
            ) : activeTab === 'docs' ? (
              <DocsPage userId={user?.id} />
            ) : activeTab === 'watchlist' ? (
              // The Watchlist names its planned features instead of the
              // shared stub, but it is still a placeholder for now.
              <WatchlistPage onNavigate={handleTabChange} />
            ) : activeTab === 'research' ? (
              // Price history reads the browser's OPFS market cache, so no
              // server round-trip stands between a tap and the chart.
              <ResearchPage userId={user?.id} initialSettings={user?.settings} />
            ) : activeTab === 'strategies' ? (
              // The published strategy library, run live in the browser engine.
              <StrategiesPage />
            ) : activeTab === 'lab' || activeTab === 'learn' ? (
              // Pages with an address but no content yet: the cards on Home
              // link here, and each one carries its own title and hash.
              <Sltp404Page page={activeTab[0].toUpperCase() + activeTab.slice(1)} onNavigate={handleTabChange} />
            ) : (
              // Home and the guide both land here; an unknown address falls
              // back to Home too, so a stale link never strands the visitor.
              <HomePage onNavigate={handleTabChange} onOpenGuide={() => setGuideOpen(true)} />
            )}
          </div>
        )}
      </main>

      {authNotice && (
        <ErrorToast message={authNotice} onClose={() => setAuthNotice(null)} />
      )}

      {/* Signing out closes the session on the server, so the page waits
          behind the stock loader rather than looking like nothing happened. */}
      {signingOut && (
        <LoaderOverlay
          label="Signing out…"
          sub="Closing your session and clearing this browser's copy of your data."
        />
      )}

      <Footer
        activeTab={activeTab}
        onNavigate={handleTabChange}
        onLegalPage={openLegalPage}
      />
    </div>
  );
}