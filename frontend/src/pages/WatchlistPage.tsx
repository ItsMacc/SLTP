// WatchlistPage.tsx — the personal page: market overview, watched stocks,
// strategy signals and alerts. Frontend-only: quotes come from the existing
// market-data endpoints and everything the user owns lives in this browser,
// so no backend change was needed to build it.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, BellRing, Newspaper, Plus, Radar, X } from 'lucide-react';
import { getStockHistory, getTickerDirectory } from '../engine/sltpClient';
import { listStrategies, type StrategyCatalogEntry } from '../../lib/api';
import { BACKTESTS } from '../data/backtestResults';
import { STRATEGIES } from '../data/strategies';
import {
  loadWatchlistItems,
  loadWatchlistSetup,
  saveWatchlistItems,
  saveWatchlistSetup,
  type WatchlistSetup,
} from '../../lib/watchlistStore';
import WatchlistOnboarding from './WatchlistOnboarding';
import { LoaderInline } from '../ui/Loader';
import Button from '../ui/Button';
import Input from '../ui/Input';
import './WatchlistPage.css';

interface WatchlistPageProps {
  userId?: string | null;
  /** Live Supabase settings (source of truth for notification booleans) */
  settings?: { tradeSignals?: boolean; [key: string]: any } | null;
  onNavigate: (tab: string) => void;
}

interface Quote {
  ticker: string;
  label: string;
  last: number;
  changePct: number;
  spark: number[];
  stale: boolean;
}

const MARKET_TICKERS = [
  { ticker: 'SPY', label: 'S&P 500' },
  { ticker: 'QQQ', label: 'Nasdaq 100' },
  { ticker: 'DIA', label: 'Dow Jones' },
  { ticker: 'IWM', label: 'Russell 2000' },
];

const ITEMS_MAX = 30;

/* ---------- tiny helpers ---------- */

function toQuote(ticker: string, label: string, closes: number[]): Quote | null {
  if (closes.length < 2) return null;
  const last = closes[closes.length - 1];
  const prev = closes[closes.length - 2];
  if (!Number.isFinite(last) || !Number.isFinite(prev) || prev === 0) return null;
  return {
    ticker,
    label,
    last,
    changePct: ((last - prev) / prev) * 100,
    spark: closes.slice(-60),
    stale: false,
  };
}

