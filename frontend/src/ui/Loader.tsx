// Loader.tsx — Shared animated loader: a mini stock line that climbs, dips,
// and redraws. It is the app's one waiting symbol: a full-page waiting
// screen (cold loads and long fetches), a dimming overlay (writes), a panel
// loader (results areas), and an inline mark in buttons (busy actions).
import './Loader.css';

// The stock line itself: up, down, up. Every variant draws this same path,
// so the symbol is the same everywhere it appears.
const LINE_POINTS = '2,34 14,26 22,30 32,14 40,20 50,6 70,10';

export function Loader({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="loader" aria-busy="true">
      <svg className="loader-chart" width="72" height="40" viewBox="0 0 72 40" fill="none" aria-hidden="true">
        <polyline
          className="loader-line"
          points={LINE_POINTS}
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

/**
 * The waiting screen.
 *
 * Every long wait in the app lands here: the same stock line, centred in the
 * space the content is going to take. A page that is working says so instead
 * of showing an empty shell, and the symbol is the accent colour in both
 * themes because the stroke comes from the stylesheet.
 */
export function LoaderScreen({
  label,
  sub,
  compact = false,
}: {
  label: string;
  sub?: string;
  /** Tighter variant for slots that are only a stat row or a card wide. */
  compact?: boolean;
}) {
  return (
    <div
      className={`loader-screen${compact ? ' is-compact' : ''}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader label={label} sub={sub} />
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

/**
 * The stock line on its own, small enough to sit next to a label.
 *
 * It is drawn in the accent colour by default, so the waiting symbol reads
 * the same everywhere in both themes. Inside a filled button pass
 * tone="inherit": there the line takes the button's own text colour, because
 * an accent line on an accent fill would disappear.
 */
export function LoaderInline({
  size = 18,
  tone = 'accent',
}: {
  size?: number;
  tone?: 'accent' | 'inherit';
}) {
  return (
    <svg
      className="loader-inline"
      width={size}
      height={Math.round(size * 0.56)}
      viewBox="0 0 72 40"
      fill="none"
      aria-hidden="true"
    >
      <polyline
        className={`loader-line${tone === 'inherit' ? ' is-inherit' : ''}`}
        points={LINE_POINTS}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The stock line beside a short label — for a panel or list that is filling. */
export function LoaderRow({ label }: { label: string }) {
  return (
    <span className="loader-row" aria-busy="true">
      <LoaderInline size={22} />
      <span className="loader-row-label">{label}</span>
    </span>
  );
}
