// StrategiesPage.tsx — the strategy library: an index on the left, one detail
// view on the right, four tabs.
//
// Everything textual comes from data/strategies.ts and every number from
// data/backtestResults.ts, which the reports script writes. The charts are SVGs
// committed under assets/strategies, so the page renders the same output the
// report script produced without a backend call.

import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ChevronRight } from 'lucide-react';
import { GlossaryText } from '../components/GlossaryText';
import { STRATEGIES, type StrategyProfile } from '../data/strategies';
import { BACKTESTS, type BacktestRow } from '../data/backtestResults';
import './StrategiesPage.css';

// Report charts, one per reported window. Statistical Mean Reversion is drawn
// against the benchmark; buy and hold is the benchmark, so it gets the simple
// single-line version from app/reports/single_curves.py.
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
};

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'mechanics', label: 'Mechanics' },
  { key: 'backtests', label: 'Backtests' },
  { key: 'glossary', label: 'Glossary' },
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

/* ---------- Tabs ---------- */

function Overview({ profile }: { profile: StrategyProfile }) {
  return (
    <>
      <section className="strat-section">
        <h3 className="strat-section-title">Hypothesis</h3>
        <p className="strat-prose">
          <GlossaryText text={profile.hypothesis} glossary={profile.glossary} />
        </p>
      </section>

      <section className="strat-section">
        <h3 className="strat-section-title">Why it might work, and why it might not</h3>
        <div className="strat-columns">
          <div className="strat-column">
            <p className="strat-column-head">Evidence for</p>
            <ul className="strat-list">
              {profile.whyItWorks.map((line) => (
                <li key={line}>
                  <GlossaryText text={line} glossary={profile.glossary} />
                </li>
              ))}
            </ul>
          </div>
          <div className="strat-column">
            <p className="strat-column-head">Reasons to doubt</p>
            <ul className="strat-list">
              {profile.whyItDoesnt.map((line) => (
                <li key={line}>
                  <GlossaryText text={line} glossary={profile.glossary} />
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

function Backtests({ profile }: { profile: StrategyProfile }) {
  const rows = BACKTESTS[profile.id] ?? [];
  const charts = CHARTS[profile.id] ?? {};
  const isBenchmark = profile.id === 'buy-and-hold';

  return (
    <>
      <section className="strat-section">
        <h3 className="strat-section-title">{rows.length} market windows</h3>
        <p className="strat-prose">
          {isBenchmark
            ? 'One line per window: buy and hold on its own, starting at an index of 100 on the first session. Daily closes, fees and slippage are included, and the label carries that window’s ending value.'
            : 'Each run starts at an index of 100 on its first session, so the strategy and the market are read on the same scale. Daily closes, fees and slippage are included; the legend carries the numbers for both lines.'}
        </p>
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
          </figure>
        ))}
      </div>
    </>
  );
}

function Glossary({ profile }: { profile: StrategyProfile }) {
  const terms = Object.entries(profile.glossary);
  return (
    <section className="strat-section">
      <h3 className="strat-section-title">{terms.length} terms used in this strategy</h3>
      <dl className="strat-glossary">
        {terms.map(([term, entry]) => (
          <div key={term} className="strat-glossary-item">
            <dt>{term.replace(/_/g, ' ')}</dt>
            <dd>
              {entry.definition}
              {entry.example && <span className="strat-glossary-example">{entry.example}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/* ---------- Page ---------- */

export const StrategiesPage: React.FC = () => {
  const [activeId, setActiveId] = useState(STRATEGIES[0].id);
  const [tab, setTab] = useState<TabKey>('overview');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const profile = STRATEGIES.find((strategy) => strategy.id === activeId) ?? STRATEGIES[0];
  const windows = (BACKTESTS[profile.id] ?? []).length;

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
            {tab === 'glossary' && <Glossary profile={profile} />}
          </div>
        </article>
      </div>
    </div>
  );
};

export default StrategiesPage;