function Sparkline({ points, positive }: { points: number[]; positive: boolean }) {
  const path = useMemo(() => {
    if (points.length < 2) return '';
    const w = 96;
    const h = 28;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = max - min || 1;
    return points
      .map((v, i) => {
        const x = (i / (points.length - 1)) * w;
        const y = h - 2 - ((v - min) / span) * (h - 4);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [points]);
  if (!path) return null;
  return (
    <svg
      className={`wl-spark ${positive ? 'is-up' : 'is-down'}`}
      width="96"
      height="28"
      viewBox="0 0 96 28"
      aria-hidden="true"
    >
      <path d={path} fill="none" strokeWidth="1.5" />
    </svg>
  );
}

function fmtPct(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(2)}%`;
}

/* ---------- page ---------- */

export default function WatchlistPage({ userId, settings, onNavigate }: WatchlistPageProps) {
  const [setup, setSetup] = useState<WatchlistSetup | null>(() => loadWatchlistSetup(userId));
  const [items, setItems] = useState<string[]>(() => loadWatchlistItems(userId));
  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [directory, setDirectory] = useState<Set<string> | null>(null);

  const [market, setMarket] = useState<Quote[]>([]);
  const [marketLoading, setMarketLoading] = useState(true);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [quotesLoading, setQuotesLoading] = useState(false);

  const [catalog, setCatalog] = useState<StrategyCatalogEntry[]>([]);

  // First run after the wizard: the tickers picked there become the list.
  useEffect(() => {
    if (!setup) return;
    const stored = loadWatchlistItems(userId);
    if (stored.length === 0 && setup.items.length > 0) {
      setItems(setup.items);
      saveWatchlistItems(userId, setup.items);
    } else {
      setItems(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup !== null]);

  // The tradable directory, for naming rows and warning on typos.
  useEffect(() => {
    let cancelled = false;
    getTickerDirectory()
      .then((list) => {
        if (!cancelled) setDirectory(new Set(list.map((t) => t.ticker.toUpperCase())));
      })
      .catch(() => {
        // Without the directory the page still works; adds are unchecked.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Strategy catalog, for the follow toggles.
  useEffect(() => {
    let cancelled = false;
    listStrategies()
      .then((entries) => {
        if (!cancelled) setCatalog(entries);
      })
      .catch(() => {
        // The followed cards below still render from the static profiles.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Market overview: the four index funds, fetched once per visit.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const settled = await Promise.allSettled(
        MARKET_TICKERS.map(async ({ ticker, label }) => {
          const res = await getStockHistory(ticker, '1y');
          return toQuote(ticker, label, res.data.map((b) => b.close));
        }),
      );
      if (cancelled) return;
      setMarket(
        settled.flatMap((r, i) =>
          r.status === 'fulfilled' && r.value
            ? [r.value]
            : [{ ticker: MARKET_TICKERS[i].ticker, label: MARKET_TICKERS[i].label, last: NaN, changePct: NaN, spark: [], stale: true }],
        ),
      );
      setMarketLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Quotes for the user's own list.
  const refreshQuotes = useCallback(async (tickers: string[]) => {
    if (tickers.length === 0) {
      setQuotes({});
      return;
    }
    setQuotesLoading(true);
    const settled = await Promise.allSettled(
      tickers.map(async (ticker) => {
        const res = await getStockHistory(ticker, '1y');
        return toQuote(ticker, res.name || ticker, res.data.map((b) => b.close));
      }),
    );
    const next: Record<string, Quote> = {};
    settled.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value) next[tickers[i]] = r.value;
      else next[tickers[i]] = { ticker: tickers[i], label: tickers[i], last: NaN, changePct: NaN, spark: [], stale: true };
    });
    setQuotes(next);
    setQuotesLoading(false);
  }, []);

  useEffect(() => {
    void refreshQuotes(items);
  }, [items, refreshQuotes]);

  const addTicker = () => {
    const symbol = input.trim().toUpperCase();
    if (!symbol) return;
    if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol)) {
      setInputError('Use a plain ticker symbol, like AAPL.');
      return;
    }
    if (items.includes(symbol)) {
      setInputError(`${symbol} is already on your list.`);
      return;
    }
    if (items.length >= ITEMS_MAX) {
      setInputError(`The list holds ${ITEMS_MAX} symbols. Remove one first.`);
      return;
    }
    const next = [...items, symbol];
    setItems(next);
    saveWatchlistItems(userId, next);
    setInput('');
    setInputError(
      directory && !directory.has(symbol)
        ? `${symbol} is not in the tradable directory. Its row may stay empty.`
        : null,
    );
  };

  const removeTicker = (ticker: string) => {
    const next = items.filter((t) => t !== ticker);
    setItems(next);
    saveWatchlistItems(userId, next);
  };

  const toggleFollow = (id: string) => {
    setSetup((prev) => {
      if (!prev) return prev;
      const followed = prev.followed.includes(id)
        ? prev.followed.filter((s) => s !== id)
        : [...prev.followed, id];
      const next = { ...prev, followed };
      saveWatchlistSetup(userId, next);
      return next;
    });
  };

  if (!setup) {
    return (
      <WatchlistOnboarding
        userId={userId}
        onDone={() => setSetup(loadWatchlistSetup(userId))}
      />
    );
  }

  const followedProfiles = setup.followed
    .map((id) => STRATEGIES.find((s) => s.id === id))
    .filter((s): s is (typeof STRATEGIES)[number] => Boolean(s));
  const signalEmailsOn = settings?.tradeSignals !== false;

  return (
    <div className="wl-page">
      <header className="wl-header">
        <div>
          <span className="wl-header-kicker">Watchlist</span>
          <h1 className="wl-header-title">What you&apos;re watching</h1>
          <p className="wl-header-sub">
            Your stocks, the market around them, and what our strategies are doing.
            Built to build confidence before real money is involved.
          </p>
        </div>
      </header>

      {/* Market overview */}
      <section aria-labelledby="wl-market-title">
        <h2 id="wl-market-title" className="wl-section-title">The market today</h2>
        {marketLoading ? (
          <p className="wl-muted">
            <LoaderInline /> Reading the market…
          </p>
        ) : (
          <div className="wl-grid">
            {market.map((q) => (
              <div key={q.ticker} className="wl-card">
                <span className="wl-card-label">{q.label}</span>
                {q.stale ? (
                  <span className="wl-muted">Data unavailable.</span>
                ) : (
                  <>
                    <span className="wl-card-value price">${q.last.toFixed(2)}</span>
                    <span className={`wl-change ${q.changePct >= 0 ? 'is-up' : 'is-down'}`}>
                      {fmtPct(q.changePct)} today
                    </span>
                    <Sparkline points={q.spark} positive={q.changePct >= 0} />
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* User's stocks */}
      <section aria-labelledby="wl-stocks-title">
        <h2 id="wl-stocks-title" className="wl-section-title">Your stocks</h2>
        <div className="wl-add-row">
          <Input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setInputError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTicker();
              }
            }}
            placeholder="Add a ticker, e.g. AAPL"
            maxLength={12}
          />
          <Button variant="secondary" size="md" onClick={addTicker}>
            <Plus size={15} /> Add
          </Button>
        </div>
        {inputError && <p className="wl-error">{inputError}</p>}
        {items.length === 0 ? (
          <div className="wl-empty">
            <span className="wl-empty-icon"><Radar size={22} strokeWidth={1.75} /></span>
            <h3 className="wl-empty-title">No stocks yet.</h3>
            <p className="wl-empty-sub">
              Add a few symbols above. Each one gets a live quote, a trend line and
              its own slot in the news digest once that is wired.
            </p>
          </div>
        ) : (
          <ul className="wl-rows">
            {items.map((ticker) => {
              const q = quotes[ticker];
              return (
                <li key={ticker} className="wl-row">
                  <div className="wl-row-id">
                    <span className="wl-row-ticker">{ticker}</span>
                    <span className="wl-row-name">{q ? q.label : '…'}</span>
                  </div>
                  <div className="wl-row-quote">
                    {!q || quotesLoading ? (
                      <span className="wl-muted"><LoaderInline /></span>
                    ) : q.stale ? (
                      <span className="wl-muted">No data.</span>
                    ) : (
                      <>
                        <span className="wl-row-price price">${q.last.toFixed(2)}</span>
                        <span className={`wl-change ${q.changePct >= 0 ? 'is-up' : 'is-down'}`}>
                          {fmtPct(q.changePct)}
                        </span>
                        <Sparkline points={q.spark} positive={q.changePct >= 0} />
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    className="wl-row-remove"
                    aria-label={`Remove ${ticker}`}
                    onClick={() => removeTicker(ticker)}
                  >
                    <X size={15} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Strategy signals */}
      <section aria-labelledby="wl-signals-title">
        <h2 id="wl-signals-title" className="wl-section-title">Strategy signals</h2>
        <p className="wl-muted">
          What your followed strategies did in their latest reported window. Fresh
          signals arrive by email. Manage them in Settings.
        </p>
        {followedProfiles.length === 0 ? (
          <div className="wl-empty">
            <span className="wl-empty-icon"><BellRing size={22} strokeWidth={1.75} /></span>
            <h3 className="wl-empty-title">You follow no strategies.</h3>
            <p className="wl-empty-sub">
              Pick from the library below. Each one links to its full backtest, so
              you can see the record before trusting a signal.
            </p>
          </div>
        ) : (
          <div className="wl-grid">
            {followedProfiles.map((profile) => {
              const rows = BACKTESTS[profile.id];
              const latest = rows?.[rows.length - 1];
              const beat = latest ? latest.strategy.ending_value - latest.benchmark.ending_value : null;
              return (
                <div key={profile.id} className="wl-card">
                  <span className="wl-card-label">{profile.category}</span>
                  <span className="wl-card-value">{profile.name}</span>
                  {latest && beat !== null ? (
                    <span className={`wl-change ${beat >= 0 ? 'is-up' : 'is-down'}`}>
                      {beat >= 0 ? '+' : '−'}{Math.abs(beat).toFixed(1)} pts vs market · {latest.label}
                    </span>
                  ) : (
                    <span className="wl-muted">No reported window yet.</span>
                  )}
                  <div className="wl-card-actions">
                    <Button variant="link" size="sm" onClick={() => onNavigate('strategies')}>
                      Full backtest <ArrowRight size={13} />
                    </Button>
                    <button
                      type="button"
                      className="wl-unfollow"
                      onClick={() => toggleFollow(profile.id)}
                    >
                      Unfollow
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {catalog.length > 0 && (
          <details className="wl-follow-more">
            <summary>Follow more strategies</summary>
            <div className="wl-follow-list">
              {catalog.map((s) => {
                const on = setup.followed.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`wl-follow-item ${on ? 'is-on' : ''}`}
                    onClick={() => toggleFollow(s.id)}
                    aria-pressed={on}
                  >
                    <span className="wl-follow-name">{s.name}</span>
                    <span className="wl-follow-state">{on ? 'Following' : 'Follow'}</span>
                  </button>
                );
              })}
            </div>
          </details>
        )}
      </section>

      {/* News & alerts (boilerplate: alerts are live, digests are planned) */}
      <section aria-labelledby="wl-news-title">
        <h2 id="wl-news-title" className="wl-section-title">News &amp; alerts</h2>
        <div className="wl-grid">
          <div className="wl-card">
            <span className="wl-empty-icon"><Newspaper size={20} strokeWidth={1.75} /></span>
            <span className="wl-card-value">News digests</span>
            <p className="wl-muted">
              Per-ticker news is not wired yet. This slot will hold a short digest
              for each stock you watch.
            </p>
          </div>
          <div className="wl-card">
            <span className="wl-empty-icon"><BellRing size={20} strokeWidth={1.75} /></span>
            <span className="wl-card-value">Alerts you already have</span>
            <p className="wl-muted">
              Signal emails are {signalEmailsOn ? 'on' : 'off'}. Price-spike and
              morning-summary emails live in the same place.
            </p>
            <div className="wl-card-actions">
              <Button variant="secondary" size="md" onClick={() => onNavigate('settings')}>
                Manage alerts
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
