// types.ts — Shared shapes for the Learn curriculum and its content.

export type LevelStatus = 'live' | 'outline';
export type LessonStatus = 'live' | 'planned';

export type IconKey =
  | 'building'
  | 'trend'
  | 'receipt'
  | 'chart'
  | 'layers'
  | 'coins'
  | 'shield'
  | 'compass'
  | 'calculator'
  | 'gauge'
  | 'scale'
  | 'book';

export type WidgetId =
  | 'company-story'
  | 'price-news'
  | 'crowd-patterns'
  | 'order-costs'
  | 'candle-builder'
  | 'index-compare'
  | 'compound'
  | 'drawdown'
  | 'plan-builder'
  | 'return-split'
  | 'average-window'
  | 'volatility-compare'
  | 'z-score-lab'
  | 'expectancy-lab'
  | 'correlation-pairs'
  | 'hypothesis-loop'
  | 'indicator-anatomy'
  | 'ma-crossover'
  | 'rsi-gauge'
  | 'atr-volume'
  | 'redundant-signals'
  | 'trend-pattern'
  | 'bounce-pattern'
  | 'breakout-range'
  | 'noise-decay'
  | 'long-short'
  | 'rule-anatomy'
  | 'exposure-limits'
  | 'position-size'
  | 'exit-planner'
  | 'market-filter'
  | 'strategy-card'
  | 'backtest-replay'
  | 'backtest-scene'
  | 'first-run'
  | 'equity-curve-detail'
  | 'return-breakdown'
  | 'drawdown-map'
  | 'risk-return'
  | 'trade-stats'
  | 'cost-drag'
  | 'results-tour'
  | 'overfit-sweep'
  | 'bias-check'
  | 'walk-forward-map'
  | 'skeptic-cards';

export type ContentBlock =
  | { kind: 'p'; text: string }
  | { kind: 'h'; text: string }
  | { kind: 'list'; items: string[]; ordered?: boolean }
  | { kind: 'callout'; tone: 'idea' | 'example' | 'watch'; title: string; text: string }
  | { kind: 'terms'; items: { term: string; text: string }[] }
  | { kind: 'formula'; title?: string; rows: { label: string; expression: string; note?: string }[] }
  | { kind: 'figure'; widget: WidgetId; caption: string };

export interface QuizQuestion {
  id: string;
  lessonId: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  hint?: string;
}

export interface LessonContent {
  objectives: string[];
  blocks: ContentBlock[];
  recap: string[];
  check: QuizQuestion[];
}

export interface Lesson {
  id: string;
  num: string;
  title: string;
  summary: string;
  badge: string;
  badgeDescription: string;
  icon: IconKey;
  status: LessonStatus;
  introduces: string[];
  assumes: string[];
  content?: LessonContent;
}

export interface Part {
  title: string;
  lessons: Lesson[];
}

export interface Level {
  id: string;
  number: number;
  name: string;
  title: string;
  status: LevelStatus;
  lead: string;
  outcomes: string[];
  certificate: string;
  parts: Part[];
  quiz: QuizQuestion[];
}

export interface Workshop {
  id: string;
  title: string;
  summary: string;
  status: 'planned' | 'draft' | 'live';
}
