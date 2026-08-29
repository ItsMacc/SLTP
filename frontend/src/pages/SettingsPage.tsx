import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import './SettingsPage.css';

interface SettingsPageProps {
  userId: string;
  userEmail: string;
  initialName?: string | null;
  onProfileUpdated: (newName: string) => void;
}

export function applyAndStoreUserSettings(settings: { theme?: string; [key: string]: any }, name?: string) {
  if (settings.theme) {
    const themeVal = settings.theme.toLowerCase();
    document.documentElement.setAttribute('data-theme', themeVal);
    sessionStorage.setItem('st_user_theme', settings.theme);
  }
  if (name !== undefined) {
    sessionStorage.setItem('st_user_name', name);
  }
}

export default function SettingsPage({ userId, userEmail, initialName, onProfileUpdated }: SettingsPageProps) {
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'preferences'>('profile');
  
  const [fullName, setFullName] = useState(initialName || '');
  const [theme, setTheme] = useState(() => sessionStorage.getItem('st_user_theme') || 'Light');

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    async function loadAndApplySettings() {
      const { data, error } = await supabase
        .from('users')
        .select('name, settings')
        .eq('id', userId)
        .single();

      if (!error && data) {
        const currentName = data.name || initialName || '';
        const currentSettings = data.settings || {};

        setFullName(currentName);
        if (currentSettings.theme) {
          setTheme(currentSettings.theme);
        }

        applyAndStoreUserSettings(currentSettings, currentName);
      }
    }
    loadAndApplySettings();
  }, [userId, initialName]);

  // Apply the theme immediately on selection so it previews before being saved.
  const handleThemeChange = (newThemeVal: string) => {
    setTheme(newThemeVal);
    applyAndStoreUserSettings({ theme: newThemeVal });
  };

  const handleSaveChanges = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const updatedName = fullName.trim();
      const updatedSettings = { theme };

      const { error } = await supabase
        .from('users')
        .update({
          name: updatedName,
          settings: updatedSettings,
        })
        .eq('id', userId);

      if (error) throw error;

      const { data: verifyData, error: verifyError } = await supabase
        .from('users')
        .select('name, settings')
        .eq('id', userId)
        .single();

      if (verifyError) throw verifyError;

      if (verifyData) {
        const freshName = verifyData.name || updatedName;
        const freshSettings = verifyData.settings || updatedSettings;
        
        applyAndStoreUserSettings(freshSettings, freshName);
        onProfileUpdated(freshName);
      }

      setMessage({ type: 'success', text: 'Changes saved and synced successfully!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save changes.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="st-settings-layout">
      <div className="st-settings-container">
        <h1 className="st-settings-header-title">Workspace.</h1>

        <div className="st-settings-grid">
          {/* Sidebar Navigation */}
          <div className="st-settings-sidebar">
            <button
              type="button"
              className={`st-settings-nav-item ${activeSubTab === 'profile' ? 'is-active' : ''}`}
              onClick={() => { setActiveSubTab('profile'); setMessage(null); }}
            >
              <div className="st-settings-nav-title">Profile</div>
              <div className="st-settings-nav-desc">Your account details</div>
            </button>

            <button
              type="button"
              className={`st-settings-nav-item ${activeSubTab === 'preferences' ? 'is-active' : ''}`}
              onClick={() => { setActiveSubTab('preferences'); setMessage(null); }}
            >
              <div className="st-settings-nav-title">Preferences</div>
              <div className="st-settings-nav-desc">Shape your experience</div>
            </button>
          </div>

          <div className="st-settings-card">
            {message && (
              <div className={`st-settings-alert st-settings-alert--${message.type}`}>
                {message.text}
              </div>
            )}

            {activeSubTab === 'profile' && (
              <div className="st-settings-section">
                <div className="st-settings-section-heading">
                  <span className="st-settings-step">01</span>
                  <h2>Profile</h2>
                </div>
                <div className="st-settings-divider" />

                <div className="st-settings-field">
                  <label className="st-settings-label">Full name</label>
                  <Input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                  />
                </div>

                <div className="st-settings-field">
                  <label className="st-settings-label">Email address</label>
                  <Input
                    type="email"
                    value={userEmail}
                    disabled
                    style={{ backgroundColor: 'var(--bg-surface-hover)', cursor: 'not-allowed' }}
                  />
                  <span className="st-settings-hint">Your email is managed by your authentication provider.</span>
                </div>
              </div>
            )}

            {activeSubTab === 'preferences' && (
              <div className="st-settings-section">
                <div className="st-settings-section-heading">
                  <span className="st-settings-step">02</span>
                  <h2>Preferences</h2>
                </div>
                <div className="st-settings-divider" />

                <div className="st-settings-field">
                  <label className="st-settings-label">Appearance</label>
                  <Select
                    value={theme}
                    onChange={(val) => handleThemeChange(String(val))}
                    options={[
                      { label: 'Light', value: 'Light' },
                      { label: 'Dark', value: 'Dark' },
                    ]}
                  />
                  <span className="st-settings-hint">Choose the visual tone used across Stocker.</span>
                </div>
              </div>
            )}

            <div className="st-settings-footer">
              <Button 
                variant="primary" 
                size="md" 
                onClick={handleSaveChanges} 
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save changes'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}