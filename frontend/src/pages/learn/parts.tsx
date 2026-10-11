// parts.tsx - Shared building blocks for the lesson modules.
//
// Every module follows the same teaching frame so the course reads as one
// course, not a pile of unrelated pages:
//
//   Objective  - what you will be able to do by the end (up front)
//   Content    - the idea, in plain language, built on what came before
//   Recap      - the few lines worth remembering
//
// Keep these presentational and dumb: state lives in each module.

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Check, ChevronRight, Lightbulb, ListChecks, RotateCcw, Target, X } from 'lucide-react';
import type { QuizQuestion } from '../../learn/moduleQuizzes';

/** Advances a stepped lesson and pulls the reader back to its heading. */
export function Continue({ onClick, label = 'Continue', sectionId }: {
  onClick: () => void;
  label?: string;
  /** When set, scrolls this section's heading into view after advancing. */
  sectionId?: string;
}) {
  return (
    <button
      type="button"
      className="learn-continue"
      onClick={() => {
        onClick();
        if (sectionId) {
          document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }}
    >
      {label}
      <ChevronRight size={15} />
    </button>
  );
}

/** Highlighted aside: the instructor leaning in to make a point. */
export function Narrator({ icon: Icon = Lightbulb, children }: {
  icon?: typeof Lightbulb;
  children: ReactNode;
}) {
  return (
    <div className="learn-narrator">
      <span className="learn-narrator-icon"><Icon size={15} /></span>
      <p>{children}</p>
    </div>
  );
}

/** Opening statement of a module: the goal, stated as an ability. */
export function Objective({ children }: { children: ReactNode }) {
  return (
    <div className="learn-objective">
      <span className="learn-objective-tag"><Target size={13} /> Objective</span>
      <p>{children}</p>
    </div>
  );
}

/** Closing summary: the lines worth carrying into the next module. */
export function Recap({ title = 'Remember this', points }: {
  title?: string;
  points: ReactNode[];
}) {
  return (
    <div className="learn-recapcard">
      <p className="learn-recapcard-title">{title}</p>
      <ul>
        {points.map((p, i) => (
          <li key={i}><span className="learn-recapcard-tick"><Check size={13} /></span> <span>{p}</span></li>
        ))}
      </ul>
    </div>
  );
}

export function Money({ value, decimals = 2 }: { value: number; decimals?: number }) {
  return (
    <strong className="learn-money">
      ${value.toLocaleString(undefined, { maximumFractionDigits: decimals })}
    </strong>
  );
}

/**
 * Optional end-of-module quiz. Collapsed by default so the lesson itself
 * stays a clean read; "Take the quiz" reveals the questions and nothing else.
 * Answers are checked immediately with a short explanation. Purely for
 * practice: scores never touch badges, milestones or certification.
 */
export function SectionQuiz({ questions }: { questions: QuizQuestion[] }) {
  const [open, setOpen] = useState(false);
  const [picks, setPicks] = useState<Record<number, number>>({});

  if (!questions.length) return null;

  const answered = Object.keys(picks).length;
  const correct = questions.reduce((n, q, i) => n + (picks[i] === q.answer ? 1 : 0), 0);

  if (!open) {
    return (
      <button type="button" className="learn-quizcta" onClick={() => setOpen(true)}>
        <ListChecks size={15} />
        Take the quiz
        <span className="learn-quizcta-note">{questions.length} questions, optional</span>
      </button>
    );
  }

  return (
    <div className="learn-quizcard">
      <div className="learn-quizcard-head">
        <p className="learn-quizcard-title"><ListChecks size={14} /> Module quiz</p>
        <div className="learn-quizcard-actions">
          {answered > 0 && (
            <button type="button" className="learn-quizcard-link" onClick={() => setPicks({})}>
              <RotateCcw size={12} /> Reset
            </button>
          )}
          <button type="button" className="learn-quizcard-link" onClick={() => setOpen(false)}>
            <X size={12} /> Hide
          </button>
        </div>
      </div>

      <ol className="learn-quizcard-list">
        {questions.map((q, i) => {
          const pick = picks[i];
          const done = pick !== undefined;
          return (
            <li key={i} className="learn-q">
              <p className="learn-q-title">
                <span className="learn-q-num">{i + 1}</span>
                {q.q}
              </p>
              <div className="learn-q-opts">
                {q.options.map((opt, j) => {
                  let cls = 'learn-q-opt';
                  if (done && j === q.answer) cls += ' is-correct';
                  else if (done && j === pick) cls += ' is-wrong';
                  return (
                    <button
                      key={j}
                      type="button"
                      className={cls}
                      disabled={done}
                      onClick={() => setPicks((p) => ({ ...p, [i]: j }))}
                    >
                      <span>{opt}</span>
                      {done && j === q.answer && <Check size={13} />}
                      {done && j === pick && j !== q.answer && <X size={13} />}
                    </button>
                  );
                })}
              </div>
              {done && (
                <p className="learn-q-explain">
                  <Lightbulb size={13} />
                  <span>
                    {pick === q.answer ? 'Correct. ' : 'Not quite. '}
                    {q.explain}
                  </span>
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <p className="learn-quizcard-foot">
        {answered < questions.length
          ? `Answered ${answered} of ${questions.length}.`
          : correct === questions.length
            ? `All ${questions.length} correct.`
            : `You got ${correct} of ${questions.length} right.`}{' '}
        These quizzes are practice only and do not affect your badges.
      </p>
    </div>
  );
}