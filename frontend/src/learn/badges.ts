// badges.ts — Visual rewards for learning progress.
//
// Two kinds of reward:
//   BADGES   — one per module (section), earned the moment that module is
//              marked complete. Shown as a grid of icons on the shelf.
//   TROPHIES — one per tier, earned by passing that tier's validation gate.
//              Bronze → Diamond, in tier order.
//
// Progress itself lives in Supabase (see progress.ts); this file is pure
// presentation data so the reward art has exactly one source of truth.

import {
  Activity, ArrowLeftRight, Award, Binary, BookOpen, Building2, ChartCandlestick,
  FlaskConical, Gauge, Gem, Layers, Medal, Receipt, Scale, ShieldAlert,
  ShieldCheck, Sparkles, TrendingUp, Trophy, type LucideIcon,
} from 'lucide-react';

export type TrophyMetal = 'bronze' | 'silver' | 'gold' | 'emerald' | 'diamond';

export const TROPHIES: Record<TrophyMetal, { label: string; icon: LucideIcon; blurb: string }> = {
  bronze: { label: 'Bronze', icon: Trophy, blurb: 'First steps into the market' },
  silver: { label: 'Silver', icon: Medal, blurb: 'Execution and order flow' },
  gold: { label: 'Gold', icon: Award, blurb: 'Signals built by rule' },
  emerald: { label: 'Emerald', icon: Sparkles, blurb: 'Backtests that survive scrutiny' },
  diamond: { label: 'Diamond', icon: Gem, blurb: 'Portfolio-level mastery' },
};

/** Tier index → trophy metal. Tiers are certified strictly in order. */
export const TIER_TROPHY: TrophyMetal[] = ['bronze', 'silver', 'gold', 'emerald', 'diamond'];

/** Section id → the badge awarded for completing it. */
export const SECTION_BADGES: Record<string, { name: string; icon: LucideIcon }> = {
  // Tier I — market mechanics
  stocks: { name: 'Founder’s Stake', icon: Building2 },
  prices: { name: 'Demand Reader', icon: TrendingUp },
  orders: { name: 'Order Router', icon: Receipt },
  candles: { name: 'Candle Spotter', icon: ChartCandlestick },
  // Tier II — microstructure
  'long-short': { name: 'Both Sides', icon: ArrowLeftRight },
  't2-spreads': { name: 'Spread Whisperer', icon: Layers },
  't2-orderbook': { name: 'Book Diver', icon: BookOpen },
  // Tier III — signals
  math: { name: 'Rule Architect', icon: Binary },
  't3-indicators': { name: 'Trend Tracker', icon: Activity },
  't3-oscillators': { name: 'Momentum Meter', icon: Gauge },
  // Tier IV — validation
  testing: { name: 'Skeptic', icon: FlaskConical },
  't4-sandbox': { name: 'Overfit Buster', icon: ShieldAlert },
  't4-audit': { name: 'Bias Auditor', icon: ShieldCheck },
  // Tier V — portfolio
  risk: { name: 'Risk Warden', icon: ShieldCheck },
  't5-metrics': { name: 'Ratio Reader', icon: Activity },
  't5-allocation': { name: 'Allocator', icon: Scale },
};

const FALLBACK_BADGE = { name: 'Module Badge', icon: Award };

/** Badge definition for a section id; stub sections get their own name too. */
export function badgeFor(sectionId: string): { name: string; icon: LucideIcon } {
  return SECTION_BADGES[sectionId] ?? FALLBACK_BADGE;
}

/** Trophy definition for a tier's position in the ladder (0-indexed). */
export function trophyFor(tierIndex: number) {
  const metal = TIER_TROPHY[Math.min(tierIndex, TIER_TROPHY.length - 1)];
  return { metal, ...TROPHIES[metal] };
}
