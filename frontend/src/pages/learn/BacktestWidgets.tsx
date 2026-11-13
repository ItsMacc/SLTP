// BacktestWidgets.tsx — Interactive explanations for the Backtesting level.
// Each lesson gets a different format: ledger, story, comparison, simulator,
// receipt, results page or audit table. Charts appear only where the path is
// the thing being taught.

import { useId, useState } from 'react';
import type { WidgetId } from '../../learn/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function months(count: number, startYear = 2018, startMonth = 0): string[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(startYear, startMonth + index, 1);
    return `${MONTHS[date.getMonth()]} ${String(date.getFullYear()).slice(2)}`;
  });
}

function buildPath({
  count,
  start,
  drift,
  wave,
  phase,
  shockAt,
  shock = 0,
}: {
  count: number;
  start: number;
  drift: number;
  wave: number;
  phase: number;
  shockAt?: number;
  shock?: number;
}) {
  const values = [start];
  for (let index = 1; index < count; index += 1) {
    const move =
      drift +
      Math.sin(index * 0.72 + phase) * wave +
      Math.cos(index * 1.73 + phase * 0.6) * wave * 0.45 +
      (index === shockAt ? shock : 0);
    values.push(Math.max(1, Math.round(values[index - 1] * (1 + move))));
  }
  return values;
}

const money = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);

const percent = (value: number, digits = 1) => `${value > 0 ? '+' : ''}${value.toFixed(digits)}%`;

