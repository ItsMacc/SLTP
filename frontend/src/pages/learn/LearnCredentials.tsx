// LearnCredentials.tsx — The Formative Validation Gate quiz that certifies a
// tier. Rendered at the END of each tier's modules, not on its own page.

import { useState } from 'react';
import { Check, Lock, ShieldCheck, Sparkles } from 'lucide-react';
import type { Tier } from '../../learn/curriculum';
import { scoreGate, type useLearn } from '../../learn/useLearn';

type LearnApi = ReturnType<typeof useLearn>;

/* ============================================================
   Formative Validation Gate: short quiz, all correct to pass
   ============================================================ */
export function GateQuiz({ tier, learn }: { tier: Tier; learn: LearnApi }) {
  const [answers, setAnswers] = useState<(number | null)[]>(tier.gate.map(() => null));
  const [submitted, setSubmitted] = useState(false);
  const { correct, passed } = scoreGate(tier.gate, answers);

  const answered = answers.every((a) => a !== null);

  const submit = () => {
    if (!answered) return;
    setSubmitted(true);
    if (passed) learn.certifyTier(tier);
  };

  const retry = () => {
    setAnswers(tier.gate.map(() => null));
    setSubmitted(false);
  };

  if (learn.isCertified(tier.id)) {
    return (
      <div className="learn-gate learn-gate-passed">
        <p className="learn-gate-title">
          <ShieldCheck size={16} /> Certified: {tier.certification}
        </p>
        <p className="learn-gate-note">
          You passed this tier's validation gate. The next tier is now unlocked.
        </p>
      </div>
    );
  }

  if (!learn.gateAvailable(tier)) {
    const done = tier.sections.filter((s) => s.content && learn.isSectionDone(s.id)).length;
    const total = tier.sections.filter((s) => s.content).length;
    return (
      <div className="learn-gate learn-gate-locked">
        <p className="learn-gate-title">
          <Lock size={15} /> Validation gate locked: {done}/{total} modules complete
        </p>
        <p className="learn-gate-note">
          Finish every module in this tier to open the certification quiz.
        </p>
      </div>
    );
  }

  return (
    <div className="learn-gate">
      <p className="learn-gate-title">
        <Sparkles size={16} /> Formative validation gate: {tier.certification}
      </p>
      <p className="learn-gate-note">
        Answer every question correctly to earn the tier certification. Retries allowed:
        the point is comprehension, not memorization.
      </p>

      {tier.gate.map((q, qi) => (
        <div key={qi} className="learn-gate-q">
          <p className="learn-gate-q-text">
            {qi + 1}. {q.q}
          </p>
          <div className="learn-gate-options">
            {q.options.map((opt, oi) => {
              const chosen = answers[qi] === oi;
              let cls = 'learn-gate-option';
              if (submitted && oi === q.answer) cls += ' is-correct';
              else if (submitted && chosen && oi !== q.answer) cls += ' is-wrong';
              else if (chosen) cls += ' is-chosen';
              return (
                <button
                  key={oi}
                  type="button"
                  className={cls}
                  disabled={submitted}
                  onClick={() =>
                    setAnswers((a) => a.map((v, i) => (i === qi ? oi : v)))
                  }
                >
                  {opt}
                </button>
              );
            })}
          </div>
          {submitted && (
            <p className={`learn-gate-explain ${answers[qi] === q.answer ? 'is-right' : 'is-wrong'}`}>
              {answers[qi] === q.answer ? <Check size={13} /> : null} {q.explain}
            </p>
          )}
        </div>
      ))}

      {!submitted ? (
        <button
          type="button"
          className="learn-continue"
          disabled={!answered}
          onClick={submit}
        >
          {answered ? 'Submit answers' : 'Answer every question to submit'}
        </button>
      ) : (
        <div className="learn-gate-result">
          {passed ? (
            <p className="learn-quiz-right">
              <Check size={14} /> {correct}/{tier.gate.length}, certification earned:{' '}
              <strong>{tier.certification}</strong>
            </p>
          ) : (
            <>
              <p className="learn-quiz-wrong">
                {correct}/{tier.gate.length} correct. Re-read the explanations above and
                try again. Every question must be right.
              </p>
              <button type="button" className="learn-continue" onClick={retry}>
                Try again
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
