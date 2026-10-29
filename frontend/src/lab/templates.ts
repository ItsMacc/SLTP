// templates.ts — Starting points for Lab projects. The ids match app/database/lab_templates.py,
// which creates Strategy subclasses that return Orders from the current engine.
import { Activity, Crosshair, FileCode, TrendingUp, type LucideIcon } from 'lucide-react';

export type LabTemplateId = 'blank' | 'ema-crossover' | 'rsi-pullback' | 'parabolic-sar';

export interface LabTemplate {
  id: LabTemplateId;
  name: string;
  summary: string;
  rule: string;
  preview: string[];
  icon: LucideIcon;
}

export const LAB_TEMPLATES: LabTemplate[] = [
  {
    id: 'blank',
    name: 'Boilerplate',
    summary: 'A Strategy subclass that returns Orders to the backtester.',
    rule: 'Engine in core/ · your code in workspace/',
    preview: [
      'workspace/custom_strategy.py',
      'from core.strategy.base_strategy import Strategy',
      'from core.utils.Order import Order',
      'class CustomStrategy(Strategy):',
    ],
    icon: FileCode,
  },
  {
    id: 'ema-crossover',
    name: 'EMA crossover',
    summary: 'Buy when the 12-day EMA crosses above the 26-day EMA.',
    rule: 'Buy on the cross · stop 8% below · target 16% above',
    preview: [
      'workspace/ema_crossover_strategy.py',
      'class EmaCrossover(Strategy):',
      'def on_signal(self, ticker, data):',
      'return Order(ticker=ticker, ...)',
    ],
    icon: TrendingUp,
  },
  {
    id: 'rsi-pullback',
    name: 'RSI pullback',
    summary: 'Buy an oversold dip while the close is still above its 50-day average.',
    rule: 'RSI below 30 in an uptrend · stop 6% below · target 12% above',
    preview: [
      'workspace/rsi_pullback_strategy.py',
      'class RsiPullback(Strategy):',
      'def on_signal(self, ticker, data):',
      'return Order(ticker=ticker, ...)',
    ],
    icon: Activity,
  },
  {
    id: 'parabolic-sar',
    name: 'Parabolic SAR trend',
    summary: 'Enter when price flips above the Parabolic SAR, and use the SAR as the stop.',
    rule: 'Price flips above SAR · stop at the SAR · target 25% above',
    preview: [
      'workspace/parabolic_sar_strategy.py',
      'class ParabolicSarTrend(Strategy):',
      'def on_signal(self, ticker, data):',
      'return Order(ticker=ticker, ...)',
    ],
    icon: Crosshair,
  },
];

export function getTemplate(id: LabTemplateId): LabTemplate {
  return LAB_TEMPLATES.find((t) => t.id === id) ?? LAB_TEMPLATES[0];
}
