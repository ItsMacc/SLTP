// Loader.tsx — Shared animated loader: a mini stock line that climbs, dips,
// and redraws. Used standalone (cold loads) and inside the dimming overlay
// (writes / long fetches).
import './Loader.css';

export function Loader({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="loader" aria-busy="true">
      <svg className="loader-chart" width="72" height="40" viewBox="0 0 72 40" fill="none" aria-hidden="true">
        <polyline
          className="loader-line"
          points="2,34 14,26 22,30 32,14 40,20 50,6 70,10"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="loader-label">{label}</span>
      {sub && <span className="loader-sub">{sub}</span>}
    </div>
  );
}

/** Full-screen dimming overlay with the loader centered. */
export function LoaderOverlay({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="loader-overlay" role="alert" aria-live="polite">
      <Loader label={label} sub={sub} />
    </div>
  );
}
