// badges.ts — Icon and medal-shape metadata keyed from curriculum lesson data.

import {
  BookOpen,
  Building2,
  Calculator,
  ChartNoAxesCombined,
  Coins,
  Compass,
  Gauge,
  Layers3,
  ReceiptText,
  Scale,
  Shield,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import type { IconKey } from './types';

export const BADGE_ICONS: Record<IconKey, LucideIcon> = {
  building: Building2,
  trend: TrendingUp,
  receipt: ReceiptText,
  chart: ChartNoAxesCombined,
  layers: Layers3,
  coins: Coins,
  shield: Shield,
  compass: Compass,
  calculator: Calculator,
  gauge: Gauge,
  scale: Scale,
  book: BookOpen,
};

export const MEDAL_SHAPES = ['circle', 'hexagon', 'octagon', 'rounded', 'diamond'] as const;

export function iconFor(key: IconKey): LucideIcon {
  return BADGE_ICONS[key] ?? BookOpen;
}

export function shapeForLevel(levelIndex: number): (typeof MEDAL_SHAPES)[number] {
  return MEDAL_SHAPES[levelIndex] ?? 'circle';
}
