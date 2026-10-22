// LearnShell - the page body of the course: a tier sidebar that reveals one
// module at a time, the badge/trophy shelf, and the tier-grouped content
// column. Split out of LearnPage.tsx only because it is long; it is rendered
// by LearnPage and shares its helpers.

import { useState } from 'react';
import {
  Check, ChevronDown, ChevronRight, Lock, Medal, Sparkles, Target, Trophy,
} from 'lucide-react';
import { TIERS, type Tier } from '../../learn/curriculum';
import { trophyFor } from '../../learn/badges';
import type { useLearn } from '../../learn/useLearn';
import { LoaderInline } from '../../ui/Loader';
import { GateQuiz } from './LearnCredentials';

type LearnApi = ReturnType<typeof useLearn>;

// ============================================================
// Badge shelf - every badge and trophy earned so far
// ============================================================
export function BadgeShelf({ learn }: { learn: LearnApi }) {
  const earned = learn.earnedBadges;
  const trophies = learn.earnedTrophies;
  const lockedTrophies = TIERS.map((tier, i) => ({ tier, ...trophyFor(i) }))
    .filter(({ tier }) => !learn.isCertified(tier.id));

  return (
    <div className="learn-shelf">
      <div className="learn-shelf-head">
        <div>
          <p className="learn-shelf-title">Badge case</p>
          <p className="learn-shelf-sub">
            {earned.length} badge{earned.length === 1 ? '' : 's'} · {trophies.length} trophy
            {trophies.length === 1 ? '' : 'ies'}, saved to your account.
          </p>
          {/* The badge lands on screen at once, but the write to the account
              store takes a moment: the stock line says it is still going. */}
          {learn.saving && (
            <p className="learn-shelf-saving" role="status">
              <LoaderInline size={14} /> Saving your progress…
            </p>
          )}
        </div>
        <span className="learn-shelf-count">{earned.length}</span>
      </div>

      {earned.length === 0 ? (
        <p className="learn-shelf-empty">
          Nothing here yet. Finish your first module and its badge lands in this case
          instantly.
        </p>
      ) : (
        <ul className="learn-badgegrid">
          {earned.map((b) => {
            const Icon = b.icon;
            return (
              <li key={b.id} className="learn-badge" title={b.name}>
                <span className="learn-badge-icon"><Icon size={20} /></span>
                <span className="learn-badge-name">{b.name}</span>
              </li>
            );
          })}
        </ul>
      )}

      <p className="learn-shelf-subhead">Tier trophies</p>
      <ul className="learn-trophyrow">
        {trophies.map(({ tier, label, icon: Icon, metal }) => (
          <li key={tier.id} className={`learn-trophy is-earned is-${metal}`} title={`${label} Trophy, ${tier.certification}`}>
            <span className="learn-trophy-icon"><Icon size={22} /></span>
            <span className="learn-trophy-label">{label}</span>
          </li>
        ))}
        {lockedTrophies.map(({ tier, label, icon: Icon, metal }) => (
          <li key={tier.id} className={`learn-trophy is-locked is-${metal}`} title={`Locked, certify Tier ${tier.roman} to earn this`}>
            <span className="learn-trophy-icon"><Icon size={22} /></span>
            <span className="learn-trophy-label">{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================
// Sidebar - tiers on the left, revealed modules nested underneath
// ============================================================
export function TierNav({ learn, activeId, onJump }: {
  learn: LearnApi;
  activeId: string;
  onJump: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <aside className="learn-toc">
      <p className="learn-toc-heading">Your path</p>

      <button
        type="button"
        className={`learn-toc-link learn-toc-link-plain ${activeId === 'start' ? 'is-active' : ''}`}
        onClick={() => onJump('start')}
      >
        <span className="learn-toc-num">00</span>Start here
      </button>
      <button
        type="button"
        className={`learn-toc-link learn-toc-link-plain ${activeId === 'credentials' ? 'is-active' : ''}`}
        onClick={() => onJump('credentials')}
      >
        <span className="learn-toc-num">★</span>Your badges
      </button>

      <p className="learn-toc-heading learn-toc-heading-tiers">Tiers</p>

      {TIERS.map((tier, idx) => {
        const status = learn.tierStatus(tier);
        const locked = status === 'locked';
        const visible = locked ? [] : learn.visibleSections(tier);
        const open = !collapsed[tier.id];
        const pct = learn.tierPercent(tier);
        const TrophyIcon = status === 'certified' ? Trophy : Medal;

        return (
          <div key={tier.id} className={`learn-toc-tier is-${status}`}>
            <div className="learn-toc-tier-row">
              <button
                type="button"
                className={`learn-toc-tier-head ${activeId === tier.id ? 'is-active' : ''}`}
                onClick={() => !locked && visible.length && onJump(visible[visible.length - 1].id)}
                aria-expanded={open && !locked}
              >
                <span className="learn-toc-num">{idx + 1}</span>
                <span className="learn-toc-tier-body">
                  <span className="learn-toc-tier-title">{shortTierTitle(tier)}</span>
                  <span className="learn-toc-tier-meta">
                    {locked ? (
                      <><Lock size={11} /> Locked</>
                    ) : status === 'certified' ? (
                      <><TrophyIcon size={11} /> Certified</>
                    ) : (
                      <>{pct}% · module {visible.length}</>
                    )}
                  </span>
                </span>
                {!locked && (
                  <span
                    className="learn-toc-caret"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCollapsed((c) => ({ ...c, [tier.id]: !c[tier.id] }));
                    }}
                    role="button"
                    tabIndex={-1}
                    aria-hidden
                  >
                    {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                )}
              </button>
            </div>

            {open && visible.length > 0 && (
              <ul className="learn-toc-modules">
                {visible.map((s) => {
                  const done = learn.isSectionDone(s.id);
                  const current = activeId === s.id;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        className={`learn-toc-link ${current ? 'is-active' : ''} ${done ? 'is-done' : ''}`}
                        onClick={() => onJump(s.id)}
                      >
                        <span className="learn-toc-num">{s.num.toLowerCase()}.</span>
                        <span className="learn-toc-module-label">{s.label}</span>
                        {done && <Check size={13} className="learn-toc-tick" />}
                      </button>
                    </li>
                  );
                })}
                {status !== 'certified' && learn.gateAvailable(tier) && (
                  <li>
                    <button
                      type="button"
                      className={`learn-toc-link learn-toc-link-gate ${activeId === `gate-${tier.id}` ? 'is-active' : ''}`}
                      onClick={() => onJump(`gate-${tier.id}`)}
                    >
                      <span className="learn-toc-num">★</span>
                      <span className="learn-toc-module-label">{tier.certification}</span>
                    </button>
                  </li>
                )}
              </ul>
            )}
          </div>
        );
      })}
    </aside>
  );
}

/** The nav shows the memorable half of each tier name, not the full thesis. */
function shortTierTitle(tier: Tier): string {
  return tier.title.split(/[:,&]/)[0].trim();
}

/** Progress header shown above a tier's modules. */
export function TierBanner({ tier, learn, index, id }: {
  tier: Tier;
  learn: LearnApi;
  index: number;
  /** Scroll target: the tier the learner has just unlocked. */
  id?: string;
}) {
  const pct = learn.tierPercent(tier);
  const certified = learn.isCertified(tier.id);
  return (
    <div id={id} className={`learn-tierbanner is-${learn.tierStatus(tier)}`}>
      <div className="learn-tierbanner-head">
        <span className="learn-tierbanner-num">{index + 1}</span>
        <div>
          <p className="learn-tierbanner-kicker">Tier {tier.roman}</p>
          <h2 className="learn-tierbanner-title">{tier.title}</h2>
        </div>
        <span className="learn-tierbanner-status">
          {certified ? <><Trophy size={14} /> Certified</> : <>{pct}%</>}
        </span>
      </div>
      <p className="learn-tierbanner-objective">{tier.objective}</p>
      <div className="learn-progressbar">
        <div className="learn-progressbar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** End-of-tier certification quiz, rendered right after the tier's last module. */
export function TierGate({ tier, learn }: { tier: Tier; learn: LearnApi }) {
  return (
    <div className="learn-tiergate">
      <p className="learn-tiergate-kicker">
        <Sparkles size={14} /> Tier {tier.roman} certification quiz
      </p>
      <div id={`gate-${tier.id}`}>
        <GateQuiz tier={tier} learn={learn} />
      </div>
      <p className="learn-tiergate-next">
        <Target size={13} /> Pass this and the {tier.roman === 'V' ? 'course' : 'next tier'} unlocks,
        along with your trophy.
      </p>
    </div>
  );
}
