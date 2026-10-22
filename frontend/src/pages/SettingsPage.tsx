// SettingsPage.tsx — Account settings, preferences, danger zone

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { clearLocalUserData } from '../../lib/api';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Checkbox from '../ui/Checkbox';
import RadioGroup from '../ui/RadioGroup';
import { LoaderInline, LoaderOverlay } from '../ui/Loader';
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
  const [chartStyle, setChartStyle] = useState('candles');
  const [defaultZoom, setDefaultZoom] = useState(90);

  // Notifications & Alerts State
  const [tradeSignals, setTradeSignals] = useState(true);
  const [securityWarnings, setSecurityWarnings] = useState(true);
  const [dailySummary, setDailySummary] = useState(false);
  const [priceAlerts, setPriceAlerts] = useState(false);
  const [autoTrackSignals, setAutoTrackSignals] = useState(false);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // The first pass fills the form from the account store, so the page waits
  // behind the loader. Later passes (after the name changes) refresh in the
  // background instead, so the form never flashes empty.
  const [profileLoading, setProfileLoading] = useState(true);
  const firstLoadRef = useRef(true);

  // Account Deletion State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAndApplySettings() {
      if (firstLoadRef.current) setProfileLoading(true);
      try {
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
          if (currentSettings.chartStyle) setChartStyle(currentSettings.chartStyle);
          if (currentSettings.defaultZoom) setDefaultZoom(currentSettings.defaultZoom);

          if (currentSettings.tradeSignals !== undefined) setTradeSignals(currentSettings.tradeSignals);
          if (currentSettings.securityWarnings !== undefined) setSecurityWarnings(currentSettings.securityWarnings);
          if (currentSettings.dailySummary !== undefined) setDailySummary(currentSettings.dailySummary);
          if (currentSettings.priceAlerts !== undefined) setPriceAlerts(currentSettings.priceAlerts);
          if (currentSettings.autoTrackSignals !== undefined) setAutoTrackSignals(currentSettings.autoTrackSignals);

          applyAndStoreUserSettings(currentSettings, currentName);
        }
      } finally {
        firstLoadRef.current = false;
        setProfileLoading(false);
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
      // Deleting only the public profile row left the Turso mirror and — far
      // worse — the Supabase auth user intact, so the same email could sign
      // straight back in to a re-provisioned account. The server owns the
      // whole cascade (Turso portfolios + users, the Supabase profile row,
      // and finally the auth credential) because it is the only place with
      // the service-role key needed to delete an auth user.
      //
      // This must run BEFORE sign-out: the request is authorised by the very
      // access token that deleting the auth user destroys.
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        throw new Error('Your session expired. Please sign in again to delete your account.');
      }

      const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const res = await fetch(`${apiBase}/api/user/account`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        let detail = `Request failed (${res.status}).`;
        try {
          const body = await res.json();
          if (body?.detail) detail = body.detail;
        } catch {
          /* non-JSON error body: keep the status-code message */
        }
        throw new Error(detail);
      }

      // The account is gone server-side. Drop every local trace of it so a
      // stale cached badge set can't survive the sign-out.
      clearLocalUserData();

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
        chartStyle,
        defaultZoom,
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

        // Supabase is the source of truth; Turso keeps a mirror the nightly
        // runner reads. Without this the mirror would stay stale until the
        // next run, and the runner would act on yesterday's preferences.
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData.session?.access_token;
          if (token) {
            await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/user/sync-settings`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ settings: freshSettings }),
            });
          }
        } catch {
          // Best-effort: Supabase already has the change, so a failed mirror
          // must not surface as a failed save.
        }
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
                  <label className="st-settings-label">Chart style</label>
                  <RadioGroup
                    name="chartStyle"
                    value={chartStyle}
                    onChange={(val) => setChartStyle(String(val))}
                    options={[
                      { label: 'Candlesticks', value: 'candles' },
                      { label: 'Line', value: 'line' },
                    ]}
                  />
                  <span className="st-settings-hint">Candlesticks show open, high, low and close per day. The line view just draws the close price, which is easier to read at a glance.</span>
                </div>

                <div className="st-settings-field">
                  <label className="st-settings-label">Default chart zoom</label>
                  <RadioGroup
                    name="defaultZoom"
                    value={String(defaultZoom)}
                    onChange={(val) => setDefaultZoom(Number(val))}
                    options={[
                      { label: '30 bars', value: '30' },
                      { label: '60 bars', value: '60' },
                      { label: '90 bars', value: '90' },
                    ]}
                  />
                  <span className="st-settings-hint">How many trading days the chart shows when it first loads. You can always zoom in and out.</span>
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
                {saving ? (
                  <>
                    <LoaderInline tone="inherit" />
                    Saving…
                  </>
                ) : 'Save changes'}
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
                {deleting ? (
                  <>
                    <LoaderInline tone="inherit" />
                    Deleting…
                  </>
                ) : 'Delete permanently'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reading the profile and writing it back both go over the network, so
          the page waits behind the loader instead of looking empty. */}
      {profileLoading && (
        <LoaderOverlay label="Loading your settings…" sub="Fetching your profile and preferences." />
      )}
      {saving && (
        <LoaderOverlay label="Saving your settings…" sub="Syncing your preferences to the account store." />
      )}
    </div>
  );
}