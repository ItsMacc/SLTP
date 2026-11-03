// LearnShell - the page body of the course: a tier sidebar that reveals one
// lesson at a time, the badge shelf, and the tier-grouped content column.
// Split out of LearnPage.tsx only because it is long; it is rendered by
// LearnPage and shares its helpers.

import { useState } from 'react';
import {
  Award, Check, ChevronDown, ChevronRight, Lock, Sparkles, Target,
} from 'lucide-react';
import { TIERS, type Tier } from '../../learn/curriculum';
import { badgeFor, certificateFor } from '../../learn/badges';
import type { useLearn } from '../../learn/useLearn';
import { LoaderInline } from '../../ui/Loader';
import { GateQuiz } from './LearnCredentials';

type LearnApi = ReturnType<typeof useLearn>;

// ============================================================
// Badge shelf - every badge in every tier you can reach, earned or not,
// so a beginner can see what is ahead instead of a wall of empty space.
// ============================================================
export function BadgeShelf({ learn }: { learn: LearnApi }) {
  const certificates = TIERS.filter((tier) => learn.isCertified(tier.id)).length;

  return (
    <div className="learn-shelf">
      <div className="learn-shelf-head">
        <div>
          <p className="learn-shelf-title">Badges</p>
          <p className="learn-shelf-sub">
            {learn.earnedBadges.length === 0
              ? 'Nothing earned yet. Each badge fills in when you finish its lesson.'
              : `${learn.earnedBadges.length} of ${learn.totals.lessons} badges, ${certificates} of ${TIERS.length} certificates.`}
          </p>
          {/* The badge lands on screen at once, but the write to the account
              store takes a moment: this line says it is still going. */}
          {learn.saving && (
            <p className="learn-shelf-saving" role="status">
              <LoaderInline size={14} /> Saving…
            </p>
          )}
        </div>
      </div>

      {TIERS.map((tier, i) => {
        if (learn.tierStatus(tier) === 'locked') return null;
        const counts = learn.tierCounts(tier);
        return (
          <div key={tier.id} className="learn-shelf-group">
            <p className="learn-shelf-group-head">
              <span className="learn-shelf-group-num">{i + 1}</span>
              {shortTierTitle(tier)}
              <span className="learn-shelf-group-meta">
                {counts.done} of {counts.total} lessons
              </span>
            </p>
            <ul className="learn-badgegrid">
              {tier.sections.filter((s) => s.content).map((s) => {
                const badge = badgeFor(s.id);
                const Icon = badge.icon;
                const earned = learn.isSectionDone(s.id);
                return (
                  <li
                    key={s.id}
                    className={`learn-badge ${earned ? 'is-earned' : 'is-locked'}`}
                    aria-label={`${badge.name}, ${earned ? 'earned' : 'not earned yet'}`}
                  >
                    <span className="learn-badge-icon"><Icon size={18} /></span>
                    <span className="learn-badge-name">{badge.name}</span>
                    <span className="learn-badge-state">{earned ? 'Earned' : s.label}</span>
                  </li>
                );
              })}
              <CertificateBadge tier={tier} index={i} earned={learn.isCertified(tier.id)} />
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/** The end-of-tier certificate, shown as one more (squarer) badge. */
function CertificateBadge({ tier, index, earned }: { tier: Tier; index: number; earned: boolean }) {
  const art = certificateFor(index);
  const Icon = art.icon;
  return (
    <li
      className={`learn-badge learn-badge-cert ${earned ? 'is-earned' : 'is-locked'} is-${art.metal}`}
      aria-label={`${tier.certification}, level certificate, ${earned ? 'earned' : 'not earned yet'}`}
    >
      <span className="learn-badge-icon"><Icon size={18} /></span>
      <span className="learn-badge-name">{tier.certification}</span>
      <span className="learn-badge-state">Certificate</span>
    </li>
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
        <span className="learn-toc-num">00</span>Course map
      </button>
      <button
        type="button"
        className={`learn-toc-link learn-toc-link-plain ${activeId === 'credentials' ? 'is-active' : ''}`}
        onClick={() => onJump('credentials')}
      >
        <span className="learn-toc-num">★</span>Your badges
      </button>

      <p className="learn-toc-heading learn-toc-heading-tiers">Levels</p>

      {TIERS.map((tier, idx) => {
        const status = learn.tierStatus(tier);
        const locked = status === 'locked';
        const visible = locked ? [] : learn.visibleSections(tier);
        const open = !collapsed[tier.id];
        const counts = learn.tierCounts(tier);

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
                      <><Award size={11} /> Certificate</>
                    ) : (
                      <>{counts.done} of {counts.total} badges</>
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
  const counts = learn.tierCounts(tier);
  const pct = counts.total ? Math.round((counts.done / counts.total) * 100) : 0;
  const certified = learn.isCertified(tier.id);
  return (
    <div id={id} className={`learn-tierbanner is-${learn.tierStatus(tier)}`}>
      <div className="learn-tierbanner-head">
        <span className="learn-tierbanner-num">{index + 1}</span>
        <div>
          <p className="learn-tierbanner-kicker">{tier.name} level</p>
          <h2 className="learn-tierbanner-title">{tier.title}</h2>
        </div>
        <span className="learn-tierbanner-status">
          {certified ? <><Award size={14} /> Certificate</> : <>{counts.done} of {counts.total} badges</>}
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
        <Sparkles size={14} /> {tier.name} quiz
      </p>
      <div id={`gate-${tier.id}`}>
        <GateQuiz tier={tier} learn={learn} />
      </div>
      <p className="learn-tiergate-next">
        <Target size={13} /> Pass this and the certificate is yours, and
        {tier.id === 'advanced' ? ' the course is finished.' : ' the next level opens.'}
      </p>
    </div>
  );
}
