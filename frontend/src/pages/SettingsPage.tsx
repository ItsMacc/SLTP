// SettingsPage.tsx — Account settings, preferences, danger zone

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { clearLocalUserData } from '../../lib/api';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Checkbox from '../ui/Checkbox';
import RadioGroup from '../ui/RadioGroup';
import { LoaderInline, LoaderOverlay } from '../ui/Loader';
import SuccessToast from '../ui/SuccessToast';
import ConfirmDeleteDialog from '../ui/ConfirmDeleteDialog';
import { Check, Copy } from 'lucide-react';
import { listApiKeys, createApiKey, revokeApiKey, type ApiKeySummary } from '../../lib/api';
import './SettingsPage.css';

const EDITOR_FONT_SIZE_OPTIONS = Array.from({ length: 11 }, (_, i) => {
  const px = 10 + i * 2;
  return { label: `${px} px`, value: px };
});

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
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'preferences' | 'notifications' | 'editor' | 'api'>('profile');

  // API keys State
  const [apiKeys, setApiKeys] = useState<ApiKeySummary[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKeySummary | null>(null);
  const [revokingKey, setRevokingKey] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [keyToast, setKeyToast] = useState<string | null>(null);
  const dismissKeyToast = useCallback(() => setKeyToast(null), []);
  const [settingsToast, setSettingsToast] = useState<string | null>(null);
  const dismissSettingsToast = useCallback(() => setSettingsToast(null), []);
  
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

  // Code editor State (applied to the Lab editor)
  const [editorFontSize, setEditorFontSize] = useState(14);
  const [editorTabSize, setEditorTabSize] = useState(4);
  const [editorWordWrap, setEditorWordWrap] = useState(false);
  const [editorMinimap, setEditorMinimap] = useState(false);
  const [editorLineNumbers, setEditorLineNumbers] = useState(true);
  const [editorFontLigatures, setEditorFontLigatures] = useState(true);

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

          if (typeof currentSettings.editorFontSize === 'number') setEditorFontSize(Math.min(30, Math.max(10, Math.round(currentSettings.editorFontSize / 2) * 2)));
          if (typeof currentSettings.editorTabSize === 'number') setEditorTabSize(currentSettings.editorTabSize);
          if (currentSettings.editorWordWrap !== undefined) setEditorWordWrap(currentSettings.editorWordWrap);
          if (currentSettings.editorMinimap !== undefined) setEditorMinimap(currentSettings.editorMinimap);
          if (currentSettings.editorLineNumbers !== undefined) setEditorLineNumbers(currentSettings.editorLineNumbers);
          if (currentSettings.editorFontLigatures !== undefined) setEditorFontLigatures(currentSettings.editorFontLigatures);

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

  const getToken = async (): Promise<string> => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) throw new Error('Your session expired. Please sign in again.');
    return token;
  };

  const loadApiKeys = async () => {
    setApiKeysLoading(true);
    setApiKeyError(null);
    try {
      setApiKeys(await listApiKeys(await getToken()));
    } catch (err: any) {
      setApiKeyError(err.message || 'Failed to load API keys.');
    } finally {
      setApiKeysLoading(false);
    }
  };

  const handleCreateKey = async () => {
    const name = newKeyName.trim();
    if (!name || creatingKey) return;
    setCreatingKey(true);
    setApiKeyError(null);
    try {
      const created = await createApiKey(await getToken(), name);
      setCreatedKey(created.key);
      setNewKeyName('');
      setApiKeys((prev) => [{ id: created.id, name: created.name, key_prefix: created.key_prefix, created_at: created.created_at, last_used_at: null }, ...prev]);
    } catch (err: any) {
      setApiKeyError(err.message || 'Failed to create API key.');
    } finally {
      setCreatingKey(false);
    }
  };

  const handleCopyKey = async () => {
    if (!createdKey) return;
    try {
      await navigator.clipboard.writeText(createdKey);
      setKeyCopied(true);
      setKeyToast('API key copied to clipboard');
    } catch {
      setApiKeyError('Could not copy automatically. Select the key and copy it manually.');
    }
  };

  const handleConfirmRevoke = async () => {
    if (!keyToRevoke || revokingKey) return;
    setRevokingKey(true);
    setRevokeError(null);
    try {
      await revokeApiKey(await getToken(), keyToRevoke.id);
      setApiKeys((prev) => prev.filter((k) => k.id !== keyToRevoke.id));
      setKeyToast(`API key “${keyToRevoke.name}” deleted`);
      setKeyToRevoke(null);
    } catch (err: any) {
      setRevokeError(err.message || 'Failed to delete API key.');
    } finally {
      setRevokingKey(false);
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
        editorFontSize,
        editorTabSize,
        editorWordWrap,
        editorMinimap,
        editorLineNumbers,
        editorFontLigatures,
      };

      // Apply right away so the page reflects the click, then persist.
      applyAndStoreUserSettings(updatedSettings, updatedName);
      onProfileUpdated(updatedName);

      const { error } = await supabase
        .from('users')
        .update({
          name: updatedName,
          settings: updatedSettings,
        })
        .eq('id', userId);

      if (error) throw error;

      // Supabase is the source of truth; Turso keeps a mirror the nightly
      // runner reads. Best-effort: Supabase already has the change, so a
      // failed mirror must not surface as a failed save.
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
            body: JSON.stringify({ settings: updatedSettings }),
          });
        }
      } catch {
        // Ignored on purpose, see above.
      }

      setSettingsToast('Settings saved');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save changes.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="st-settings-layout">
      <div className="st-settings-container">
        <h1 className="st-settings-header-title">Settings</h1>

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
              className={`st-settings-nav-item ${activeSubTab === 'editor' ? 'is-active' : ''}`}
              onClick={() => { setActiveSubTab('editor'); setMessage(null); }}
            >
              <div className="st-settings-nav-title">Code editor</div>
              <div className="st-settings-nav-desc">Lab editor appearance</div>
            </button>

            <button
              type="button"
              className={`st-settings-nav-item ${activeSubTab === 'notifications' ? 'is-active' : ''}`}
              onClick={() => { setActiveSubTab('notifications'); setMessage(null); }}
            >
              <div className="st-settings-nav-title">Notifications & Alerts</div>
              <div className="st-settings-nav-desc">Manage signal feeds</div>
            </button>

            <button
              type="button"
              className={`st-settings-nav-item ${activeSubTab === 'api' ? 'is-active' : ''}`}
              onClick={() => { setActiveSubTab('api'); setMessage(null); loadApiKeys(); }}
            >
              <div className="st-settings-nav-title">API keys</div>
              <div className="st-settings-nav-desc">Use the API from your machine</div>
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
                  <span className="st-settings-step">04</span>
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

            {/* --- 3. Code Editor Section --- */}
            {activeSubTab === 'editor' && (
              <div className="st-settings-section">
                <div className="st-settings-section-heading">
                  <span className="st-settings-step">03</span>
                  <h2>Code editor</h2>
                </div>
                <div className="st-settings-divider" />

                <div className="st-settings-field">
                  <label className="st-settings-label">Font size</label>
                  <Select
                    value={editorFontSize}
                    onChange={(val) => setEditorFontSize(Number(val))}
                    options={EDITOR_FONT_SIZE_OPTIONS}
                  />
                  <span className="st-settings-hint">Text size used in the Lab code editor.</span>
                </div>

                <div className="st-settings-field">
                  <label className="st-settings-label">Tab size</label>
                  <RadioGroup
                    name="editorTabSize"
                    value={String(editorTabSize)}
                    onChange={(val) => setEditorTabSize(Number(val))}
                    options={[
                      { label: '2 spaces', value: '2' },
                      { label: '4 spaces', value: '4' },
                    ]}
                  />
                  <span className="st-settings-hint">How many spaces one indent level uses.</span>
                </div>

                <div className="st-settings-field">
                  <Checkbox
                    checked={editorWordWrap}
                    onChange={(e) => setEditorWordWrap(e.target.checked)}
                    label="Word wrap"
                  />
                  <span className="st-settings-hint is-indented">
                    Wrap long lines to the width of the editor instead of scrolling sideways.
                  </span>
                </div>

                <div className="st-settings-field">
                  <Checkbox
                    checked={editorLineNumbers}
                    onChange={(e) => setEditorLineNumbers(e.target.checked)}
                    label="Show line numbers"
                  />
                  <span className="st-settings-hint is-indented">
                    Display line numbers in the gutter beside the code.
                  </span>
                </div>

                <div className="st-settings-field">
                  <Checkbox
                    checked={editorMinimap}
                    onChange={(e) => setEditorMinimap(e.target.checked)}
                    label="Show minimap"
                  />
                  <span className="st-settings-hint is-indented">
                    Show a small overview of the whole file on the right edge of the editor.
                  </span>
                </div>

                <div className="st-settings-field">
                  <Checkbox
                    checked={editorFontLigatures}
                    onChange={(e) => setEditorFontLigatures(e.target.checked)}
                    label="Font ligatures"
                  />
                  <span className="st-settings-hint is-indented">
                    Combine symbols such as -&gt; and === into single glyphs in fonts that support them.
                  </span>
                </div>
              </div>
            )}

            {/* --- API keys Section --- */}
            {activeSubTab === 'api' && (
              <div className="st-settings-section">
                <div className="st-settings-section-heading">
                  <span className="st-settings-step">05</span>
                  <h2>API keys</h2>
                </div>
                <div className="st-settings-divider" />

                <div className="st-settings-field">
                  <label className="st-settings-label" htmlFor="new-api-key-name">Create a key</label>
                  <div className="st-settings-key-create">
                    <Input
                      id="new-api-key-name"
                      type="text"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleCreateKey(); }}
                      placeholder="For example: my laptop"
                      maxLength={60}
                      disabled={creatingKey}
                    />
                    <Button
                      variant="primary"
                      size="md"
                      onClick={handleCreateKey}
                      disabled={!newKeyName.trim() || creatingKey}
                    >
                      {creatingKey ? <LoaderInline tone="inherit" /> : 'Create key'}
                    </Button>
                  </div>
                  <span className="st-settings-hint">Keys give full access to your account through the API. Treat them like a password.</span>
                </div>

                {createdKey && (
                  <div className="st-settings-field st-settings-new-key">
                    <label className="st-settings-label">Your new key</label>
                    <div className="st-settings-key-box">
                      <code className="st-settings-key-value">{createdKey}</code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyKey}
                        aria-label="Copy API key"
                      >
                        {keyCopied ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={2} />}
                        {keyCopied ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                    <span className="st-settings-hint is-warning">Copy it now. You won&apos;t be able to see it again.</span>
                    <div className="st-settings-new-key-actions">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setCreatedKey(null); setKeyCopied(false); }}
                        disabled={!keyCopied}
                      >
                        Done
                      </Button>
                    </div>
                  </div>
                )}

                {apiKeyError && <div className="st-settings-alert st-settings-alert--error">{apiKeyError}</div>}

                <div className="st-settings-field">
                  <label className="st-settings-label">Your keys</label>
                  {apiKeysLoading && <LoaderInline />}
                  {!apiKeysLoading && apiKeys.length === 0 && (
                    <span className="st-settings-hint">You have no API keys yet.</span>
                  )}
                  {apiKeys.map((key) => (
                    <div key={key.id} className="st-settings-key-row">
                      <div>
                        <div className="st-settings-key-name">{key.name}</div>
                        <div className="st-settings-hint">
                          {key.key_prefix}… · created {new Date(key.created_at).toLocaleDateString()}
                          {' · '}
                          {key.last_used_at ? `last used ${new Date(key.last_used_at).toLocaleDateString()}` : 'never used'}
                        </div>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="st-settings-btn-danger"
                        onClick={() => { setRevokeError(null); setKeyToRevoke(key); }}
                      >
                        Delete
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="st-settings-footer" hidden={activeSubTab === 'api'}>
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
              This will permanently delete your SLTP profile, your portfolio setup
              and trade records, your Lab workspaces and files, your API keys,
              and your sign-in credentials. This action <strong>cannot be undone</strong>.
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

      {keyToRevoke && (
        <ConfirmDeleteDialog
          title="Delete this API key?"
          description={<>Anything using <strong>{keyToRevoke.name}</strong> will stop working right away. This can&apos;t be undone.</>}
          confirmLabel="Delete key"
          busy={revokingKey}
          error={revokeError}
          onConfirm={handleConfirmRevoke}
          onCancel={() => { if (!revokingKey) setKeyToRevoke(null); }}
        />
      )}

      {keyToast && <SuccessToast message={keyToast} onClose={dismissKeyToast} />}
      {settingsToast && <SuccessToast message={settingsToast} onClose={dismissSettingsToast} />}

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