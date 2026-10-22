// App.tsx — Root shell: auth session, tab routing, legal pages
import { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import { AuthCard } from './components/AuthCard';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import SiteGuide from './components/SiteGuide';
import 'driver.js/dist/driver.css';
import SettingsPage, { applyAndStoreUserSettings } from './pages/SettingsPage';
import LegalPage, { type LegalPageKind } from './pages/LegalPage';
import PerformancePage from './pages/PerformancePage';
import StrategiesPage from './pages/StrategiesPage';
import PortfolioPage from './pages/PortfolioPage';
import LabPage from './pages/LabPage';
import DocsPage from './pages/DocsPage';
import LearnPage from './pages/LearnPage';
import ErrorToast from './ui/ErrorToast';
import { Loader, LoaderOverlay } from './ui/Loader';
import { supabase } from '../lib/supabase';
import { invalidatePortfolio, provisionAccount } from '../lib/api';
import { pageTitleFor, usePageTitle } from './usePageTitle';
import './index.css';

export interface UserProfile {
  id?: string;
  email: string;
  name?: string | null;
  settings?: { theme?: string; [key: string]: any };
}

const AUTH_REQUIRED_TABS = ['lab', 'portfolio'];

const LEGAL_TITLES: Record<LegalPageKind, string> = {
  privacy: 'Privacy Policy — SLTP',
  terms: 'Terms of Service — SLTP',
};

const AUTH_TITLES = {
  login: 'Sign in — SLTP',
  signup: 'Create an account — SLTP',
};

/* The Lab opens without an account in local development, so the tour is not
   locked there either. */
const LAB_PREVIEW = import.meta.env.DEV && import.meta.env.VITE_LAB_PREVIEW === 'true';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [authMode, setAuthMode] = useState<'login' | 'signup' | null>(null);
  const [legalPage, setLegalPage] = useState<LegalPageKind | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  // One account sync per user at a time. The sign-in card and the auth
  // listener both ask for it, and the Turso write must only happen once.
  const syncsRef = useRef(new Map<string, Promise<void>>());

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
      const settings = data?.settings || {};

      applyAndStoreUserSettings(settings, name);
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

  // Signing out closes the session and clears what this browser kept.
  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      syncsRef.current.clear();
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

  const handleTabChange = (tab: string) => {
    const localLabPreview = LAB_PREVIEW && tab === 'lab';
    if (AUTH_REQUIRED_TABS.includes(tab) && !user?.id && !localLabPreview) {
      setAuthMode('signup');
      setLegalPage(null);
      setAuthNotice('You must be logged in to use these features');
      return;
    }

    setActiveTab(tab);
    window.scrollTo(0, 0);
    setAuthMode(null);
    setLegalPage(null);
    setAuthNotice(null);
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
        onSettingsClick={() => { setActiveTab('settings'); setAuthMode(null); setLegalPage(null); }}
      />

      {/* Site guide slideshow lives at app level so it can navigate tabs
          mid-tour (Driver.js spotlights real elements on real pages). */}
      <SiteGuide
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        onNavigate={handleTabChange}
        isSignedIn={Boolean(user?.id) || LAB_PREVIEW}
      />

      <main className="app-main">
        {legalPage ? (
          <LegalPage page={legalPage} onBack={() => setLegalPage(null)} />
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
                onProfileUpdated={(newName) => setUser((prev) => prev ? { ...prev, name: newName } : null)}
                onAccountDeleted={async () => {
                  await handleSignOut();
                }}
              />
            ) : activeTab === 'performance' ? (
              <PerformancePage userId={user?.id} initialSettings={user?.settings} />
            ) : activeTab === 'strategies' ? (
              <StrategiesPage />
            ) : activeTab === 'docs' ? (
              <DocsPage onNavigate={handleTabChange} />
            ) : activeTab === 'learn' ? (
              <LearnPage onNavigate={handleTabChange} />
            ) : activeTab === 'portfolio' && user?.id ? (
              <PortfolioPage defaultName={user.name} settings={user.settings} />
            ) : activeTab === 'lab' && (user?.id || LAB_PREVIEW) ? (
              <LabPage onNavigate={handleTabChange} />
            ) : activeTab === 'home' || activeTab === 'guide' ? (
              <HomePage onNavigate={handleTabChange} onOpenGuide={() => setGuideOpen(true)} />
            ) : (
              <div className="app-placeholder">
                <h1 className="app-placeholder-title">
                  {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} View
                </h1>
                <p className="app-placeholder-text">
                  {activeTab === 'settings'
                    ? 'Please sign in to access your settings workspace.'
                    : `Currently rendering the active layout module for ${activeTab}.`}
                </p>
              </div>
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
        onLegalPage={(page) => { setLegalPage(page); setAuthMode(null); }}
      />
    </div>
  );
}