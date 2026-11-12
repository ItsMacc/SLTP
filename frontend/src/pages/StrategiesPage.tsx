// StrategiesPage.tsx — the strategy library: an index on the left, one detail
// card on the right, two tabs.
//
// All copy comes from data/strategies.ts, so the page adds no prose of its own
// beyond its header. The Overview tab carries the idea, the case for it and the
// case against it, plus the notes behind the rules. The Mechanics tab carries
// what the strategy holds, the settings the engine runs, and the notes on how a
// day actually executes. Glossary terms are marked inline by GlossaryText and
// shown in a tooltip, with no glossary tab on the page.

import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { ChevronRight } from 'lucide-react';
import { GlossaryText } from '../components/GlossaryText';
import { STRATEGIES, type StrategyProfile } from '../data/strategies';
import './StrategiesPage.css';

interface StrategiesPageProps {
  onNavigate?: (tab: string) => void;
}

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'mechanics', label: 'Mechanics' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

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

/* ---------- Page ---------- */

export const StrategiesPage: React.FC<StrategiesPageProps> = ({ onNavigate }) => {
  const [activeId, setActiveId] = useState(STRATEGIES[0].id);
  const [tab, setTab] = useState<TabKey>('overview');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const profile = STRATEGIES.find((strategy) => strategy.id === activeId) ?? STRATEGIES[0];

  // A new strategy always opens on Overview: the idea is where a reader starts,
  // and carrying the old tab across would drop them mid-argument.
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
    <div className="strat-page">
      <header className="strat-head">
        <p className="strat-eyebrow">Strategy library</p>
        <h1 className="strat-title">How each strategy thinks</h1>
        <p className="strat-lede">
          {STRATEGIES.length} rule sets, each written out in the same order: the idea behind it, the
          case for and against it, what it actually buys, and every setting the engine runs.
          Underlined words carry a plain-language definition on hover or tap.
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

        <article className="strat-detail">
          <header className="strat-detail-head">
            <p className="strat-detail-kicker">{profile.category} strategy</p>
            <h2 className="strat-detail-name">{profile.name}</h2>
            <p className="strat-detail-summary">
              <GlossaryText text={profile.summary} glossary={profile.glossary} />
            </p>
            <p className="strat-detail-record">
              Rules, not results: every parameter below is one the engine runs. The Research page
              replays them over any dates you pick.
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
