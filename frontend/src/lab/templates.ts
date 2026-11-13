// templates.ts — the starting strategies the New project wizard offers.
//
// Every template is a Strategy class, not a script that builds a Backtester.
// Run finds the class, instantiates it and runs it over the default window,
// so a new project is one click from a real report.
//
// The four named templates are the prebuilt strategies the browser engine
// runs, imported straight from their sources so the wizard always shows the
// code that ships with the engine.

import { Crosshair, FileCode, Globe, Shield, TrendingUp, type LucideIcon } from 'lucide-react';

import adaptiveMomentumSource from '../store/strategies/adaptive_momentum.py?raw';
import gtaSource from '../store/strategies/global_trend_allocation.py?raw';
import minVolSource from '../store/strategies/minimum_volatility.py?raw';
import smrSource from '../store/strategies/statistical_mean_reversion.py?raw';

export type LabTemplateId =
  | 'blank'
  | 'adaptive-momentum'
  | 'global-trend-allocation'
  | 'minimum-volatility'
  | 'statistical-mean-reversion';

export interface LabTemplate {
  id: LabTemplateId;
  name: string;
  summary: string;
  /** Where the starting code lives, shown under the name. */
  rule: string;
  /** The first lines of the file, shown in the wizard. */
  preview: string[];
  /** What every project starts with: workspace/main.py. */
  code: string;
  icon: LucideIcon;
}

/** Drop the "browser copy" note: it explains the bundling, not the strategy. */
function starter(source: string): string {
  return source
    .split('\n')
    .filter((line) => !line.startsWith('# BROWSER COPY') && !line.startsWith('# inside the engine worker'))
    .join('\n');
}

const BLANK = `from sltp import Order, RebalanceFrequency, StockData, Strategy


class MyStrategy(Strategy):
    """Every hook a Strategy can implement, in the order the engine calls them."""


    def __init__(self):
        super().__init__()

        # Identity. Both are shown by the API and the strategy registry.
        self.name: str = "My strategy"
        self.description: str = "One line on what this strategy does."

        # Book policy: the limits the engine enforces on your positions.
        self.MAX_POSITIONS: int = 10  # Most tickers held at once. None means no cap.
        self.MAX_ALLOCATION_PER_TICKER: float = 0.15  # Ceiling on one ticker's share of equity. None means no ceiling.
        self.MAX_LOTS_PER_TICKER: int = 1  # Separate entries one ticker may hold at once.
        self.REBALANCE_FREQUENCY: RebalanceFrequency = RebalanceFrequency.MONTHLY  # NEVER, MONTHLY, QUARTERLY or YEARLY. Sets how often on_rebalance runs.
        self.MIN_BARS_REQUIRED: int = 60  # Sessions of history a ticker needs before the hooks run for it.
        self.LIQUIDATE_ON_END: bool = False  # True closes every open lot at the final close.
        self.STREAMING_INDICATORS: bool = False  # True keeps indicators in a rolling cache instead of recomputing them.

        # Your own parameters. Anything the hooks below read belongs here.
        self.ALLOCATION: float = 0.10  # Share of equity one entry uses.
        self.STOP_LOSS_PCT: float = 0.08
        self.TAKE_PROFIT_PCT: float = 0.16


    # -------- Required --------

    def on_signal(self, ticker: str, data: StockData) -> Order | None:
        """Runs for each eligible ticker after fills. Return an Order to queue an
        entry for the next open, or None to leave the ticker alone."""
        if ticker in self.open_tickers:  # Already held: do not stack entries.
            return None

        closes = data.close_price
        if len(closes) < self.MIN_BARS_REQUIRED:
            return None

        # No setup yet. Replace this with your entry rule and return an Order:
        #
        #   close = float(closes[-1])
        #   return Order(
        #       ticker=ticker,
        #       position_type=PositionType.LONG,
        #       allocation=self.ALLOCATION,
        #       sizing=OrderSizing.EQUITY,
        #       order_date=str(data.dates[-1]),
        #       stop_loss=round(close * (1.0 - self.STOP_LOSS_PCT), 2),
        #       take_profit=round(close * (1.0 + self.TAKE_PROFIT_PCT), 2),
        #   )
        return None


    # -------- Optional --------

    def run_daily(self, current_date: str) -> None:
        """Optional. Runs once per session, before any fill or signal. Use it for
        per-day state that does not belong to a single ticker."""
        pass

    def initialize_universe(self, current_date: str, histories: dict[str, StockData]) -> bool:
        """Builds the names this strategy may trade. Runs before the loop, and again
        during warmup until it returns True. Returning True with no tickers raises."""
        self.add_tickers(["AAPL", "MSFT", "NVDA", "SPY"])
        return True

    def on_rebalance(self, current_date: str, histories: dict[str, StockData]) -> None:
        """Optional. Runs after fills and before signals, only when
        REBALANCE_FREQUENCY is due. Use it to re-rank the universe."""
        pass
`;