function worstDrawdown(values: number[]) {
  let peak = 0;
  let bestPeak = 0;
  let bestTrough = 0;
  let worst = 0;
  values.forEach((value, index) => {
    if (value > values[peak]) peak = index;
    const fall = ((values[peak] - value) / values[peak]) * 100;
    if (fall > worst) {
      worst = fall;
      bestPeak = peak;
      bestTrough = index;
    }
  });
  return { peak: bestPeak, trough: bestTrough, worst, low: values[bestTrough] };
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="widget-readout">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

interface ChartMarker {
  index: number;
  label: string;
  tone?: 'buy' | 'sell' | 'plain';
}

interface BacktestChartProps {
  labels: string[];
  series: number[];
  benchmark?: number[];
  markerIndex?: number;
  markers?: ChartMarker[];
  segments?: number[];
  segmentIndex?: number;
  showExtremes?: boolean;
  format?: (value: number) => string;
}

function BacktestChart({
  labels,
  series,
  benchmark,
  markerIndex,
  markers = [],
  segments,
  segmentIndex,
  showExtremes = false,
  format = money,
}: BacktestChartProps) {
  const width = 380;
  const height = 268;
  const left = 64;
  const right = 20;
  const top = 40;
  const bottom = 52;
  const all = benchmark ? [...series, ...benchmark] : series;
  const rawMin = Math.min(...all);
  const rawMax = Math.max(...all);
  const pad = Math.max(1, (rawMax - rawMin) * 0.1);
  const min = rawMin - pad;
  const max = rawMax + pad;
  const x = (index: number) =>
    left + (Math.min(index, labels.length - 1) / Math.max(1, labels.length - 1)) * (width - left - right);
  const y = (value: number) => top + ((max - value) / (max - min)) * (height - top - bottom);
  const points = (values: number[]) => values.map((value, index) => `${x(index)},${y(value)}`).join(' ');
  const highIndex = series.indexOf(Math.max(...series));
  const lowIndex = series.indexOf(Math.min(...series));
  const currentIndex = markerIndex ?? series.length - 1;
  const currentY = y(series[Math.min(currentIndex, series.length - 1)]);

  return (
    <div className="bt-chart-shell">
      <svg className="bt-chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Backtest chart with labelled start and end">
        {[0, 0.33, 0.66, 1].map((fraction) => {
          const value = max - fraction * (max - min);
          const yPosition = top + fraction * (height - top - bottom);
          return (
            <g key={fraction}>
              <line x1={left} y1={yPosition} x2={width - right} y2={yPosition} className="bt-grid" />
              <text x={left - 6} y={yPosition + 4} textAnchor="end" className="bt-label">
                {format(value)}
              </text>
            </g>
          );
        })}

        {segments?.map((boundary) => (
          <line
            key={boundary}
            x1={x(boundary)}
            y1={top}
            x2={x(boundary)}
            y2={height - bottom}
            className="bt-segment-line"
          />
        ))}

        {segments && segmentIndex !== undefined && segments[segmentIndex] !== undefined && (
          <rect
            x={x(segments[segmentIndex])}
            y={top}
            width={x(segments[segmentIndex + 1] ?? series.length - 1) - x(segments[segmentIndex])}
            height={height - top - bottom}
            className="bt-segment"
          />
        )}

        {benchmark && <polyline points={points(benchmark)} className="bt-line bt-line--bench" />}
        <polyline points={points(series)} className="bt-line" />

        <circle cx={x(0)} cy={y(series[0])} r="4" className="bt-dot bt-dot--start" />
        <circle cx={x(series.length - 1)} cy={y(series[series.length - 1])} r="4.5" className="bt-dot" />
        <text x={left} y={13} className="bt-label bt-label--strong">Start</text>
        <text x={left} y={28} className="bt-label">{format(series[0])}</text>
        <text x={width - right} y={13} textAnchor="end" className="bt-label bt-label--strong">End</text>
        <text x={width - right} y={28} textAnchor="end" className="bt-label">{format(series[series.length - 1])}</text>

        {showExtremes && highIndex !== series.length - 1 && (
          <>
            <circle cx={x(highIndex)} cy={y(series[highIndex])} r="4" className="bt-dot bt-dot--high" />
            <text
              x={x(highIndex)}
              y={y(series[highIndex]) - 9}
              textAnchor={highIndex > series.length / 2 ? 'end' : 'start'}
              className="bt-label bt-label--strong"
            >
              High {format(series[highIndex])}
            </text>
          </>
        )}

        {showExtremes && lowIndex !== 0 && (
          <>
            <circle cx={x(lowIndex)} cy={y(series[lowIndex])} r="4" className="bt-dot bt-dot--low" />
            <text
              x={x(lowIndex)}
              y={y(series[lowIndex]) + 18}
              textAnchor={lowIndex > series.length / 2 ? 'end' : 'start'}
              className="bt-label"
            >
              Low {format(series[lowIndex])}
            </text>
          </>
        )}

        {markers
          .filter((marker) => marker.index < series.length)
          .map((marker) => (
            <g key={`${marker.index}-${marker.label}`}>
              <line
                x1={x(marker.index)}
                y1={top}
                x2={x(marker.index)}
                y2={height - bottom}
                className="bt-marker-line"
              />
              <circle
                cx={x(marker.index)}
                cy={y(series[marker.index])}
                r="4"
                className={marker.tone === 'sell' ? 'bt-dot bt-dot--sell' : 'bt-dot'}
              />
              <text x={x(marker.index)} y={height - bottom + 16} textAnchor="middle" className="bt-label">
                {marker.label}
              </text>
            </g>
          ))}

        {markerIndex !== undefined && markerIndex >= 0 && markerIndex < series.length && (
          <>
            <line
              x1={x(markerIndex)}
              y1={top}
              x2={x(markerIndex)}
              y2={height - bottom}
              className="bt-current-line"
            />
            <circle cx={x(markerIndex)} cy={currentY} r="5" className="bt-dot bt-dot--current" />
            <text
              x={x(markerIndex)}
              y={currentY > top + 32 ? currentY - 11 : currentY + 21}
              textAnchor="middle"
              className="bt-label bt-label--strong"
            >
              Now
            </text>
          </>
        )}

        <line x1={left} y1={height - bottom} x2={width - right} y2={height - bottom} className="bt-axis" />
        <text x={left} y={height - 9} className="bt-label">
          {labels[0]}
        </text>
        <text x={width / 2} y={height - 9} textAnchor="middle" className="bt-label">
          {labels[Math.floor(labels.length / 2)]}
        </text>
        <text x={width - right} y={height - 9} textAnchor="end" className="bt-label">
          {labels[labels.length - 1]}
        </text>
      </svg>
      <div className="bt-legend">
        <span className="bt-key">Strategy</span>
        {benchmark && <span className="bt-key bt-key--bench">Benchmark</span>}
        {segments && <span className="bt-key bt-key--segment">Test window</span>}
      </div>
    </div>
  );
}

function StoryChart({
  series,
  benchmark,
  shade,
  markers,
}: {
  series: number[];
  benchmark?: number[];
  shade?: { start: number; end: number };
  markers: number[];
}) {
  const width = 380;
  const height = 176;
  const left = 8;
  const right = 8;
  const top = 12;
  const bottom = 12;
  const all = benchmark ? [...series, ...benchmark] : series;
  const rawMin = Math.min(...all);
  const rawMax = Math.max(...all);
  const pad = Math.max(1, (rawMax - rawMin) * 0.12);
  const min = rawMin - pad;
  const max = rawMax + pad;
  const x = (index: number) => left + (index / Math.max(1, series.length - 1)) * (width - left - right);
  const y = (value: number) => top + ((max - value) / (max - min)) * (height - top - bottom);
  const points = (values: number[]) => values.map((value, index) => `${x(index)},${y(value)}`).join(' ');

  return (
    <div className="bt-story-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Strategy and benchmark path with selected chapter marked">
        {[0, 0.5, 1].map((fraction) => (
          <line
            key={fraction}
            x1={left}
            y1={top + fraction * (height - top - bottom)}
            x2={width - right}
            y2={top + fraction * (height - top - bottom)}
            className="bt-grid"
          />
        ))}
        {shade && (
          <polygon
            points={`${points(series.slice(shade.start, shade.end + 1))} ${x(shade.end)},${height - bottom} ${x(shade.start)},${height - bottom}`}
            className="bt-drawdown-area"
          />
        )}
        {benchmark && <polyline points={points(benchmark)} className="bt-line bt-line--bench" />}
        <polyline points={points(series)} className="bt-line" />
        {markers.map((index) => (
          <circle key={index} cx={x(index)} cy={y(series[index])} r="4.5" className="bt-dot bt-dot--current" />
        ))}
        <circle cx={x(series.length - 1)} cy={y(series[series.length - 1])} r="4" className="bt-dot" />
      </svg>
      <div className="bt-legend">
        <span className="bt-key">Strategy</span>
        {benchmark && <span className="bt-key bt-key--bench">Benchmark</span>}
      </div>
    </div>
  );
}

const REPLAY = buildPath({ count: 40, start: 10000, drift: 0.0055, wave: 0.019, phase: 0.7, shockAt: 23, shock: -0.11 });
const REPLAY_LABELS = months(40);
const SCENE = {
  all: buildPath({ count: 40, start: 10000, drift: 0.005, wave: 0.018, phase: 1.2, shockAt: 22, shock: -0.09 }),
  large: buildPath({ count: 40, start: 10000, drift: 0.006, wave: 0.013, phase: 2.1, shockAt: 22, shock: -0.06 }),
  survivors: buildPath({ count: 40, start: 10000, drift: 0.008, wave: 0.012, phase: 3.4, shockAt: 22, shock: -0.03 }),
};
const EQUITY_PATH = buildPath({ count: 40, start: 10000, drift: 0.0065, wave: 0.019, phase: 1.8, shockAt: 18, shock: -0.12 });
const BENCH_PATH = buildPath({ count: 40, start: 10000, drift: 0.004, wave: 0.012, phase: 3.2, shockAt: 18, shock: -0.06 });
const DRAWDOWN_PATH = buildPath({ count: 40, start: 10000, drift: 0.007, wave: 0.014, phase: 2.4, shockAt: 16, shock: -0.16 });
const TOUR_PATH = buildPath({ count: 40, start: 10000, drift: 0.006, wave: 0.016, phase: 1.5, shockAt: 21, shock: -0.1 });
const TOUR_BENCH = buildPath({ count: 40, start: 10000, drift: 0.004, wave: 0.011, phase: 2.8, shockAt: 21, shock: -0.05 });
const BIAS_ALL = buildPath({ count: 40, start: 10000, drift: 0.005, wave: 0.014, phase: 0.3, shockAt: 25, shock: -0.13 });
const BIAS_SURVIVORS = buildPath({ count: 40, start: 10000, drift: 0.0075, wave: 0.011, phase: 0.3, shockAt: 25, shock: -0.05 });
const WALK_PATH = buildPath({ count: 48, start: 10000, drift: 0.0055, wave: 0.015, phase: 1.4, shockAt: 33, shock: -0.09 });

const TRADE_BOOK = (() => {
  let cash = 10000;
  return [
    { entry: 'Jan 18', exit: 'Feb 15', shares: 50, buy: 100, sell: 108, holding: 28 },
    { entry: 'Mar 01', exit: 'Mar 22', shares: 46, buy: 108, sell: 104, holding: 21 },
    { entry: 'Apr 12', exit: 'May 20', shares: 48, buy: 104, sell: 116, holding: 38 },
    { entry: 'Jun 03', exit: 'Jun 24', shares: 44, buy: 116, sell: 112, holding: 21 },
    { entry: 'Jul 08', exit: 'Aug 19', shares: 45, buy: 112, sell: 124, holding: 42 },
  ].map((trade) => {
    const profit = trade.shares * (trade.sell - trade.buy);
    cash += profit;
    return {
      ...trade,
      profit,
      returnPct: ((trade.sell - trade.buy) / trade.buy) * 100,
      cashAfter: cash,
    };
  });
})();

function BacktestReplay() {
  const [step, setStep] = useState(REPLAY.length - 1);
  const shown = REPLAY.slice(0, step + 1);

  return (
    <div className="learn-widget">
      <div className="widget-readouts">
        <Readout label="Month" value={REPLAY_LABELS[step]} />
        <Readout label="Account value" value={money(REPLAY[step])} />
        <Readout label="Change from start" value={percent(((REPLAY[step] - REPLAY[0]) / REPLAY[0]) * 100)} />
      </div>
      <BacktestChart labels={REPLAY_LABELS.slice(0, step + 1)} series={shown} markerIndex={step} />
      <div className="widget-controls">
        <button type="button" className="widget-btn widget-btn--quiet" onClick={() => setStep(0)}>
          Replay from start
        </button>
        <button
          type="button"
          className="widget-btn"
          disabled={step === REPLAY.length - 1}
          onClick={() => setStep((value) => Math.min(REPLAY.length - 1, value + 1))}
        >
          Next month
        </button>
      </div>
    </div>
  );
}

function BacktestScene() {
  const [universe, setUniverse] = useState<keyof typeof SCENE>('all');
  const [cash, setCash] = useState(10000);
  const path = SCENE[universe];
  const scaled = path.map((value) => Math.round((value / 10000) * cash));

  return (
    <div className="learn-widget">
      <div className="widget-readouts">
        <Readout label="Ending value" value={money(scaled[scaled.length - 1])} />
        <Readout label="Starting cash" value={money(cash)} />
        <Readout label="Final multiple" value={`${(scaled[scaled.length - 1] / cash).toFixed(2)}x`} />
      </div>
      <BacktestChart
        labels={REPLAY_LABELS}
        series={scaled}
        benchmark={BENCH_PATH.map((value) => Math.round((value / 10000) * cash))}
      />
      <label className="widget-label" htmlFor="backtest-cash">
        Starting cash: {money(cash)}
      </label>
      <input
        id="backtest-cash"
        className="widget-slider"
        type="range"
        min="5000"
        max="50000"
        step="5000"
        value={cash}
        onChange={(event) => setCash(Number(event.target.value))}
      />
      <div className="widget-controls" role="group" aria-label="Choose a stock universe">
        <button
          type="button"
          className={`widget-btn ${universe === 'all' ? 'is-selected' : ''}`}
          aria-pressed={universe === 'all'}
          onClick={() => setUniverse('all')}
        >
          All stocks
        </button>
        <button
          type="button"
          className={`widget-btn ${universe === 'large' ? 'is-selected' : ''}`}
          aria-pressed={universe === 'large'}
          onClick={() => setUniverse('large')}
        >
          Large caps
        </button>
        <button
          type="button"
          className={`widget-btn ${universe === 'survivors' ? 'is-selected' : ''}`}
          aria-pressed={universe === 'survivors'}
          onClick={() => setUniverse('survivors')}
        >
          Survivors only
        </button>
      </div>
    </div>
  );
}

function FirstRun() {
  const [index, setIndex] = useState(0);
  const trade = TRADE_BOOK[index];
  const totalProfit = TRADE_BOOK.reduce((sum, item) => sum + item.profit, 0);

  return (
    <div className="learn-widget bt-stack">
      <div className="bt-rule-box">
        <p className="bt-eyebrow">The rule</p>
        <p>Buy when the close crosses above the 20-day average. Sell when it closes below. Put about half the cash into each trade.</p>
      </div>

      <div className="bt-run-line">
        <span><em>Start</em> <strong>$10,000</strong></span>
        <span><em>Trades</em> <strong>5</strong></span>
        <span><em>Wins</em> <strong>3 / 2</strong></span>
        <span><em>Profit</em> <strong className="bt-positive">{money(totalProfit)}</strong></span>
      </div>

      <div className="bt-ledger" role="table" aria-label="Trade ledger">
        <div className="bt-ledger-head" role="row">
          <span role="columnheader">#</span>
          <span role="columnheader">Dates</span>
          <span role="columnheader">Buy / sell</span>
          <span role="columnheader">P&amp;L</span>
        </div>
        {TRADE_BOOK.map((item, number) => (
          <button
            type="button"
            role="row"
            key={item.entry}
            className={`bt-ledger-row ${index === number ? 'is-selected' : ''}`}
            aria-pressed={index === number}
            onClick={() => setIndex(number)}
          >
            <span role="cell">{number + 1}</span>
            <span role="cell">
              {item.entry} to {item.exit}
            </span>
            <span role="cell">
              {item.shares} sh @ ${item.buy} / ${item.sell}
            </span>
            <span role="cell" className={item.profit >= 0 ? 'bt-positive' : 'bt-negative'}>
              {item.profit >= 0 ? '+' : ''}
              {money(item.profit)}
            </span>
          </button>
        ))}
      </div>

      <div className="bt-ticket">
        <div className="bt-ticket-top">
          <div>
            <p className="bt-eyebrow">Trade {index + 1} of 5</p>
            <p className="bt-ticket-title">
              {trade.shares} shares at ${trade.buy}
            </p>
          </div>
          <span className={`bt-chip ${trade.profit >= 0 ? 'bt-chip--up' : 'bt-chip--down'}`}>
            {trade.profit >= 0 ? '+' : ''}
            {money(trade.profit)}
          </span>
        </div>
        <div className="bt-ticket-grid">
          <div>
            <span>Bought</span>
            <strong>
              {trade.entry}, ${trade.buy}
            </strong>
          </div>
          <div>
            <span>Sold</span>
            <strong>
              {trade.exit}, ${trade.sell}
            </strong>
          </div>
          <div>
            <span>Cash after</span>
            <strong>{money(trade.cashAfter)}</strong>
          </div>
          <div>
            <span>Holding time</span>
            <strong>{trade.holding} days</strong>
          </div>
        </div>
      </div>

    </div>
  );
}

function EquityCurveDetail() {
  const [chapter, setChapter] = useState<'start' | 'fall' | 'finish'>('start');
  const range = worstDrawdown(EQUITY_PATH);
  const benchRange = worstDrawdown(BENCH_PATH);
  const end = EQUITY_PATH[EQUITY_PATH.length - 1];
  const benchEnd = BENCH_PATH[BENCH_PATH.length - 1];
  const gap = ((end - benchEnd) / benchEnd) * 100;
  const chapters = {
    start: {
      label: '1. Start',
      date: REPLAY_LABELS[0],
      value: money(EQUITY_PATH[0]),
      title: 'The same $10,000, two paths',
      copy: 'Both lines start with $10,000. The dashed line is a broad benchmark. From here, the only fair question is which path you could actually hold.',
      marker: 0,
    },
    fall: {
      label: '2. The fall',
      date: REPLAY_LABELS[range.trough],
      value: money(range.low),
      title: `A ${range.worst.toFixed(1)}% fall`,
      copy: `The strategy dropped from ${money(EQUITY_PATH[range.peak])} to ${money(range.low)}. The benchmark fell ${benchRange.worst.toFixed(1)}%, so the rule took more pain on the way down.`,
      marker: range.trough,
    },
    finish: {
      label: '3. The finish',
      date: REPLAY_LABELS[REPLAY_LABELS.length - 1],
      value: money(end),
      title: `${money(end)} vs ${money(benchEnd)}`,
      copy: `The strategy finished ${money(end - benchEnd)} ahead. It earned that gap with a rougher middle, which is the part a final value hides.`,
      marker: EQUITY_PATH.length - 1,
    },
  } as const;
  const active = chapters[chapter];

  return (
    <div className="learn-widget bt-stack">
      <div className="widget-readouts">
        <Readout label="Strategy end" value={money(end)} />
        <Readout label="Benchmark end" value={money(benchEnd)} />
        <Readout label="Gap" value={percent(gap)} />
      </div>

      <StoryChart
        series={EQUITY_PATH}
        benchmark={BENCH_PATH}
        shade={chapter === 'fall' ? { start: range.peak, end: range.trough } : undefined}
        markers={[active.marker]}
      />

      <div className="bt-chapter-grid" role="group" aria-label="Choose a chapter of the equity curve">
        {(Object.keys(chapters) as Array<keyof typeof chapters>).map((key) => {
          const item = chapters[key];
          return (
            <button
              type="button"
              key={key}
              className={`bt-chapter ${chapter === key ? 'is-selected' : ''}`}
              aria-pressed={chapter === key}
              onClick={() => setChapter(key)}
            >
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.date}</small>
            </button>
          );
        })}
      </div>

      <div className="bt-story-copy">
        <p className="bt-eyebrow">{active.title}</p>
        <p>{active.copy}</p>
      </div>
    </div>
  );
}

