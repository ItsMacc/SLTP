// StrategiesPage.tsx: the strategy library, an index on the left, one detail
// view on the right, three tabs.
//
// Everything textual comes from data/strategies.ts and every number from
// data/backtestResults.ts, which the reports script writes. The charts are SVGs
// committed under assets/strategies, so the page renders the same output the
// report script produced without a backend call.

import { Fragment, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ChevronRight } from 'lucide-react';
import { GlossaryText } from '../components/GlossaryText';
import { STRATEGIES, type StrategyProfile } from '../data/strategies';
import { BACKTESTS, type BacktestRow } from '../data/backtestResults';
import './StrategiesPage.css';

// Report charts, one per reported window. Active strategies are drawn against
// the benchmark; buy and hold is the benchmark, so it gets the simple single-line
// version from app/reports/single_curves.py.
import momBearDotcom from '../assets/strategies/trend-leaders/graph_bear-dotcom.svg';
import momBearGfc from '../assets/strategies/trend-leaders/graph_bear-gfc.svg';
import momBearCovid from '../assets/strategies/trend-leaders/graph_bear-covid.svg';
import momBear2022 from '../assets/strategies/trend-leaders/graph_bear-2022.svg';
import momBull2012 from '../assets/strategies/trend-leaders/graph_bull-2012.svg';
import momBullReopening from '../assets/strategies/trend-leaders/graph_bull-reopening.svg';
import momBullAi from '../assets/strategies/trend-leaders/graph_bull-ai.svg';
import momBull2003 from '../assets/strategies/trend-leaders/graph_bull-2003.svg';

import gtaBearDotcom from '../assets/strategies/global-trend-allocation/graph_bear-dotcom.svg';
import gtaBearGfc from '../assets/strategies/global-trend-allocation/graph_bear-gfc.svg';
import gtaBearCovid from '../assets/strategies/global-trend-allocation/graph_bear-covid.svg';
import gtaBear2022 from '../assets/strategies/global-trend-allocation/graph_bear-2022.svg';
import gtaBull2012 from '../assets/strategies/global-trend-allocation/graph_bull-2012.svg';
import gtaBullReopening from '../assets/strategies/global-trend-allocation/graph_bull-reopening.svg';
import gtaBullAi from '../assets/strategies/global-trend-allocation/graph_bull-ai.svg';
import gtaBull2003 from '../assets/strategies/global-trend-allocation/graph_bull-2003.svg';

import lvBearDotcom from '../assets/strategies/steady/graph_bear-dotcom.svg';
import lvBearGfc from '../assets/strategies/steady/graph_bear-gfc.svg';
import lvBearCovid from '../assets/strategies/steady/graph_bear-covid.svg';
import lvBear2022 from '../assets/strategies/steady/graph_bear-2022.svg';
import lvBull2012 from '../assets/strategies/steady/graph_bull-2012.svg';
import lvBullReopening from '../assets/strategies/steady/graph_bull-reopening.svg';
import lvBullAi from '../assets/strategies/steady/graph_bull-ai.svg';
import lvBull2003 from '../assets/strategies/steady/graph_bull-2003.svg';

import smrBearDotcom from '../assets/strategies/statistical-mean-reversion/graph_bear-dotcom.svg';
import smrBearGfc from '../assets/strategies/statistical-mean-reversion/graph_bear-gfc.svg';
import smrBearCovid from '../assets/strategies/statistical-mean-reversion/graph_bear-covid.svg';
import smrBear2022 from '../assets/strategies/statistical-mean-reversion/graph_bear-2022.svg';
import smrBull2012 from '../assets/strategies/statistical-mean-reversion/graph_bull-2012.svg';
import smrBullReopening from '../assets/strategies/statistical-mean-reversion/graph_bull-reopening.svg';
import smrBullAi from '../assets/strategies/statistical-mean-reversion/graph_bull-ai.svg';
import smrBull2003 from '../assets/strategies/statistical-mean-reversion/graph_bull-2003.svg';

