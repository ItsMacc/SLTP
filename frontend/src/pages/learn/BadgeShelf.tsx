// BadgeShelf.tsx — Every badge in course order, always at the top.

import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { ChevronLeft, ChevronRight, LockKeyhole } from 'lucide-react';
import { LEVELS, lessonsOf } from '../../learn/curriculum';
import type { Level, Lesson } from '../../learn/types';
import { iconFor } from '../../learn/badges';
import type { LearnProgress } from '../../learn/progress';
import { Medal } from './Medal';

interface BadgeShelfProps {
  progress: LearnProgress;
  pulseId: string | null;
  currentLessonId: string | null;
  focusRequest: { levelId: string; nonce: number } | null;
  shelfRef: RefObject<HTMLElement | null>;
  onOpenAll: () => void;
  onOpenLesson: (lesson: Lesson) => void;
  onOpenLevel: (level: Level) => void;
}

export function BadgeShelf({
  progress,
  pulseId,
  currentLessonId,
  focusRequest,
  shelfRef,
  onOpenAll,
  onOpenLesson,
  onOpenLevel,
}: BadgeShelfProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const earned = LEVELS.flatMap((level) => lessonsOf(level)).filter((lesson) =>
    progress.sections.includes(lesson.id),
  );
  const firstUnearned = LEVELS.flatMap((level) => lessonsOf(level)).find(
    (lesson) => !progress.sections.includes(lesson.id),
  );
  const anchorId = pulseId ?? earned[earned.length - 1]?.id ?? firstUnearned?.id ?? null;

  useEffect(() => {
    const row = rowRef.current;
    if (!row || !anchorId) return;
    const target = row.querySelector<HTMLElement>(`[data-badge-id="${anchorId}"]`);
    if (!target) return;
    row.scrollLeft = Math.max(0, target.offsetLeft - row.clientWidth / 2 + target.offsetWidth / 2);
  }, [anchorId]);

  // Pressing a level tab brings that level's badges back into the row.
  useEffect(() => {
    if (!focusRequest) return;
    const row = rowRef.current;
    if (!row) return;
    const group = row.querySelector<HTMLElement>(`[data-level-id="${focusRequest.levelId}"]`);
    if (!group) return;
    const rowRect = row.getBoundingClientRect();
    const groupRect = group.getBoundingClientRect();
    // Every group starts at the row's inset, so the previous level's tail never
    // shows beside it. The last group clamps at the row's end, which is expected.
    const target =
      row.scrollLeft +
      (groupRect.left - rowRect.left) -
      parseFloat(getComputedStyle(row).paddingLeft);
    // The row's smooth scrolling never advances on a masked scroller, so the
    // jump is made explicit: a tab press must land on the right group.
    const previous = row.style.scrollBehavior;
    row.style.scrollBehavior = 'auto';
    row.scrollLeft = Math.max(0, target);
    row.style.scrollBehavior = previous;
  }, [focusRequest]);

  const scroll = (direction: -1 | 1) => {
    rowRef.current?.scrollBy({ left: direction * 320, behavior: 'smooth' });
  };

  return (
    <section className="learn-shelf" aria-label="Badges" ref={shelfRef}>
      <div className="learn-shelf-head">
        <p className="learn-shelf-title">
          Badges <span>{earned.length} of {LEVELS.flatMap((level) => lessonsOf(level)).length}</span>
        </p>
        <button type="button" className="learn-text-link" onClick={onOpenAll}>
          See all
        </button>
      </div>
      <div className="learn-shelf-body">
        <button type="button" className="learn-shelf-arrow" aria-label="Scroll badges left" onClick={() => scroll(-1)}>
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <div className="learn-shelf-row" ref={rowRef}>
          {LEVELS.map((level, levelIndex) => {
            const lessons = lessonsOf(level);
            const certified = progress.certifications.includes(level.id);
            return (
              <div className="learn-shelf-group" key={level.id} data-level-id={level.id}>
                <span className="learn-shelf-group-name">{level.name}</span>
                <div className="learn-shelf-medals">
                  {lessons.map((lesson) => {
                    const isEarned = progress.sections.includes(lesson.id);
                    const isCurrent = lesson.id === currentLessonId;
                    const state = isEarned ? 'earned' : isCurrent ? 'current' : 'locked';
                    const Icon = iconFor(lesson.icon);
                    return (
                      <Tooltip.Provider key={lesson.id} delayDuration={140}>
                        <Tooltip.Root>
                          <Tooltip.Trigger asChild>
                            <button
                              type="button"
                              className="learn-shelf-medal-button"
                              data-badge-id={lesson.id}
                              aria-label={`${lesson.badge}, ${isEarned ? 'earned' : 'not earned'}`}
                              onClick={() => {
                                if (lesson.status === 'live') onOpenLesson(lesson);
                              }}
                            >
                              <Medal
                                icon={Icon}
                                state={state}
                                size={36}
                                levelIndex={levelIndex}
                                label={lesson.badge}
                                pulse={pulseId === lesson.id}
                              />
                            </button>
                          </Tooltip.Trigger>
                          <Tooltip.Portal>
                            <Tooltip.Content className="learn-badge-tooltip" sideOffset={8} collisionPadding={12}>
                              <strong>{lesson.badge}</strong>
                              <span>{lesson.badgeDescription}</span>
                              <span className="learn-badge-tooltip-lesson">
                                {lesson.num}. {lesson.title}
                              </span>
                              <Tooltip.Arrow className="learn-badge-tooltip-arrow" />
                            </Tooltip.Content>
                          </Tooltip.Portal>
                        </Tooltip.Root>
                      </Tooltip.Provider>
                    );
                  })}
                  <button
                    type="button"
                    className="learn-shelf-medal-button"
                    data-badge-id={`certificate-${level.id}`}
                    aria-label={`${level.name} certificate, ${certified ? 'earned' : 'not earned'}`}
                    onClick={() => onOpenLevel(level)}
                  >
                    <Medal
                      icon={levelIndex === 0 ? iconFor('chart') : iconFor(levelIndex === 4 ? 'scale' : 'book')}
                      state={certified ? 'earned' : 'locked'}
                      size={36}
                      levelIndex={levelIndex}
                      label={`${level.name} certificate`}
                    />
                  </button>
                </div>
              </div>
            );
          })}
          <div className="learn-shelf-group learn-shelf-group--workshops">
            <span className="learn-shelf-group-name">Workshops</span>
            <span className="learn-shelf-lock">
              <LockKeyhole size={14} aria-hidden="true" /> Planned
            </span>
          </div>
        </div>
        <button type="button" className="learn-shelf-arrow" aria-label="Scroll badges right" onClick={() => scroll(1)}>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
