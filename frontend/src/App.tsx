// src/App.tsx
import { useState, useEffect } from 'react';
import Header from './components/Header';
import { AuthCard } from './components/AuthCard';
import { supabase } from '../lib/supabase';
import './index.css';

export interface UserProfile {
  email: string;
  name?: string | null;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [authMode, setAuthMode] = useState<'login' | 'signup' | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // Helper to fetch profile straight from public.users table
  const fetchUserProfile = async (userId: string, email: string): Promise<UserProfile> => {
    const { data, error } = await supabase
      .from('users')
      .select('name')
      .eq('id', userId)
      .single();

    return {
      email,
      name: !error && data?.name ? data.name : email,
    };
  };

  // Sync session with Supabase auth state on mount
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const profile = await fetchUserProfile(session.user.id, session.user.email || '');
        setUser(profile);
      }
      setLoadingSession(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const profile = await fetchUserProfile(session.user.id, session.user.email || '');
        setUser(profile);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLoginSuccess = (userData: UserProfile) => {
    setUser(userData);
    setAuthMode(null);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setAuthMode(null);
  };

  if (loadingSession) {
    return null;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header 
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setAuthMode(null);
        }}
        onAuthClick={(mode) => setAuthMode(mode)}
        sessionUserName={user?.name}
        sessionUserEmail={user?.email}
        onSignOut={handleLogout}
        onSettingsClick={() => {
          setActiveTab('settings');
          setAuthMode(null);
        }}
      />

      <main style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {authMode ? (
          <AuthCard 
            key={authMode}
            initialMode={authMode} 
            onSuccess={handleLoginSuccess} 
          />
        ) : (
          <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
              {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} View
            </h1>
            <p style={{ color: 'var(--text-muted)' }}>
              Currently rendering the active layout module for <strong>{activeTab}</strong>.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}