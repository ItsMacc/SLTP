// PortfolioOnboarding.tsx — Setup wizard shown the first time a user opens Portfolio
import { useEffect, useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import RadioGroup from '../ui/RadioGroup';
import { LoaderInline, LoaderOverlay } from '../ui/Loader';
import { completeSetup, listStrategies, type StrategyCatalogEntry } from '../../lib/api';
import './PortfolioOnboarding.css';

interface PortfolioOnboardingProps {
  defaultName?: string | null;
  onDone: () => void;
}

const CURRENCIES = [
  { label: 'USD — US Dollar', value: 'USD' },
  { label: 'CAD — Canadian Dollar', value: 'CAD' },
  { label: 'EUR — Euro', value: 'EUR' },
  { label: 'GBP — British Pound', value: 'GBP' },
  { label: 'INR — Indian Rupee', value: 'INR' },
];

export default function PortfolioOnboarding({ defaultName, onDone }: PortfolioOnboardingProps) {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Answers collected across steps
  const [portfolioName, setPortfolioName] = useState(defaultName ? `${defaultName}'s Portfolio` : 'My Portfolio');
  const [intent, setIntent] = useState('');
  const [experience, setExperience] = useState('');
  const [startingCash, setStartingCash] = useState('10000');
  const [currency, setCurrency] = useState('USD');
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([]);

  /* The wizard follows the engine registry rather than keeping its own list:
     a strategy the server no longer registers cannot be offered here. If the
     list cannot be read the step offers nothing, because following a strategy
     that does not exist is worse than following none. */
  const [catalog, setCatalog] = useState<StrategyCatalogEntry[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  // A failed read is not an empty registry, and the step says so differently.
  const [catalogUnavailable, setCatalogUnavailable] = useState(false);

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

  // Strategies matching the chosen intent: invest -> investing, trade -> trading,
  // both -> everything.
  const intentTypes: Record<string, string[]> = {
    invest: ['investing'],
    trade: ['trading'],
    both: ['investing', 'trading'],
  };
  const visibleStrategies = catalog.filter((s) =>
    (intentTypes[intent] ?? ['investing', 'trading']).includes(s.type),
  );

  // Drop any selected strategies that are no longer visible after an intent change
  const selectableIds = new Set(visibleStrategies.map((s) => s.id));

  const totalSteps = 4;
  const canAdvance =
    (step === 0 && portfolioName.trim().length > 0) ||
    (step === 1 && intent !== '' && experience !== '') ||
    (step === 2 && parseFloat(startingCash) > 0) ||
    step === 3;

  const toggleStrategy = (id: string) => {
    setSelectedStrategies((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  // Deselect strategies that no longer match the chosen intent
  useEffect(() => {
    setSelectedStrategies((prev) => prev.filter((sid) => selectableIds.has(sid)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent]);

  const handleFinish = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const { data: { session } } = await (await import('../../lib/supabase')).supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not signed in');
      await completeSetup(token, {
        name: portfolioName.trim(),
        starting_cash: parseFloat(startingCash),
        base_currency: currency,
        preferences: {
          intent,               // invest | trade | both
          experience,           // beginner | intermediate | advanced
          followedStrategies: selectedStrategies,
          onboardedAt: new Date().toISOString(),
        },
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pf-onboard">
      <div className="pf-onboard-card">
        {/* Progress */}
        <div className="pf-onboard-progress" aria-hidden="true">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <span key={i} className={`pf-onboard-dot ${i <= step ? 'is-done' : ''}`} />
          ))}
        </div>
        <span className="pf-onboard-step-label">
          Step {step + 1} of {totalSteps}
        </span>

        {/* Step 0 — Identity */}
        {step === 0 && (
          <div className="pf-onboard-step">
            <h1 className="pf-onboard-title">Welcome to your portfolio.</h1>
            <p className="pf-onboard-sub">
              Let's set things up so your tracking, signals, and performance work out of the box.
            </p>
            <label className="pf-onboard-label">What should we call this portfolio?</label>
            <Input
              type="text"
              value={portfolioName}
              onChange={(e) => setPortfolioName(e.target.value)}
              placeholder="e.g. Long-term Growth"
              maxLength={60}
              autoFocus
            />
          </div>
        )}

        {/* Step 1 — Intent & experience */}
        {step === 1 && (
          <div className="pf-onboard-step">
            <h1 className="pf-onboard-title">How will you use it?</h1>
            <p className="pf-onboard-sub">This shapes position sizing and which strategies we surface.</p>
            <RadioGroup
              name="intent"
              value={intent}
              onChange={(v) => setIntent(String(v))}
              options={[
                { label: 'Invest', value: 'invest', description: 'Long-term positions, fewer trades' },
                { label: 'Trade', value: 'trade', description: 'Active buying and selling on signals' },
                { label: 'A bit of both', value: 'both', description: 'Core holdings plus tactical trades' },
              ]}
            />
            <label className="pf-onboard-label" style={{ marginTop: 'var(--space-md)' }}>
              Your experience level
            </label>
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
          </div>
        )}

        {/* Step 2 — Capital */}
        {step === 2 && (
          <div className="pf-onboard-step">
            <h1 className="pf-onboard-title">Starting capital.</h1>
            <p className="pf-onboard-sub">
              This is virtual tracking capital. You can add more from your pocket anytime.
            </p>
            <div className="pf-onboard-capital-row">
              <div>
                <label className="pf-onboard-label">Starting cash</label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={startingCash}
                  onChange={(e) => setStartingCash(e.target.value)}
                />
              </div>
              <div>
                <label className="pf-onboard-label">Currency</label>
                <Select value={currency} onChange={(v) => setCurrency(String(v))} options={CURRENCIES} />
              </div>
            </div>
          </div>
        )}

        {/* Step 3 — Strategies & signals */}
        {step === 3 && (
          <div className="pf-onboard-step">
            <h1 className="pf-onboard-title">Follow any strategies?</h1>
            <p className="pf-onboard-sub">
              Pick SLTP strategies to follow, or just watch for signals. You can change this later.
            </p>
            <div className="pf-onboard-strategies">
              {visibleStrategies.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`pf-onboard-strategy ${selectedStrategies.includes(s.id) ? 'is-selected' : ''}`}
                  onClick={() => toggleStrategy(s.id)}
                >
                  <span className="pf-onboard-strategy-name">{s.name}</span>
                  <span className="pf-onboard-strategy-desc">{s.description}</span>
                </button>
              ))}
              {catalogLoading && (
                <p className="pf-onboard-sub">Loading the strategy library…</p>
              )}
              {!catalogLoading && catalogUnavailable && (
                <p className="pf-onboard-sub">
                  Could not load the strategy library. You can follow strategies later from
                  Settings.
                </p>
              )}
              {!catalogLoading && !catalogUnavailable && visibleStrategies.length === 0 && (
                <p className="pf-onboard-sub">No {intent === 'invest' ? 'investing' : 'trading'} strategies available yet — you can follow some later.</p>
              )}
            </div>
            <p className="pf-onboard-sub" style={{ marginTop: 'var(--space-md)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Signal notifications are on by default — you can manage them anytime in Settings.
            </p>
          </div>
        )}

        {error && <div className="pf-onboard-error">{error}</div>}

        {/* Navigation */}
        <div className="pf-onboard-actions">
          {step > 0 && (
            <Button variant="ghost" size="md" onClick={() => setStep(step - 1)} disabled={submitting}>
              Back
            </Button>
          )}
          <span style={{ flex: 1 }} />
          {step < totalSteps - 1 ? (
            <Button variant="primary" size="md" onClick={() => setStep(step + 1)} disabled={!canAdvance}>
              Continue
            </Button>
          ) : (
            <Button variant="primary" size="md" onClick={handleFinish} disabled={submitting}>
              {submitting ? (
                <>
                  <LoaderInline tone="inherit" />
                  Setting up…
                </>
              ) : 'Create portfolio'}
            </Button>
          )}
        </div>
      </div>

      {/* The portfolio is written to Turso before the wizard closes, which
          takes a moment, so the whole step waits behind the loader. */}
      {submitting && (
        <LoaderOverlay label="Creating your portfolio…" sub="Writing your setup to the account store." />
      )}
    </div>
  );
}
