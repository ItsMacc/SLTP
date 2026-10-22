// useLearn.ts — One hook that joins curriculum (what exists) with
// progress (what's done): load/save, section completion, milestone
// evaluation, and the certification gate.
//
// Progression rules:
//   Tiers unlock in order. Tier I is always open; Tier N opens when Tier N-1
//   is certified. Locked tiers hide their modules entirely.
//   Within an open tier, modules reveal one at a time: module N+1 appears
//   only once module N is complete. That keeps a beginner on exactly one
//   decision at a time instead of staring at a wall of eight topics.
//   Completing a module awards its badge automatically; finishing every
//   real module in a tier opens that tier's validation gate, which awards
//   the tier trophy (bronze → diamond) and unlocks the tier below.

import { useCallback, useEffect, useRef, useState } from 'react';
import { TIERS, type GateQuestion, type Tier, type TierSection } from './curriculum';
import { badgeFor, trophyFor } from './badges';
import { loadProgress, saveProgress, badgeAwardId, trophyAwardId, type LearnProgress } from './progress';

export type TierStatus = 'locked' | 'open' | 'certified';

/** A reward the learner just earned, for the toast popup. */
export interface Earned {
  kind: 'badge' | 'trophy' | 'milestone';
  name: string;
  detail: string;
  metal?: string;
  /** Supabase catalog id (`badge:stocks`), so the row can be stamped earned. */
  awardId: string;
}