const ADAPTIVE_MOMENTUM = starter(adaptiveMomentumSource);
const GLOBAL_TREND_ALLOCATION = starter(gtaSource);
const MINIMUM_VOLATILITY = starter(minVolSource);
const STATISTICAL_MEAN_REVERSION = starter(smrSource);

export const LAB_TEMPLATES: LabTemplate[] = [
  {
    id: 'blank',
    name: 'Strategy skeleton',
    summary: 'Every Strategy hook in call order, with the variables you can set.',
    rule: 'Starts in workspace/main.py',
    preview: [
      'class MyStrategy(Strategy):',
      '    def __init__(self):',
      '    def on_signal(self, ticker, data):',
      '    def run_daily(self, current_date):',
      '    def initialize_universe(self, current_date, histories):',
      '    def on_rebalance(self, current_date, histories):',
    ],
    code: BLANK,
    icon: FileCode,
  },
  {
    id: 'adaptive-momentum',
    name: 'Adaptive Momentum',
    summary: 'Holds the 20 strongest liquid US stocks while SPY is above its 200-day average.',
    rule: 'Starts in workspace/main.py',
    preview: [
      'class AdaptiveMomentum(Strategy):',
      'score = momentum / volatility',
      'if self._market_is_on(histories):',
    ],
    code: ADAPTIVE_MOMENTUM,
    icon: TrendingUp,
  },
  {
    id: 'global-trend-allocation',
    name: 'Global Trend Allocation',
    summary: 'Five-ETF book from trend, correlation and momentum. Exits a sleeve when its trend breaks.',
    rule: 'Starts in workspace/main.py',
    preview: [
      'class GlobalTrendAllocation(Strategy):',
      'self.MAX_POSITIONS: int = 5',
      'picks = self._execute_selection_matrix(...)',
    ],
    code: GLOBAL_TREND_ALLOCATION,
    icon: Globe,
  },
  {
    id: 'minimum-volatility',
    name: 'Minimum Volatility',
    summary: 'Equal-weighted 30 least volatile liquid US stocks, rebuilt quarterly.',
    rule: 'Starts in workspace/main.py',
    preview: [
      'class MinimumVolatility(Strategy):',
      'self.REBALANCE_FREQUENCY = RebalanceFrequency.QUARTERLY',
      'self._rank(histories)',
    ],
    code: MINIMUM_VOLATILITY,
    icon: Shield,
  },
  {
    id: 'statistical-mean-reversion',
    name: 'Statistical Mean Reversion',
    summary: 'Buys stocks that fell further than their volatility explains, then waits for the snap back.',
    rule: 'Starts in workspace/main.py',
    preview: [
      'class StatisticalMeanReversionStrategy(Strategy):',
      'if rsi < self.RSI_THRESHOLD and z_score < -self.Z_SCORE_THRESHOLD:',
      'stop and target at 3 standard deviations',
    ],
    code: STATISTICAL_MEAN_REVERSION,
    icon: Crosshair,
  },
];

export function getTemplate(id: LabTemplateId): LabTemplate {
  return LAB_TEMPLATES.find((template) => template.id === id) ?? LAB_TEMPLATES[0];
}
