// src/App.tsx
import { useState, useEffect } from 'react';
import Header from './components/Header';
import { AuthCard } from './components/AuthCard';
import SettingsPage, { applyAndStoreUserSettings } from './pages/SettingsPage';
import { supabase } from '../lib/supabase';
import './index.css';

export interface UserProfile {
  id?: string;
  email: string;
  name?: string | null;
  settings?: { theme?: string; [key: string]: any };
}

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [authMode, setAuthMode] = useState<'login' | 'signup' | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header 
        activeTab={activeTab}
        onTabChange={(tab) => { setActiveTab(tab); setAuthMode(null); }}
        onAuthClick={setAuthMode}
        sessionUserName={user?.name}
        sessionUserEmail={user?.email}
        onSignOut={async () => { await supabase.auth.signOut(); setUser(null); }}
        onSettingsClick={() => { setActiveTab('settings'); setAuthMode(null); }}
      />

      <main style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {authMode ? (
          <AuthCard key={authMode} initialMode={authMode} onSuccess={(u) => { setUser(u); setAuthMode(null); }} />
        ) : activeTab === 'settings' && user?.id ? (
          <SettingsPage 
            userId={user.id}
            userEmail={user.email}
            initialName={user.name}
            onProfileUpdated={(newName) => setUser((prev) => prev ? { ...prev, name: newName } : null)}
          />
        ) : (
          <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
              {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} View
            </h1>
            <p style={{ color: 'var(--text-muted)' }}>
              {activeTab === 'settings' 
                ? 'Please sign in to access your settings workspace.' 
                : `Currently rendering the active layout module for ${activeTab}.`}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}