import bhBearDotcom from '../assets/strategies/buy-and-hold/curve_bear-dotcom.svg';
import bhBearGfc from '../assets/strategies/buy-and-hold/curve_bear-gfc.svg';
import bhBearCovid from '../assets/strategies/buy-and-hold/curve_bear-covid.svg';
import bhBear2022 from '../assets/strategies/buy-and-hold/curve_bear-2022.svg';
import bhBull2012 from '../assets/strategies/buy-and-hold/curve_bull-2012.svg';
import bhBullReopening from '../assets/strategies/buy-and-hold/curve_bull-reopening.svg';
import bhBullAi from '../assets/strategies/buy-and-hold/curve_bull-ai.svg';
import bhBull2003 from '../assets/strategies/buy-and-hold/curve_bull-2003.svg';

const CHARTS: Record<string, Record<string, string>> = {
  'buy-and-hold': {
    'bear-dotcom': bhBearDotcom,
    'bear-gfc': bhBearGfc,
    'bear-covid': bhBearCovid,
    'bear-2022': bhBear2022,
    'bull-2012': bhBull2012,
    'bull-reopening': bhBullReopening,
    'bull-ai': bhBullAi,
    'bull-2003': bhBull2003,
  },
  'statistical-mean-reversion': {
    'bear-dotcom': smrBearDotcom,
    'bear-gfc': smrBearGfc,
    'bear-covid': smrBearCovid,
    'bear-2022': smrBear2022,
    'bull-2012': smrBull2012,
    'bull-reopening': smrBullReopening,
    'bull-ai': smrBullAi,
    'bull-2003': smrBull2003,
  },
  'trend-leaders': {
    'bear-dotcom': momBearDotcom,
    'bear-gfc': momBearGfc,
    'bear-covid': momBearCovid,
    'bear-2022': momBear2022,
    'bull-2012': momBull2012,
    'bull-reopening': momBullReopening,
    'bull-ai': momBullAi,
    'bull-2003': momBull2003,
  },
  'global-trend-allocation': {
    'bear-dotcom': gtaBearDotcom,
    'bear-gfc': gtaBearGfc,
    'bear-covid': gtaBearCovid,
    'bear-2022': gtaBear2022,
    'bull-2012': gtaBull2012,
    'bull-reopening': gtaBullReopening,
    'bull-ai': gtaBullAi,
    'bull-2003': gtaBull2003,
  },
  'steady': {
    'bear-dotcom': lvBearDotcom,
    'bear-gfc': lvBearGfc,
    'bear-covid': lvBearCovid,
    'bear-2022': lvBear2022,
    'bull-2012': lvBull2012,
    'bull-reopening': lvBullReopening,
    'bull-ai': lvBullAi,
    'bull-2003': lvBull2003,
  },
};

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

const windowDates = (row: BacktestRow) => `${month(row.start)} – ${month(row.end)}`;

const signedPercent = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
const percent = (value: number) => `${value.toFixed(1)}%`;
const ratio = (value: number) => value.toFixed(2);
const indexValue = (value: number) => value.toFixed(1);

const isBetter = (candidate: number, other: number, higherIsBetter: boolean) =>
  higherIsBetter ? candidate > other + 1e-9 : candidate < other - 1e-9;

interface WindowRecord {
  total: number;
  returnWins: number;
  drawdownWins: number;
}

const windowRecord = (rows: BacktestRow[]): WindowRecord => ({
  total: rows.length,
  returnWins: rows.filter((row) => isBetter(row.strategy.cagr, row.benchmark.cagr, true)).length,
  drawdownWins: rows.filter((row) =>
    isBetter(row.strategy.max_drawdown, row.benchmark.max_drawdown, false),
  ).length,
});

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
  rows: BacktestRow[];
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
    strategy: (row: BacktestRow) => number;
    benchmark: (row: BacktestRow) => number;
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
                  <span className="strat-scorecard-window-dates">{windowDates(row)}</span>
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

