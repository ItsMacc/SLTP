// learnApi.ts — Supabase storage for learning progress, badges and trophies.
//
// Storage lives in three tables (see migrations/supabase_learn.sql):
//   learn_awards  — the catalog: one row per badge/trophy, for everyone
//   user_awards   — what a learner holds; seeded LOCKED at signup
//   learn_progress — which modules/tiers are done
//
// The signup trigger already seeds user_awards server-side. seedNewAccount()
// is the belt-and-braces path for a brand-new account: it is idempotent
// (ON CONFLICT DO NOTHING), so running it on every signup is safe, and it
// never touches anyone else's rows.
//
// Every function resolves to a result object instead of throwing: if the
// migration has not been run yet the course must still work off local
// storage, so callers can decide whether to fall back.

import { supabase } from './supabase'

export type AwardKind = 'badge' | 'trophy'

export interface AwardRow {
  id: string
  kind: AwardKind
  section_id: string | null
  tier_id: string | null
  name: string
  icon: string
  metal: string | null
}

export interface LearnState {
  sections: string[]
  milestones: string[]
  certifications: string[]
  /** Catalog ids of awards this learner has actually earned. */
  awards: string[]
}

/** Catalog id for a module badge — must match the ids in supabase_learn.sql. */
export const badgeAwardId = (sectionId: string) => `badge:${sectionId}`

/** Catalog id for a tier trophy. */
export const trophyAwardId = (tierId: string) => `trophy:${tierId}`

/**
 * Give a freshly created account its badge set.
 *
 * Runs on signup only (never as a backfill). Safe to call repeatedly: the
 * progress row upserts, and the locked award rows are inserted only where
 * missing, so an award already earned is never downgraded.
 */
export const seedNewAccount = async (userId: string): Promise<{ ok: boolean; error?: string }> => {
  const { error: progressError } = await supabase
    .from('learn_progress')
    .upsert({ user_id: userId }, { onConflict: 'user_id' })

  if (progressError) return { ok: false, error: progressError.message }

  return seedUserAwards(userId)
}

/** Reads the award catalog. Shared reference data — identical for everyone. */
export const getAwardCatalog = async (): Promise<AwardRow[]> => {
  const { data, error } = await supabase
    .from('learn_awards')
    .select('id, kind, section_id, tier_id, name, icon, metal')
    .order('sort_order', { ascending: true })

  if (error || !data) return []
  return data as AwardRow[]
}

/**
 * Seed the caller's own locked award rows from the catalog.
 *
 * Separate from seedNewAccount so the signup call stays readable, and so a
 * half-finished signup (progress row written, awards not yet) can be
 * completed later without duplicating logic. Scoped to the caller's uid by
 * RLS, and only inserts rows that do not exist.
 */
export const seedUserAwards = async (userId: string): Promise<{ ok: boolean; error?: string }> => {
  const { data: existing, error: existingError } = await supabase
    .from('user_awards')
    .select('award_id')
    .eq('user_id', userId)

  if (existingError) return { ok: false, error: existingError.message }

  const held = new Set(((existing ?? []) as { award_id: string }[]).map((r) => r.award_id))
  const catalog = await getAwardCatalog()
  const missing = catalog.filter((a) => !held.has(a.id)).map((a) => ({ user_id: userId, award_id: a.id }))

  if (!missing.length) return { ok: true }

  const { error } = await supabase.from('user_awards').insert(missing)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Loads progress + earned award ids for a learner. Null if nothing stored yet. */
export const loadLearnState = async (userId: string): Promise<LearnState | null> => {
  const [{ data: progress, error: progressError }, { data: awards, error: awardsError }] =
    await Promise.all([
      supabase
        .from('learn_progress')
        .select('sections, milestones, certifications')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('user_awards')
        .select('award_id')
        .eq('user_id', userId)
        .not('earned_at', 'is', null),
    ])

  // Only one of the two failing is enough to fall back to local storage.
  if (progressError || awardsError) return null

  return {
    sections: (progress?.sections as string[]) ?? [],
    milestones: (progress?.milestones as string[]) ?? [],
    certifications: (progress?.certifications as string[]) ?? [],
    awards: ((awards ?? []) as { award_id: string }[]).map((r) => r.award_id),
  }
}

/**
 * Persists progression and stamps the awards just earned.
 *
 * Both writes are fire-and-forget from the caller's perspective: the local
 * copy in learn/progress.ts is what drives the UI, so a failed write never
 * blocks the learner — it just means the next load falls back.
 */
export const saveLearnState = async (
  userId: string,
  state: LearnState,
  justEarned: string[] = []
): Promise<{ ok: boolean; error?: string }> => {
  const { error: progressError } = await supabase.from('learn_progress').upsert(
    {
      user_id: userId,
      sections: state.sections,
      milestones: state.milestones,
      certifications: state.certifications,
    },
    { onConflict: 'user_id' },
  )

  if (progressError) return { ok: false, error: progressError.message }

  if (!justEarned.length) return { ok: true }

  // Stamping earned_at is what actually "earns" a badge; the row was already
  // there, locked, from signup.
  const { error: awardError } = await supabase
    .from('user_awards')
    .update({ earned_at: new Date().toISOString() })
    .eq('user_id', userId)
    .in('award_id', justEarned)

  return awardError ? { ok: false, error: awardError.message } : { ok: true }
}
