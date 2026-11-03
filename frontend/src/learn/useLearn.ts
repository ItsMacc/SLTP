// useLearn.ts — One hook that joins curriculum (what exists) with
// progress (what's done): load/save, lesson completion, and the tier quiz.
//
// Progression rules:
//   Tiers unlock in order. Tier I is always open; Tier N opens when Tier N-1
//   is finished. Locked tiers hide their lessons entirely.
//   Within an open tier, lessons reveal one at a time: lesson N+1 appears
//   only once lesson N is done. That keeps a beginner on exactly one
//   decision at a time instead of staring at a wall of eight topics.
//   Marking a lesson done awards its badge; finishing every lesson in a tier
//   opens that tier's quiz, which awards the tier certificate and unlocks
//   the tier below.

import { useCallback, useEffect, useRef, useState } from 'react';
import { TIERS, type GateQuestion, type Tier, type TierSection } from './curriculum';
import { badgeFor, certificateFor } from './badges';
import { loadProgress, saveProgress, badgeAwardId, certificateAwardId, type LearnProgress } from './progress';

export type TierStatus = 'locked' | 'open' | 'certified';

/** A reward the learner just earned, for the toast popup. */
export interface Earned {
  kind: 'badge' | 'certificate';
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

  /** Marking a lesson done auto-awards its badge. One badge, one toast. */
  const completeSection = useCallback((sectionId: string) => {
    if (progress.sections.includes(sectionId)) return;
    const sections = [...progress.sections, sectionId];
    const badge = badgeFor(sectionId);
    const badgeId = badgeAwardId(sectionId);

    commit(
      { ...progress, sections, awards: [...progress.awards, badgeId] },
      [badgeId],
    );

    announce([{
      kind: 'badge',
      name: badge.name,
      detail: `for finishing “${labelForSection(sectionId)}”`,
      awardId: badgeId,
    }]);
  }, [progress, commit, announce]);

  const isSectionDone = useCallback((id: string) => progress.sections.includes(id), [progress.sections]);

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

  /** Pass the tier quiz -> award the tier certificate and unlock the next tier. */
  const certifyTier = useCallback((tier: Tier) => {
    if (progress.certifications.includes(tier.id)) return;
    const idx = TIERS.findIndex((t) => t.id === tier.id);
    const art = certificateFor(idx);
    const certificateId = certificateAwardId(tier.id);
    commit(
      {
        ...progress,
        certifications: [...progress.certifications, tier.id],
        awards: [...progress.awards, certificateId],
      },
      [certificateId],
    );
    announce([{
      kind: 'certificate',
      name: tier.certification,
      metal: art.metal,
      detail: `${tier.name} certificate`,
      awardId: certificateId,
    }]);
  }, [progress, commit, announce]);

  const isCertified = useCallback((id: string) => progress.certifications.includes(id), [progress.certifications]);

  /** Badge count for a tier: how many of its lessons are done, and how many exist. */
  const tierCounts = useCallback((tier: Tier) => {
    const real = tier.sections.filter((s) => s.content);
    return {
      done: real.filter((s) => progress.sections.includes(s.id)).length,
      total: real.length,
    };
  }, [progress.sections]);

  /**
   * The first unfinished lesson in curriculum order, which is what "Up next"
   * points at. Null once every lesson is done.
   */
  // Cheap to recompute: a handful of lessons, so no memo to keep in sync.
  const nextLesson = (() => {
    let index = 0;
    for (const [tierIndex, tier] of TIERS.entries()) {
      for (const section of tier.sections.filter((s) => s.content)) {
        index += 1;
        if (!progress.sections.includes(section.id)) {
          return { tier, tierIndex, section, index };
        }
      }
    }
    return null;
  })();

  /** Total lessons and badges in the course, derived from the curriculum. */
  const totals = (() => {
    const lessons = TIERS.flatMap((t) => t.sections.filter((s) => s.content));
    return { lessons: lessons.length, done: lessons.filter((s) => progress.sections.includes(s.id)).length };
  })();

  /** Every lesson completed so far, in curriculum order. */
  const earnedSectionIds = orderedCompleted(progress.sections);
  const earnedBadges = earnedSectionIds.map((id) => ({ id, ...badgeFor(id) }));
  const earnedCertificates = TIERS.map((tier, i) => ({ tier, ...certificateFor(i) }))
    .filter(({ tier }) => progress.certifications.includes(tier.id));

  return {
    loading,
    saving,
    progress,
    toast,
    dismissToast,
    earnedBadges,
    earnedCertificates,
    tierCounts,
    nextLesson,
    totals,
    tierStatus,
    visibleSections,
    isSectionRevealed,
    completeSection,
    isSectionDone,
    gateAvailable,
    certifyTier,
    isCertified,
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
