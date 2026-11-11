// StrategiesPage.tsx — the strategy library: an index on the left, one detail
// view on the right, three tabs.
//
// The look is the published strategies page from the pre-trim site: the same
// index, the same Overview and Mechanics copy (from data/strategies.ts), the
// same scorecard tables and window cards. What changed is the numbers: the
// old page printed precomputed figures and static SVGs, while this one runs
// every window live in the Pyodide engine worker against the OPFS market
// cache and draws the equity curves itself. No backend call, no stale report.
//
// Mobile shows the same library, but the Backtests tab explains that runs
// need a desktop browser instead of offering them.

import { Fragment, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ChevronRight } from 'lucide-react';
import { GlossaryText } from '../components/GlossaryText';
import TradeResults, { type TradeRecord } from '../components/TradeResults';
import { LoaderRow } from '../ui/Loader';
import Button from '../ui/Button';
import { STRATEGIES, type StrategyProfile } from '../data/strategies';
import {
  runStrategy,
  useEngineStatus,
  type EngineRun,
} from '../store';
import './StrategiesPage.css';

/* ---------- Market windows ---------- */

// The same eight regimes the old reports measured: four bears, four bulls.
// Calendar definitions, not numbers — every figure on this page is computed
// live by running the strategy over these ranges in the browser.
interface WindowDef {
  key: string;
  kind: 'bear' | 'bull';
  label: string;
  start: string;
  end: string;
}

const WINDOWS: WindowDef[] = [
  { key: 'bear-dotcom', kind: 'bear', label: 'Dot-com bust', start: '2000-01-03', end: '2003-03-31' },
  { key: 'bear-gfc', kind: 'bear', label: 'Global financial crisis', start: '2007-10-01', end: '2009-03-31' },
  { key: 'bear-covid', kind: 'bear', label: 'COVID crash', start: '2020-02-03', end: '2020-05-29' },
  { key: 'bear-2022', kind: 'bear', label: 'Rate-hike bear market', start: '2022-01-03', end: '2023-10-31' },
  { key: 'bull-2012', kind: 'bull', label: 'Slow recovery bull', start: '2012-01-03', end: '2015-05-29' },
  { key: 'bull-reopening', kind: 'bull', label: 'Pandemic reopening', start: '2020-06-01', end: '2021-11-30' },
  { key: 'bull-ai', kind: 'bull', label: 'AI-led rally', start: '2023-01-03', end: '2025-06-30' },
  { key: 'bull-2003', kind: 'bull', label: 'Mid-2000s bull', start: '2003-04-01', end: '2007-07-31' },
];

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'mechanics', label: 'Mechanics' },
  { key: 'backtests', label: 'Backtests' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

/* ---------- Formatting ---------- */

const month = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

const windowDates = (start: string, end: string) => `${month(start)} – ${month(end)}`;

const finite = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : NaN);
const fmtNaN = (text: string) => (text === 'NaN%' || text === 'NaN' ? '—' : text);
const signedPercent = (value: number) => fmtNaN(`${value > 0 ? '+' : ''}${value.toFixed(1)}%`);
const percent = (value: number) => fmtNaN(`${value.toFixed(1)}%`);
const ratio = (value: number) => fmtNaN(value.toFixed(2));
const indexValue = (value: number) => fmtNaN(value.toFixed(1));

const isBetter = (candidate: number, other: number, higherIsBetter: boolean) =>
  Number.isFinite(candidate) &&
  Number.isFinite(other) &&
  (higherIsBetter ? candidate > other + 1e-9 : candidate < other - 1e-9);

interface LiveMetrics {
  cagr: number;
  sharpe: number;
  max_drawdown: number;
  ending_value: number;
  turnover: number;
  cost_drag: number;
}

interface LiveRow {
  key: string;
  kind: 'bear' | 'bull';
  label: string;
  start: string;
  end: string;
  strategy: LiveMetrics;
  benchmark: LiveMetrics;
  equityStrategy: { date: string; value: number }[];
  equityBenchmark: { date: string; value: number }[];
  trades: TradeRecord[];
}

interface WindowRecord {
  total: number;
  returnWins: number;
  drawdownWins: number;
}