function ReturnBreakdown() {
  const [mode, setMode] = useState<'total' | 'annual' | 'excess'>('total');
  const strategyTotal = 19.6;
  const benchmarkTotal = 25.2;
  const years = 3;
  const strategyAnnual = (Math.pow(1 + strategyTotal / 100, 1 / years) - 1) * 100;
  const benchmarkAnnual = (Math.pow(1 + benchmarkTotal / 100, 1 / years) - 1) * 100;
  const strategyEnd = 10000 * (1 + strategyTotal / 100);
  const benchmarkEnd = 10000 * (1 + benchmarkTotal / 100);
  const gap = strategyTotal - benchmarkTotal;
  const annualGap = strategyAnnual - benchmarkAnnual;
  const isAnnual = mode === 'annual';
  const max = isAnnual ? 10 : 30;
  const values = isAnnual
    ? { strategy: strategyAnnual, benchmark: benchmarkAnnual, gap: annualGap }
    : { strategy: strategyTotal, benchmark: benchmarkTotal, gap };

  return (
    <div className="learn-widget bt-stack">
      <div className="widget-readouts">
        <Readout label="You started" value="$10,000" />
        <Readout label="Strategy ended" value={money(strategyEnd)} />
        <Readout label="Benchmark ended" value={money(benchmarkEnd)} />
      </div>

      <div className="bt-compare">
        <div className="bt-compare-head">
          <span>{isAnnual ? 'Per year' : 'Over 3 years'}</span>
          <span className={values.gap >= 0 ? 'bt-positive' : 'bt-negative'}>
            Gap {values.gap > 0 ? '+' : ''}
            {values.gap.toFixed(1)} pts
          </span>
        </div>
        <div className="bt-compare-row">
          <div className="bt-compare-label">
            <span>Strategy</span>
            <strong>{percent(values.strategy)}</strong>
          </div>
          <div className="bt-compare-track">
            <span style={{ width: `${Math.max(2, (values.strategy / max) * 100)}%` }} />
          </div>
        </div>
        <div className="bt-compare-row bt-compare-row--bench">
          <div className="bt-compare-label">
            <span>Benchmark</span>
            <strong>{percent(values.benchmark)}</strong>
          </div>
          <div className="bt-compare-track">
            <span style={{ width: `${Math.max(2, (values.benchmark / max) * 100)}%` }} />
          </div>
        </div>
      </div>

      <div className="widget-controls" role="group" aria-label="Choose a return measure">
        <button
          type="button"
          className={`widget-btn ${mode === 'total' ? 'is-selected' : ''}`}
          aria-pressed={mode === 'total'}
          onClick={() => setMode('total')}
        >
          Total
        </button>
        <button
          type="button"
          className={`widget-btn ${mode === 'annual' ? 'is-selected' : ''}`}
          aria-pressed={mode === 'annual'}
          onClick={() => setMode('annual')}
        >
          Annualised
        </button>
        <button
          type="button"
          className={`widget-btn ${mode === 'excess' ? 'is-selected' : ''}`}
          aria-pressed={mode === 'excess'}
          onClick={() => setMode('excess')}
        >
          Excess
        </button>
      </div>

    </div>
  );
}

