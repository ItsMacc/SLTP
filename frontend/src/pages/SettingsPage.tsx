// SettingsPage.tsx — Account settings, preferences, danger zone

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Checkbox from '../ui/Checkbox';
import RadioGroup from '../ui/RadioGroup';
import './SettingsPage.css';

interface SettingsPageProps {
  userId: string;
  userEmail: string;
  initialName?: string | null;
  onProfileUpdated: (newName: string) => void;
  onAccountDeleted: () => Promise<void> | void;
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

export default function SettingsPage({ userId, userEmail, initialName, onProfileUpdated, onAccountDeleted }: SettingsPageProps) {
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'preferences' | 'notifications'>('profile');
  
  // Profile State
  const [fullName, setFullName] = useState(initialName || '');
  const [accountCreated, setAccountCreated] = useState<string>('Loading...');

  // Preferences State
  const [theme, setTheme] = useState(() => sessionStorage.getItem('st_user_theme') || 'Light');
  const [defaultTimeframe, setDefaultTimeframe] = useState('1y');
  const [riskTolerance, setRiskTolerance] = useState('Medium');

  // Notifications & Alerts State
  const [tradeSignals, setTradeSignals] = useState(true);
  const [securityWarnings, setSecurityWarnings] = useState(true);
  const [dailySummary, setDailySummary] = useState(false);
  const [priceAlerts, setPriceAlerts] = useState(true);
  const [autoTrackSignals, setAutoTrackSignals] = useState(false);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Account Deletion State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAndApplySettings() {
      // Fetch user profile metadata & settings from Supabase
      const { data, error } = await supabase
        .from('users')
        .select('name, created_at, settings')
        .eq('id', userId)
        .single();

      if (!error && data) {
        const currentName = data.name || initialName || '';
        const currentSettings = data.settings || {};

        setFullName(currentName);
        
        if (data.created_at) {
          setAccountCreated(new Date(data.created_at).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }));
        } else {
          setAccountCreated('Standard Member');
        }

        if (currentSettings.theme) setTheme(currentSettings.theme);
        if (currentSettings.defaultTimeframe) setDefaultTimeframe(currentSettings.defaultTimeframe);
        if (currentSettings.riskTolerance) setRiskTolerance(currentSettings.riskTolerance);
        
        if (currentSettings.tradeSignals !== undefined) setTradeSignals(currentSettings.tradeSignals);
        if (currentSettings.securityWarnings !== undefined) setSecurityWarnings(currentSettings.securityWarnings);
        if (currentSettings.dailySummary !== undefined) setDailySummary(currentSettings.dailySummary);
        if (currentSettings.priceAlerts !== undefined) setPriceAlerts(currentSettings.priceAlerts);
        if (currentSettings.autoTrackSignals !== undefined) setAutoTrackSignals(currentSettings.autoTrackSignals);

        applyAndStoreUserSettings(currentSettings, currentName);
      }
    }
    loadAndApplySettings();
  }, [userId, initialName]);

  // Close the delete-account modal with the Escape key (blocked while deleting).
  useEffect(() => {
    if (!deleteModalOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !deleting) {
        setDeleteModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteModalOpen, deleting]);

  const handleThemeChange = (newThemeVal: string) => {
    setTheme(newThemeVal);
    applyAndStoreUserSettings({ theme: newThemeVal });
  };

  const handleRequestDelete = () => {
    setDeleteError(null);
    setDeleteConfirmText('');
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'CONFIRM' || deleting) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      // Delete the user's profile row. The RLS policy
      // "Users can delete their own profile." authorizes this request.
      // `.select('id')` verifies the row was actually removed so a success
      // message is never shown when nothing was deleted.
      const { data: deletedRows, error: rowError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId)
        .select('id');

      if (rowError) throw rowError;
      if (!deletedRows || deletedRows.length === 0) {
        throw new Error(
          'Your profile could not be deleted. Check that the "Users can delete their own profile." RLS policy exists on the users table, then try again.',
        );
      }

      setDeleteModalOpen(false);
      setMessage({ type: 'success', text: 'Your account has been deleted. Redirecting...' });
      await onAccountDeleted();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete account. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveChanges = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const updatedName = fullName.trim();
      const updatedSettings = {
        theme,
        defaultTimeframe,
        riskTolerance,
        tradeSignals,
        securityWarnings,
        dailySummary,
        priceAlerts,
        autoTrackSignals,
      };

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

            <button
              type="button"
              className={`st-settings-nav-item ${activeSubTab === 'notifications' ? 'is-active' : ''}`}
              onClick={() => { setActiveSubTab('notifications'); setMessage(null); }}
            >
              <div className="st-settings-nav-title">Notifications & Alerts</div>
              <div className="st-settings-nav-desc">Manage signal feeds</div>
            </button>
          </div>

          <div className="st-settings-card">
            {message && (
              <div className={`st-settings-alert st-settings-alert--${message.type}`}>
                {message.text}
              </div>
            )}

            {/* --- 1. Profile Section --- */}
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
                  <Input type="email" value={userEmail} disabled />
                  <span className="st-settings-hint">Your email is managed by your authentication provider.</span>
                </div>

                <div className="st-settings-field">
                  <label className="st-settings-label">Account created</label>
                  <Input type="text" value={accountCreated} disabled />
                  <span className="st-settings-hint">System registration timestamp.</span>
                </div>

                <div className="st-settings-field is-danger">
                  <label className="st-settings-label is-danger">Danger Zone</label>
                  <span className="st-settings-hint is-warning">
                    Permanently delete your account and all associated configuration data.
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="st-settings-btn-danger"
                    onClick={handleRequestDelete}
                  >
                    Delete account
                  </Button>
                </div>
              </div>
            )}

            {/* --- 2. Preferences Section --- */}
            {activeSubTab === 'preferences' && (
              <div className="st-settings-section">
                <div className="st-settings-section-heading">
                  <span className="st-settings-step">02</span>
                  <h2>Preferences</h2>
                </div>
                <div className="st-settings-divider" />

                <div className="st-settings-field">
                  <label className="st-settings-label">Theme</label>
                  <Select
                    value={theme}
                    onChange={(val) => handleThemeChange(String(val))}
                    options={[
                      { label: 'Light', value: 'Light' },
                      { label: 'Dark', value: 'Dark' },
                    ]}
                  />
                  <span className="st-settings-hint">Choose the visual tone used across SLTP.</span>
                </div>

                <div className="st-settings-field">
                  <label className="st-settings-label">Default timeframe</label>
                  <RadioGroup
                    name="defaultTimeframe"
                    value={defaultTimeframe}
                    onChange={(val) => setDefaultTimeframe(String(val))}
                    options={[
                      { label: '1 Year', value: '1y' },
                      { label: '2 Years', value: '2y' },
                      { label: '5 Years', value: '5y' },
                      { label: 'All Time', value: 'All' },
                    ]}
                  />
                  <span className="st-settings-hint">Default chart scale when analyzing market tickers.</span>
                </div>

                <div className="st-settings-field">
                  <label className="st-settings-label">Risk Tolerance</label>
                  <RadioGroup
                    name="riskTolerance"
                    value={riskTolerance}
                    onChange={(val) => setRiskTolerance(String(val))}
                    options={[
                      { label: 'Low', value: 'Low' },
                      { label: 'Medium', value: 'Medium' },
                      { label: 'High', value: 'High' },
                    ]}
                  />
                  <span className="st-settings-hint">Tailors strategy suggestions and volatility metrics.</span>
                </div>
              </div>
            )}

            {/* --- 3. Notifications & Alerts Section --- */}
            {activeSubTab === 'notifications' && (
              <div className="st-settings-section">
                <div className="st-settings-section-heading">
                  <span className="st-settings-step">03</span>
                  <h2>Notifications & Alerts</h2>
                </div>
                <div className="st-settings-divider" />

                <div className="st-settings-field">
                  <Checkbox
                    checked={tradeSignals}
                    onChange={(e) => setTradeSignals(e.target.checked)}
                    label="Notify me when trade signals are generated"
                  />
                  <span className="st-settings-hint is-indented">
                    Receive instant notifications when active strategies hit buy/sell execution criteria.
                  </span>
                </div>

                <div className="st-settings-field">
                  <Checkbox
                    checked={securityWarnings}
                    onChange={(e) => setSecurityWarnings(e.target.checked)}
                    label="Security warning alerts"
                  />
                  <span className="st-settings-hint is-indented">
                    Get notified immediately regarding password changes or login attempts from unknown IPs.
                  </span>
                </div>

                <div className="st-settings-field">
                  <Checkbox
                    checked={dailySummary}
                    onChange={(e) => setDailySummary(e.target.checked)}
                    label="Daily Market Summary"
                  />
                  <span className="st-settings-hint is-indented">
                    Receive an aggregated morning overview of portfolio performance and watchlist movements.
                  </span>
                </div>

                <div className="st-settings-field">
                  <Checkbox
                    checked={priceAlerts}
                    onChange={(e) => setPriceAlerts(e.target.checked)}
                    label="Volatility & Price Threshold Spikes"
                  />
                  <span className="st-settings-hint is-indented">
                    Instant alerts if any tracked instrument moves +/- 5% within a single trading session.
                  </span>
                </div>

                <div className="st-settings-field">
                  <Checkbox
                    checked={autoTrackSignals}
                    onChange={(e) => setAutoTrackSignals(e.target.checked)}
                    label="Enable automatic tracking on signal generation"
                  />
                  <span className="st-settings-hint is-indented">
                    When a strategy generates a signal, automatically record the trade in your portfolio at our
                    pre-calculated prices. Leave this off to add trades manually from the Portfolio page.
                  </span>
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

      {deleteModalOpen && (
        <div
          className="st-settings-modal-overlay"
          onClick={() => { if (!deleting) setDeleteModalOpen(false); }}
        >
          <div
            className="st-settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="delete-account-title" className="st-settings-modal-title">
              Delete your account?
            </h3>
            <p className="st-settings-modal-text">
              This will permanently delete your SLTP profile and all associated
              configuration data. This action <strong>cannot be undone</strong>.
            </p>

            <label className="st-settings-label" htmlFor="delete-confirm-input">
              Type <span className="st-settings-modal-code">CONFIRM</span> to continue
            </label>
            <Input
              id="delete-confirm-input"
              type="text"
              autoFocus
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="CONFIRM"
              disabled={deleting}
              className="st-settings-modal-input"
            />

            {deleteError && (
              <div className="st-settings-alert st-settings-alert--error">{deleteError}</div>
            )}

            <div className="st-settings-modal-actions">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                className="st-settings-modal-danger"
                disabled={deleteConfirmText.trim().toUpperCase() !== 'CONFIRM' || deleting}
                onClick={handleConfirmDelete}
              >
                {deleting ? 'Deleting...' : 'Delete permanently'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}