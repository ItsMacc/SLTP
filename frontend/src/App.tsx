// App.tsx — Root shell: auth session, tab routing, legal pages
import { useState, useEffect } from 'react';
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
import DocsPage from './pages/DocsPage';
import LearnPage from './pages/LearnPage';
import ErrorToast from './ui/ErrorToast';
import { supabase } from '../lib/supabase';
import { invalidatePortfolio } from '../lib/api';
import './index.css';

export interface UserProfile {
  id?: string;
  email: string;
  name?: string | null;
  settings?: { theme?: string; [key: string]: any };
}

const AUTH_REQUIRED_TABS = ['lab', 'portfolio'];

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [authMode, setAuthMode] = useState<'login' | 'signup' | null>(null);
  const [legalPage, setLegalPage] = useState<LegalPageKind | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [guideOpen, setGuideOpen] = useState(false);

  const handleTabChange = (tab: string) => {
    if (AUTH_REQUIRED_TABS.includes(tab) && !user?.id) {
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
    async function syncUser(userId: string, email: string) {
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

      // Ensure the user exists in Turso with default values (idempotent,
      // safe on every login — only creates rows the first time).
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (token) {
          await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/user/provision`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ name }),
          });
        }
      } catch {
        // Provisioning is best-effort; never block the UI on it
      }
    }

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
  }, []);

  // Opening Terms / Privacy swaps the whole page body but leaves the window
  // scroll offset untouched, so arriving from the middle of a long page
  // dropped you into the middle of the legal text instead of its title.
  // Smooth on the way in, instant on the way back out.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: legalPage ? 'smooth' : 'auto' });
  }, [legalPage]);

  if (loading) return null;

  return (
    <div className="app-shell">
      <Header 
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onAuthClick={(mode) => { setAuthMode(mode); setLegalPage(null); }}
        sessionUserName={user?.name}
        sessionUserEmail={user?.email}
        onSignOut={async () => { 
          setActiveTab('home');
          setUser(null);
          invalidatePortfolio();
          setAuthMode(null);
          setLegalPage(null);
          await supabase.auth.signOut(); 
        }}
        onSettingsClick={() => { setActiveTab('settings'); setAuthMode(null); setLegalPage(null); }}
      />

      {/* Site guide slideshow lives at app level so it can navigate tabs
          mid-tour (Driver.js spotlights real elements on real pages). */}
      <SiteGuide open={guideOpen} onClose={() => setGuideOpen(false)} onNavigate={handleTabChange} />

      <main className="app-main">
        {legalPage ? (
          <LegalPage page={legalPage} onBack={() => setLegalPage(null)} />
        ) : (
          <div key={authMode || activeTab} className="page-transition">
            {authMode ? (
              <AuthCard initialMode={authMode} onSuccess={(u) => {
                setUser((prev) => ({
                  id: u.id ?? prev?.id,
                  email: u.email,
                  name: u.name,
                  settings: prev?.settings,
                }));
                setAuthMode(null);
              }} />
            ) : activeTab === 'settings' && user?.id ? (
              <SettingsPage 
                userId={user.id}
                userEmail={user.email}
                initialName={user.name}
                onProfileUpdated={(newName) => setUser((prev) => prev ? { ...prev, name: newName } : null)}
                onAccountDeleted={async () => { 
                  setActiveTab('home');
                  setUser(null);
                  setAuthMode(null);
                  setLegalPage(null);
                  await supabase.auth.signOut(); 
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

      <Footer
        activeTab={activeTab}
        onNavigate={handleTabChange}
        onLegalPage={(page) => { setLegalPage(page); setAuthMode(null); }}
      />
    </div>
  );
}