function DrawdownMap() {
  const [focus, setFocus] = useState<'peak' | 'trough' | 'recovery'>('trough');
  const range = worstDrawdown(DRAWDOWN_PATH);
  const recovery = DRAWDOWN_PATH.findIndex((value, index) => index > range.trough && value >= DRAWDOWN_PATH[range.peak]);
  const monthsToRecover = recovery >= 0 ? recovery - range.trough : null;
  const gainNeeded = ((1 / (1 - range.worst / 100)) - 1) * 100;
  const chapters = {
    peak: {
      label: '1. Peak',
      value: money(DRAWDOWN_PATH[range.peak]),
      date: REPLAY_LABELS[range.peak],
      title: 'The old high',
      copy: 'The fall is measured from this point, not from your entry. The account is worth $10,746 here.',
      marker: range.peak,
    },
    trough: {
      label: '2. Low',
      value: money(range.low),
      date: REPLAY_LABELS[range.trough],
      title: `Down ${range.worst.toFixed(1)}%`,
      copy: `The low is $9,204. Getting back to the old high needs a ${gainNeeded.toFixed(1)}% gain, which is why a deep fall is harder than it looks.`,
      marker: range.trough,
    },
    recovery: {
      label: '3. Recovery',
      value: monthsToRecover === null ? 'Not yet' : `${monthsToRecover} months`,
      date: recovery >= 0 ? REPLAY_LABELS[recovery] : 'After the test',
      title: 'Back to even',
      copy:
        monthsToRecover === null
          ? 'The account never regained its old high inside the test.'
          : `The old high returns ${monthsToRecover} months later. That is time the account spent below water.`,
      marker: recovery >= 0 ? recovery : DRAWDOWN_PATH.length - 1,
    },
  } as const;
  const active = chapters[focus];

  return (
    <div className="learn-widget bt-stack">
      <div className="widget-readouts">
        <Readout label="Maximum drawdown" value={`-${range.worst.toFixed(1)}%`} />
        <Readout label="Peak" value={money(DRAWDOWN_PATH[range.peak])} />
        <Readout label="Low" value={money(range.low)} />
        <Readout label="Recovery" value={monthsToRecover === null ? 'Not yet' : `${monthsToRecover} months`} />
      </div>

      <StoryChart
        series={DRAWDOWN_PATH}
        shade={{ start: range.peak, end: range.trough }}
        markers={[active.marker]}
      />

      <div className="bt-chapter-grid" role="group" aria-label="Choose a point in the drawdown">
        {(Object.keys(chapters) as Array<keyof typeof chapters>).map((key) => {
          const item = chapters[key];
          return (
            <button
              type="button"
              key={key}
              className={`bt-chapter ${focus === key ? 'is-selected' : ''}`}
              aria-pressed={focus === key}
              onClick={() => setFocus(key)}
            >
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.date}</small>
            </button>
          );
        })}
      </div>

      <div className="bt-story-copy">
        <p className="bt-eyebrow">{active.title}</p>
        <p>{active.copy}</p>
      </div>
    </div>
  );
}

