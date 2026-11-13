// Quiz.tsx — The optional lesson check and the required level quiz.

import { useEffect, useMemo, useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import type { Level, QuizQuestion } from '../../learn/types';
import { displayQuestion } from '../../learn/quizDisplay';

const LETTERS = ['A', 'B', 'C', 'D'];

export function CheckYourself({ questions }: { questions: QuizQuestion[] }) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [wrong, setWrong] = useState<number[]>([]);
  const [solved, setSolved] = useState(false);
  const [firstTry, setFirstTry] = useState(0);
  const [finished, setFinished] = useState(false);
  const source = questions[index];
  const question = source ? displayQuestion(source) : undefined;

  if (!question) return null;

  const choose = (option: number) => {
    if (solved || wrong.includes(option)) return;
    setSelected(option);
    if (option === question.correctIndex) {
      setSolved(true);
      if (wrong.length === 0) setFirstTry((value) => value + 1);
    } else {
      setWrong((value) => [...value, option]);
    }
  };

  const next = () => {
    if (index + 1 >= questions.length) {
      setFinished(true);
      return;
    }
    setIndex((value) => value + 1);
    setSelected(null);
    setWrong([]);
    setSolved(false);
  };

  const reset = () => {
    setIndex(0);
    setSelected(null);
    setWrong([]);
    setSolved(false);
    setFirstTry(0);
    setFinished(false);
  };

  return (
    <section className="learn-check" aria-labelledby="check-heading">
      <h2 id="check-heading" className="learn-section-title">Check yourself</h2>
      <p className="learn-section-note">Optional. It doesn't affect your badge.</p>
      {finished ? (
        <div className="learn-check-summary">
          <p className="learn-check-score">
            {firstTry} of {questions.length} on the first try
          </p>
          <button type="button" className="learn-text-link" onClick={reset}>
            <RotateCcw size={15} aria-hidden="true" /> Try again
          </button>
        </div>
      ) : (
        <>
          <div className="learn-quiz-progress">
            <span>Question {index + 1} of {questions.length}</span>
            <div className="learn-quiz-dots" aria-hidden="true">
              {questions.map((item, dot) => (
                <span key={item.id} className={dot <= index ? 'is-filled' : ''} />
              ))}
            </div>
          </div>
          <p className="learn-quiz-prompt">{question.prompt}</p>
          <div className="learn-quiz-options" role="group" aria-label="Answer options">
            {question.options.map((option, optionIndex) => {
              const isWrong = wrong.includes(optionIndex);
              const isCorrect = solved && optionIndex === question.correctIndex;
              const isPicked = selected === optionIndex;
              return (
                <button
                  key={option}
                  type="button"
                  className={`learn-option${isPicked && !solved ? ' is-picked' : ''}${isWrong ? ' is-wrong' : ''}${isCorrect ? ' is-correct' : ''}`}
                  onClick={() => choose(optionIndex)}
                  disabled={isWrong || solved}
                  aria-pressed={isPicked}
                >
                  <span className="learn-option-letter">{LETTERS[optionIndex]}</span>
                  <span>{option}</span>
                  {isWrong && <X size={18} aria-label="Not correct" />}
                  {isCorrect && <Check size={18} aria-label="Correct" />}
                </button>
              );
            })}
          </div>
          <div className="learn-quiz-feedback" aria-live="polite">
            {solved && (
              <>
                <p className="learn-feedback-correct">
                  <Check size={16} aria-hidden="true" /> Correct.
                </p>
                <p>{question.explanation}</p>
                <button type="button" className="learn-text-link" onClick={next}>
                  {index + 1 >= questions.length ? 'See result' : 'Next question'}
                </button>
              </>
            )}
            {!solved && wrong.length > 0 && (
              <>
                <p className="learn-feedback-wrong">
                  <X size={16} aria-hidden="true" /> Not quite.
                </p>
                <p>{question.hint ?? 'Try another option.'}</p>
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}

interface QuizState {
  answers: Record<string, number | null>;
  locked: string[];
  removed: Record<string, number[]>;
  results: Record<string, 'correct' | 'wrong'>;
  firstTry: number | null;
}

function emptyState(level: Level): QuizState {
  return {
    answers: Object.fromEntries(level.quiz.map((question) => [question.id, null])),
    locked: [],
    removed: {},
    results: {},
    firstTry: null,
  };
}

function readState(level: Level): QuizState {
  try {
    const raw = sessionStorage.getItem(`sltp_learn_quiz.${level.id}`);
    if (!raw) return emptyState(level);
    const parsed = JSON.parse(raw) as Partial<QuizState>;
    return {
      ...emptyState(level),
      ...parsed,
      answers: { ...emptyState(level).answers, ...(parsed.answers ?? {}) },
      removed: parsed.removed ?? {},
      results: parsed.results ?? {},
    };
  } catch {
    return emptyState(level);
  }
}

export function LevelQuiz({
  level,
  onPass,
  onBack,
}: {
  level: Level;
  onPass: (firstTry: number) => void;
  onBack: () => void;
}) {
  const [state, setState] = useState<QuizState>(() => readState(level));
  const [message, setMessage] = useState('');
  const questions = useMemo(() => level.quiz.map(displayQuestion), [level.quiz]);

  useEffect(() => {
    try {
      sessionStorage.setItem(`sltp_learn_quiz.${level.id}`, JSON.stringify(state));
    } catch {
      /* private mode */
    }
  }, [level.id, state]);

  const answered = useMemo(
    () => questions.filter((question) => state.locked.includes(question.id) || state.answers[question.id] != null).length,
    [questions, state],
  );
  const allAnswered = answered === questions.length;

  const choose = (question: QuizQuestion, option: number) => {
    if (state.locked.includes(question.id)) return;
    if (state.removed[question.id]?.includes(option)) return;
    setState((current) => {
      const results = { ...current.results };
      delete results[question.id];
      return {
        ...current,
        answers: { ...current.answers, [question.id]: option },
        results,
      };
    });
    setMessage('');
  };

  const check = () => {
    if (!allAnswered) return;
    const firstCheck = state.firstTry === null;
    let correctCount = 0;
    const locked = [...state.locked];
    const removed = { ...state.removed };
    const results = { ...state.results };
    const answers = { ...state.answers };

    for (const question of questions) {
      if (locked.includes(question.id)) {
        correctCount += 1;
        continue;
      }
      const chosen = answers[question.id];
      if (chosen === question.correctIndex) {
        correctCount += 1;
        locked.push(question.id);
        results[question.id] = 'correct';
      } else if (chosen != null) {
        removed[question.id] = Array.from(new Set([...(removed[question.id] ?? []), chosen]));
        results[question.id] = 'wrong';
        answers[question.id] = null;
      }
    }

    const firstTry = firstCheck ? correctCount : state.firstTry ?? correctCount;
    const next: QuizState = { answers, locked, removed, results, firstTry };
    setState(next);

    if (correctCount === questions.length) {
      try {
        sessionStorage.removeItem(`sltp_learn_quiz.${level.id}`);
      } catch {
        /* private mode */
      }
      onPass(firstTry);
      return;
    }

    const left = questions.length - correctCount;
    setMessage(`${left} ${left === 1 ? 'question' : 'questions'} to try again.`);
  };

  return (
    <section className="learn-view learn-view--quiz" aria-labelledby="level-quiz-title">
      <button type="button" className="learn-back-link" onClick={onBack}>
        Back to {level.name}
      </button>
      <p className="learn-kicker">Level {level.number} quiz</p>
      <h1 id="level-quiz-title" className="learn-level-title">{level.name} level quiz</h1>
      <p className="learn-lead">
        Answer every question. If any are wrong, only those come back.
      </p>
      <div className="learn-quiz-list">
        {questions.map((question, index) => {
          const locked = state.locked.includes(question.id);
          const removed = state.removed[question.id] ?? [];
          const result = state.results[question.id];
          return (
            <fieldset className="learn-quiz-question" key={question.id}>
              <legend>
                <span className="learn-quiz-number">Question {index + 1}</span>
                {question.prompt}
              </legend>
              <div className="learn-quiz-options">
                {question.options.map((option, optionIndex) => {
                  const isRemoved = removed.includes(optionIndex);
                  const isCorrect = locked && optionIndex === question.correctIndex;
                  const isPicked = state.answers[question.id] === optionIndex;
                  return (
                    <label
                      key={option}
                      className={`learn-option${isPicked ? ' is-picked' : ''}${isRemoved ? ' is-wrong' : ''}${isCorrect ? ' is-correct' : ''}`}
                    >
                      <input
                        type="radio"
                        name={question.id}
                        value={optionIndex}
                        checked={isPicked}
                        disabled={locked || isRemoved}
                        onChange={() => choose(question, optionIndex)}
                      />
                      <span className="learn-option-letter">{LETTERS[optionIndex]}</span>
                      <span>{option}</span>
                      {isRemoved && <span className="learn-option-note">Not this one</span>}
                      {isCorrect && <Check size={18} aria-label="Correct" />}
                    </label>
                  );
                })}
              </div>
              {result === 'correct' && (
                <p className="learn-quiz-explanation">
                  <Check size={16} aria-hidden="true" /> Correct. {question.explanation}
                </p>
              )}
              {result === 'wrong' && (
                <p className="learn-quiz-hint">
                  Not quite. {question.hint ?? 'Try another option.'}
                </p>
              )}
            </fieldset>
          );
        })}
      </div>
      <div className="learn-quiz-bar">
        <div>
          <strong>{answered} of {questions.length} answered</strong>
          {!allAnswered && <span>Answer every question to check.</span>}
          {message && <span role="status">{message}</span>}
        </div>
        <button type="button" className="learn-primary-button" onClick={check} disabled={!allAnswered}>
          Check answers
        </button>
      </div>
    </section>
  );
}
