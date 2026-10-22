// PortfolioPage.tsx — Onboarding gate + simple portfolio summary.
// All trades/positions/performance tracking UI was removed; this page shows
// the wizard answers saved during onboarding. Coming back soon.
import { useState, useEffect, useCallback } from 'react';
import { Wallet } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  getPortfolioStatus,
  peekPortfolio,
  isPortfolioStale,
  type PortfolioStatus,
} from '../../lib/api';
import PortfolioOnboarding from './PortfolioOnboarding';
import { LoaderInline, LoaderScreen } from '../ui/Loader';
import './PortfolioPage.css';

interface PortfolioPageProps {
  defaultName?: string | null;
  /** Live Supabase settings (source of truth for notification booleans) */
  settings?: { tradeSignals?: boolean; [key: string]: any } | null;
}

export default function PortfolioPage({ defaultName, settings }: PortfolioPageProps) {
  // Seed from the module-level cache so returning to this tab paints the
  // previous result immediately instead of flashing a spinner.
  const [status, setStatus] = useState<PortfolioStatus | null>(() => peekPortfolio());
  const [loading, setLoading] = useState(() => peekPortfolio() === null);
  // A background revalidation keeps the old copy on screen; the stock line
  // says it is still reading from the store.
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  /**
   * Loads portfolio status. With a cached copy present this revalidates in the
   * background — `background` keeps the current data on screen and never shows
   * the spinner, so a slow or failed refresh is invisible to the user.
   */
  const loadStatus = useCallback(async (options: { force?: boolean; background?: boolean } = {}) => {
    const { force = false, background = false } = options;
    if (!background) {
      setLoading(true);
      setLoadError(null);
    } else {
      setRefreshing(true);
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not signed in');
      setStatus(await getPortfolioStatus(token, { force }));
    } catch (err) {
      // A failed background refresh must not replace good data with an error.
      if (!background || !peekPortfolio()) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load portfolio');
      }
    } finally {
      if (!background) setLoading(false);
      else setRefreshing(false);
    }
  }, []);

  // On mount, fetch only if the cache is missing or stale. Returning to the
  // tab within the TTL paints instantly and issues no request at all.
  useEffect(() => {
    if (isPortfolioStale()) loadStatus({ background: peekPortfolio() !== null });
  }, [loadStatus]);

  // Picking the tab back up is the natural moment to notice database changes.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') {
        loadStatus({ background: true });
      }
    }
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [loadStatus]);

  // NB: the cache is deliberately NOT cleared on unmount - that is what keeps
  // the data around when the user visits another tab and comes back. Sign-out
  // clears it instead, so one user never sees the previous user's portfolio.

  if (loading && !status) {
    return (
      <div className="pf-page">
        <LoaderScreen
          label="Loading your portfolio…"
          sub="Reading your portfolio from the account store."
        />
      </div>
    );
  }

  if (loadError || !status) {
    return (
      <div className="pf-page">
        <div className="pf-page-placeholder">
          <span className="pf-page-placeholder-text">{loadError || 'Portfolio unavailable.'}</span>
          <button type="button" className="pf-page-retry" onClick={() => loadStatus({ force: true })}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!status.onboarded) {
    // complete-setup invalidates the cache, so this reloads with force.
    return <PortfolioOnboarding defaultName={defaultName} onDone={() => loadStatus({ force: true })} />;
  }

  const fmt = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: status.base_currency || 'USD',
    maximumFractionDigits: 2,
  });

  const prefs = status.preferences || {};
  const followed: string[] = Array.isArray(prefs.followedStrategies)
    ? prefs.followedStrategies
        .map((s: any) => (typeof s === 'string' ? s : s?.name || s?.id))
        .filter(Boolean)
    : [];

  return (
    <div className="pf-page">
      <header className="pf-header">
        <div>
          <span className="pf-header-kicker">Portfolio</span>
          <h1 className="pf-header-title">{status.name}</h1>
        </div>
        {refreshing && (
          <span className="pf-header-refresh" role="status">
            <LoaderInline size={14} /> Refreshing…
          </span>
        )}
      </header>

      <section className="pf-summary-grid">
        <div className="pf-summary-card">
          <span className="pf-summary-label">Starting cash</span>
          <span className="pf-summary-value price">{fmt.format(status.starting_cash)}</span>
        </div>
        <div className="pf-summary-card">
          <span className="pf-summary-label">Base currency</span>
          <span className="pf-summary-value">{status.base_currency}</span>
        </div>
        <div className="pf-summary-card">
          <span className="pf-summary-label">Experience</span>
          <span className="pf-summary-value" style={{ textTransform: 'capitalize' }}>
            {prefs.experience || '—'}
          </span>
        </div>
      </section>

      <section className="pf-summary-grid">
        <div className="pf-summary-card">
          <span className="pf-summary-label">Intent</span>
          <span className="pf-summary-value" style={{ textTransform: 'capitalize' }}>
            {prefs.intent === 'both' ? 'Investing & Trading' : prefs.intent === 'invest' ? 'Investing' : prefs.intent === 'trade' ? 'Trading' : '—'}
          </span>
        </div>
        <div className="pf-summary-card">
          <span className="pf-summary-label">Signal notifications</span>
          <span className="pf-summary-value">
            {settings?.tradeSignals === false ? 'Off' : 'On'}
          </span>
        </div>
      </section>

      {followed.length > 0 && (
        <section className="pf-summary-card">
          <span className="pf-summary-label">Followed strategies</span>
          <div className="pf-chips">
            {followed.map((name) => (
              <span key={name} className="pf-chip">{name}</span>
            ))}
          </div>
        </section>
      )}

      <section className="pf-empty">
        <span className="pf-empty-icon"><Wallet size={22} strokeWidth={1.75} /></span>
        <h2 className="pf-empty-title">Portfolio tracking is being rebuilt.</h2>
        <p className="pf-empty-sub">
          Your setup is saved. Trades, holdings, and the performance chart will return in a simpler form.
        </p>
      </section>
    </div>
  );
}
