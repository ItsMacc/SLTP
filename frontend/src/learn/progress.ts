// progress.ts - Learning progress: completed sections, earned milestones,
// tier certifications, and the ids of every badge/trophy actually earned.
//
// Stored in Supabase (see migrations/supabase_learn.sql):
//   learn_progress - sections / milestones / certifications
//   user_awards    - one row per badge & trophy, stamped with earned_at
//                    when it is won
// Turso stays out of learning state.
//
// Not signed in, or Supabase unreachable (or the migration not yet run)?
// Progress falls back to localStorage so the course still remembers where
// you were. Whatever the source, a copy always lands in localStorage so a
// later offline visit still knows your state.

import { supabase } from '../../lib/supabase';
import { badgeAwardId, loadLearnState, saveLearnState, trophyAwardId } from '../../lib/learnApi';

export interface LearnProgress {
  sections: string[]; // completed section ids
  milestones: string[]; // earned milestone ids
  certifications: string[]; // certified tier ids
  /** Catalog ids of awards earned - see learnApi for the id format. */
  awards: string[]; // `badge:stocks`, `trophy:tier1`, ...
}

const EMPTY: LearnProgress = { sections: [], milestones: [], certifications: [], awards: [] };

// The cache is namespaced per account id. A single shared key meant signing in
// as a second account on the same browser could adopt the first account's
// badges - exactly what must NOT happen, since Supabase is authoritative for
// each user and the local copy is only a fallback.
const CACHE_PREFIX = 'sltp_learn_progress.';

/** 'anon' while signed out, so offline work still caches under one key. */
function cacheKey(userId?: string | null): string {
  return `${CACHE_PREFIX}${userId ?? 'anon'}`;
}

const normalize = (raw: unknown): LearnProgress => {
  if (!raw || typeof raw !== 'object') return { ...EMPTY };
  const r = raw as Partial<Record<keyof LearnProgress, unknown>>;
  const pick = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  return {
    sections: pick(r.sections),
    milestones: pick(r.milestones),
    certifications: pick(r.certifications),
    awards: pick(r.awards),
  };
};

const cache = (p: LearnProgress, userId?: string | null) => {
  try { localStorage.setItem(cacheKey(userId), JSON.stringify(p)); } catch { /* private mode */ }
};

const readCache = (userId?: string | null): LearnProgress | null => {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    return raw ? normalize(JSON.parse(raw)) : null;
  } catch { /* corrupt/unavailable */ return null; }
};

/**
 * Loads progress: Supabase first (authoritative), then localStorage.
 *
 * Supabase is the source of truth once the tables exist. Awards are merged
 * from both sources rather than preferring one, so a badge earned while
 * offline (and cached locally) is never lost the moment you sign back in.
 */
export async function loadProgress(): Promise<LearnProgress> {
  let userId: string | null = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch { /* offline: treat as signed out */ }

  const local = readCache(userId);

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const remote = await loadLearnState(user.id);
      if (remote) {
        // RLS hides other users' rows, so an empty remote read is ambiguous:
        // it means either "brand-new account, nothing done yet" or "no row
        // yet". If Supabase has no progression at all, the local copy is the
        // better answer - otherwise signing in would wipe modules finished
        // while signed out.
        const remoteIsEmpty =
          !remote.sections.length && !remote.milestones.length && !remote.certifications.length;

        const merged: LearnProgress = remoteIsEmpty && local
          ? { ...local, awards: Array.from(new Set([...remote.awards, ...local.awards])) }
          : {
              sections: remote.sections,
              milestones: remote.milestones,
              certifications: remote.certifications,
              // Union: Supabase's earned set plus anything cached locally but
              // not yet synced.
              awards: Array.from(new Set([...remote.awards, ...(local?.awards ?? [])])),
            };
        cache(merged, userId);
        return merged;
      }
    }
  } catch { /* fall through to local */ }

  return local ?? { ...EMPTY };
}

/**
 * Saves progress: localStorage always, Supabase when signed in (best-effort).
 *
 * `justEarned` lists the award ids won since the last save, so the badge rows
 * created (locked) at signup get stamped with earned_at rather than being
 * inserted twice.
 */
export async function saveProgress(p: LearnProgress, justEarned: string[] = []): Promise<void> {
  const clean = normalize(p);
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id ?? null;
    cache(clean, userId);
    if (!user) return; // offline / signed out: local copy survives
    await saveLearnState(
      user.id,
      {
        sections: clean.sections,
        milestones: clean.milestones,
        certifications: clean.certifications,
        awards: clean.awards,
      },
      justEarned,
    );
  } catch { /* offline: local copy survives */ }
}

/** Award id for a module badge, re-exported so callers need one import. */
export { badgeAwardId, trophyAwardId };
