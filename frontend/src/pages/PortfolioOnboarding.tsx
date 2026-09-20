// PortfolioOnboarding.tsx — Setup wizard shown the first time a user opens Portfolio
import { useEffect, useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import RadioGroup from '../ui/RadioGroup';
import Checkbox from '../ui/Checkbox';
import { completeSetup } from '../../lib/api';
import './PortfolioOnboarding.css';

interface PortfolioOnboardingProps {
  defaultName?: string | null;
  onDone: () => void;
}

/**
 * Strategy catalog for the onboarding wizard. To surface a new strategy here,
 * just add an entry — it shows up automatically based on the user's intent:
 *   invest -> 'investing' strategies | trade -> 'trading' | both -> all
 */
const STRATEGY_CATALOG: { id: string; name: string; description: string; type: 'investing' | 'trading' }[] = [
  {
    id: 'stock-health-filter',
    name: 'Stock Health Filter',
    description: 'Momentum breakout strategy targeting high-velocity stocks with strong short-term price health.',
    type: 'trading',
  },
  // Add new strategies here, e.g.:
  // { id: 'dividend-aristocrats', name: 'Dividend Aristocrats', description: '...', type: 'investing' },
];

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
  const [wantsSignals, setWantsSignals] = useState(false);

  // Strategies matching the chosen intent: invest -> investing, trade -> trading,
  // both -> everything. Uses the local catalog; server list is a fallback filter.
  const intentTypes: Record<string, string[]> = {
    invest: ['investing'],
    trade: ['trading'],
    both: ['investing', 'trading'],
  };
  const visibleStrategies = STRATEGY_CATALOG.filter((s) =>
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
          wantsSignalNotifications: wantsSignals,
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
              {visibleStrategies.length === 0 && (
                <p className="pf-onboard-sub">No {intent === 'invest' ? 'investing' : 'trading'} strategies available yet — you can follow some later.</p>
              )}
            </div>
            <div className="pf-onboard-signal-check">
              <Checkbox
                checked={wantsSignals}
                onChange={(e) => setWantsSignals(e.target.checked)}
                label="Keep on the lookout for trade signals"
                description="We'll notify you when strategies hit buy/sell criteria"
              />
            </div>
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
              {submitting ? 'Setting up...' : 'Create portfolio'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
