// badges.ts — Visual rewards for learning progress.
//
// Two kinds of reward:
//   SECTION_BADGES  - one per lesson, earned the moment that lesson is marked
//                     done. Named for what the learner can now do, 2-3 words.
//   certificateFor  - one per level, earned by passing that level's quiz. This
//                     file supplies the art and colour only; the certificate's
//                     NAME lives in curriculum.ts so the two cannot drift.
//
// Progress itself lives in Supabase (see progress.ts); this file is pure
// presentation data so the reward art has exactly one source of truth.

import {
  Activity, ArrowLeftRight, Award, Binary, BookOpen, Brain, Building2,
  Calculator, ChartCandlestick, Code, Compass, FileText, FlaskConical, Gauge,
  Layers, Lightbulb, LineChart, MessageSquare, Puzzle, Receipt, Scale,
  ShieldCheck, Tag, TrendingUp,
  type LucideIcon,
} from 'lucide-react';

export type TierAccent = 'bronze' | 'silver' | 'gold';

/** Level index → accent (colour only) plus the certificate's icon. */
const CERTIFICATE_ART: Record<TierAccent, { icon: LucideIcon }> = {
  bronze: { icon: ChartCandlestick },
  silver: { icon: Compass },
  gold: { icon: Code },
};

const TIER_ACCENT: TierAccent[] = ['bronze', 'silver', 'gold'];

/** Lesson id → the badge awarded for marking that lesson done. */
export const SECTION_BADGES: Record<string, { name: string; icon: LucideIcon }> = {
  // Beginner
  stocks: { name: 'Part Owner', icon: Building2 },
  prices: { name: 'Tug of War', icon: TrendingUp },
  orders: { name: 'First Order', icon: Receipt },
  candles: { name: 'Chart Reader', icon: ChartCandlestick },
  'long-short': { name: 'Long & Short', icon: ArrowLeftRight },
  math: { name: 'Rulebook', icon: Binary },
  risk: { name: 'Safety Net', icon: ShieldCheck },

  // Intermediate
  't3-style': { name: 'Trader or Investor', icon: Compass },
  't3-index': { name: 'Whole Market', icon: LineChart },
  psychology: { name: 'Crowd Watcher', icon: Brain },
  ideas: { name: 'Hunch to Hypothesis', icon: Lightbulb },
  'why-math': { name: 'Numbers, Not Hunches', icon: Calculator },
  't3-indicators': { name: 'Signal Spotter', icon: Activity },
  vocabulary: { name: 'Speaks the Language', icon: MessageSquare },
  anatomy: { name: 'Strategy Anatomy', icon: Puzzle },

  // Advanced
  'code-read': { name: 'Reads Code', icon: Code },
  'code-write': { name: 'First Strategy', icon: Code },
  statements: { name: 'Reads Statements', icon: FileText },
  valuation: { name: 'Price vs Value', icon: Tag },
  testing: { name: 'Fair Test', icon: FlaskConical },
  't4-walkthrough': { name: 'First Backtest', icon: BookOpen },
  't5-metrics': { name: 'Scorekeeper', icon: Gauge },
  't5-allocation': { name: 'Spread It Out', icon: Scale },
  't2-spreads': { name: 'Mind the Gap', icon: Layers },
  't2-orderbook': { name: 'Order Book Reader', icon: BookOpen },
};

const FALLBACK_BADGE = { name: 'Lesson badge', icon: Award };

/** Badge definition for a lesson id. */
export function badgeFor(sectionId: string): { name: string; icon: LucideIcon } {
  return SECTION_BADGES[sectionId] ?? FALLBACK_BADGE;
}

/** Certificate art + accent for a level's position in the ladder (0-indexed). */
export function certificateFor(tierIndex: number): { metal: TierAccent; icon: LucideIcon } {
  const metal = TIER_ACCENT[Math.min(tierIndex, TIER_ACCENT.length - 1)];
  return { metal, ...CERTIFICATE_ART[metal] };
}