function BenchmarkTable({ rows }: { rows: BacktestRow[] }) {
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
                <span className="strat-table-dates">{windowDates(row)}</span>
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

function ComparisonCards({ rows }: { rows: BacktestRow[] }) {
  return (
    <div className="strat-window-cards">
      {rows.map((row) => (
        <article className="strat-window-card" key={row.key}>
          <header className="strat-window-head">
            <h4 className="strat-window-title">{row.label}</h4>
            <span className="strat-window-dates">{windowDates(row)}</span>
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

function BenchmarkCards({ rows }: { rows: BacktestRow[] }) {
  return (
    <div className="strat-window-cards">
      {rows.map((row) => (
        <article className="strat-window-card" key={row.key}>
          <header className="strat-window-head">
            <h4 className="strat-window-title">{row.label}</h4>
            <span className="strat-window-dates">{windowDates(row)}</span>
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

function Backtests({ profile }: { profile: StrategyProfile }) {
  const rows = BACKTESTS[profile.id] ?? [];
  const charts = CHARTS[profile.id] ?? {};
  const isBenchmark = profile.id === 'buy-and-hold';

  return (
    <>
      <section className="strat-section">
        <h3 className="strat-section-title">The record, window by window</h3>
        <p className="strat-prose">
          {isBenchmark ? (
            'Each window starts the fund at 100 and ends at the value in the last column. There is no second line because this is the line every other strategy is measured against.'
          ) : (
            <GlossaryText
              text={`Each window starts both curves at 100, so the paths can be read on the same scale. The scorecard marks the better figure in each pair with a check; turnover is context rather than a score. The charts below show how each pair got there.`}
              glossary={profile.glossary}
            />
          )}
        </p>
        {isBenchmark ? (
          <>
            <BenchmarkTable rows={rows} />
            <BenchmarkCards rows={rows} />
          </>
        ) : (
          <>
            <ComparisonTable rows={rows} name={profile.name} />
            <ComparisonCards rows={rows} />
          </>
        )}
      </section>

      <div className="strat-charts">
        {rows.map((row) => (
          <figure className="strat-chart" key={row.key}>
            <figcaption className="strat-chart-head">
              <span className="strat-chart-title">{row.label}</span>
              <span className="strat-chart-meta">
                <span>{windowDates(row)}</span>
                <span className={`strat-chart-kind is-${row.kind}`}>
                  {row.kind === 'bear' ? 'Bear' : 'Bull'}
                </span>
              </span>
            </figcaption>
            {charts[row.key] && (
              <img
                src={charts[row.key]}
                alt={
                  isBenchmark
                    ? `Buy and hold equity curve, ${row.label}, ${month(row.start)} to ${month(row.end)}`
                    : `${profile.name} against buy and hold, ${row.label}, ${month(row.start)} to ${month(row.end)}`
                }
                loading="lazy"
                decoding="async"
              />
            )}
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
          </figure>
        ))}
      </div>
    </>
  );
}

/* ---------- Page ---------- */

export const StrategiesPage: React.FC = () => {
  const [activeId, setActiveId] = useState(STRATEGIES[0].id);
  const [tab, setTab] = useState<TabKey>('overview');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const profile = STRATEGIES.find((strategy) => strategy.id === activeId) ?? STRATEGIES[0];
  const rows = BACKTESTS[profile.id] ?? [];
  const windows = rows.length;
  const isBenchmark = profile.id === 'buy-and-hold';
  const record = windowRecord(rows);

  const returnLine =
    record.returnWins === 0
      ? 'never finished ahead of buy and hold on return'
      : `finished ahead of buy and hold on return in ${record.returnWins} of ${record.total} windows`;
  const drawdownLine =
    record.drawdownWins === 0
      ? 'never carried the smaller drawdown'
      : `carried the smaller drawdown in ${record.drawdownWins}`;

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
    <div className="strat-page page-transition">
      <header className="strat-head">
        <p className="strat-eyebrow">Strategies</p>
        <h1 className="strat-title">Published strategies</h1>
        <p className="strat-lede">
          {STRATEGIES.length} strategies, each measured over the same {windows} market windows and
          compared with buying and holding the S&P 500.
        </p>
      </header>

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
                    {strategy.category} · {(BACKTESTS[strategy.id] ?? []).length} windows
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
              {isBenchmark ? (
                'This is the benchmark. It is the line every other strategy here has to beat.'
              ) : (
                <GlossaryText
                  text={`Across ${record.total} market windows it ${returnLine} and ${drawdownLine}.`}
                  glossary={profile.glossary}
                />
              )}
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
            {tab === 'backtests' && <Backtests profile={profile} />}
          </div>
        </article>
      </div>
    </div>
  );
};

export default StrategiesPage;
