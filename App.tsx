import { useEffect, useState } from 'react'
import Header, { type UserProfile } from './src/components/Header'
import HomePage from './src/pages/HomePage'
import PerformancePage from './src/pages/PerformancePage'
import StrategiesPage from './src/pages/Strategies'
import InvestPage from './src/pages/Invest'
import SettingsPage from './src/pages/SettingsPage'
import Footer from './src/components/Footer'
import { AuthModal } from './src/components/AuthModal'
import { supabase } from "./lib/supabase"
import { getSettings, type UserSettings } from './lib/settings'
import type { Session } from '@supabase/supabase-js'

const defaultSettings: Omit<UserSettings, 'user_id'> = {
  full_name: '',
  risk_profile: 'balanced',
  default_timeframe: '1y',
  theme: 'light',
  email_updates: true,
  weekly_summary: false,
}

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState('')
  const [userSettings, setUserSettings] = useState(defaultSettings)
  const [isReady, setIsReady] = useState(false)
  const [currentPage, setCurrentPage] = useState('home')

  const [authModal, setAuthModal] = useState<{ isOpen: boolean; mode: 'login' | 'signup' }>({
    isOpen: false,
    mode: 'login',
  })

  // Cache all ticker symbols in sessionStorage on app load
  useEffect(() => {
    const cacheAllTickers = async () => {
      if (sessionStorage.getItem('all_tickers')) return

      try {
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
        const res = await fetch(`${API_BASE_URL}/api/stock/all-tickers`)
        if (res.ok) {
          const tickers = await res.json()
          sessionStorage.setItem('all_tickers', JSON.stringify(tickers))
        }
      } catch (err) {
        console.error("Failed to cache tickers:", err)
      }
    }

    void cacheAllTickers()
  }, [])

  useEffect(() => {
    const hydrateSession = async (session: Session | null) => {
      if (!session?.user) {
        document.documentElement.dataset.theme = 'light'
        setUser(null)
        setUserId(null)
        setUserEmail('')
        setUserSettings(defaultSettings)
        setIsReady(true)
        return
      }

      const { data: savedSettings } = await getSettings(session.user.id)
      const nextSettings = savedSettings
        ? { ...defaultSettings, ...savedSettings, full_name: savedSettings.full_name || session.user.user_metadata?.full_name || '' }
        : { ...defaultSettings, full_name: session.user.user_metadata?.full_name || '' }

      document.documentElement.dataset.theme = nextSettings.theme
      setUserId(session.user.id)
      setUserEmail(session.user.email || '')
      setUserSettings(nextSettings)
      setUser({
        name: nextSettings.full_name || 'User',
        email: session.user.email || '',
      })
      setIsReady(true)
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      void hydrateSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void hydrateSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleOpenAuth = (mode: 'login' | 'signup') => {
    setAuthModal({ isOpen: true, mode })
  }

  const handleAuthSuccess = (userData: UserProfile) => {
    setUser(userData)
    setAuthModal((prev) => ({ ...prev, isOpen: false }))
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  if (!isReady) {
    return <div className="app-loading">Preparing your workspace...</div>
  }

  return (
    <div className="app-container">
      <Header
        user={user}
        onNavigate={setCurrentPage}
        onOpenAuth={handleOpenAuth}
        onLogout={handleLogout}
      />

      <main style={{ padding: '2rem 1rem' }}>
        {currentPage === 'home' && <HomePage onNavigate={setCurrentPage} />}
        {currentPage === 'invest' && <InvestPage />}
        {currentPage === 'strategies' && <StrategiesPage />}
        {currentPage === 'performance' && (
          <PerformancePage defaultTimeframe={userSettings.default_timeframe} />
        )}
        {currentPage === 'settings' && (
          <SettingsPage
            key={userId ?? 'signed-out'}
            userId={userId}
            email={userEmail}
            initialSettings={userSettings}
            onSettingsSaved={setUserSettings}
          />
        )}
      </main>

      <Footer onNavigate={setCurrentPage} />

      <AuthModal
        isOpen={authModal.isOpen}
        initialMode={authModal.mode}
        onClose={() => setAuthModal((prev) => ({ ...prev, isOpen: false }))}
        onSuccess={handleAuthSuccess}
      />
    </div>
  )
}