const FUNDS = [
  { name: 'Calm fund', returnPct: 9.4, volatility: 5.6, note: 'Small monthly moves' },
  { name: 'Wild fund', returnPct: 9.4, volatility: 22.4, note: 'Large monthly swings' },
];

function RiskReturn() {
  const [cash, setCash] = useState(2);

  return (
    <div className="learn-widget bt-stack">
      <div className="bt-rule-box">
        <p className="bt-eyebrow">Same return, different ride</p>
        <p>Both funds turn $10,000 into $10,940. The question is how much movement you had to tolerate to get there.</p>
      </div>

      <div className="bt-fund-grid">
        {FUNDS.map((fund) => {
          const sharpe = (fund.returnPct - cash) / fund.volatility;
          return (
            <div className="bt-fund-card" key={fund.name}>
              <p className="bt-eyebrow">{fund.name}</p>
              <p className="bt-fund-return">{percent(fund.returnPct)}</p>
              <p className="bt-fund-note">$10,000 becomes $10,940</p>
              <div className="bt-fund-risk">
                <span>Typical swing</span>
                <strong>±{fund.volatility.toFixed(1)}%</strong>
              </div>
              <div className="bt-fund-track" aria-hidden="true">
                <span style={{ width: `${(fund.volatility / 24) * 100}%` }} />
              </div>
              <div className="bt-sharpe">
                <span>Sharpe</span>
                <strong>{sharpe.toFixed(2)}</strong>
              </div>
              <p className="bt-formula">
                ({fund.returnPct.toFixed(1)} - {cash}) / {fund.volatility.toFixed(1)} = {sharpe.toFixed(2)}
              </p>
            </div>
          );
        })}
      </div>

      <div className="widget-controls" role="group" aria-label="Choose a cash rate">
        {[0, 2, 4].map((rate) => (
          <button
            type="button"
            key={rate}
            className={`widget-btn ${cash === rate ? 'is-selected' : ''}`}
            aria-pressed={cash === rate}
            onClick={() => setCash(rate)}
          >
            Cash {rate}%
          </button>
        ))}
      </div>

    </div>
  );
}

