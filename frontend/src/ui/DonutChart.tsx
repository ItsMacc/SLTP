// DonutChart.tsx — SVG donut chart for portfolio allocation
// Slices use a hand-picked palette that harmonizes with the app's
// accent (indigo in light / amber in dark) while staying distinguishable.
import './DonutChart.css';

export interface DonutSlice {
  label: string;
  value: number;
  color?: string;
}

interface DonutChartProps {
  slices: DonutSlice[];
  /** Text rendered in the hole (e.g. total value) */
  centerLabel?: string;
  centerValue?: string;
  size?: number;
}

const PALETTE = [
  'var(--donut-1)',
  'var(--donut-2)',
  'var(--donut-3)',
  'var(--donut-4)',
  'var(--donut-5)',
  'var(--donut-6)',
];

export default function DonutChart({ slices, centerLabel, centerValue, size = 180 }: DonutChartProps) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const radius = 100;
  const circumference = 2 * Math.PI * radius;

  // Build arcs with a small gap between slices for a crisp look
  let offset = 0;
  const arcs = slices.map((slice, i) => {
    const fraction = total > 0 ? slice.value / total : 0;
    const dash = Math.max(fraction * circumference - 3, 0.5);
    const arc = {
      ...slice,
      color: slice.color || PALETTE[i % PALETTE.length],
      dasharray: `${dash} ${circumference - dash}`,
      dashoffset: -offset,
      pct: fraction * 100,
    };
    offset += fraction * circumference;
    return arc;
  });

  return (
    <div className="donut" role="img" aria-label="Portfolio allocation">
      <div className="donut-svg-wrap" style={{ width: size, height: size }}>
        <svg viewBox="0 0 250 250" width="100%" height="100%">
          <circle cx="125" cy="125" r={radius} fill="none" stroke="var(--border-subtle)" strokeWidth="26" />
          {arcs.map((a, i) => (
            <circle
              key={i}
              cx="125"
              cy="125"
              r={radius}
              fill="none"
              stroke={a.color}
              strokeWidth="26"
              strokeDasharray={a.dasharray}
              strokeDashoffset={a.dashoffset}
              strokeLinecap="butt"
              transform="rotate(-90 125 125)"
              className="donut-arc"
            />
          ))}
        </svg>
        {(centerLabel || centerValue) && (
          <div className="donut-center">
            {centerLabel && <span className="donut-center-label">{centerLabel}</span>}
            {centerValue && <span className="donut-center-value price">{centerValue}</span>}
          </div>
        )}
      </div>

      <ul className="donut-legend">
        {arcs.map((a, i) => (
          <li key={i} className="donut-legend-item">
            <span className="donut-swatch" style={{ background: a.color }} />
            <span className="donut-legend-label">{a.label}</span>
            <span className="donut-legend-pct">{a.pct.toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
