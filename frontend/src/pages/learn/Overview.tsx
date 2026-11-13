// Overview.tsx — Level overview, certificate and the next-level card.

import { ArrowRight, Check, LockKeyhole } from 'lucide-react';
import { lessonsOf, nextLevel as nextLevelFor, readingMinutes } from '../../learn/curriculum';
import type { Level, Lesson } from '../../learn/types';
import type { LearnProgress } from '../../learn/progress';
import { iconFor } from '../../learn/badges';
import { Medal } from './Medal';

interface OverviewProps {
  level: Level;
  progress: LearnProgress;
  isDone: (lessonId: string) => boolean;
  isUnlocked: (level: Level, lessonId: string) => boolean;
  allDone: boolean;
  certified: boolean;
  onOpenLesson: (lesson: Lesson) => void;
  onOpenQuiz: () => void;
  onSwitchLevel: (levelId: string) => void;
}

export function Overview({
  level,
  progress,
  isDone,
  isUnlocked,
  allDone,
  certified,
  onOpenLesson,
  onOpenQuiz,
  onSwitchLevel,
}: OverviewProps) {
  const lessons = lessonsOf(level);
  const done = lessons.filter((lesson) => isDone(lesson.id)).length;
  const nextLevel = nextLevelFor(level.id);
  const isOutline = level.status === 'outline';
  const percent = lessons.length ? Math.round((done / lessons.length) * 100) : 0;

  return (
    <div className="learn-view">
      <p className="learn-kicker">Level {level.number} of 5</p>
      <h1 className="learn-level-title">{level.title}</h1>
      <p className="learn-lead">{level.lead}</p>

      {isOutline && (
        <p className="learn-outline-note">
          This level is not written yet. Here is what it will cover.
        </p>
      )}

      <div className="learn-outcomes">
        <h2 className="learn-small-heading">By the end you can</h2>
        <ul>
          {level.outcomes.map((outcome) => (
            <li key={outcome}>
              <Check size={17} aria-hidden="true" /> {outcome}
            </li>
          ))}
        </ul>
      </div>

      {!isOutline && (
        <div className="learn-level-progress">
          <div className="learn-progress-track" aria-hidden="true">
            <span style={{ width: `${percent}%` }} />
          </div>
          <div className="learn-progress-meta">
            <span>{done} of {lessons.length} lessons</span>
            {!certified && allDone && (
              <button type="button" className="learn-text-link" onClick={onOpenQuiz}>
                Take the level quiz <ArrowRight size={15} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="learn-lesson-list">
        {level.parts.map((part) => (
          <section className="learn-part" key={part.title}>
            <h2 className="learn-part-title">{part.title}</h2>
            {part.lessons.map((lesson) => {
              const doneLesson = isDone(lesson.id);
              const unlocked = isUnlocked(level, lesson.id);
              const state = doneLesson ? 'earned' : unlocked ? 'current' : 'locked';
              return (
                <LessonRow
                  key={lesson.id}
                  level={level}
                  lesson={lesson}
                  done={doneLesson}
                  unlocked={unlocked}
                  state={state}
                  onOpen={() => onOpenLesson(lesson)}
                />
              );
            })}
          </section>
        ))}
      </div>

      {!isOutline && (
        <div className="learn-quiz-row">
          <div>
            <p className="learn-row-title">Level quiz</p>
            <p className="learn-row-summary">10 questions. It unlocks when every lesson is done.</p>
          </div>
          <div className="learn-row-action">
            {certified ? (
              <span className="learn-row-done"><Check size={15} /> Passed</span>
            ) : allDone ? (
              <button type="button" className="learn-text-link" onClick={onOpenQuiz}>
                Start the quiz <ArrowRight size={15} aria-hidden="true" />
              </button>
            ) : (
              <span className="learn-row-locked">
                <LockKeyhole size={15} aria-hidden="true" /> Locked
              </span>
            )}
          </div>
        </div>
      )}

      {certified && (
        <CertificateBlock
          level={level}
          progress={progress}
          nextLevel={nextLevel}
          onSwitchLevel={onSwitchLevel}
          compact
        />
      )}

      {certified && nextLevel && (
        <NextLevelCard nextLevel={nextLevel} onSwitchLevel={onSwitchLevel} />
      )}

      {isOutline && nextLevel && (
        <NextLevelCard nextLevel={nextLevel} onSwitchLevel={onSwitchLevel} />
      )}

      {!certified && !isOutline && (
        <p className="learn-certificate-hint">
          Pass the level quiz to earn the certificate.
        </p>
      )}

    </div>
  );
}

function LessonRow({
  level,
  lesson,
  done,
  unlocked,
  state,
  onOpen,
}: {
  level: Level;
  lesson: Lesson;
  done: boolean;
  unlocked: boolean;
  state: 'earned' | 'current' | 'locked';
  onOpen: () => void;
}) {
  const outline = level.status === 'outline';
  const badgeIcon = iconFor(lesson.icon);
  const previous = level.parts
    .flatMap((part) => part.lessons)
    .find((item) => item.num === String.fromCharCode(lesson.num.charCodeAt(0) - 1));
  const actionText = outline
    ? 'Planned'
    : done
      ? 'Review'
      : unlocked
        ? `About ${readingMinutes(lesson)} min`
        : previous
          ? `Opens after ${previous.num}`
          : 'Locked';

  if (outline) {
    return (
      <div className="learn-lesson-row learn-lesson-row--planned">
        <span className="learn-lesson-num">{lesson.num}</span>
        <div className="learn-lesson-row-main">
          <p className="learn-row-title">{lesson.title}</p>
          <p className="learn-row-summary">{lesson.summary}</p>
        </div>
        <span className="learn-row-planned">Planned</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`learn-lesson-row${done ? ' is-done' : ''}${unlocked ? ' is-open' : ' is-locked'}`}
      onClick={onOpen}
      disabled={!unlocked}
      aria-label={`${lesson.num}. ${lesson.title}. ${actionText}`}
    >
      <span className="learn-lesson-num">{lesson.num}</span>
      <span className="learn-lesson-row-main">
        <span className="learn-row-title">{lesson.title}</span>
        <span className="learn-row-summary">{lesson.summary}</span>
        <span className="learn-row-badge">
          <Medal icon={badgeIcon} state={state} size={24} levelIndex={level.number - 1} label={lesson.badge} />
          {lesson.badge}
        </span>
      </span>
      <span className="learn-row-action">
        {!unlocked && <LockKeyhole size={15} aria-hidden="true" />}
        {done ? <span className="learn-row-done"><Check size={15} /> Done</span> : <span>{actionText}</span>}
        {unlocked && !done && <ArrowRight size={16} aria-hidden="true" />}
      </span>
    </button>
  );
}

export function CertificateView({
  level,
  progress,
  onSwitchLevel,
  onBack,
}: {
  level: Level;
  progress: LearnProgress;
  onSwitchLevel: (levelId: string) => void;
  onBack: () => void;
}) {
  return (
    <div className="learn-view learn-view--certificate">
      <button type="button" className="learn-back-link" onClick={onBack}>
        Back to {level.name}
      </button>
      <CertificateBlock
        level={level}
        progress={progress}
        nextLevel={nextLevelFor(level.id)}
        onSwitchLevel={onSwitchLevel}
      />
    </div>
  );
}

function CertificateBlock({
  level,
  progress,
  nextLevel,
  onSwitchLevel,
  compact = false,
}: {
  level: Level;
  progress: LearnProgress;
  nextLevel?: Level;
  onSwitchLevel: (levelId: string) => void;
  compact?: boolean;
}) {
  const earnedAt = progress.earnedAt[level.id];
  const firstTry = progress.firstTry[level.id];
  return (
    <section className={`learn-certificate${compact ? ' learn-certificate--compact' : ''}`}>
      <Medal
        icon={iconFor(level.number === 1 ? 'chart' : level.number === 5 ? 'scale' : 'book')}
        state="earned"
        size={compact ? 56 : 120}
        levelIndex={level.number - 1}
        label={`${level.name} certificate, earned`}
      />
      <p className="learn-kicker">{level.name} certificate</p>
      <h2>{level.certificate}</h2>
      {earnedAt && (
        <p className="learn-certificate-date">
          Earned {new Date(earnedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          {typeof firstTry === 'number' ? ` · ${firstTry} of ${level.quiz.length} on the first try` : ''}
        </p>
      )}
      {!compact && nextLevel && <NextLevelCard nextLevel={nextLevel} onSwitchLevel={onSwitchLevel} />}
    </section>
  );
}

export function NextLevelCard({
  nextLevel,
  onSwitchLevel,
}: {
  nextLevel: Level;
  onSwitchLevel: (levelId: string) => void;
}) {
  return (
    <section className="learn-next-level">
      <p className="learn-kicker">Next: {nextLevel.name}</p>
      <h2>{nextLevel.title}</h2>
      <p>
        {nextLevel.lead.split('. ').slice(0, 2).join('. ')}
        {nextLevel.lead.includes('. ') ? '.' : ''}
      </p>
      <button type="button" className="learn-primary-button" onClick={() => onSwitchLevel(nextLevel.id)}>
        {nextLevel.status === 'live' ? `Start ${nextLevel.name}` : `View ${nextLevel.name}`}
      </button>
    </section>
  );
}