const windowRecord = (rows: LiveRow[]): WindowRecord => ({
  total: rows.length,
  returnWins: rows.filter((row) => isBetter(row.strategy.cagr, row.benchmark.cagr, true)).length,
  drawdownWins: rows.filter((row) =>
    isBetter(row.strategy.max_drawdown, row.benchmark.max_drawdown, false),
  ).length,
});

/* ---------- Live results ---------- */

// Benchmark windows are identical for every strategy, so one session-wide
// cache serves all five pages. Strategy runs are cached too: switching away
// and back never pays for the same window twice.
const benchmarkCache = new Map<string, { metrics: LiveMetrics; equity: { date: string; value: number }[] }>();
const strategyCache = new Map<string, LiveRow>();

function pickMetrics(stats: Record<string, number>): LiveMetrics {
  return {
    cagr: finite(stats.cagr),
    sharpe: finite(stats.sharpe),
    max_drawdown: finite(stats.max_drawdown),
    ending_value: finite(stats.ending_value),
    turnover: finite(stats.turnover),
    cost_drag: finite(stats.cost_drag),
  };
}

function toEquity(run: EngineRun): { date: string; value: number }[] {
  if (!Array.isArray(run.equity)) return [];
  return run.equity
    .filter((p) => typeof p?.date === 'string' && Number.isFinite(p?.value))
    .map((p) => ({ date: p.date, value: p.value }));
}

// Engine trades nest the exit (`exit: { date, price }`); the table reads it
// flat, so the mapping happens once here instead of in every row.
function toTrades(run: EngineRun): TradeRecord[] {
  if (!Array.isArray(run.trades)) return [];
  return run.trades.map((raw) => {
    const trade = (raw ?? {}) as Record<string, unknown>;
    const exit = (trade.exit ?? {}) as Record<string, unknown>;
    return {
      id: trade.id,
      ticker: trade.ticker,
      position_type: trade.position_type,
      entry_date: trade.entry_date,
      entry_price: trade.entry_price,
      exit_date: (exit.date as string | undefined) ?? null,
      exit_price: (exit.price as number | undefined) ?? null,
      allocation_size: trade.allocation,
      transaction_cost: trade.fees,
      stop_loss: trade.stop_loss,
      take_profit: trade.take_profit,
    } as TradeRecord;
  });
}

async function benchmarkRow(def: WindowDef): Promise<{ metrics: LiveMetrics; equity: { date: string; value: number }[] }> {
  const hit = benchmarkCache.get(def.key);
  if (hit) return hit;
  const run = await runStrategy('buy-and-hold', def.start, def.end);
  const out = { metrics: pickMetrics(run.stats), equity: toEquity(run) };
  benchmarkCache.set(def.key, out);
  return out;
}

async function strategyRow(strategyId: string, def: WindowDef): Promise<LiveRow> {
  const cacheKey = `${strategyId}|${def.key}`;
  const hit = strategyCache.get(cacheKey);
  if (hit) return hit;
  const [strategy, benchmark] = await Promise.all([
    runStrategy(strategyId, def.start, def.end).then((run) => ({
      metrics: pickMetrics(run.stats),
      equity: toEquity(run),
      trades: strategyId === 'buy-and-hold' ? [] : toTrades(run),
    })),
    benchmarkRow(def),
  ]);
  const row: LiveRow = {
    key: def.key,
    kind: def.kind,
    label: def.label,
    start: def.start,
    end: def.end,
    strategy: strategy.metrics,
    benchmark: benchmark.metrics,
    equityStrategy: strategy.equity,
    equityBenchmark: benchmark.equity,
    trades: strategy.trades,
  };
  strategyCache.set(cacheKey, row);
  return row;
}

/* ---------- Tabs ---------- */

