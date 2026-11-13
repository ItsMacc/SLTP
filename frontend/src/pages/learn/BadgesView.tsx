// BadgesView.tsx — The full badge grid, grouped by level.

import { Check } from 'lucide-react';
import { LEVELS, lessonsOf } from '../../learn/curriculum';
import type { Lesson } from '../../learn/types';
import type { LearnProgress } from '../../learn/progress';
import { iconFor } from '../../learn/badges';
import { Medal } from './Medal';

export function BadgesView({
  progress,
  onOpenLesson,
  onOpenLevel,
}: {
  progress: LearnProgress;
  onOpenLesson: (lesson: Lesson) => void;
  onOpenLevel: (levelId: string) => void;
}) {
  return (
    <div className="learn-view learn-view--wide">
      <p className="learn-kicker">The course</p>
      <h1 className="learn-level-title">All badges</h1>
      <p className="learn-lead">
        One badge for each lesson and one certificate for each level. Earned badges show the date they were won.
      </p>

      <section className="learn-cert-grid" aria-label="Certificates">
        {LEVELS.map((level) => {
          const earned = progress.certifications.includes(level.id);
          const date = progress.earnedAt[level.id];
          return (
            <button
              type="button"
              key={level.id}
              className={`learn-cert-card${earned ? ' is-earned' : ''}`}
              onClick={() => onOpenLevel(level.id)}
            >
              <Medal
                icon={iconFor(level.number === 1 ? 'chart' : level.number === 5 ? 'scale' : 'book')}
                state={earned ? 'earned' : 'locked'}
                size={56}
                levelIndex={level.number - 1}
                label={`${level.name} certificate`}
              />
              <span className="learn-cert-card-level">{level.name}</span>
              <span className="learn-cert-card-text">{level.certificate}</span>
              <span className="learn-cert-card-date">
                {earned && date
                  ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : 'Not earned'}
              </span>
            </button>
          );
        })}
      </section>

      {LEVELS.map((level) => (
        <section className="learn-badge-group" key={level.id}>
          <h2 className="learn-part-title">{level.name}</h2>
          <div className="learn-badge-grid">
            {lessonsOf(level).map((lesson) => {
              const earned = progress.sections.includes(lesson.id);
              const date = progress.earnedAt[lesson.id];
              const clickable = lesson.status === 'live';
              return (
                <button
                  type="button"
                  key={lesson.id}
                  className={`learn-badge-card${earned ? ' is-earned' : ''}`}
                  onClick={() => {
                    if (clickable) onOpenLesson(lesson);
                  }}
                  disabled={!clickable}
                >
                  <Medal
                    icon={iconFor(lesson.icon)}
                    state={earned ? 'earned' : 'locked'}
                    size={36}
                    levelIndex={level.number - 1}
                    label={`${lesson.badge}, ${earned ? 'earned' : 'not earned'}`}
                  />
                  <span className="learn-badge-card-main">
                    <span className="learn-badge-card-name">{lesson.badge}</span>
                    <span className="learn-badge-card-description">{lesson.badgeDescription}</span>
                    <span className="learn-badge-card-meta">
                      {lesson.num}. {lesson.title}
                    </span>
                  </span>
                  {earned && (
                    <span className="learn-badge-card-date">
                      <Check size={14} aria-hidden="true" />
                      {date
                        ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        : 'Earned'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
