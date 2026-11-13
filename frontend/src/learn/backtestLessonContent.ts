// backtestLessonContent.ts — Joins the three Backtesting content parts.

import type { LessonContent } from './types';
import { BACKTEST_PART_1 } from './backtestPart1';
import { BACKTEST_PART_2 } from './backtestPart2';
import { BACKTEST_PART_3 } from './backtestPart3';

export const BACKTEST_LESSON_CONTENT: Record<string, LessonContent> = {
  ...BACKTEST_PART_1,
  ...BACKTEST_PART_2,
  ...BACKTEST_PART_3,
};
