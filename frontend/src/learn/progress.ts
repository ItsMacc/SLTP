// progress.ts — Learning progress: completed lessons, certificates, earned
// dates, first-try quiz scores and the last level viewed.
//
// Supabase stores the completion sets and award ids (see lib/learnApi.ts).
// Dates, first-try scores and the last level are browser metadata, cached
// alongside the same progress so an offline visit keeps them. No migration is
// needed: the remote schema is unchanged.

import { supabase } from '../../lib/supabase';
import { badgeAwardId, loadLearnState, saveLearnState, certificateAwardId } from '../../lib/learnApi';
import { ALL_LESSONS, LEVELS } from './curriculum';

export interface LearnProgress {
  version: number;
  sections: string[];
  milestones: string[];
  certifications: string[];
  awards: string[];
  earnedAt: Record<string, string>;
  firstTry: Record<string, number>;
  lastLevel: string;
}

const CACHE_VERSION = 2;
const LIVE_LESSON_IDS = new Set(ALL_LESSONS.filter((lesson) => lesson.status === 'live').map((lesson) => lesson.id));
const LEVEL_IDS = new Set(LEVELS.map((level) => level.id));
const VALID_AWARD_IDS = new Set([
  ...ALL_LESSONS.filter((lesson) => lesson.status === 'live').map((lesson) => badgeAwardId(lesson.id)),
  ...LEVELS.map((level) => certificateAwardId(level.id)),
]);

const EMPTY: LearnProgress = {
  version: CACHE_VERSION,
  sections: [],
  milestones: [],
  certifications: [],
  awards: [],
  earnedAt: {},
  firstTry: {},
  lastLevel: 'beginner',
};

const CACHE_PREFIX = 'sltp_learn_progress.';

function cacheKey(userId?: string | null): string {
  return `${CACHE_PREFIX}${userId ?? 'anon'}`;
}

const stringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const stringRecord = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
};

const numberRecord = (value: unknown): Record<string, number> => {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === 'number'),
  );
};

const normalize = (raw: unknown): LearnProgress => {
  if (!raw || typeof raw !== 'object') return { ...EMPTY };
  const r = raw as Partial<Record<keyof LearnProgress, unknown>>;
  return {
    version: typeof r.version === 'number' ? r.version : 0,
    sections: stringArray(r.sections),
    milestones: stringArray(r.milestones),
    certifications: stringArray(r.certifications),
    awards: stringArray(r.awards),
    earnedAt: stringRecord(r.earnedAt),
    firstTry: numberRecord(r.firstTry),
    lastLevel: typeof r.lastLevel === 'string' ? r.lastLevel : 'beginner',
  };
};

const sanitize = (progress: LearnProgress): LearnProgress => ({
  ...progress,
  sections: progress.sections.filter((id) => LIVE_LESSON_IDS.has(id)),
  milestones: [],
  certifications: progress.certifications.filter((id) => LEVEL_IDS.has(id)),
  awards: progress.awards.filter((id) => VALID_AWARD_IDS.has(id)),
});

const cache = (progress: LearnProgress, userId?: string | null) => {
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify({ ...progress, version: CACHE_VERSION }));
  } catch {
    /* private mode */
  }
};

const readCache = (userId?: string | null): LearnProgress | null => {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    return raw ? normalize(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};

/** Loads progress: Supabase first, then the browser copy. */
export async function loadProgress(): Promise<LearnProgress> {
  let userId: string | null = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    /* offline */
  }

  const cached = readCache(userId);
  // A cache written before this version can belong to the retired curriculum.
  // Ignoring it lets a remote reset actually clear the first visit.
  const local = cached?.version === CACHE_VERSION ? sanitize(cached) : null;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const remote = await loadLearnState(user.id);
      if (remote) {
        const cleanRemote = sanitize({
          version: CACHE_VERSION,
          sections: remote.sections,
          milestones: remote.milestones,
          certifications: remote.certifications,
          awards: remote.awards,
          earnedAt: {},
          firstTry: {},
          lastLevel: 'beginner',
        });
        const remoteIsEmpty =
          !cleanRemote.sections.length && !cleanRemote.milestones.length && !cleanRemote.certifications.length;

        const metadata = {
          version: CACHE_VERSION,
          earnedAt: local?.earnedAt ?? {},
          firstTry: local?.firstTry ?? {},
          lastLevel: local?.lastLevel ?? 'beginner',
        };

        const merged: LearnProgress = remoteIsEmpty && local
          ? { ...local, awards: Array.from(new Set([...cleanRemote.awards, ...local.awards])) }
          : {
              ...cleanRemote,
              awards: Array.from(new Set([...cleanRemote.awards, ...(local?.awards ?? [])])),
              ...metadata,
            };
        cache(merged, userId);
        return merged;
      }
    }
  } catch {
    /* fall through to local */
  }

  return local ?? { ...EMPTY };
}

/** Saves progress: browser always, Supabase when signed in (best effort). */
export async function saveProgress(progress: LearnProgress, justEarned: string[] = []): Promise<void> {
  const clean = { ...normalize(progress), version: CACHE_VERSION };
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id ?? null;
    cache(clean, userId);
    if (!user) return;
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
  } catch {
    /* offline: local copy survives */
  }
}

export { badgeAwardId, certificateAwardId };
