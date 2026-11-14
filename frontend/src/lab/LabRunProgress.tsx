// LabRunProgress.tsx — the small window that opens when Run starts.
//
// Pyodide runs the strategy in one synchronous call, so the engine cannot
// report a percentage yet. The window shows the stage the worker is on and a
// live seconds counter, then hands over to the report when the payload lands.

import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import Button from '../ui/Button';
import './LabRunProgress.css';

interface LabRunProgressProps {
  stage: string;
  startedAt: number;
  error?: string | null;
  onClose: () => void;
  onCancel: () => void;
}

export default function LabRunProgress({ stage, startedAt, error, onClose, onCancel }: LabRunProgressProps) {
  const [seconds, setSeconds] = useState(() => Math.max(0, (Date.now() - startedAt) / 1000));

  useEffect(() => {
    if (error) return;
    const timer = window.setInterval(() => {
      setSeconds(Math.max(0, (Date.now() - startedAt) / 1000));
    }, 100);
    return () => window.clearInterval(timer);
  }, [startedAt, error]);

  return (
    <div
      className="lab-run-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && error) onClose();
      }}
    >
      <section className="lab-run-window" role="dialog" aria-modal="true" aria-labelledby="lab-run-title">
        <header className="lab-run-head">
          <div>
            <p className="lab-run-kicker">Backtest running</p>
            <h2 className="lab-run-title" id="lab-run-title">Your strategy is running</h2>
          </div>
          {error && (
            <Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}>
              <X size={18} aria-hidden="true" />
            </Button>
          )}
        </header>

        <div className="lab-run-body">
          {error ? (
            <>
              <p className="lab-run-error">{error}</p>
              <p className="lab-run-note">The traceback is in LOGS under the editor.</p>
              <Button variant="secondary" size="sm" onClick={onClose}>Back to the editor</Button>
            </>
          ) : (
            <>
              <div className="lab-run-stage">
                <Loader2 size={18} className="lab-run-spinner" aria-hidden="true" />
                <span>{stage}</span>
              </div>
              <div className="lab-run-track" aria-hidden="true">
                <span className="lab-run-bar" />
              </div>
              <p className="lab-run-time">
                <strong>{seconds.toFixed(1)}</strong> seconds elapsed
              </p>
              <p className="lab-run-note">
                The first run can take longer while market data warms up. The report opens here
                when the strategy finishes.
              </p>
              <Button variant="secondary" size="sm" onClick={onCancel}>
                Cancel run
              </Button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