function TradeStats() {
  const [winRate, setWinRate] = useState(70);
  const [avgWin, setAvgWin] = useState(3);
  const [avgLoss, setAvgLoss] = useState(1.5);
  const winId = useId();
  const winSizeId = useId();
  const lossSizeId = useId();
  const wins = Math.round(winRate);
  const losses = 100 - wins;
  const grossWin = wins * avgWin;
  const grossLoss = losses * avgLoss;
  const net = grossWin - grossLoss;
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : 0;
  const breakEven = (avgLoss / (avgWin + avgLoss)) * 100;
  const verdict = net > 0.01 ? 'Winning' : net < -0.01 ? 'Losing' : 'Break-even';

  return (
    <div className="learn-widget bt-stack">
      <div className="widget-readouts">
        <Readout label="Net per 100 trades" value={`${net >= 0 ? '+' : ''}${net.toFixed(1)}x risk`} />
        <Readout label="Profit factor" value={profitFactor.toFixed(2)} />
        <Readout label="Break-even win rate" value={`${breakEven.toFixed(0)}%`} />
        <Readout label="Verdict" value={verdict} />
      </div>

      <div className="bt-sim-bars">
        <div>
          <span>{wins} wins × {avgWin.toFixed(1)}x</span>
          <strong>+{grossWin.toFixed(1)}x</strong>
        </div>
        <div>
          <span>{losses} losses × {avgLoss.toFixed(1)}x</span>
          <strong className="bt-negative">-{grossLoss.toFixed(1)}x</strong>
        </div>
      </div>

      <div className="bt-sim-dots" aria-label={`${wins} winning trades and ${losses} losing trades out of 100`}>
        {Array.from({ length: 100 }, (_, index) => (
          <span key={index} className={(index * 37 + 11) % 100 < wins ? 'is-win' : 'is-loss'} />
        ))}
      </div>

      <div className="bt-math">
        <span>{wins} × {avgWin.toFixed(1)}x</span>
        <span>- {losses} × {avgLoss.toFixed(1)}x</span>
        <strong>
          = {net >= 0 ? '+' : ''}
          {net.toFixed(1)}x per 100 trades
        </strong>
      </div>

      <div className="bt-slider-stack">
        <label className="widget-label" htmlFor={winId}>
          Win rate: {winRate}%
        </label>
        <input
          id={winId}
          className="widget-slider"
          type="range"
          min="5"
          max="95"
          step="5"
          value={winRate}
          onChange={(event) => setWinRate(Number(event.target.value))}
        />
        <label className="widget-label" htmlFor={winSizeId}>
          Average win: {avgWin.toFixed(1)}x risk
        </label>
        <input
          id={winSizeId}
          className="widget-slider"
          type="range"
          min="0.5"
          max="12"
          step="0.5"
          value={avgWin}
          onChange={(event) => setAvgWin(Number(event.target.value))}
        />
        <label className="widget-label" htmlFor={lossSizeId}>
          Average loss: {avgLoss.toFixed(1)}x risk
        </label>
        <input
          id={lossSizeId}
          className="widget-slider"
          type="range"
          min="0.5"
          max="8"
          step="0.5"
          value={avgLoss}
          onChange={(event) => setAvgLoss(Number(event.target.value))}
        />
      </div>

      <div className="widget-controls">
        <button
          type="button"
          className="widget-btn widget-btn--quiet"
          onClick={() => {
            setWinRate(70);
            setAvgWin(3);
            setAvgLoss(1.5);
          }}
        >
          70% wins, 3x vs 1.5x
        </button>
        <button
          type="button"
          className="widget-btn widget-btn--quiet"
          onClick={() => {
            setWinRate(30);
            setAvgWin(10);
            setAvgLoss(1);
          }}
        >
          30% wins, 10x vs 1x
        </button>
      </div>

    </div>
  );
}

const COST_LEVELS = [
  { key: 'none', label: 'No costs', commission: 0, spread: 0, slippage: 0 },
  { key: 'commission', label: 'Commission', commission: 126, spread: 84, slippage: 0 },
  { key: 'full', label: 'Commission + slippage', commission: 126, spread: 84, slippage: 144 },
] as const;

