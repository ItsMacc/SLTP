// advancedLessonContent.ts — Joins the four Advanced content parts so the
// curriculum can read every live lesson from one lookup.

import type { LessonContent } from './types';
import { ADVANCED_PART_1 } from './advancedPart1';
import { ADVANCED_PART_2 } from './advancedPart2';
import { ADVANCED_PART_3 } from './advancedPart3';
import { ADVANCED_PART_4 } from './advancedPart4';

export const ADVANCED_LESSON_CONTENT: Record<string, LessonContent> = {
  ...ADVANCED_PART_1,
  ...ADVANCED_PART_2,
  ...ADVANCED_PART_3,
  ...ADVANCED_PART_4,
};
