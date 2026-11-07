// WatchlistOnboarding.tsx — Setup wizard shown the first time a user opens Watchlist.
//
// Frontend-only: answers are kept in this browser under a per-account key, so
// no backend write happens here. When the visitor previously finished the old
// portfolio setup, its experience level and followed strategies are adopted
// instead of asking again.
import { useEffect, useMemo, useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import RadioGroup from '../ui/RadioGroup';
import { LoaderInline } from '../ui/Loader';
import { getSessionToken } from '../../lib/session';
import { getPortfolioStatus, listStrategies, type StrategyCatalogEntry } from '../../lib/api';
import { getTickerDirectory, type TickerInfo } from '../engine/sltpClient';
import {
  loadWatchlistSetup,
  saveWatchlistSetup,
  normalizeFollowed,
  type WatchlistSetup,
} from '../../lib/watchlistStore';
import './WatchlistOnboarding.css';

interface WatchlistOnboardingProps {
  userId?: string | null;
  onDone: () => void;
}

// The no-knowledge starter pack: one fund per row, each holding hundreds of
// companies, so a beginner watches the market without picking a stock.
const STARTERS = [
  { ticker: 'SPY', name: 'S&P 500', blurb: 'Five hundred large US companies in one fund.' },
  { ticker: 'QQQ', name: 'Nasdaq 100', blurb: 'A hundred large growth companies, heavy on tech.' },
  { ticker: 'DIA', name: 'Dow Jones', blurb: 'Thirty blue-chip stocks, the oldest index.' },
];

export default function WatchlistOnboarding({ userId, onDone }: WatchlistOnboardingProps) {
  const [step, setStep] = useState(0);
  const [checking, setChecking] = useState(true);

  // Answers collected across steps
  const [experience, setExperience] = useState('');
  const [goal, setGoal] = useState('');
  const [tickers, setTickers] = useState<string[]>([]);
  const [tickerInput, setTickerInput] = useState('');
  const [tickerError, setTickerError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  // The searchable directory for the ticker search box.
  const [directory, setDirectory] = useState<TickerInfo[] | null>(null);
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([]);

  const [catalog, setCatalog] = useState<StrategyCatalogEntry[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogUnavailable, setCatalogUnavailable] = useState(false);

  // A previous portfolio setup already answers the experience and follow
  // questions, so adopt it and skip the wizard instead of asking twice.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const existing = loadWatchlistSetup(userId);
        if (existing?.onboarded) {
          onDone();
          return;
        }
        const token = await getSessionToken().catch(() => null);
        if (token) {
          const status = await getPortfolioStatus(token).catch(() => null);
          if (!cancelled && status?.onboarded) {
            const prefs = status.preferences || {};
            const seeded: WatchlistSetup = {
              onboarded: true,
              experience:
                typeof prefs.experience === 'string' && prefs.experience ? prefs.experience : 'beginner',
              goal: 'both',
              followed: normalizeFollowed(prefs.followedStrategies),
              items: [],
            };
            saveWatchlistSetup(userId, seeded);
            onDone();
            return;
          }
        }
      } catch {
        // A failed seed just means the wizard asks from scratch.
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One fetch, then every keystroke filters in memory.
  useEffect(() => {
    let cancelled = false;
    getTickerDirectory()
      .then((list) => {
        if (!cancelled) setDirectory(list);
      })
      .catch(() => {
        // Without the directory the box falls back to plain symbol entry.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    listStrategies()
      .catch((): StrategyCatalogEntry[] => {
        if (!cancelled) setCatalogUnavailable(true);
        return [];
      })
      .then((entries) => {
        if (cancelled) return;
        setCatalog(entries);
        setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const totalSteps = 3;
  const canAdvance =
    (step === 0 && experience !== '' && goal !== '') || step === 1 || step === 2;

  // Symbol-first matches rank above name matches; already-added rows drop out.
  const matches = useMemo(() => {
    const query = tickerInput.trim().toUpperCase();
    if (!directory || query.length === 0) return [];
    const starts: TickerInfo[] = [];
    const contains: TickerInfo[] = [];
    for (const entry of directory) {
      const symbol = entry.ticker.toUpperCase();
      if (tickers.includes(symbol)) continue;
      if (symbol.startsWith(query)) starts.push(entry);
      else if (symbol.includes(query) || entry.name.toUpperCase().includes(query)) {
        contains.push(entry);
      }
      if (starts.length + contains.length >= 24) break;
    }
    return [...starts, ...contains].slice(0, 8);
  }, [directory, tickerInput, tickers]);

  const addSymbol = (raw: string) => {
    const symbol = raw.trim().toUpperCase();
    if (!symbol) return;
    if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(symbol)) {
      setTickerError('Use a plain ticker symbol, like AAPL.');
      return;
    }
    if (tickers.includes(symbol)) {
      setTickerError(`${symbol} is already on the list.`);
      return;
    }
    setTickers((prev) => [...prev, symbol]);
    setTickerInput('');
    setTickerError(null);
    setSearchOpen(false);
  };

  const addTicker = () => addSymbol(tickerInput);

  const onSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' && matches.length > 0) {
      e.preventDefault();
      setSearchOpen(true);
      setActiveIdx((i) => (i + 1) % matches.length);
    } else if (e.key === 'ArrowUp' && matches.length > 0) {
      e.preventDefault();
      setSearchOpen(true);
      setActiveIdx((i) => (i - 1 + matches.length) % matches.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchOpen && matches[activeIdx]) addSymbol(matches[activeIdx].ticker);
      else addTicker();
    } else if (e.key === 'Escape') {
      setSearchOpen(false);
    }
  };

  const followAll = () => {
    setSelectedStrategies((prev) =>
      prev.length === catalog.length && catalog.length > 0 ? [] : catalog.map((s) => s.id),
    );
  };

  const toggleStrategy = (id: string) => {
    setSelectedStrategies((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const handleFinish = () => {
    saveWatchlistSetup(userId, {
      onboarded: true,
      experience,
      goal,
      followed: selectedStrategies,
      items: tickers,
    });
    onDone();
  };

  if (checking) {
    return (
      <div className="wl-onboard">
        <div className="wl-onboard-card">
          <p className="wl-onboard-sub">
            <LoaderInline /> Checking for an existing setup…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="wl-onboard">
      <div className="wl-onboard-card">
        {/* Progress */}
        <div className="wl-onboard-progress" aria-hidden="true">
          {Array.from({ length: totalSteps }, (_, i) => (
            <span key={i} className={`wl-onboard-dot ${i <= step ? 'is-done' : ''}`} />
          ))}
        </div>
        <span className="wl-onboard-step-label">
          Step {step + 1} of {totalSteps}
        </span>

        {/* Step 0 — Experience & goal */}
        {step === 0 && (
          <div className="wl-onboard-step">
            <h1 className="wl-onboard-title">How do you invest?</h1>
            <p className="wl-onboard-sub">
              This shapes what we explain and which strategies we surface. Nothing here
              moves money; it only tunes the page.
            </p>
            <label className="wl-onboard-label">Your experience level</label>
            <RadioGroup
              name="experience"
              value={experience}
              onChange={(v) => setExperience(String(v))}
              direction="horizontal"
              options={[
                { label: 'Beginner', value: 'beginner' },
                { label: 'Intermediate', value: 'intermediate' },
                { label: 'Advanced', value: 'advanced' },
              ]}
            />
            <label className="wl-onboard-label" style={{ marginTop: 'var(--space-md)' }}>
              What brings you here?
            </label>
            <RadioGroup
              name="goal"
              value={goal}
              onChange={(v) => setGoal(String(v))}
              options={[
                { label: 'Follow the market', value: 'market', description: 'Quotes, movers and context on your stocks' },
                { label: 'Follow strategies', value: 'strategies', description: 'Signals from tested SLTP strategies' },
                { label: 'A bit of both', value: 'both', description: 'Market context plus strategy signals' },
              ]}
            />
          </div>
        )}

        {/* Step 1 — First tickers; beginners get a starter pack, not a blank box */}
        {step === 1 && (
          <div className="wl-onboard-step">
            {experience === 'beginner' ? (
              <>
                <h1 className="wl-onboard-title">New to the market? Start here.</h1>
                <p className="wl-onboard-sub">
                  You need zero ticker knowledge. Beginners usually start by watching
                  the whole market through a single fund — each one below holds
                  hundreds of companies at once.
                </p>
                <div className="wl-onboard-starters">
                  {STARTERS.map((s) => {
                    const added = tickers.includes(s.ticker);
                    return (
                      <div key={s.ticker} className="wl-onboard-starter">
                        <div>
                          <span className="wl-onboard-starter-name">
                            {s.ticker} · {s.name}
                          </span>
                          <span className="wl-onboard-starter-blurb">{s.blurb}</span>
                        </div>
                        <Button
                          variant={added ? 'ghost' : 'secondary'}
                          size="md"
                          onClick={() =>
                            added
                              ? setTickers((prev) => prev.filter((t) => t !== s.ticker))
                              : addSymbol(s.ticker)
                          }
                        >
                          {added ? 'Watching' : 'Watch'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
                <p className="wl-onboard-sub">
                  Know a company already? Search it below — anything else can wait.
                </p>
              </>
            ) : (
              <>
                <h1 className="wl-onboard-title">Name a few stocks to watch.</h1>
                <p className="wl-onboard-sub">
                  Search by company name or symbol. You can add and remove them anytime.
                </p>
              </>
            )}
            <div className="wl-onboard-search">
              <div className="wl-onboard-ticker-row">
                <Input
                  type="text"
                  value={tickerInput}
                  onChange={(e) => {
                    setTickerInput(e.target.value);
                    setTickerError(null);
                    setSearchOpen(true);
                    setActiveIdx(0);
                  }}
                  onKeyDown={onSearchKeyDown}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => setSearchOpen(false)}
                  placeholder={directory ? 'Try “Apple” or “AAPL”…' : 'e.g. AAPL'}
                  maxLength={40}
                  autoFocus={experience !== 'beginner'}
                  role="combobox"
                  aria-expanded={searchOpen && matches.length > 0}
                  aria-controls="wl-ticker-results"
                  aria-activedescendant={matches[activeIdx] ? `wl-result-${matches[activeIdx].ticker}` : undefined}
                />
                <Button variant="secondary" size="md" onClick={addTicker}>
                  Add
                </Button>
              </div>
              {searchOpen && matches.length > 0 && (
                <ul id="wl-ticker-results" className="wl-onboard-results" role="listbox">
                  {matches.map((m, i) => (
                    <li key={m.ticker} role="option" aria-selected={i === activeIdx} id={`wl-result-${m.ticker}`}>
                      <button
                        type="button"
                        className={`wl-onboard-result ${i === activeIdx ? 'is-active' : ''}`}
                        onMouseDown={(e) => {
                          // Fires before the input blur closes the list.
                          e.preventDefault();
                          addSymbol(m.ticker);
                        }}
                        onMouseEnter={() => setActiveIdx(i)}
                      >
                        <span className="wl-onboard-result-ticker">{m.ticker}</span>
                        <span className="wl-onboard-result-name">{m.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {tickerError && <div className="wl-onboard-error">{tickerError}</div>}
            {tickers.length > 0 && (
              <div className="wl-onboard-chips">
                {tickers.map((t) => (
                  <span key={t} className="wl-onboard-chip">
                    {t}
                    <button
                      type="button"
                      className="wl-onboard-chip-x"
                      aria-label={`Remove ${t}`}
                      onClick={() => setTickers((prev) => prev.filter((s) => s !== t))}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2 — Strategies & signals */}
        {step === 2 && (
          <div className="wl-onboard-step">
            <h1 className="wl-onboard-title">Follow any strategies?</h1>
            <p className="wl-onboard-sub">
              Followed strategies appear on your watchlist with their latest reported
              stance. Fresh signals arrive by email; you can change this later.
            </p>
            {experience === 'beginner' && catalog.length > 0 && (
              <div className="wl-onboard-callout">
                <p className="wl-onboard-callout-title">New to strategies? Learn by watching.</p>
                <p className="wl-onboard-callout-body">
                  Follow them all and see what each one does in practice — every
                  signal links the backtest behind it, and unfollowing takes one tap.
                </p>
                <Button variant="secondary" size="md" onClick={followAll}>
                  {selectedStrategies.length === catalog.length ? 'Unfollow all' : 'Follow all strategies'}
                </Button>
              </div>
            )}
            <div className="wl-onboard-strategies">
              {catalog.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`wl-onboard-strategy ${selectedStrategies.includes(s.id) ? 'is-selected' : ''}`}
                  onClick={() => toggleStrategy(s.id)}
                >
                  <span className="wl-onboard-strategy-name">{s.name}</span>
                  {s.description && (
                    <span className="wl-onboard-strategy-desc">{s.description}</span>
                  )}
                </button>
              ))}
              {catalogLoading && (
                <p className="wl-onboard-sub">Loading the strategy library…</p>
              )}
              {!catalogLoading && catalogUnavailable && (
                <p className="wl-onboard-sub">
                  Could not load the strategy library. You can follow strategies later
                  from the watchlist.
                </p>
              )}
            </div>
            <p className="wl-onboard-sub" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Signal emails are on by default — manage them anytime in Settings.
            </p>
          </div>
        )}

        {/* Navigation */}
        <div className="wl-onboard-actions">
          {step > 0 && (
            <Button variant="ghost" size="md" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          <span style={{ flex: 1 }} />
          {step < totalSteps - 1 ? (
            <Button variant="primary" size="md" onClick={() => setStep(step + 1)} disabled={!canAdvance}>
              Continue
            </Button>
          ) : (
            <Button variant="primary" size="md" onClick={handleFinish}>
              Start watching
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
