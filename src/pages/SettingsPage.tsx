import { useState } from 'react'
import { saveSettings, type UserSettings } from '../../lib/settings'
import { supabase } from '../../lib/supabase'
import './SettingsPage.css'

const defaultSettings: Omit<UserSettings, 'user_id'> = {
  full_name: '',
  risk_profile: 'balanced',
  default_timeframe: '1y',
  theme: 'light',
  email_updates: true,
  weekly_summary: false,
}

type SettingsSection = 'profile' | 'preferences' | 'notifications'

interface SettingsPageProps {
  userId?: string | null
  email?: string
  initialSettings?: Omit<UserSettings, 'user_id'>
  onSettingsSaved?: (settings: Omit<UserSettings, 'user_id'>) => void
}

export default function SettingsPage({
  userId: initialUserId = null,
  email: initialEmail = '',
  initialSettings,
  onSettingsSaved,
}: SettingsPageProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile')
  const [userId] = useState<string | null>(initialUserId)
  const [email] = useState(initialEmail)
  const [settings, setSettings] = useState(initialSettings ?? defaultSettings)
  const [loading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const updateSetting = <Key extends keyof typeof settings>(
    key: Key,
    value: (typeof settings)[Key]
  ) => {
    setSettings((current) => ({ ...current, [key]: value }))
    if (key === 'theme') {
      document.documentElement.dataset.theme = value as string
    }
    setMessage('')
    setError('')
  }

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!userId) return

    setSaving(true)
    setMessage('')
    setError('')
    const { error: saveError } = await saveSettings(userId, settings)

    if (saveError) {
      setError(saveError.message)
    } else {
      await supabase.auth.updateUser({ data: { full_name: settings.full_name } })
      onSettingsSaved?.(settings)
      setMessage('Your settings have been saved.')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="settings-page">
        <p className="settings-status">Loading your settings...</p>
      </div>
    )
  }

  if (!userId) {
    return (
      <div className="settings-page">
        <section className="settings-empty-state">
          <span className="settings-kicker">ACCOUNT SETTINGS</span>
          <h1>Make Stocker feel like yours.</h1>
          <p>Sign in to manage your profile, investing preferences, and email updates.</p>
        </section>
      </div>
    )
  }

  return (
    <div className="settings-page">
      <header className="settings-header">
        <div>
          <span className="settings-kicker">ACCOUNT SETTINGS</span>
          <h1>Your investing workspace.</h1>
        </div>
        <div className="settings-account-mark" aria-hidden="true">
          {settings.full_name.charAt(0).toUpperCase() || email.charAt(0).toUpperCase() || 'U'}
        </div>
      </header>

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {(
            [
              ['profile', 'Profile', 'Your account details'],
              ['preferences', 'Preferences', 'Shape your experience'],
              ['notifications', 'Notifications', 'Choose what reaches you'],
            ] as const
          ).map(([section, label, description]) => (
            <button
              key={section}
              type="button"
              className={`settings-nav-item ${activeSection === section ? 'is-active' : ''}`}
              onClick={() => setActiveSection(section)}
            >
              <span>{label}</span>
              <small>{description}</small>
            </button>
          ))}
        </nav>

        <form className="settings-panel" onSubmit={handleSave}>
          {activeSection === 'profile' && (
            <section className="settings-section">
              <div className="settings-section-heading">
                <div>
                  <span className="settings-section-number">01</span>
                  <h2>Profile</h2>
                </div>
              </div>
              <label className="settings-field">
                <span>Full name</span>
                <input
                  value={settings.full_name}
                  onChange={(event) => updateSetting('full_name', event.target.value)}
                  placeholder="Your name"
                />
              </label>
              <label className="settings-field">
                <span>Email address</span>
                <input value={email} type="email" disabled />
                <small>Your email is managed by your authentication provider.</small>
              </label>
            </section>
          )}

          {activeSection === 'preferences' && (
            <section className="settings-section">
              <div className="settings-section-heading">
                <div>
                  <span className="settings-section-number">02</span>
                  <h2>Preferences</h2>
                </div>
              </div>
              <label className="settings-field">
                <span>Risk profile</span>
                <div className="settings-select">
                  <select
                    value={settings.risk_profile}
                    onChange={(event) =>
                      updateSetting(
                        'risk_profile',
                        event.target.value as UserSettings['risk_profile']
                      )
                    }
                  >
                    <option value="conservative">Conservative</option>
                    <option value="balanced">Balanced</option>
                    <option value="growth">Growth</option>
                  </select>
                </div>
                <small>This helps you compare strategies with the right context.</small>
              </label>
              <label className="settings-field">
                <span>Default performance range</span>
                <div className="settings-select">
                  <select
                    value={settings.default_timeframe}
                    onChange={(event) =>
                      updateSetting(
                        'default_timeframe',
                        event.target.value as UserSettings['default_timeframe']
                      )
                    }
                  >
                    <option value="1y">1 year</option>
                    <option value="2y">2 years</option>
                    <option value="5y">5 years</option>
                    <option value="all">All available data</option>
                  </select>
                </div>
              </label>
              <label className="settings-field">
                <span>Appearance</span>
                <div className="settings-select">
                  <select
                    value={settings.theme}
                    onChange={(event) =>
                      updateSetting('theme', event.target.value as UserSettings['theme'])
                    }
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </div>
                <small>Choose the visual tone used across Stocker.</small>
              </label>
            </section>
          )}

          {activeSection === 'notifications' && (
            <section className="settings-section">
              <div className="settings-section-heading">
                <div>
                  <span className="settings-section-number">03</span>
                  <h2>Notifications</h2>
                </div>
              </div>
              <label className="settings-toggle">
                <span>
                  <strong>Product updates</strong>
                  <small>Occasional news about Stocker and new tools.</small>
                </span>
                <input
                  type="checkbox"
                  checked={settings.email_updates}
                  onChange={(event) => updateSetting('email_updates', event.target.checked)}
                />
              </label>
              <label className="settings-toggle">
                <span>
                  <strong>Weekly summary</strong>
                  <small>A brief review of your saved investing activity.</small>
                </span>
                <input
                  type="checkbox"
                  checked={settings.weekly_summary}
                  onChange={(event) => updateSetting('weekly_summary', event.target.checked)}
                />
              </label>
            </section>
          )}

          <div className="settings-actions">
            <span className={`settings-feedback ${error ? 'is-error' : ''}`}>
              {error || message}
            </span>
            <button className="settings-save" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}