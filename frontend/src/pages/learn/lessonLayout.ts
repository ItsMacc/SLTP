// lessonLayout.ts — Small layout choices that keep long lessons from reading
// like the same page repeated.

export type TermLayout = 'grid' | 'rows' | 'index' | 'stack' | 'none';

interface LessonLayout {
  terms: TermLayout;
  figureAfter?: number;
}

// Backtesting lessons no longer end with a definitions block. The terms are
// already explained in the prose and widgets, so the block only added repetition.
const FIGURE_AFTER: Record<string, number> = {
  'what-is-a-backtest': 8,
  'backtest-setup': 10,
  'first-run': 3,
  'equity-curve': 4,
  'return-numbers': 14,
  'worst-stretch': 4,
  'return-for-risk': 7,
  'trade-statistics': 7,
  'costs-realism': 6,
  'reading-results': 3,
  'fooling-1': 8,
  'fooling-2': 12,
  'testing-properly': 10,
  'spot-the-problem': 2,
};

// The two lessons outside Backtesting that still use a term block.
const TERMS_LAYOUT: Record<string, TermLayout> = {
  'read-a-chart': 'rows',
  'fear-and-greed': 'index',
};

export function layoutForLesson(lessonId: string): LessonLayout {
  return {
    terms: TERMS_LAYOUT[lessonId] ?? 'none',
    figureAfter: FIGURE_AFTER[lessonId],
  };
}