function CostDrag() {
  const [level, setLevel] = useState<(typeof COST_LEVELS)[number]['key']>('full');
  const gross = 12184;
  const selected = COST_LEVELS.find((item) => item.key === level) ?? COST_LEVELS[2];
  const totalCosts = selected.commission + selected.spread + selected.slippage;
  const net = gross - totalCosts;
  const drag = (totalCosts / gross) * 100;

  return (
    <div className="learn-widget bt-stack">
      <div className="bt-receipt">
        <div className="bt-receipt-head">
          <div>
            <p className="bt-eyebrow">Cost receipt</p>
            <p>38 round trips · {drag.toFixed(1)}% drag</p>
          </div>
          <strong className="bt-positive">{money(net)}</strong>
        </div>
        <div className="bt-receipt-row">
          <span>Gross result</span>
          <strong>{money(gross)}</strong>
        </div>
        <div className="bt-receipt-row">
          <span>Commission</span>
          <strong className="bt-negative">-{money(selected.commission)}</strong>
        </div>
        <div className="bt-receipt-row">
          <span>Spread</span>
          <strong className="bt-negative">-{money(selected.spread)}</strong>
        </div>
        <div className="bt-receipt-row">
          <span>Slippage</span>
          <strong className="bt-negative">-{money(selected.slippage)}</strong>
        </div>
        <div className="bt-receipt-row bt-receipt-total">
          <span>Net kept</span>
          <strong>{money(net)}</strong>
        </div>
      </div>

      <div className="bt-cost-strip" aria-hidden="true">
        <span className="bt-cost-strip--net" style={{ width: `${(net / gross) * 100}%` }} />
        <span className="bt-cost-strip--cost" style={{ width: `${(totalCosts / gross) * 100}%` }} />
      </div>

      <div className="widget-controls" role="group" aria-label="Choose a cost level">
        {COST_LEVELS.map((item) => (
          <button
            type="button"
            key={item.key}
            className={`widget-btn ${level === item.key ? 'is-selected' : ''}`}
            aria-pressed={level === item.key}
            onClick={() => setLevel(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

    </div>
  );
}

const METRICS = (() => {
  const range = worstDrawdown(TOUR_PATH);
  const end = TOUR_PATH[TOUR_PATH.length - 1];
  const bench = TOUR_BENCH[TOUR_BENCH.length - 1];
  return [
    {
      key: 'end',
      label: 'End value',
      value: money(end),
      says: `The account started at $10,000 and ended at ${money(end)}.`,
      check: 'Confirm the ending price, the open positions and whether costs are included.',
    },
    {
      key: 'return',
      label: 'Total return',
      value: percent(((end - 10000) / 10000) * 100),
      says: `The account gained ${percent(((end - 10000) / 10000) * 100)} over the whole test.`,
      check: 'Read the dates before the percentage, and check that the return is net of costs.',
    },
    {
      key: 'benchmark',
      label: 'Benchmark',
      value: percent(((bench - 10000) / 10000) * 100),
      says: `A simple benchmark gained ${percent(((bench - 10000) / 10000) * 100)} over the same period.`,
      check: 'The benchmark must use the same dates, cash and costs. A different scene is a different question.',
    },
    {
      key: 'excess',
      label: 'Excess return',
      value: percent(((end - bench) / bench) * 100),
      says: `The strategy finished ${percent(((end - bench) / bench) * 100)} ahead of the benchmark.`,
      check: 'A small gap can disappear after a worse fill or a different cost assumption.',
    },
    {
      key: 'drawdown',
      label: 'Worst fall',
      value: `-${range.worst.toFixed(1)}%`,
      says: `The deepest fall from a high was ${range.worst.toFixed(1)}%, from ${money(TOUR_PATH[range.peak])} to ${money(range.low)}.`,
      check: 'Look at the dates and the time below the old high, not only the depth.',
    },
    {
      key: 'sharpe',
      label: 'Sharpe',
      value: '0.58',
      says: 'The return above cash was about 0.58 times the movement taken to earn it.',
      check: 'Compare it with the drawdown and the sample. A calm average can hide a rare crash.',
    },
    {
      key: 'profit',
      label: 'Profit factor',
      value: '1.24',
      says: 'Total wins were about 1.24 times total losses.',
      check: 'Check whether one large winner is carrying the ratio.',
    },
    {
      key: 'trades',
      label: 'Trades',
      value: '28',
      says: 'The result is built on 28 closed trades.',
      check: 'Ask whether the sample includes different market moods, not just different months.',
    },
  ];
})();

function SnapshotChart({ series, benchmark }: { series: number[]; benchmark: number[] }) {
  const width = 380;
  const height = 150;
  const left = 6;
  const right = 6;
  const top = 10;
  const bottom = 10;
  const all = [...series, ...benchmark];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const pad = Math.max(1, (max - min) * 0.1);
  const x = (index: number) => left + (index / Math.max(1, series.length - 1)) * (width - left - right);
  const y = (value: number) => top + ((max + pad - value) / (max - min + pad * 2)) * (height - top - bottom);
  const points = (values: number[]) => values.map((value, index) => `${x(index)},${y(value)}`).join(' ');

  return (
    <div className="bt-snapshot-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Sample backtest equity curve with benchmark">
        {[0, 0.5, 1].map((fraction) => (
          <line
            key={fraction}
            x1={left}
            y1={top + fraction * (height - top - bottom)}
            x2={width - right}
            y2={top + fraction * (height - top - bottom)}
            className="bt-grid"
          />
        ))}
        <polyline points={points(benchmark)} className="bt-line bt-line--bench" />
        <polyline points={points(series)} className="bt-line" />
        <circle cx={x(series.length - 1)} cy={y(series[series.length - 1])} r="4" className="bt-dot" />
      </svg>
    </div>
  );
}

function ResultsTour() {
  const [selected, setSelected] = useState('end');
  const metric = METRICS.find((item) => item.key === selected) ?? METRICS[0];

  return (
    <div className="learn-widget bt-stack">
      <div className="bt-results-panel">
        <div className="bt-results-head">
          <div>
            <p className="bt-eyebrow">Momentum 20</p>
            <p className="bt-results-title">Backtest result</p>
          </div>
          <span className="bt-results-period">Jan 18 to Apr 21</span>
        </div>

        <SnapshotChart series={TOUR_PATH} benchmark={TOUR_BENCH} />
        <div className="bt-legend bt-results-legend">
          <span className="bt-key">Strategy</span>
          <span className="bt-key bt-key--bench">Benchmark</span>
          <span className="bt-results-net">Net of $0.12 per trade</span>
        </div>

        <div className="bt-metric-grid" role="group" aria-label="Choose a result metric">
          {METRICS.map((item) => (
            <button
              type="button"
              key={item.key}
              className={`bt-metric ${selected === item.key ? 'is-selected' : ''}`}
              aria-pressed={selected === item.key}
              onClick={() => setSelected(item.key)}
            >
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </button>
          ))}
        </div>
      </div>

      <div className="bt-metric-detail">
        <div className="bt-metric-detail-head">
          <p className="bt-eyebrow">Selected metric</p>
          <h4>{metric.label}</h4>
        </div>
        <p>
          <strong>What it says.</strong> {metric.says}
        </p>
        <p>
          <strong>What to check.</strong> {metric.check}
        </p>
      </div>

    </div>
  );
}

const AUDIT_ROWS = [
  { window: '10 days', inSample: 0.82, heldBack: 0.41 },
  { window: '15 days', inSample: 1.04, heldBack: 0.28 },
  { window: '18 days', inSample: 1.17, heldBack: 0.31 },
  { window: '25 days', inSample: 0.96, heldBack: 0.58 },
  { window: '33 days', inSample: 0.72, heldBack: 0.84 },
  { window: '45 days', inSample: 0.54, heldBack: 0.62 },
];
const BEST_IN_SAMPLE = AUDIT_ROWS.reduce((best, row) => (row.inSample > best.inSample ? row : best), AUDIT_ROWS[0]);
const BEST_HELD_BACK = AUDIT_ROWS.reduce((best, row) => (row.heldBack > best.heldBack ? row : best), AUDIT_ROWS[0]);

function OverfitSweep() {
  return (
    <div className="learn-widget bt-stack">
      <div className="bt-audit-caption">
        <span>41 window settings</span>
        <span>In-sample vs held-back</span>
      </div>

      <div className="bt-audit" role="table" aria-label="Parameter results in-sample and held-back">
        <div className="bt-audit-head" role="row">
          <span role="columnheader">Window</span>
          <span role="columnheader">In-sample</span>
          <span role="columnheader">Held-back</span>
          <span role="columnheader">Change</span>
        </div>
        {AUDIT_ROWS.map((row) => (
          <div
            className={`bt-audit-row ${row.window === BEST_IN_SAMPLE.window ? 'is-best' : ''}`}
            role="row"
            key={row.window}
          >
            <span role="cell">{row.window}</span>
            <span role="cell">{row.inSample.toFixed(2)}</span>
            <span role="cell" className={row.window === BEST_HELD_BACK.window ? 'bt-positive' : ''}>
              {row.heldBack.toFixed(2)}
            </span>
            <span role="cell" className={row.heldBack < row.inSample ? 'bt-negative' : 'bt-positive'}>
              {(row.heldBack - row.inSample).toFixed(2)}
            </span>
          </div>
        ))}
      </div>

    </div>
  );
}

function BiasCheck() {
  const [bias, setBias] = useState<'survivors' | 'lookahead'>('survivors');
  const markers: ChartMarker[] = bias === 'lookahead' ? [{ index: 17, label: 'Signal' }, { index: 31, label: 'Signal' }] : [];

  return (
    <div className="learn-widget">
      <div className="widget-readouts">
        <Readout label="Bias" value={bias === 'survivors' ? 'Survivorship' : 'Look-ahead'} />
        <Readout
          label="End value"
          value={money(bias === 'survivors' ? BIAS_SURVIVORS[BIAS_SURVIVORS.length - 1] : BIAS_ALL[BIAS_ALL.length - 1])}
        />
        <Readout label="Clue" value={bias === 'survivors' ? 'Only winners remain' : 'Signal is early'} />
      </div>
      <BacktestChart
        labels={REPLAY_LABELS}
        series={bias === 'survivors' ? BIAS_SURVIVORS : BIAS_ALL}
        benchmark={bias === 'survivors' ? BIAS_ALL : undefined}
        markers={markers}
        markerIndex={bias === 'lookahead' ? 31 : undefined}
      />
      <div className="widget-controls" role="group" aria-label="Choose a bias">
        <button
          type="button"
          className={`widget-btn ${bias === 'survivors' ? 'is-selected' : ''}`}
          aria-pressed={bias === 'survivors'}
          onClick={() => setBias('survivors')}
        >
          Survivorship bias
        </button>
        <button
          type="button"
          className={`widget-btn ${bias === 'lookahead' ? 'is-selected' : ''}`}
          aria-pressed={bias === 'lookahead'}
          onClick={() => setBias('lookahead')}
        >
          Look-ahead bias
        </button>
      </div>
    </div>
  );
}

const WALK_SEGMENTS = [0, 8, 16, 24, 32, 40, 48];
const WALK_LABELS = months(48);

function WalkForwardMap() {
  const [window, setWindow] = useState(2);
  const start = WALK_SEGMENTS[window];
  const end = WALK_SEGMENTS[window + 1];

  return (
    <div className="learn-widget">
      <div className="widget-readouts">
        <Readout label="Test window" value={`${window + 1} of 6`} />
        <Readout
          label="Period"
          value={`${WALK_LABELS[start]} to ${WALK_LABELS[Math.min(end - 1, WALK_LABELS.length - 1)]}`}
        />
        <Readout label="End value" value={money(WALK_PATH[Math.min(end, WALK_PATH.length - 1)])} />
      </div>
      <BacktestChart
        labels={WALK_LABELS}
        series={WALK_PATH}
        segments={WALK_SEGMENTS}
        segmentIndex={window}
        markerIndex={Math.min(end, WALK_PATH.length - 1)}
        showExtremes
      />
      <label className="widget-label" htmlFor="walk-window">
        Test window: {window + 1}
      </label>
      <input
        id="walk-window"
        className="widget-slider"
        type="range"
        min="0"
        max="5"
        value={window}
        onChange={(event) => setWindow(Number(event.target.value))}
      />
    </div>
  );
}

const CASE_COPY = [
  {
    title: 'Too smooth',
    flag: 'Overfitting',
    claim: 'The rule returned 33.4% over three years.',
    evidence: ['8 closed trades', 'Best setting: 18 days', 'Held-back score: 0.31'],
    verdict: 'Treat the peak as a candidate, not a discovery.',
  },
  {
    title: 'Too early',
    flag: 'Look-ahead bias',
    claim: 'The entry caught the low every time.',
    evidence: ['Signal at 3:59pm', 'Fill at the same close', 'Same-day price used'],
    verdict: 'Move the fill to the next available price.',
  },
  {
    title: 'Too lucky',
    flag: 'Survivorship bias',
    claim: 'The stock list beat the index by 6 points.',
    evidence: ['Only current index members', 'Failed companies excluded', 'No delisted names'],
    verdict: 'Rebuild the list with the companies that existed at the time.',
  },
];

function SkepticCards() {
  const [index, setIndex] = useState(0);
  const item = CASE_COPY[index];

  return (
    <div className="learn-widget bt-stack">
      <div className="bt-evidence-head">
        <div>
          <p className="bt-eyebrow">Case {index + 1} of 3</p>
          <p className="bt-results-title">{item.title}</p>
        </div>
        <span className="bt-chip bt-chip--down">{item.flag}</span>
      </div>

      <div className="bt-claim">
        <p className="bt-eyebrow">The claim</p>
        <p>{item.claim}</p>
      </div>

      <div className="bt-evidence-list">
        {item.evidence.map((line) => (
          <div key={line}>
            <span aria-hidden="true" />
            <p>{line}</p>
          </div>
        ))}
      </div>

      <div className="bt-evidence-verdict">
        <p className="bt-eyebrow">What to do next</p>
        <p>{item.verdict}</p>
      </div>

      <div className="widget-controls" role="group" aria-label="Choose a flawed result">
        {CASE_COPY.map((entry, number) => (
          <button
            type="button"
            key={entry.title}
            className={`widget-btn ${index === number ? 'is-selected' : ''}`}
            aria-pressed={index === number}
            onClick={() => setIndex(number)}
          >
            {entry.title}
          </button>
        ))}
      </div>

    </div>
  );
}

export function BacktestLessonWidget({ id }: { id: WidgetId }) {
  switch (id) {
    case 'backtest-replay':
      return <BacktestReplay />;
    case 'backtest-scene':
      return <BacktestScene />;
    case 'first-run':
      return <FirstRun />;
    case 'equity-curve-detail':
      return <EquityCurveDetail />;
    case 'return-breakdown':
      return <ReturnBreakdown />;
    case 'drawdown-map':
      return <DrawdownMap />;
    case 'risk-return':
      return <RiskReturn />;
    case 'trade-stats':
      return <TradeStats />;
    case 'cost-drag':
      return <CostDrag />;
    case 'results-tour':
      return <ResultsTour />;
    case 'overfit-sweep':
      return <OverfitSweep />;
    case 'bias-check':
      return <BiasCheck />;
    case 'walk-forward-map':
      return <WalkForwardMap />;
    case 'skeptic-cards':
      return <SkepticCards />;
    default:
      return null;
  }
}
