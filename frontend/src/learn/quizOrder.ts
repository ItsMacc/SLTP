// quizOrder.ts — presentation-time answer shuffling.
//
// The quiz data lists the correct answer first or second in almost every
// question, which teaches the pattern "it's one of the first two" instead of
// the material. The options are therefore shuffled for display, and the answer
// index is remapped to follow the correct text.
//
// The shuffle is seeded from the question text, so a question keeps the same
// order on every render and every visit — readers can compare answers with a
// friend, and nothing jumps while they are choosing.

import type { QuizQuestion } from './moduleQuizzes';

/** FNV-1a over the question text: small, fast, stable across browsers. */
function seedFrom(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: 32-bit seeded PRNG, returns [0, 1). */
function nextRandom(state: number): () => number {
  let a = state;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Returns a new question with its options in a shuffled, stable order.
 *
 * The correct answer is tracked by text, so `answer` always points at the same
 * option the author marked — only its position changes.
 */
export function shuffleOptions(question: QuizQuestion): QuizQuestion {
  const correctText = question.options[question.answer];
  const rand = nextRandom(seedFrom(question.q));
  const options = [...question.options];

  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }

  return { ...question, options, answer: options.indexOf(correctText) };
}

/** Shuffles every question in a quiz. */
export const shuffleQuestions = (questions: QuizQuestion[]): QuizQuestion[] =>
  questions.map(shuffleOptions);
