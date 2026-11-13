// LabRunSettings.tsx — the dates and trading costs a Lab run uses.
//
// The dialog starts at the engine defaults, keeps the fields as strings while
// it is open, and validates them before handing the values back.

import { useEffect, useState } from 'react';
import { RotateCcw, Settings2 } from 'lucide-react';
import Button from '../ui/Button';
import Checkbox from '../ui/Checkbox';
import DatePicker from '../ui/DatePicker';
import Input from '../ui/Input';
import {
  defaultLabRunSettings,
  validateLabRunSettings,
  type LabRunSettings,
} from './runSettings';
import './LabRunSettings.css';

interface LabRunSettingsDialogProps {
  value: LabRunSettings;
  onApply: (settings: LabRunSettings) => void;
  onClose: () => void;
}

export default function LabRunSettingsDialog({
  value,
  onApply,
  onClose,
}: LabRunSettingsDialogProps) {
  const [draft, setDraft] = useState<LabRunSettings>(value);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const update = <Key extends keyof LabRunSettings>(key: Key, next: LabRunSettings[Key]) => {
    setDraft((current) => ({ ...current, [key]: next }));
    setError(null);
  };

  const apply = () => {
    const problem = validateLabRunSettings(draft);
    if (problem) {
      setError(problem);
      return;
    }
    onApply(draft);
    onClose();
  };

  return (
    <div
      className="lab-run-settings-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="lab-run-settings"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lab-run-settings-title"
      >
        <header className="lab-run-settings-head">
          <span className="lab-run-settings-icon" aria-hidden="true">
            <Settings2 size={16} />
          </span>
          <div>
            <h2 id="lab-run-settings-title" className="lab-run-settings-title">
              Backtest settings
            </h2>
            <p className="lab-run-settings-sub">
              Dates and trading costs for the next run. These are remembered for
              the next time you open the Lab.
            </p>
          </div>
        </header>

        <div className="lab-run-settings-body">
          <section className="lab-run-settings-section">
            <h3 className="lab-run-settings-heading">Dates</h3>
            <div className="lab-run-settings-grid">
              <DatePicker
                id="lab-run-start"
                label="Start date"
                value={draft.start}
                onChange={(next) => update('start', next)}
              />
              <div className="lab-run-settings-end">
                <DatePicker
                  id="lab-run-end"
                  label="End date (optional)"
                  value={draft.end}
                  onChange={(next) => update('end', next)}
                />
                {draft.end && (
                  <Button variant="ghost" size="sm" onClick={() => update('end', '')}>
                    Latest data
                  </Button>
                )}
              </div>
            </div>
            <p className="lab-run-settings-hint">
              Leave the end date empty to run to the latest bar.
            </p>
          </section>

          <section className="lab-run-settings-section">
            <h3 className="lab-run-settings-heading">Trading costs</h3>
            <div className="lab-run-settings-grid">
              <Input
                label="Fee per trade (%)"
                type="number"
                min="0"
                step="0.01"
                value={draft.feePct}
                onChange={(event) => update('feePct', event.target.value)}
              />
              <Input
                label="Slippage (%)"
                type="number"
                min="0"
                step="0.01"
                value={draft.slippagePct}
                onChange={(event) => update('slippagePct', event.target.value)}
              />
              <Input
                label="Spread (%)"
                type="number"
                min="0"
                step="0.01"
                value={draft.spreadPct}
                onChange={(event) => update('spreadPct', event.target.value)}
              />
              <Input
                label="Max participation (%)"
                type="number"
                min="0"
                max="100"
                step="1"
                placeholder="No cap"
                value={draft.participationPct}
                onChange={(event) => update('participationPct', event.target.value)}
              />
              <Input
                label="Borrow rate (% a year)"
                type="number"
                min="0"
                step="0.1"
                value={draft.borrowPct}
                onChange={(event) => update('borrowPct', event.target.value)}
              />
            </div>
            <Checkbox
              label="Include dividends"
              description="Pay dividends to lots held from the previous close."
              checked={draft.dividends}
              onChange={(event) => update('dividends', event.target.checked)}
            />
          </section>

          {error && <p className="lab-run-settings-error" role="alert">{error}</p>}

          <p className="lab-run-settings-note">
            These apply when Run builds the backtest for you. A file that calls
            Backtester itself keeps the dates and costs it sets in code.
          </p>
        </div>

        <footer className="lab-run-settings-foot">
          <Button
            variant="ghost"
            size="md"
            onClick={() => {
              setDraft(defaultLabRunSettings());
              setError(null);
            }}
          >
            <RotateCcw size={14} aria-hidden="true" />
            Defaults
          </Button>
          <div className="lab-run-settings-foot-end">
            <Button variant="secondary" size="md" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="md" onClick={apply}>
              Use these settings
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