export function useLearn() {
  const [progress, setProgress] = useState<LearnProgress>({ sections: [], milestones: [], certifications: [], awards: [] });
  const [loading, setLoading] = useState(true);
  // True while a progress write is still in flight, so the page can show the
  // stock loader instead of pretending the badge is already stored.
  const [saving, setSaving] = useState(false);
  // How many writes are still open: two badges earned in a row must not
  // clear the flag while the first write is still running.
  const pendingWrites = useRef(0);
  // Awards raised by this session, shown one at a time by the toast host.
  // The backlog lives in a ref and is drained by dismissToast, so showing the
  // next award is driven by the click that closed the previous one.
  const pending = useRef<Earned[]>([]);
  // Mirror of the toast currently on screen, so `announce` can tell whether a
  // toast is already up without reading state inside a setState updater.
  const showing = useRef<Earned | null>(null);
  const [toast, setToast] = useState<Earned | null>(null);

  useEffect(() => {
    let alive = true;
    loadProgress().then((p) => {
      if (alive) {
        setProgress(p);
        setLoading(false);
      }
    });
    return () => { alive = false; };
  }, []);

  /** Queue awards; show the first immediately unless one is already up. */
  const announce = useCallback((awards: Earned[]) => {
    if (!awards.length) return;
    pending.current.push(...awards);
    // Read the live value via a ref: inside a setState updater, touching
    // pending.current would be an impure side effect React may replay.
    if (showing.current) return;
    showing.current = pending.current.shift() ?? null;
    setToast(showing.current);
  }, []);

  /** Close the current toast and promote the next queued award, if any. */
  const dismissToast = useCallback(() => {
    showing.current = pending.current.shift() ?? null;
    setToast(showing.current);
  }, []);

  /**
   * Applies a progress change and persists it.
   *
   * `justEarned` is the set of Supabase award ids won in this same change;
   * they are recorded in the awards list and stamped earned_at on the
   * user's locked award rows.
   */
  const commit = useCallback((next: LearnProgress, justEarned: string[] = []) => {
    setProgress(next);
    pendingWrites.current += 1;
    setSaving(true);
    void saveProgress(next, justEarned).finally(() => {
      pendingWrites.current -= 1;
      if (pendingWrites.current <= 0) setSaving(false);
    });
  }, []);

  /** Tier unlocks when it's first, or the tier above it is certified. */
  const tierStatus = useCallback((tier: Tier): TierStatus => {
    const idx = TIERS.findIndex((t) => t.id === tier.id);
    if (progress.certifications.includes(tier.id)) return 'certified';
    if (idx <= 0 || progress.certifications.includes(TIERS[idx - 1].id)) return 'open';
    return 'locked';
  }, [progress.certifications]);

  /** Completing a section auto-awards its badge plus any milestones it completes. */
  const completeSection = useCallback((sectionId: string) => {
    if (progress.sections.includes(sectionId)) return;
    const sections = [...progress.sections, sectionId];
    const milestones = [...progress.milestones];
    const freshMilestones: string[] = [];
    for (const tier of TIERS) {
      for (const m of tier.milestones) {
        if (m.upcoming || milestones.includes(m.id)) continue;
        // Only milestones tied to the section just completed may fire. A
        // milestone unlocks because its LAST required module finished, so it
        // always includes sectionId. Scanning every milestone instead meant
        // any already-complete-but-unrecorded milestone (state that fell out
        // of sync) would pop on a completely unrelated module - badges
        // "triggered no matter what".
        if (!m.sections.includes(sectionId)) continue;
        if (m.sections.every((s) => sections.includes(s))) {
          milestones.push(m.id);
          freshMilestones.push(m.name);
        }
      }
    }
    const badge = badgeFor(sectionId);
    const badgeId = badgeAwardId(sectionId);

    commit(
      { ...progress, sections, milestones, awards: [...progress.awards, badgeId] },
      [badgeId],
    );

    const awards: Earned[] = [{
      kind: 'badge',
      name: badge.name,
      detail: `for completing “${labelForSection(sectionId)}”`,
      awardId: badgeId,
    }];
    for (const name of freshMilestones) {
      // Milestones share the module's badge row; no separate catalog entry.
      // They are announced as their own kind so a milestone never reads as a
      // "badge" that then fails to appear in the badge shelf.
      awards.push({ kind: 'milestone', name, detail: `for finishing “${labelForSection(sectionId)}”`, awardId: badgeId });
    }
    announce(awards);
  }, [progress, commit, announce]);

  const isSectionDone = useCallback((id: string) => progress.sections.includes(id), [progress.sections]);
  const isMilestoneEarned = useCallback((id: string) => progress.milestones.includes(id), [progress.milestones]);

  /** Modules of a tier the learner may currently see: revealed one at a time. */
  const visibleSections = useCallback((tier: Tier): TierSection[] => {
    if (tierStatus(tier) === 'locked') return [];
    const real = tier.sections.filter((s) => s.content);
    const out: TierSection[] = [];
    for (const s of real) {
      out.push(s);
      if (!progress.sections.includes(s.id)) break; // stop at the first unfinished one
    }
    return out;
  }, [tierStatus, progress.sections]);

  const isSectionRevealed = useCallback((tier: Tier, sectionId: string) =>
    visibleSections(tier).some((s) => s.id === sectionId), [visibleSections]);

  /** All real (non-stub) sections of a tier complete? Gate becomes available. */
  const gateAvailable = useCallback((tier: Tier) => {
    const real = tier.sections.filter((s) => s.content).map((s) => s.id);
    return real.every((id) => progress.sections.includes(id));
  }, [progress.sections]);

  /** Pass the tier's gate quiz -> certify the tier (trophy) and unlock the next. */
  const certifyTier = useCallback((tier: Tier) => {
    if (progress.certifications.includes(tier.id)) return;
    const idx = TIERS.findIndex((t) => t.id === tier.id);
    const trophy = trophyFor(idx);
    const trophyId = trophyAwardId(tier.id);
    commit(
      {
        ...progress,
        certifications: [...progress.certifications, tier.id],
        awards: [...progress.awards, trophyId],
      },
      [trophyId],
    );
    announce([{
      kind: 'trophy',
      name: `${trophy.label} Trophy`,
      metal: trophy.metal,
      detail: `tier certified, ${tier.certification}`,
      awardId: trophyId,
    }]);
  }, [progress, commit, announce]);

  const isCertified = useCallback((id: string) => progress.certifications.includes(id), [progress.certifications]);

  /** Percentage of a tier's real sections completed. */
  const tierPercent = useCallback((tier: Tier) => {
    const real = tier.sections.filter((s) => s.content).map((s) => s.id);
    if (!real.length) return 0;
    return Math.round((real.filter((id) => progress.sections.includes(id)).length / real.length) * 100);
  }, [progress.sections]);

  /** Every section completed so far, in curriculum order - drives the badge shelf. */
  const earnedSectionIds = orderedCompleted(progress.sections);
  const earnedBadges = earnedSectionIds.map((id) => ({ id, ...badgeFor(id) }));
  const earnedTrophies = TIERS.map((tier, i) => ({ tier, ...trophyFor(i) }))
    .filter(({ tier }) => progress.certifications.includes(tier.id));

  return {
    loading,
    saving,
    progress,
    toast,
    dismissToast,
    earnedBadges,
    earnedTrophies,
    tierStatus,
    visibleSections,
    isSectionRevealed,
    completeSection,
    isSectionDone,
    isMilestoneEarned,
    gateAvailable,
    certifyTier,
    isCertified,
    tierPercent,
  };
}

/** Curriculum order for a set of completed section ids (stable, deduped). */
function orderedCompleted(ids: string[]) {
  const order = TIERS.flatMap((t) => t.sections.filter((s) => s.content).map((s) => s.id));
  const done = new Set(ids);
  return order.filter((id) => done.has(id));
}

/** Human label for a section id, used in award copy. */
function labelForSection(sectionId: string): string {
  for (const tier of TIERS) {
    const hit = tier.sections.find((s) => s.id === sectionId);
    if (hit) return hit.label;
  }
  return sectionId;
}

/** Scores a gate submission: correct count + pass flag (all must be right). */
export function scoreGate(questions: GateQuestion[], answers: (number | null)[]) {
  const correct = questions.reduce((n, q, i) => n + (answers[i] === q.answer ? 1 : 0), 0);
  return { correct, passed: questions.length > 0 && correct === questions.length };
}