function Overview({ profile }: { profile: StrategyProfile }) {
  return (
    <>
      <section className="strat-section">
        <h3 className="strat-section-title">The idea</h3>
        <p className="strat-prose strat-prose-lead">
          <GlossaryText text={profile.hypothesis} glossary={profile.glossary} />
        </p>
      </section>

      <section className="strat-section">
        <h3 className="strat-section-title">The case for, and the case against</h3>
        <div className="strat-columns">
          <div className="strat-column">
            <p className="strat-column-head">Evidence for</p>
            <ul className="strat-list">
              {profile.whyItWorks.map((point) => (
                <li key={point.title}>
                  <strong className="strat-point-title">
                    <GlossaryText text={point.title} glossary={profile.glossary} />
                  </strong>
                  {point.description && (
                    <p className="strat-point-text">
                      <GlossaryText text={point.description} glossary={profile.glossary} />
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div className="strat-column">
            <p className="strat-column-head">Reasons to doubt</p>
            <ul className="strat-list">
              {profile.whyItDoesnt.map((point) => (
                <li key={point.title}>
                  <strong className="strat-point-title">
                    <GlossaryText text={point.title} glossary={profile.glossary} />
                  </strong>
                  {point.description && (
                    <p className="strat-point-text">
                      <GlossaryText text={point.description} glossary={profile.glossary} />
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {profile.overviewNotes.map((note) => (
        <section className="strat-section" key={note.title}>
          <h3 className="strat-section-title">{note.title}</h3>
          <p className="strat-prose">
            <GlossaryText text={note.body} glossary={profile.glossary} />
          </p>
        </section>
      ))}
    </>
  );
}

function Mechanics({ profile }: { profile: StrategyProfile }) {
  return (
    <>
      <section className="strat-section">
        <h3 className="strat-section-title">What it holds</h3>
        <div className="strat-columns">
          <div className="strat-column">
            <p className="strat-column-head">Universe</p>
            <p className="strat-prose">
              <GlossaryText text={profile.universe} glossary={profile.glossary} />
            </p>
          </div>
          <div className="strat-column">
            <p className="strat-column-head">Rebalance</p>
            <p className="strat-prose">
              <GlossaryText text={profile.rebalance} glossary={profile.glossary} />
            </p>
          </div>
        </div>
      </section>

      <section className="strat-section">
        <h3 className="strat-section-title">Settings</h3>
        <dl className="strat-settings">
          {profile.settings.map((setting) => (
            <div key={setting.label} className="strat-setting">
              <dt>{setting.label}</dt>
              <dd>{setting.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {profile.notes.map((note) => (
        <section className="strat-section" key={note.title}>
          <h3 className="strat-section-title">{note.title}</h3>
          <p className="strat-prose">
            <GlossaryText text={note.body} glossary={profile.glossary} />
          </p>
        </section>
      ))}
    </>
  );
}

/* ---------- Backtest comparison ---------- */

interface ComparisonTableProps {
  rows: LiveRow[];
  name: string;
}

function ComparisonTable({ rows, name }: ComparisonTableProps) {
  const record = windowRecord(rows);
  const sharpeWins = rows.filter((row) =>
    isBetter(row.strategy.sharpe, row.benchmark.sharpe, true),
  ).length;
  const costWins = rows.filter((row) =>
    isBetter(row.strategy.cost_drag, row.benchmark.cost_drag, false),
  ).length;

  const summary = [
    { label: 'CAGR', wins: record.returnWins },
    { label: 'Drawdown', wins: record.drawdownWins },
    { label: 'Sharpe', wins: sharpeWins },
    { label: 'Cost drag', wins: costWins },
  ];

  const scoreMetrics: Array<{
    label: string;
    hint: string;
    strategy: (row: LiveRow) => number;
    benchmark: (row: LiveRow) => number;
    format: (value: number) => string;
    higherIsBetter: boolean | null;
  }> = [
    {
      label: 'CAGR',
      hint: 'higher is better',
      strategy: (row) => row.strategy.cagr,
      benchmark: (row) => row.benchmark.cagr,
      format: signedPercent,
      higherIsBetter: true,
    },
    {
      label: 'Max drawdown',
      hint: 'lower is better',
      strategy: (row) => row.strategy.max_drawdown,
      benchmark: (row) => row.benchmark.max_drawdown,
      format: percent,
      higherIsBetter: false,
    },
    {
      label: 'Sharpe',
      hint: 'higher is better',
      strategy: (row) => row.strategy.sharpe,
      benchmark: (row) => row.benchmark.sharpe,
      format: ratio,
      higherIsBetter: true,
    },
    {
      label: 'Cost drag',
      hint: 'lower is better',
      strategy: (row) => row.strategy.cost_drag,
      benchmark: (row) => row.benchmark.cost_drag,
      format: percent,
      higherIsBetter: false,
    },
    {
      label: 'Turnover',
      hint: 'context, not scored',
      strategy: (row) => row.strategy.turnover,
      benchmark: (row) => row.benchmark.turnover,
      format: percent,
      higherIsBetter: null,
    },
  ];

  return (
    <div className="strat-scorecard">
      <div className="strat-scorecard-summary">
        <div className="strat-scorecard-summary-copy">
          <span className="strat-scorecard-summary-eyebrow">Scorecard</span>
          <span>Windows where {name} beat buy and hold</span>
        </div>
        {summary.map((item) => (
          <div className="strat-scorecard-summary-item" key={item.label}>
            <strong>{item.wins}/{record.total}</strong>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      <div className="strat-table-wrap strat-scorecard-wrap">
        <table className="strat-scorecard-table">
          <caption className="strat-table-caption">
            Each row is a metric and each pair of columns is one window. Green marks
            the better figure in that window. Turnover is shown for context and is not
            scored; cost drag is annualized fees plus slippage, and lower is better.
          </caption>
          <thead>
            <tr>
              <th scope="col" rowSpan={2} className="strat-scorecard-metric-head">
                Metric
              </th>
              {rows.map((row) => (
                <th
                  key={row.key}
                  scope="colgroup"
                  colSpan={2}
                  className="strat-scorecard-window-head"
                >
                  <span className="strat-scorecard-window-name">{row.label}</span>
                  <span className="strat-scorecard-window-dates">{windowDates(row.start, row.end)}</span>
                </th>
              ))}
            </tr>
            <tr>
              {rows.map((row) => (
                <Fragment key={row.key}>
                  <th scope="col" className="strat-scorecard-side-head">
                    Buy and hold
                  </th>
                  <th scope="col" className="strat-scorecard-side-head is-strategy">
                    Strategy
                  </th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {scoreMetrics.map((metric) => (
              <tr key={metric.label}>
                <th scope="row" className="strat-scorecard-metric">
                  <span className="strat-scorecard-metric-label">{metric.label}</span>
                  <span className="strat-scorecard-metric-hint">{metric.hint}</span>
                </th>
                {rows.flatMap((row) => {
                  const strategyValue = metric.strategy(row);
                  const benchmarkValue = metric.benchmark(row);
                  const strategyBetter =
                    metric.higherIsBetter !== null &&
                    isBetter(strategyValue, benchmarkValue, metric.higherIsBetter);
                  const benchmarkBetter =
                    metric.higherIsBetter !== null &&
                    isBetter(benchmarkValue, strategyValue, metric.higherIsBetter);

                  return [
                    <td
                      key={`${row.key}-benchmark`}
                      className={`strat-scorecard-value${benchmarkBetter ? ' is-better' : ''}`}
                    >
                      {metric.format(benchmarkValue)}
                      {benchmarkBetter && <span className="strat-sr"> better</span>}
                    </td>,
                    <td
                      key={`${row.key}-strategy`}
                      className={`strat-scorecard-value${strategyBetter ? ' is-better' : ''}`}
                    >
                      {metric.format(strategyValue)}
                      {strategyBetter && <span className="strat-sr"> better</span>}
                    </td>,
                  ];
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BenchmarkTable({ rows }: { rows: LiveRow[] }) {
  return (
    <div className="strat-table-wrap">
      <table className="strat-table">
        <caption className="strat-table-caption">
          Buy and hold is the market, so there is no second line to compare it with.
          The same figures appear against each active strategy.
        </caption>
        <thead>
          <tr>
            <th scope="col" className="strat-table-window-head">
              Window
            </th>
            <th scope="col">CAGR</th>
            <th scope="col">Max drawdown</th>
            <th scope="col">Sharpe</th>
            <th scope="col" title="Annualized turnover / annualized cost drag">Turnover / cost</th>
            <th scope="col">Ending value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row" className="strat-table-window">
                <span className="strat-table-label">{row.label}</span>
                <span className="strat-table-dates">{windowDates(row.start, row.end)}</span>
              </th>
              <td className="strat-cell">{signedPercent(row.strategy.cagr)}</td>
              <td className="strat-cell">{percent(row.strategy.max_drawdown)}</td>
              <td className="strat-cell">{ratio(row.strategy.sharpe)}</td>
              <td
                className="strat-cell"
                aria-label={`Turnover ${percent(row.strategy.turnover)}, cost drag ${percent(row.strategy.cost_drag)}`}
              >
                <span className="strat-trade-cell">
                  <span>{percent(row.strategy.turnover)}</span>
                  <span className="strat-trade-cost">{percent(row.strategy.cost_drag)}</span>
                </span>
              </td>
              <td className="strat-cell">{indexValue(row.strategy.ending_value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ComparisonCards({ rows }: { rows: LiveRow[] }) {
  return (
    <div className="strat-window-cards">
      {rows.map((row) => (
        <article className="strat-window-card" key={row.key}>
          <header className="strat-window-head">
            <h4 className="strat-window-title">{row.label}</h4>
            <span className="strat-window-dates">{windowDates(row.start, row.end)}</span>
          </header>
          <div className="strat-window-grid">
            <span aria-hidden="true" />
            <span className="strat-window-side">Strategy</span>
            <span className="strat-window-side">Buy &amp; hold</span>

            <span className="strat-window-label">CAGR</span>
            <span
              className={`strat-window-value${
                isBetter(row.strategy.cagr, row.benchmark.cagr, true) ? ' is-better' : ''
              }`}
            >
              {signedPercent(row.strategy.cagr)}
            </span>
            <span
              className={`strat-window-value${
                isBetter(row.benchmark.cagr, row.strategy.cagr, true) ? ' is-better' : ''
              }`}
            >
              {signedPercent(row.benchmark.cagr)}
            </span>

            <span className="strat-window-label">Drawdown</span>
            <span
              className={`strat-window-value${
                isBetter(row.strategy.max_drawdown, row.benchmark.max_drawdown, false)
                  ? ' is-better'
                  : ''
              }`}
            >
              {percent(row.strategy.max_drawdown)}
            </span>
            <span
              className={`strat-window-value${
                isBetter(row.benchmark.max_drawdown, row.strategy.max_drawdown, false)
                  ? ' is-better'
                  : ''
              }`}
            >
              {percent(row.benchmark.max_drawdown)}
            </span>

            <span className="strat-window-label">Sharpe</span>
            <span
              className={`strat-window-value${
                isBetter(row.strategy.sharpe, row.benchmark.sharpe, true) ? ' is-better' : ''
              }`}
            >
              {ratio(row.strategy.sharpe)}
            </span>
            <span
              className={`strat-window-value${
                isBetter(row.benchmark.sharpe, row.strategy.sharpe, true) ? ' is-better' : ''
              }`}
            >
              {ratio(row.benchmark.sharpe)}
            </span>

            <span className="strat-window-label">Turnover</span>
            <span className="strat-window-value">{percent(row.strategy.turnover)}</span>
            <span className="strat-window-value">{percent(row.benchmark.turnover)}</span>

            <span className="strat-window-label">Cost drag</span>
            <span
              className={`strat-window-value${
                isBetter(row.strategy.cost_drag, row.benchmark.cost_drag, false) ? ' is-better' : ''
              }`}
            >
              {percent(row.strategy.cost_drag)}
            </span>
            <span
              className={`strat-window-value${
                isBetter(row.benchmark.cost_drag, row.strategy.cost_drag, false) ? ' is-better' : ''
              }`}
            >
              {percent(row.benchmark.cost_drag)}
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}

function BenchmarkCards({ rows }: { rows: LiveRow[] }) {
  return (
    <div className="strat-window-cards">
      {rows.map((row) => (
        <article className="strat-window-card" key={row.key}>
          <header className="strat-window-head">
            <h4 className="strat-window-title">{row.label}</h4>
            <span className="strat-window-dates">{windowDates(row.start, row.end)}</span>
          </header>
          <div className="strat-window-grid is-single">
            <span className="strat-window-label">CAGR</span>
            <span className="strat-window-value">{signedPercent(row.strategy.cagr)}</span>
            <span className="strat-window-label">Drawdown</span>
            <span className="strat-window-value">{percent(row.strategy.max_drawdown)}</span>
            <span className="strat-window-label">Sharpe</span>
            <span className="strat-window-value">{ratio(row.strategy.sharpe)}</span>
            <span className="strat-window-label">Turnover</span>
            <span className="strat-window-value">{percent(row.strategy.turnover)}</span>
            <span className="strat-window-label">Cost drag</span>
            <span className="strat-window-value">{percent(row.strategy.cost_drag)}</span>
            <span className="strat-window-label">Ending value</span>
            <span className="strat-window-value">{indexValue(row.strategy.ending_value)}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

/* ---------- Live equity chart ---------- */

// One SVG per window: the strategy against buy and hold, both rebased to
// 100 at the window start. Drawn from the live run, not a report artifact.
function EquityChart({
  strategy,
  benchmark,
  label,
}: {
  strategy: { date: string; value: number }[];
  benchmark: { date: string; value: number }[];
  label: string;
}) {
  const width = 560;
  const height = 220;
  const padLeft = 8;
  const padRight = 8;
  const padTop = 12;
  const padBottom = 24;
  const points = Math.max(strategy.length, benchmark.length, 2);
  const values = [...strategy, ...benchmark].map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => padLeft + (i / (points - 1)) * (width - padLeft - padRight);
  const y = (v: number) => padTop + (1 - (v - min) / span) * (height - padTop - padBottom);
  const line = (series: { date: string; value: number }[]) =>
    series.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  if (strategy.length === 0 && benchmark.length === 0) return null;
  const first = strategy[0]?.date ?? benchmark[0]?.date ?? '';
  const last =
    strategy[strategy.length - 1]?.date ?? benchmark[benchmark.length - 1]?.date ?? '';
  return (
    <svg
      className="strat-equity"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Equity curves for ${label}: strategy against buy and hold`}
    >
      <title>{`Equity curves for ${label}`}</title>
      {[0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1={padLeft}
          x2={width - padRight}
          y1={padTop + f * (height - padTop - padBottom)}
          y2={padTop + f * (height - padTop - padBottom)}
          className="strat-equity-grid"
        />
      ))}
      {benchmark.length > 1 && <path d={line(benchmark)} className="strat-equity-benchmark" />}
      {strategy.length > 1 && <path d={line(strategy)} className="strat-equity-strategy" />}
      <text x={padLeft} y={height - 8} className="strat-equity-tick">
        {month(first)}
      </text>
      <text x={width - padRight} y={height - 8} className="strat-equity-tick is-end">
        {month(last)}
      </text>
    </svg>
  );
}

/* ---------- Live backtests ---------- */

type BacktestPhase = 'idle' | 'running' | 'done' | 'error';

function Backtests({ profile }: { profile: StrategyProfile }) {
  const engine = useEngineStatus();
  const unsupported = engine.phase === 'unsupported';
  const [phase, setPhase] = useState<BacktestPhase>('idle');
  const [rows, setRows] = useState<LiveRow[]>([]);
  const [runningLabel, setRunningLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef(0);

  // A strategy switch or unmount cancels the in-flight run: late worker
  // replies resolve into a dead token and are dropped, never painted.
  useEffect(() => {
    const token = tokenRef.current;
    return () => {
      if (tokenRef.current === token) tokenRef.current += 1;
    };
  }, [profile.id]);

  const isBenchmark = profile.id === 'buy-and-hold';

  const runAll = async () => {
    const token = (tokenRef.current += 1);
    setPhase('running');
    setRows([]);
    setError(null);
    try {
      for (const def of WINDOWS) {
        if (token !== tokenRef.current) return;
        setRunningLabel(def.label);
        const row = await strategyRow(profile.id, def);
        if (token !== tokenRef.current) return;
        setRows((prev) => [...prev, row]);
      }
      if (token !== tokenRef.current) return;
      setRunningLabel(null);
      setPhase('done');
    } catch (err) {
      if (token !== tokenRef.current) return;
      setRunningLabel(null);
      setError(err instanceof Error ? err.message : 'Backtest failed');
      setPhase('error');
    }
  };

  const record = windowRecord(rows);
  const returnLine =
    record.returnWins === 0
      ? 'never finished ahead of buy and hold on return'
      : `finished ahead of buy and hold on return in ${record.returnWins} of ${record.total} windows`;
  const drawdownLine =
    record.drawdownWins === 0
      ? 'never carried the smaller drawdown'
      : `carried the smaller drawdown in ${record.drawdownWins}`;

  return (
    <>
      <section className="strat-section">
        <h3 className="strat-section-title">The record, window by window</h3>
        {unsupported ? (
          <p className="strat-prose">
            Backtests run in this browser&apos;s engine, and strategy runs need a
            desktop browser. The library above reads the same on a phone — the
            numbers wait until you run them on a computer.
          </p>
        ) : (
          <p className="strat-prose">
            {isBenchmark
              ? 'Each window starts the fund at 100 and ends at the value in the last column. There is no second line because this is the line every other strategy is measured against. Runs happen live in your browser against the cached market data.'
              : `Each window starts both curves at 100, so the paths can be read on the same scale. Press run and the engine backtests this strategy in your browser — the scorecard fills in window by window, and the charts draw from the live runs.`}
          </p>
        )}

        {!unsupported && phase === 'idle' && (
          <div className="strat-run-row">
            <Button variant="primary" size="md" onClick={() => void runAll()}>
              Run {WINDOWS.length} windows
            </Button>
            <span className="strat-run-note">
              {engine.phase === 'ready'
                ? engine.cachedWheels
                  ? 'Engine is warm — wheels loaded from this browser.'
                  : 'Engine is warm.'
                : (engine.detail ?? 'Engine warms up on first run.')}
            </span>
          </div>
        )}

        {!unsupported && phase === 'running' && (
          <div className="strat-run-row">
            <LoaderRow
              label={runningLabel ? `Running ${runningLabel}…` : 'Running…'
              }
            />
            <span className="strat-run-note">
              {rows.length} of {WINDOWS.length} windows done
            </span>
          </div>
        )}

        {!unsupported && phase === 'error' && (
          <div className="strat-run-row">
            <p className="strat-run-error">{error ?? 'Backtest failed.'}</p>
            <Button variant="secondary" size="md" onClick={() => void runAll()}>
              Try again
            </Button>
          </div>
        )}

        {rows.length > 0 && !isBenchmark && (
          <p className="strat-prose strat-record-line">
            Across {record.total} market windows it {returnLine} and {drawdownLine}.
          </p>
        )}

        {rows.length > 0 &&
          (isBenchmark ? (
            <>
              <BenchmarkTable rows={rows} />
              <BenchmarkCards rows={rows} />
            </>
          ) : (
            <>
              <ComparisonTable rows={rows} name={profile.name} />
              <ComparisonCards rows={rows} />
            </>
          ))}
      </section>

      {rows.length > 0 && (
        <div className="strat-charts">
          {rows.map((row) => (
            <figure className="strat-chart" key={row.key}>
              <figcaption className="strat-chart-head">
                <span className="strat-chart-title">{row.label}</span>
                <span className="strat-chart-meta">
                  <span>{windowDates(row.start, row.end)}</span>
                  <span className={`strat-chart-kind is-${row.kind}`}>
                    {row.kind === 'bear' ? 'Bear' : 'Bull'}
                  </span>
                </span>
              </figcaption>
              <EquityChart
                strategy={row.equityStrategy}
                benchmark={row.equityBenchmark}
                label={row.label}
              />
              <div className="strat-chart-foot">
                {isBenchmark ? (
                  <span>Ending value {indexValue(row.strategy.ending_value)}</span>
                ) : (
                  <>
                    <span>{profile.name} {indexValue(row.strategy.ending_value)}</span>
                    <span>Buy and hold {indexValue(row.benchmark.ending_value)}</span>
                  </>
                )}
              </div>
              {row.trades.length > 0 && (
                <details className="strat-trades">
                  <summary>Trades ({row.trades.length})</summary>
                  <TradeResults trades={row.trades} />
                </details>
              )}
            </figure>
          ))}
        </div>
      )}
    </>
  );
}

/* ---------- Page ---------- */

export function StrategiesView() {
  const [activeId, setActiveId] = useState(STRATEGIES[0].id);
  const [tab, setTab] = useState<TabKey>('overview');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const profile = STRATEGIES.find((strategy) => strategy.id === activeId) ?? STRATEGIES[0];
  const isBenchmark = profile.id === 'buy-and-hold';

  const selectStrategy = (id: string) => {
    setActiveId(id);
    setTab('overview');
  };

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % TABS.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = TABS.length - 1;
    else return;

    event.preventDefault();
    setTab(TABS[next].key);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="strat-shell">
      <nav className="strat-index" aria-label="Strategy index">
        <p className="strat-index-head">Index</p>
        {STRATEGIES.map((strategy, index) => {
          const isActive = strategy.id === profile.id;
          return (
            <button
              key={strategy.id}
              type="button"
              className={`strat-item ${isActive ? 'is-active' : ''}`}
              onClick={() => selectStrategy(strategy.id)}
              aria-current={isActive ? 'true' : undefined}
            >
              <span className="strat-item-num">{String(index + 1).padStart(2, '0')}</span>
              <span className="strat-item-body">
                <span className="strat-item-name">{strategy.name}</span>
                <span className="strat-item-meta">
                  {strategy.category} · {WINDOWS.length} windows
                </span>
              </span>
              <ChevronRight size={15} className="strat-item-chevron" aria-hidden="true" />
            </button>
          );
        })}
      </nav>

      <article className="strat-detail">
        <header className="strat-detail-head">
          <p className="strat-detail-kicker">{profile.category} strategy</p>
          <h2 className="strat-detail-name">{profile.name}</h2>
          <p className="strat-detail-summary">
            <GlossaryText text={profile.summary} glossary={profile.glossary} />
          </p>
          <p className="strat-detail-record">
            {isBenchmark
              ? 'This is the benchmark. It is the line every other strategy here has to beat.'
              : 'Measured across eight market windows — four bears, four bulls. Run the backtests below to fill in the scorecard.'}
          </p>
          <dl className="strat-facts">
            {profile.facts.map((fact) => (
              <div key={fact.label} className="strat-fact">
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        </header>

        <div className="strat-tabs" role="tablist" aria-label={`${profile.name} detail`}>
          {TABS.map((entry, index) => {
            const selected = entry.key === tab;
            return (
              <button
                key={entry.key}
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                type="button"
                role="tab"
                id={`strat-tab-${entry.key}`}
                aria-selected={selected}
                aria-controls="strat-panel"
                tabIndex={selected ? 0 : -1}
                className={`strat-tab ${selected ? 'is-active' : ''}`}
                onClick={() => setTab(entry.key)}
                onKeyDown={(event) => onTabKey(event, index)}
              >
                {entry.label}
              </button>
            );
          })}
        </div>

        <div
          className="strat-panel"
          role="tabpanel"
          id="strat-panel"
          aria-labelledby={`strat-tab-${tab}`}
          tabIndex={0}
        >
          {tab === 'overview' && <Overview profile={profile} />}
          {tab === 'mechanics' && <Mechanics profile={profile} />}
          {tab === 'backtests' && <Backtests key={profile.id} profile={profile} />}
        </div>
      </article>
    </div>
  );
}

export default function StrategiesPage() {
  return (
    <div className="strat-page page-transition">
      <header className="strat-head">
        <p className="strat-eyebrow">Strategies</p>
        <h1 className="strat-title">Published strategies</h1>
        <p className="strat-lede">
          {STRATEGIES.length} strategies, each measured over the same {WINDOWS.length} market
          windows and compared with buying and holding the S&amp;P 500.
        </p>
      </header>

      <StrategiesView />
    </div>
  );
}
