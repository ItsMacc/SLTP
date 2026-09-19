// App.tsx — Root shell: auth session, tab routing, legal pages
import { useState, useEffect } from 'react';
import Header from './components/Header';
import { AuthCard } from './components/AuthCard';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import SettingsPage, { applyAndStoreUserSettings } from './pages/SettingsPage';
import LegalPage, { type LegalPageKind } from './pages/LegalPage';
import PerformancePage from './pages/PerformancePage';
import StrategiesPage from './pages/StrategiesPage';
import ErrorToast from './ui/ErrorToast';
import { supabase } from '../lib/supabase';
import './index.css';

export interface UserProfile {
  id?: string;
  email: string;
  name?: string | null;
  settings?: { theme?: string; [key: string]: any };
}

const AUTH_REQUIRED_TABS = ['lab', 'invest', 'portfolio'];

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [authMode, setAuthMode] = useState<'login' | 'signup' | null>(null);
  const [legalPage, setLegalPage] = useState<LegalPageKind | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

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
      const { data } = await supabase.from('users').select('name, settings').eq('id', userId).single();
      const name = data?.name || email;
      const settings = data?.settings || {};
      
      applyAndStoreUserSettings(settings, name);
      setUser({ id: userId, email, name, settings });
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) await syncUser(session.user.id, session.user.email || '');
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_, session) => {
      if (session?.user) {
        await syncUser(session.user.id, session.user.email || '');
      } else {
        setUser(null);
        sessionStorage.clear();
        document.documentElement.removeAttribute('data-theme');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
          setAuthMode(null);
          setLegalPage(null);
          await supabase.auth.signOut(); 
        }}
        onSettingsClick={() => { setActiveTab('settings'); setAuthMode(null); setLegalPage(null); }}
      />

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
            ) : activeTab === 'home' ? (
              <HomePage onNavigate={handleTabChange} />
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