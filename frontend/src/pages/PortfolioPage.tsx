// PortfolioPage.tsx — Onboarding gate + simple portfolio summary.
// All trades/positions/performance tracking UI was removed; this page shows
// the wizard answers saved during onboarding. Coming back soon.
import { useState, useEffect, useCallback } from 'react';
import { Wallet } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getPortfolioStatus, type PortfolioStatus } from '../../lib/api';
import PortfolioOnboarding from './PortfolioOnboarding';
import { Loader } from '../ui/Loader';
import './PortfolioPage.css';

interface PortfolioPageProps {
  defaultName?: string | null;
  /** Live Supabase settings (source of truth for notification booleans) */
  settings?: { tradeSignals?: boolean; [key: string]: any } | null;
}

export default function PortfolioPage({ defaultName, settings }: PortfolioPageProps) {
  const [status, setStatus] = useState<PortfolioStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not signed in');
      setStatus(await getPortfolioStatus(token));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load portfolio');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  if (loading) {
    return (
      <div className="pf-page">
        <Loader label="Loading your portfolio…" />
      </div>
    );
  }

  if (loadError || !status) {
    return (
      <div className="pf-page">
        <div className="pf-page-placeholder">
          <span className="pf-page-placeholder-text">{loadError || 'Portfolio unavailable.'}</span>
          <button type="button" className="pf-page-retry" onClick={loadStatus}>Try again</button>
        </div>
      </div>
    );
  }

  if (!status.onboarded) {
    return <PortfolioOnboarding defaultName={defaultName} onDone={loadStatus} />;
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
