// useLearn.ts — Joins curriculum with progress: completion, certification,
// counts, unlock state and the next unfinished lesson.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ALL_LESSONS, LEVELS, TOTAL_BADGES, levelForLesson, lessonsOf } from './curriculum';
import type { Level, Lesson } from './types';
import { loadProgress, saveProgress, badgeAwardId, certificateAwardId, type LearnProgress } from './progress';

export interface EarnedBadge {
  id: string;
  name: string;
  description: string;
  lessonId: string;
  earnedAt: string;
}

export function useLearn() {
  const [progress, setProgress] = useState<LearnProgress>({
    sections: [],
    milestones: [],
    certifications: [],
    awards: [],
    earnedAt: {},
    firstTry: {},
    lastLevel: 'beginner',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const pendingWrites = useRef(0);

  useEffect(() => {
    let alive = true;
    loadProgress().then((loaded) => {
      if (!alive) return;
      setProgress(loaded);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const commit = useCallback((next: LearnProgress, justEarned: string[] = []) => {
    setProgress(next);
    pendingWrites.current += 1;
    setSaving(true);
    void saveProgress(next, justEarned).finally(() => {
      pendingWrites.current -= 1;
      if (pendingWrites.current <= 0) setSaving(false);
    });
  }, []);

  const isLessonDone = useCallback(
    (lessonId: string) => progress.sections.includes(lessonId),
    [progress.sections],
  );

  const isCertified = useCallback(
    (levelId: string) => progress.certifications.includes(levelId),
    [progress.certifications],
  );

  const levelCounts = useCallback(
    (level: Level) => {
      const lessons = lessonsOf(level);
      return {
        done: lessons.filter((lesson) => progress.sections.includes(lesson.id)).length,
        total: lessons.length,
      };
    },
    [progress.sections],
  );

  const allLessonsDone = useCallback(
    (level: Level) => {
      const lessons = lessonsOf(level).filter((lesson) => lesson.status === 'live');
      return lessons.length > 0 && lessons.every((lesson) => progress.sections.includes(lesson.id));
    },
    [progress.sections],
  );

  const isLessonUnlocked = useCallback(
    (level: Level, lessonId: string) => {
      if (level.status !== 'live') return false;
      const lessons = lessonsOf(level).filter((lesson) => lesson.status === 'live');
      const index = lessons.findIndex((lesson) => lesson.id === lessonId);
      if (index < 0) return false;
      if (index === 0) return true;
      return progress.sections.includes(lessons[index - 1].id);
    },
    [progress.sections],
  );

  const firstUnfinished = useCallback(
    (level: Level): Lesson | undefined =>
      lessonsOf(level).find((lesson) => lesson.status === 'live' && !progress.sections.includes(lesson.id)),
    [progress.sections],
  );

  const nextUnfinished = useMemo(() => {
    for (const level of LEVELS) {
      if (level.status !== 'live') continue;
      const lesson = lessonsOf(level).find(
        (item) => item.status === 'live' && !progress.sections.includes(item.id),
      );
      if (lesson) return { level, lesson };
    }
    return null;
  }, [progress.sections]);

  const completeLesson = useCallback(
    (lesson: Lesson): EarnedBadge | null => {
      if (progress.sections.includes(lesson.id)) return null;
      const now = new Date().toISOString();
      const awardId = badgeAwardId(lesson.id);
      const next: LearnProgress = {
        ...progress,
        sections: [...progress.sections, lesson.id],
        awards: progress.awards.includes(awardId) ? progress.awards : [...progress.awards, awardId],
        earnedAt: { ...progress.earnedAt, [lesson.id]: now },
      };
      commit(next, [awardId]);
      return {
        id: awardId,
        name: lesson.badge,
        description: lesson.badgeDescription,
        lessonId: lesson.id,
        earnedAt: now,
      };
    },
    [progress, commit],
  );

  const certifyLevel = useCallback(
    (level: Level, firstTry: number) => {
      if (progress.certifications.includes(level.id)) return;
      const now = new Date().toISOString();
      const awardId = certificateAwardId(level.id);
      commit(
        {
          ...progress,
          certifications: [...progress.certifications, level.id],
          awards: progress.awards.includes(awardId) ? progress.awards : [...progress.awards, awardId],
          earnedAt: { ...progress.earnedAt, [level.id]: now },
          firstTry: { ...progress.firstTry, [level.id]: firstTry },
        },
        [awardId],
      );
    },
    [progress, commit],
  );

  const setLastLevel = useCallback(
    (levelId: string) => {
      if (progress.lastLevel === levelId) return;
      commit({ ...progress, lastLevel: levelId });
    },
    [progress, commit],
  );

  const earnedBadges = useMemo(
    () => ALL_LESSONS.filter((lesson) => progress.sections.includes(lesson.id)),
    [progress.sections],
  );

  const earlierLesson = useCallback(
    (level: Level, lessonId: string): Lesson | undefined => {
      const lessons = lessonsOf(level).filter((lesson) => lesson.status === 'live');
      const index = lessons.findIndex((lesson) => lesson.id === lessonId);
      return index > 0 ? lessons[index - 1] : undefined;
    },
    [],
  );

  const laterLesson = useCallback(
    (level: Level, lessonId: string): Lesson | undefined => {
      const lessons = lessonsOf(level).filter((lesson) => lesson.status === 'live');
      const index = lessons.findIndex((lesson) => lesson.id === lessonId);
      return index >= 0 ? lessons[index + 1] : undefined;
    },
    [],
  );

  return {
    progress,
    loading,
    saving,
    isLessonDone,
    isCertified,
    levelCounts,
    allLessonsDone,
    isLessonUnlocked,
    firstUnfinished,
    nextUnfinished,
    completeLesson,
    certifyLevel,
    setLastLevel,
    earnedBadges,
    earlierLesson,
    laterLesson,
    totalBadges: TOTAL_BADGES,
    totalCertificates: LEVELS.length,
    levelForLesson,
  };
}
