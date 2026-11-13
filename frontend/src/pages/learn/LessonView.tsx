// LessonView.tsx — One lesson, its rail, check and finish block.

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, List, LockKeyhole, X } from 'lucide-react';
import { lessonsOf, readingMinutes, lessonById } from '../../learn/curriculum';
import { LEARN_GLOSSARY } from '../../learn/learnGlossary';
import type { Level, Lesson } from '../../learn/types';
import type { LearnProgress } from '../../learn/progress';
import { iconFor } from '../../learn/badges';
import { Medal } from './Medal';
import { LessonBlocks } from './LessonBlocks';
import { CheckYourself } from './Quiz';

interface LessonViewProps {
  level: Level;
  lesson: Lesson;
  progress: LearnProgress;
  isDone: (lessonId: string) => boolean;
  allDone: boolean;
  previous?: Lesson;
  next?: Lesson;
  onOpenLesson: (lesson: Lesson) => void;
  onOpenQuiz: () => void;
  onBack: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onFinish: () => void;
}

export function LessonView({
  level,
  lesson,
  progress,
  isDone,
  allDone,
  previous,
  next,
  onOpenLesson,
  onOpenQuiz,
  onBack,
  onPrevious,
  onNext,
  onFinish,
}: LessonViewProps) {
  const [railOpen, setRailOpen] = useState(false);
  const [readProgress, setReadProgress] = useState(0);
  const articleRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lessons = lessonsOf(level).filter((item) => item.status === 'live');
  const done = isDone(lesson.id);
  const earnedAt = progress.earnedAt[lesson.id];

  useEffect(() => {
    setRailOpen(false);
    setReadProgress(0);
  }, [lesson.id]);

  useEffect(() => {
    const update = () => {
      const article = articleRef.current;
      if (!article) return;
      const top = article.getBoundingClientRect().top + window.scrollY;
      const height = Math.max(1, article.offsetHeight - window.innerHeight * 0.5);
      const value = (window.scrollY - top + window.innerHeight * 0.35) / height;
      setReadProgress(Math.max(0, Math.min(1, value)));
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [lesson.id]);

  useEffect(() => {
    if (!railOpen) return;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setRailOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [railOpen]);

  if (!lesson.content) return null;

  return (
    <>
      <div className="learn-reading-line" aria-hidden="true">
        <span style={{ width: `${readProgress * 100}%` }} />
      </div>
      <div className="learn-lesson-layout">
        <aside className="learn-rail" aria-label={`${level.name} lessons`}>
          <p className="learn-rail-title">Lessons</p>
          <div className="learn-rail-list">
            {lessons.map((item) => {
              const itemDone = isDone(item.id);
              const current = item.id === lesson.id;
              const unlocked = itemDone || current || isDone(lessons[lessons.indexOf(item) - 1]?.id ?? '');
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`learn-rail-item${current ? ' is-current' : ''}${itemDone ? ' is-done' : ''}`}
                  onClick={() => {
                    if (unlocked) onOpenLesson(item);
                  }}
                  disabled={!unlocked}
                >
                  <span className="learn-rail-state">
                    {itemDone ? <Check size={14} /> : unlocked ? <span className="learn-rail-dot" /> : <LockKeyhole size={13} />}
                  </span>
                  <span>{item.num}. {item.title}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="learn-rail-quiz"
            onClick={onOpenQuiz}
            disabled={!allDone}
          >
            Level quiz {!allDone && <LockKeyhole size={13} />}
          </button>
        </aside>

        <article className="learn-lesson" ref={articleRef}>
          <div className="learn-breadcrumb">
            <button type="button" className="learn-text-link" onClick={onBack}>
              {level.name}
            </button>
            <span aria-hidden="true">/</span>
            <span>{lesson.num}. {lesson.title}</span>
            <button type="button" className="learn-sheet-trigger" onClick={() => setRailOpen(true)}>
              <List size={16} aria-hidden="true" /> Lessons
            </button>
          </div>

          <p className="learn-lesson-letter" aria-hidden="true">{lesson.num}</p>
          <h1 className="learn-lesson-title">{lesson.title}</h1>
          <p className="learn-lesson-meta">
            <Medal
              icon={iconFor(lesson.icon)}
              state={done ? 'earned' : 'current'}
              size={24}
              levelIndex={level.number - 1}
              label={lesson.badge}
            />
            <span>{lesson.badge}</span>
            <span aria-hidden="true">·</span>
            <span>About {readingMinutes(lesson)} min</span>
          </p>

          <section className="learn-objectives">
            <h2 className="learn-small-heading">What you'll learn</h2>
            <ul>
              {lesson.content.objectives.map((objective) => (
                <li key={objective}>{objective}</li>
              ))}
            </ul>
          </section>

          {lesson.assumes.length > 0 && (
            <p className="learn-assumes">
              You'll use:{' '}
              {lesson.assumes.map((term, index) => {
                const sourceLesson = lessonById(LEARN_GLOSSARY[term]?.introducedIn ?? '');
                return (
                  <span key={term}>
                    {index > 0 && ', '}
                    <button
                      type="button"
                      className="learn-inline-link"
                      onClick={() => {
                        if (sourceLesson) onOpenLesson(sourceLesson);
                      }}
                      disabled={!sourceLesson}
                    >
                      {term} ({sourceLesson?.num ?? ''})
                    </button>
                  </span>
                );
              })}
            </p>
          )}

          <LessonBlocks blocks={lesson.content.blocks} />

          <section className="learn-end-section">
            <h2 className="learn-section-title">What to remember</h2>
            <ul className="learn-recap">
              {lesson.content.recap.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <div className="learn-end-section">
            <CheckYourself questions={lesson.content.check} />
          </div>

          <section className="learn-finish">
            <Medal
              icon={iconFor(lesson.icon)}
              state={done ? 'earned' : 'current'}
              size={56}
              levelIndex={level.number - 1}
              label={`${lesson.badge}, ${done ? 'earned' : 'not earned'}`}
            />
            <div>
              <h2 className="learn-section-title">{lesson.badge}</h2>
              <p>{lesson.badgeDescription}</p>
              {done ? (
                <p className="learn-finish-earned">
                  <Check size={16} aria-hidden="true" /> Badge earned
                  {earnedAt
                    ? ` on ${new Date(earnedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                    : ''}
                </p>
              ) : (
                <button type="button" className="learn-primary-button" onClick={onFinish}>
                  Finish lesson
                </button>
              )}
            </div>
          </section>

          <nav className="learn-lesson-nav" aria-label="Lesson navigation">
            {previous ? (
              <button type="button" className="learn-nav-link" onClick={onPrevious}>
                <ArrowLeft size={17} aria-hidden="true" />
                <span>
                  <span className="learn-nav-label">Previous</span>
                  {previous.num}. {previous.title}
                </span>
              </button>
            ) : (
              <button type="button" className="learn-nav-link" onClick={onBack}>
                <ArrowLeft size={17} aria-hidden="true" />
                <span>
                  <span className="learn-nav-label">Back</span>
                  {level.name}
                </span>
              </button>
            )}
            <button
              type="button"
              className="learn-nav-link learn-nav-link--next"
              onClick={onNext}
              disabled={!done}
              title={!done ? 'Finish this lesson to open the next one.' : undefined}
            >
              <span>
                <span className="learn-nav-label">{next ? 'Next' : 'Back to level'}</span>
                {next ? `${next.num}. ${next.title}` : level.name}
              </span>
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          </nav>
        </article>
      </div>

      {railOpen && (
        <div
          className="learn-sheet-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setRailOpen(false);
          }}
        >
          <div className="learn-sheet" role="dialog" aria-modal="true" aria-label={`${level.name} lessons`}>
            <div className="learn-sheet-head">
              <p>Lessons</p>
              <button type="button" className="learn-icon-button" aria-label="Close lessons" onClick={() => setRailOpen(false)} ref={closeRef}>
                <X size={18} />
              </button>
            </div>
            {lessons.map((item, index) => {
              const itemDone = isDone(item.id);
              const current = item.id === lesson.id;
              const unlocked = itemDone || current || isDone(lessons[index - 1]?.id ?? '');
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`learn-sheet-item${current ? ' is-current' : ''}`}
                  onClick={() => {
                    setRailOpen(false);
                    if (unlocked) onOpenLesson(item);
                  }}
                  disabled={!unlocked}
                >
                  <span>{itemDone ? <Check size={15} /> : unlocked ? <span className="learn-rail-dot" /> : <LockKeyhole size={14} />}</span>
                  {item.num}. {item.title}
                </button>
              );
            })}
            <button type="button" className="learn-sheet-item" onClick={onOpenQuiz} disabled={!allDone}>
              <span>{allDone ? <span className="learn-rail-dot" /> : <LockKeyhole size={14} />}</span>
              Level quiz
            </button>
          </div>
        </div>
      )}
    </>
  );
}
