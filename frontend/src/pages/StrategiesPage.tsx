// StrategiesPage.tsx — the strategy library: one card per strategy, each
// opening onto the full write-up.
//
// All copy comes from data/strategies.ts, so the page has no prose of its own
// beyond its header. Every card follows the same order: the idea, the case for
// it, the case against it, the notes behind the rules, what it holds, and the
// settings the engine runs. Glossary terms are marked inline by GlossaryText
// and shown in a tooltip, with no glossary section on the page.

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { GlossaryText } from '../components/GlossaryText';
import { STRATEGIES, type StrategyProfile } from '../data/strategies';
import './StrategiesPage.css';

interface StrategiesPageProps {
  onNavigate?: (tab: string) => void;
}

/* One numbered card. The header stays visible when the write-up closes, so the
   name, the summary and the four facts are always scannable. */
function StrategyCard({
  profile,
  index,
  open,
  onToggle,
  onNavigate,
}: {
  profile: StrategyProfile;
  index: number;
  open: boolean;
  onToggle: () => void;
  onNavigate?: (tab: string) => void;
}) {
  const panelId = `strat-panel-${profile.id}`;
  const nameId = `strat-name-${profile.id}`;

  return (
    <article className={`strat-card ${open ? 'is-open' : ''}`} aria-labelledby={nameId}>
      <header className="strat-card-head">
        <div className="strat-card-topline">
          <span className="strat-card-num">{String(index + 1).padStart(2, '0')}</span>
          <span className="strat-card-category">{profile.category}</span>
        </div>

        <h2 className="strat-card-name" id={nameId}>
          {profile.name}
        </h2>

        <p className="strat-card-summary">
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

        <button
          type="button"
          className="strat-toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
        >
          <span>{open ? 'Close the write-up' : 'Read the full write-up'}</span>
          <ChevronDown size={16} className="strat-toggle-icon" aria-hidden="true" />
        </button>
      </header>

      <div className="strat-body" id={panelId} hidden={!open}>
        <div className="strat-body-inner">
          <section className="strat-section">
            <h3 className="strat-section-title">The idea</h3>
            <p className="strat-prose">
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
              <h3 className="strat-note-title">{note.title}</h3>
              <p className="strat-prose">
                <GlossaryText text={note.body} glossary={profile.glossary} />
              </p>
            </section>
          ))}

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
              <h3 className="strat-note-title">{note.title}</h3>
              <p className="strat-prose">
                <GlossaryText text={note.body} glossary={profile.glossary} />
              </p>
            </section>
          ))}

          {onNavigate && (
            <footer className="strat-card-foot">
              <button type="button" className="strat-run" onClick={() => onNavigate('research')}>
                Run {profile.name} on real dates
              </button>
            </footer>
          )}
        </div>
      </div>
    </article>
  );
}

export const StrategiesPage: React.FC<StrategiesPageProps> = ({ onNavigate }) => {
  // One card opens at a time. The first one starts open, so the page lands on
  // a full write-up rather than five closed headers.
  const [openId, setOpenId] = useState<string | null>(STRATEGIES[0]?.id ?? null);

  return (
    <div className="strat-page">
      <header className="strat-head">
        <p className="strat-eyebrow">Strategy library</p>
        <h1 className="strat-title">How each strategy thinks</h1>
        <p className="strat-lede">
          {STRATEGIES.length} rule sets, each written out the same way: the idea behind it, the
          case for it, the case against it, what it actually buys, and every setting the engine
          runs. Underlined words carry a plain-language definition on hover or tap.
        </p>
        <p className="strat-head-note">
          Everything below is a rule, not a result. To see what a rule did over a set of real
          dates, run it on the Research page.
        </p>
      </header>

      <div className="strat-cards">
        {STRATEGIES.map((profile, index) => (
          <StrategyCard
            key={profile.id}
            profile={profile}
            index={index}
            open={openId === profile.id}
            onToggle={() => setOpenId((current) => (current === profile.id ? null : profile.id))}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  );
};

export default StrategiesPage;
