// StrategiesPage.tsx — the strategy library: an index on the left, one detail
// card on the right, three tabs.
//
// All copy comes from data/strategies.ts and every number from
// data/backtestResults.ts, which backend/scripts/regime_report.py writes. The
// charts are SVGs committed under assets/strategies, so the page renders the
// same output the report script produced without a backend call.
//
// Overview carries the idea, the case for it and the case against it, plus the
// notes behind the rules. Mechanics carries what the strategy holds, the
// settings the engine runs, and the execution notes. Backtests replays each
// strategy over eight fixed windows and marks the better figure in every metric
// pair. Glossary terms are marked inline by GlossaryText, with no glossary tab.

import { Fragment, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ChevronRight } from 'lucide-react';
import { GlossaryText } from '../components/GlossaryText';
import { STRATEGIES, type StrategyProfile } from '../data/strategies';
import { BACKTESTS, type BacktestMetrics, type BacktestRow } from '../data/backtestResults';
import { OUTLOOK } from '../data/strategyOutlook';
import './StrategiesPage.css';

interface StrategiesPageProps {
  onNavigate?: (tab: string) => void;
}

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'mechanics', label: 'Mechanics' },
  { key: 'backtests', label: 'Backtests' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

/* Every window chart, bundled as a URL at build time. Buy and hold is drawn on
   its own (curve_), every other strategy against it (graph_). */
const CHART_URLS = import.meta.glob<string>('../assets/strategies/*/*.svg', {
  query: '?url',
  import: 'default',
  eager: true,
});

const chartFor = (strategyId: string, key: string, single: boolean) =>
  CHART_URLS[`../assets/strategies/${strategyId}/${single ? 'curve' : 'graph'}_${key}.svg`];

/* ---------- Formatting ---------- */

const month = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

const windowDates = (row: BacktestRow) => `${month(row.start)} to ${month(row.end)}`;

const indexValue = (value: number) => value.toFixed(1);
const percent = (value: number) => `${value.toFixed(1)}%`;
const ratio = (value: number) => value.toFixed(2);
/* Max drawdown is stored as a positive magnitude, so the minus is added here. */
const drawdown = (value: number) => `-${value.toFixed(1)}%`;

const METRICS: Array<{
  key: keyof BacktestMetrics;
  label: string;
  format: (value: number) => string;
  higherIsBetter: boolean;
}> = [
  { key: 'ending_value', label: 'Ending value', format: indexValue, higherIsBetter: true },
  { key: 'cagr', label: 'CAGR', format: percent, higherIsBetter: true },
  { key: 'sharpe', label: 'Sharpe', format: ratio, higherIsBetter: true },
  { key: 'max_drawdown', label: 'Max drawdown', format: drawdown, higherIsBetter: false },
];

/* Which side of a pair wins, given whether the larger number is the better one. */
const compare = (mine: number, theirs: number, higherIsBetter: boolean): [boolean, boolean] => {
  if (mine === theirs) return [false, false];
  const mineWins = higherIsBetter ? mine > theirs : mine < theirs;
  return [mineWins, !mineWins];
};

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
        <h3 className="strat-section-title">Why it can work, and why it can fail</h3>
        <div className="strat-columns">
          <div className="strat-column is-for">
            <p className="strat-column-head">The case for it</p>
            <ul className="strat-points">
              {profile.whyItWorks.map((point) => (
                <li key={point.title} className="strat-point">
                  <span className="strat-point-title">{point.title}</span>
                  <span className="strat-point-text">
                    <GlossaryText text={point.description} glossary={profile.glossary} />
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="strat-column is-against">
            <p className="strat-column-head">The case against it</p>
            <ul className="strat-points">
              {profile.whyItDoesnt.map((point) => (
                <li key={point.title} className="strat-point">
                  <span className="strat-point-title">{point.title}</span>
                  <span className="strat-point-text">
                    <GlossaryText text={point.description} glossary={profile.glossary} />
                  </span>
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
            <p className="strat-column-head">The universe</p>
            <p className="strat-prose">
              <GlossaryText text={profile.universe} glossary={profile.glossary} />
            </p>
          </div>
          <div className="strat-column">
            <p className="strat-column-head">Rebalancing</p>
            <p className="strat-prose">
              <GlossaryText text={profile.rebalance} glossary={profile.glossary} />
            </p>
          </div>
        </div>
      </section>

      <section className="strat-section">
        <h3 className="strat-section-title">The settings the engine runs</h3>
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

function Backtests({ profile }: { profile: StrategyProfile }) {
  const rows = BACKTESTS[profile.id] ?? [];
  const isBenchmark = profile.id === 'buy-and-hold';
  const outlook = OUTLOOK[profile.id];

  return (
    <>
      {outlook && (
        <>
          <section className="strat-section">
            <h3 className="strat-section-title">What we can expect</h3>
            <p className="strat-prose strat-prose-lead">{outlook.expectation}</p>
          </section>

          <section className="strat-section">
            <h3 className="strat-section-title">What the windows showed</h3>
            {outlook.windows.map((paragraph) => (
              <p className="strat-prose" key={paragraph.slice(0, 40)}>
                {paragraph}
              </p>
            ))}
            <p className="strat-prose-note">
              In every chart both lines start at 100 on the first session, so the two paths are
              read on one scale. Where a window shows two sides, the better figure in each pair is
              green. All figures are after fees and slippage and cover the window itself, not the
              years around it.
            </p>
          </section>
        </>
      )}

      <section className="strat-section">
        <h3 className="strat-section-title">The {rows.length} windows, chart by chart</h3>
      </section>

      <div className="strat-window-cards">
        {rows.map((row) => {
          const chart = chartFor(profile.id, row.key, isBenchmark);
          const benchmark = row.benchmark;
          return (
            <figure className="strat-window-card" key={row.key}>
              <figcaption className="strat-window-head">
                <span className="strat-window-title">{row.label}</span>
                <span className="strat-window-meta">
                  <span>{windowDates(row)}</span>
                  <span className={`strat-window-kind is-${row.kind}`}>
                    {row.kind === 'bear' ? 'Bear' : 'Bull'}
                  </span>
                </span>
              </figcaption>

              {chart && (
                <img
                  src={chart}
                  alt={
                    isBenchmark
                      ? `Buy and hold equity curve, ${row.label}, ${windowDates(row)}`
                      : `${profile.name} against buy and hold, ${row.label}, ${windowDates(row)}`
                  }
                  loading="lazy"
                  decoding="async"
                />
              )}

              {benchmark ? (
                <div className="strat-window-metrics">
                  <span aria-hidden="true" />
                  <span className="strat-window-side">Strategy</span>
                  <span className="strat-window-side">Buy &amp; hold</span>

                  {METRICS.map((metric) => {
                    const mine = row.strategy[metric.key];
                    const theirs = benchmark[metric.key];
                    const [mineBetter, theirsBetter] = compare(mine, theirs, metric.higherIsBetter);
                    return (
                      <Fragment key={metric.key}>
                        <span className="strat-window-label">{metric.label}</span>
                        <span className={`strat-window-value${mineBetter ? ' is-better' : ''}`}>
                          {metric.format(mine)}
                        </span>
                        <span className={`strat-window-value${theirsBetter ? ' is-better' : ''}`}>
                          {metric.format(theirs)}
                        </span>
                      </Fragment>
                    );
                  })}
                </div>
              ) : (
                <dl className="strat-window-facts">
                  {METRICS.map((metric) => (
                    <div key={metric.key} className="strat-window-fact">
                      <dt>{metric.label}</dt>
                      <dd>{metric.format(row.strategy[metric.key])}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </figure>
          );
        })}
      </div>
    </>
  );
}

/* ---------- Page ---------- */

export const StrategiesPage: React.FC<StrategiesPageProps> = ({ onNavigate }) => {
  const [activeId, setActiveId] = useState(STRATEGIES[0].id);
  const [tab, setTab] = useState<TabKey>('overview');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const detailRef = useRef<HTMLElement | null>(null);

  const profile = STRATEGIES.find((strategy) => strategy.id === activeId) ?? STRATEGIES[0];

  // A new strategy always opens on Overview: the idea is where a reader starts,
  // and carrying the old tab across would drop them mid-argument. The detail card
  // is scrolled back to its own top, because the rail sits alongside a card that
  // can be several screens tall and the reader should not land in the middle of
  // the previous strategy's argument.
  const selectStrategy = (id: string) => {
    setActiveId(id);
    setTab('overview');

    const card = detailRef.current;
    if (!card) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    card.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
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
    <div className="strat-page">
      <header className="strat-head">
        <p className="strat-eyebrow">Strategy library</p>
        <h1 className="strat-title">How each strategy thinks</h1>
        <p className="strat-lede">
          {STRATEGIES.length} rule sets, each documented the same way: the idea, the case for and
          against it, the settings the engine runs, and what those rules did over eight fixed market
          windows. Underlined words carry a plain-language definition on hover or tap.
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
                    {strategy.category} · {strategy.facts[0]?.value}
                  </span>
                </span>
                <ChevronRight size={15} className="strat-item-chevron" aria-hidden="true" />
              </button>
            );
          })}
        </nav>

        <article className="strat-detail" ref={detailRef}>
          <header className="strat-detail-head">
            <p className="strat-detail-kicker">{profile.category} strategy</p>
            <h2 className="strat-detail-name">{profile.name}</h2>
            <p className="strat-detail-summary">
              <GlossaryText text={profile.summary} glossary={profile.glossary} />
            </p>
            <p className="strat-detail-record">
              Overview and Mechanics hold the rules the engine runs. Backtests replays those rules
              over eight fixed windows, four declines and four recoveries.
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

          {onNavigate && (
            <footer className="strat-detail-foot">
              <button type="button" className="strat-run" onClick={() => onNavigate('research')}>
                Run {profile.name} on real dates
              </button>
            </footer>
          )}
        </article>
      </div>
    </div>
  );
};

export default StrategiesPage;
