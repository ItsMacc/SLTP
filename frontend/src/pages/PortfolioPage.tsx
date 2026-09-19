// PortfolioPage.tsx — Portfolio view: onboarding gate + basic layout
import { useState, useEffect } from 'react';
import { Wallet } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getPortfolioStatus, getAvailableStrategies, type PortfolioStatus } from '../../lib/api';
import PortfolioOnboarding from './PortfolioOnboarding';
import './PortfolioPage.css';

interface PortfolioPageProps {
  defaultName?: string | null;
}

export default function PortfolioPage({ defaultName }: PortfolioPageProps) {
  const [status, setStatus] = useState<PortfolioStatus | null>(null);
  const [strategies, setStrategies] = useState<{ id: string; name: string; description: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadStatus = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not signed in');
      const [s, strategies_] = await Promise.all([
        getPortfolioStatus(token),
        getAvailableStrategies(token).catch(() => []),
      ]);
      setStatus(s);
      setStrategies(strategies_);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load portfolio');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStatus(); }, []);

  if (loading) {
    return (
      <div className="pf-page">
        <div className="pf-page-placeholder">
          <span className="pf-page-placeholder-text">Loading your portfolio…</span>
        </div>
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

  // First time (or not onboarded yet): show the setup wizard
  if (!status.onboarded) {
    return (
      <PortfolioOnboarding
        defaultName={defaultName}
        availableStrategies={strategies}
        onDone={loadStatus}
      />
    );
  }

  // Basic portfolio layout — we'll flesh this out later.
  const fmt = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: status.base_currency || 'USD',
    maximumFractionDigits: 2,
  });

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
          <span className="pf-summary-label">Holdings</span>
          <span className="pf-summary-value">0</span>
        </div>
      </section>

      <section className="pf-empty">
        <span className="pf-empty-icon"><Wallet size={22} strokeWidth={1.75} /></span>
        <h2 className="pf-empty-title">No positions yet.</h2>
        <p className="pf-empty-sub">
          Trades you record will show up here, with gain or loss on each holding.
        </p>
      </section>
    </div>
  );
}
