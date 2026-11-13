// quizDisplay.ts — Stable option order for every quiz, with the correct answer
// spread across A, B, C and D instead of clustering in the first two slots.

import type { QuizQuestion } from './types';

function hashText(value: string): number {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function shuffle<T>(items: T[], seed: number): T[] {
  const result = [...items];
  let state = seed || 1;
  for (let index = result.length - 1; index > 0; index -= 1) {
    state = Math.imul(state ^ (state >>> 15), 2246822507);
    state = Math.imul(state ^ (state >>> 13), 3266489909);
    const swap = (state >>> 0) % (index + 1);
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

/**
 * Keeps the same order every render for a given question, but moves the
 * correct option to a hashed position and shuffles the distractors.
 */
export function displayQuestion(question: QuizQuestion): QuizQuestion {
  const options = question.options;
  if (options.length < 2) return question;

  const target = hashText(question.id) % options.length;
  const correct = options[question.correctIndex];
  const distractors = shuffle(
    options.filter((_, index) => index !== question.correctIndex),
    hashText(`${question.id}|${options.join('|')}`),
  );

  const ordered: string[] = [];
  let distraction = 0;
  for (let index = 0; index < options.length; index += 1) {
    ordered.push(index === target ? correct : distractors[distraction++]);
  }

  return { ...question, options: ordered, correctIndex: target };
}
