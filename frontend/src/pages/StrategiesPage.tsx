// StrategiesPage.tsx — Strategies listing page and hero banner
import React, { useEffect, useState } from 'react';
import { ChevronUp } from 'lucide-react';
import { StrategyCard } from '../components/StrategyCard';
import { type StrategyData } from '../types/strategy';
import './StrategiesPage.css';

/** Define Strategy Data */
const BuyAndHoldStrategy: StrategyData = {
  id: 'buy-and-hold',
  name: 'Buy and Hold',
  category: 'INVESTING',
  summary: 'A long-term investment strategy where you buy investments and keep them for years, regardless of short-term price movements.',
  metrics: {
    horizon: '10+ Years',
    activity: 'Low',
    positions: 'Full Universe', 
    rebalance: 'Never',
  },
  idea: {
    hypothesis: 'Over the long term, the stock market tends to increase in value because growing companies continually make higher profits and innovate. By holding these investments without selling, your money grows untouched while avoiding extra fees, taxes, and bad emotional decisions.',
    whyItWorks: [
      'Captures overall market growth over time without requiring you to predict when to buy or sell.',
      'Saves money by minimizing transaction costs and capital gains tax from frequent trading.',
      'Prevents emotional mistakes, such as panic selling during short-term price drops.',
    ],
    whyItDoesnt: [
      'Exposes your account to full drawdowns during severe economic recessions or market crashes.',
      'Lacks active trading rules to lock in profits or pivot into cash when prices fall.',
      'Can take several years to break even after major market downturns.',
    ],
  },
  universeLogic: 'Holds every available asset in the selected market without filtering, ranking, or excluding any options.',
  rebalanceLogic: 'No automatic buying or selling occurs. Investments remain untouched unless you manually add or withdraw funds.',
  inDepthSections: [
    {
      id: 'benchmark-role',
      title: 'Why This Strategy Is The Universal Benchmark',
      content:
        'This model serves as the baseline benchmark for every other strategy on the platform. Because it represents simple, unmanaged market exposure with zero market timing or management fees, any active trading strategy must generate a higher risk-adjusted return to justify its added complexity and trading costs.',
    }
  ],
  pros: [
    'Requires minimal time, effort, and financial knowledge to maintain.',
    'Highly cost-effective with low transaction costs and maximum tax efficiency.',
    'Provides a transparent baseline benchmark to measure all active trading performance.',
  ],
  cons: [
    'Offers zero risk management protection during steep market declines.',
    'Does not include exit rules or profit-taking steps to secure gains during market peaks.',
    'May cause uncomfortable paper losses during severe market crashes.',
  ],
  glossary: {
    portfolio: {
      definition: 'The total collection of financial investments owned by a single person or organization.',
      example: 'If you own shares in five different companies inside one account, those combined investments make up your portfolio.',
    },
    'transaction costs': {
      definition: 'The fees and expenses paid whenever you buy or sell an investment, including broker commissions and bank charges.',
      example: 'If you buy $1,000 worth of stock and your broker charges a $5 fee, that $5 is a transaction cost.',
    },
    volatility: {
      definition: 'How quickly and drastically the price of an investment moves up and down over time.',
      example: 'A stock whose price swings between $80 and $120 in a single week has high volatility.',
    },
    'bear market': {
      definition: 'A prolonged period of time when market prices fall continuously, usually dropping 20% or more from recent highs.',
      example: 'If the overall market index drops from 1,000 points down to 780 points and stays down for months, it is in a bear market.',
    },
    drawdowns: {
      definition: 'The total percentage drop in value from an investment account peak down to its lowest point before recovering.',
      example: 'If your account grows to $10,000 and then falls to $7,500 during a crash, you experienced a 25% drawdown.',
    },
    'risk management': {
      definition: 'Rules or safety measures put in place to limit total money lost during unfavorable market conditions.',
      example: 'Setting a rule to automatically sell an investment if it drops 10% is a simple form of risk management.',
    },
    benchmark: {
      definition: 'A simple baseline standard used to measure whether a specific trading strategy is actually performing well.',
      example: 'If an active trading strategy makes 8% this year while the unmanaged market benchmark makes 10%, the active strategy underperformed.',
    },
    exposure: {
      definition: 'The total amount of money or percentage of your account tied to a specific market or investment.',
      example: 'If $40,000 of your $100,000 account is invested in tech stocks, your exposure to technology is 40%.',
    },
    'capital gains tax': {
      definition: 'A tax paid to the government on the profit made when selling an investment for more than you paid for it.',
      example: 'If you buy a stock for $100 and sell it for $150, you pay capital gains tax only on the $50 profit.',
    },
    'market timing': {
      definition: 'The attempt to predict future market prices by buying right before prices go up and selling right before they fall.',
      example: 'Trying to guess the exact day a stock reaches its lowest price to buy it is an example of market timing.',
    },
    'active trading': {
      definition: 'A strategy that involves frequent buying and selling of investments to capitalize on short-term price movements.',
      example: 'Placing several buys and sells each week to profit from daily news is considered active trading.',
    },
    'risk-adjusted return': {
      definition: 'A calculation that measures how much profit an investment made relative to the amount of risk taken to get that profit.',
      example: 'If two strategies make 10% profit, but Strategy A suffered huge 40% swings while Strategy B barely fluctuated, Strategy B has a far better risk-adjusted return.',
    },
  },
};

export const StockHealthFilterStrategy: StrategyData = {
  id: 'stock-health-filter',
  name: 'Stock Health Filter',
  category: 'TRADING',
  summary: 'A momentum breakout strategy that identifies high-velocity stocks with strong short-term vs. long-term price health.',
  metrics: {
    horizon: '2+ Years',
    activity: 'Medium',
    positions: 'Up to 20',
    rebalance: 'Quarterly',
  },
  idea: {
    hypothesis: 'Stocks with the highest trading volumes that are structurally healthy and accelerating in price are more likely to continue their momentum than those that are weak or declining. By filtering for high short-term vs. long-term health ratios, we can identify breakout candidates with strong upside potential.',
    whyItWorks: [
      'Catches explosive breakouts by waiting for a stock’s short-term health score to violently jump way above its long-term baseline average.',
      'Focuses exclusively on heavily traded, high-volume stocks so sudden ratio spikes signal real interest.',
      'Exploits predictable human behaviour in market psychology during sudden price acceleration phases instead of attempting to guess or predict future market prices.'
    ],
    whyItDoesnt: [
      'Risk of getting caught in false breakout traps when market-wide momentum stalls or reverses suddenly.',
      'By the time a stock’s health ratio spikes, it may already be overextended and due for a pullback.',
      'In sideways or choppy markets, the strategy may generate many false signals that lead to losses or whipsaw trades.',
    ],
  },
  universeLogic: 'Filters the market universe to include the top 25 most liquid stocks based on average daily trading volume, and their growth rates in the past 3 months.',
  rebalanceLogic: 'Quarterly rebalancing of the portfolio to remove underperforming assets and replace them with top liquid growth candidates from the universe.',

  inDepthSections: [
    {
      id: 'strategy-overview',
      title: 'Strategy Overview',
      content: 'The Stock Health Filter strategy scans market universes for high-momentum breakouts by evaluating short-term vs. long-term price structural "health." Rather than inspecting simple price momentum, it calculates a compound score based on log-linear regression consistency, annualized positive slope growth, and downside volatility frequency. Breakout buys are confirmed when the short-to-long health ratio spikes upward alongside velocity validation.',
    },
    {
      id: 'risk-management',
      title: 'Dynamic Risk Management',
      content: 'This strategy employs a dynamic risk management framework using Average True Range (ATR) to set stop-loss and take-profit levels. The stop-loss is placed at 4x ATR below the entry price, while the take-profit is set at 2x the calculated risk distance above the entry. This approach allows for flexible position sizing and helps protect capital during volatile market conditions.',
    },
  ],

  comparisons : [
    {
      id: 'recent-market',
      periodName: 'Recent Market (2024-2026)',
      expectation: 'The strategy aims to generate superior risk-adjusted returns during steady market conditions, trading off some raw growth for capital preservation.',
      resultSummary: 'Although the strategy lagged slightly in total returns, it fulfilled its risk objectives by limiting maximum drawdowns compared to the broader benchmark.',
      strategySvg: '/assets/backtests/StockHealthFilter_Recent.svg',
      benchmarkSvg: '/assets/backtests/BuyAndHold_Recent.svg',
      metrics: {
        strategy: {
          finalValue: '132.68',
          cagr: '15.22%',
          maxDrawdown: '-11.08%',
          sharpeRatio: '1.4446',
          rawFinalValue: 132.68,
          rawCagr: 15.22,
          rawMaxDrawdown: -11.08,
          rawSharpe: 1.4446,
        },
        benchmark: {
          finalValue: '137.66',
          cagr: '17.37%',
          maxDrawdown: '-16.22%',
          sharpeRatio: '1.2468',
          rawFinalValue: 137.66,
          rawCagr: 17.37,
          rawMaxDrawdown: -16.22,
          rawSharpe: 1.2468,
        },
      },
    },
    {
      id: 'bear-market-1',
      periodName: 'Bear Market 1 (January - December 2022)',
      expectation: 'During sustained market declines, the strategy is designed to protect capital and mitigate severe losses relative to holding broad equity indices.',
      resultSummary: 'The strategy successfully cushioned downside risk, maintaining a significantly lower peak-to-trough decline than the benchmark throughout the pullback.',
      strategySvg: '/assets/backtests/StockHealthFilter_Bear_Market_1.svg',
      benchmarkSvg: '/assets/backtests/BuyAndHold_Bear_Market_1.svg',
      metrics: {
        strategy: {
          finalValue: '89.68',
          cagr: '-10.43%',
          maxDrawdown: '-10.87%',
          sharpeRatio: '-2.2102',
          rawFinalValue: 89.68,
          rawCagr: -10.43,
          rawMaxDrawdown: -10.87,
          rawSharpe: -2.2102,
        },
        benchmark: {
          finalValue: '88.22',
          cagr: '-11.91%',
          maxDrawdown: '-18.56%',
          sharpeRatio: '-0.6142',
          rawFinalValue: 88.22,
          rawCagr: -11.91,
          rawMaxDrawdown: -18.56,
          rawSharpe: -0.6142,
        },
      },
    },
    {
      id: 'bear-market-2',
      periodName: 'Bear Market 2 (2007-2009)',
      expectation: 'During major structural downturns, the strategy should systematically exit deteriorating positions to minimize severe drawdown exposure.',
      resultSummary: 'Capital preservation rules performed as intended, cutting overall portfolio losses and peak drawdown depth roughly in half during a historical market crash.',
      strategySvg: '/assets/backtests/StockHealthFilter_Bear_Market_2.svg',
      benchmarkSvg: '/assets/backtests/BuyAndHold_Bear_Market_2.svg',
      metrics: {
        strategy: {
          finalValue: '85.06',
          cagr: '-10.24%',
          maxDrawdown: '-15.70%',
          sharpeRatio: '-1.9112',
          rawFinalValue: 85.06,
          rawCagr: -10.24,
          rawMaxDrawdown: -15.70,
          rawSharpe: -1.9112,
        },
        benchmark: {
          finalValue: '69.49',
          cagr: '-21.58%',
          maxDrawdown: '-36.27%',
          sharpeRatio: '-1.1263',
          rawFinalValue: 69.49,
          rawCagr: -21.58,
          rawMaxDrawdown: -36.27,
          rawSharpe: -1.1263,
        },
      },
    },
    {
      id: 'covid',
      periodName: 'COVID Crash & Recovery (2020-2021)',
      expectation: 'The strategy seeks to limit drawdowns during sharp market drops while maintaining enough market exposure to capture the subsequent recovery.',
      resultSummary: 'While downside protection was effective during the initial shock, defensive positioning caused the strategy to lag the benchmark in the rapid market rally that followed.',
      strategySvg: '/assets/backtests/StockHealthFilter_COVID.svg',
      benchmarkSvg: '/assets/backtests/BuyAndHold_COVID.svg',
      metrics: {
        strategy: {
          finalValue: '125.75',
          cagr: '13.52%',
          maxDrawdown: '-10.08%',
          sharpeRatio: '1.3804',
          rawFinalValue: 125.75,
          rawCagr: 13.52,
          rawMaxDrawdown: -10.08,
          rawSharpe: 1.3804,
        },
        benchmark: {
          finalValue: '181.78',
          cagr: '39.20%',
          maxDrawdown: '-16.71%',
          sharpeRatio: '1.5687',
          rawFinalValue: 181.78,
          rawCagr: 39.20,
          rawMaxDrawdown: -16.71,
          rawSharpe: 1.5687,
        },
      },
    },
    {
      id: 'bull-market-1',
      periodName: 'Bull Market 1 (2012-2018)',
      expectation: 'In extended equity uptrends, the strategy aims to deliver stable compounding while maintaining disciplined risk limits relative to broad holdings.',
      resultSummary: 'The strategy achieved steady growth, but the benchmark yielded higher overall return metrics given the low-volatility nature of this prolonged upward move.',
      strategySvg: '/assets/backtests/StockHealthFilter_Bull_Market_1.svg',
      benchmarkSvg: '/assets/backtests/BuyAndHold_Bull_Market_1.svg',
      metrics: {
        strategy: {
          finalValue: '202.76',
          cagr: '11.05%',
          maxDrawdown: '-16.97%',
          sharpeRatio: '1.0003',
          rawFinalValue: 202.76,
          rawCagr: 11.05,
          rawMaxDrawdown: -16.97,
          rawSharpe: 1.0003,
        },
        benchmark: {
          finalValue: '252.42',
          cagr: '14.72%',
          maxDrawdown: '-16.14%',
          sharpeRatio: '1.2371',
          rawFinalValue: 252.42,
          rawCagr: 14.72,
          rawMaxDrawdown: -16.14,
          rawSharpe: 1.2371,
        },
      },
    },
    {
      id: 'bull-market-2',
      periodName: 'Bull Market 2 (2009-2016)',
      expectation: 'Throughout multi-year expansions, periodic portfolio rebalancing should keep fundamental quality high without heavily drag on total compounding.',
      resultSummary: 'Continuous risk management led to performance drag relative to a pure buy-and-hold approach, which strongly benefits from uninterrupted market expansion.',
      strategySvg: '/assets/backtests/StockHealthFilter_Bull_Market_2.svg',
      benchmarkSvg: '/assets/backtests/BuyAndHold_Bull_Market_2.svg',
      metrics: {
        strategy: {
          finalValue: '184.53',
          cagr: '8.06%',
          maxDrawdown: '-16.85%',
          sharpeRatio: '0.8072',
          rawFinalValue: 184.53,
          rawCagr: 8.06,
          rawMaxDrawdown: -16.85,
          rawSharpe: 0.8072,
        },
        benchmark: {
          finalValue: '321.66',
          cagr: '15.92%',
          maxDrawdown: '-21.07%',
          sharpeRatio: '0.9785',
          rawFinalValue: 321.66,
          rawCagr: 15.92,
          rawMaxDrawdown: -21.07,
          rawSharpe: 0.9785,
        },
      },
    },
    {
      id: '10-year-current',
      periodName: '10-Year Current (2016-2026)',
      expectation: 'Across a ten-year horizon, filtering underperforming assets and limiting large drawdowns should drive higher risk-adjusted efficiency.',
      resultSummary: 'The strategy delivered stronger risk efficiency over the decade by successfully shielding the portfolio from major market drawdowns.',
      strategySvg: '/assets/backtests/StockHealthFilter_10-year_current.svg',
      benchmarkSvg: '/assets/backtests/BuyAndHold_10-year_current.svg',
      metrics: {
        strategy: {
          finalValue: '275.22',
          cagr: '10.66%',
          maxDrawdown: '-19.11%',
          sharpeRatio: '1.0713',
          rawFinalValue: 275.22,
          rawCagr: 10.66,
          rawMaxDrawdown: -19.11,
          rawSharpe: 1.0713,
        },
        benchmark: {
          finalValue: '364.33',
          cagr: '13.82%',
          maxDrawdown: '-35.40%',
          sharpeRatio: '0.7951',
          rawFinalValue: 364.33,
          rawCagr: 13.82,
          rawMaxDrawdown: -35.40,
          rawSharpe: 0.7951,
        },
      },
    },
    {
      id: '15-year',
      periodName: '15-Year Horizon (2010-2025)',
      expectation: 'Over multiple full market cycles, rigorous risk controls should protect principal during downturns and smooth long-term equity compounding.',
      resultSummary: 'The strategy demonstrated significant downside protection by holding peak-to-trough drawdowns to half that of the benchmark over 15 years.',
      strategySvg: '/assets/backtests/StockHealthFilter_15-year.svg',
      benchmarkSvg: '/assets/backtests/BuyAndHold_15-year.svg',
      metrics: {
        strategy: {
          finalValue: '223.81',
          cagr: '5.52%',
          maxDrawdown: '-17.85%',
          sharpeRatio: '0.7148',
          rawFinalValue: 223.81,
          rawCagr: 5.52,
          rawMaxDrawdown: -17.85,
          rawSharpe: 0.7148,
        },
        benchmark: {
          finalValue: '719.43',
          cagr: '14.07%',
          maxDrawdown: '-36.65%',
          sharpeRatio: '0.8391',
          rawFinalValue: 719.43,
          rawCagr: 14.07,
          rawMaxDrawdown: -36.65,
          rawSharpe: 0.8391,
        },
      },
    },
  ],

  pros: [
    'Systematically selects assets with strong trend consistency and minimal downside noise.',
    'Protects capital against major drops using dynamic ATR-based volatility stops.',
    'Automates portfolio cleanup by pruning underperformers during quarterly rebalance cycles.',
  ],

  cons: [
    'Whipsaw risk during sideways market conditions can trigger false spike entries.',
    'Requires a warm-up period and reliable daily volume data for universe ranking.',
    'Can temporarily miss rapid turnarounds in oversold, beaten-down stocks.',
  ],

  glossary: {
    momentum: {
      definition: 'The tendency of an asset that has performed well in the recent past to continue performing well, or vice versa.',
      example: 'If a stock’s price has been rising steadily for weeks, it has strong positive momentum.',
    },
    breakout: {
      definition: 'When an investment price moves sharply above a resistance level or previous trading range, often signaling the start of a strong new trend.',
      example: 'If a stock trades sideways under $50 for months and then suddenly surges to $55 on high volume, it has experienced a breakout.',
    },
    'choppy market': {
      definition: 'A directionless, erratic market environment characterized by frequent, unpredictable price reversals rather than clean trends.',
      example: 'A market where stocks bounce up 3% one day and drop 3% the next with no clear overall direction is considered choppy.',
    },
    'whipsaw trades': {
      definition: 'Losing trades caused when a security’s price abruptly changes direction right after a trader enters a position, triggering false signals.',
      example: 'Buying a sudden price spike only for the stock to crash immediately afterward is a classic whipsaw trade.',
    },
    'downside volatility': {
      definition: 'Price fluctuations that specifically represent sudden downward drops or losses in an investment value, ignoring upward swings.',
      example: 'A stock that frequently crashes by 5% on bad days while rarely moving up smoothly suffers from high downside volatility.',
    },
    ATR: {
      definition: 'Average True Range (ATR) is an indicator that measures market volatility by breaking down the entire price range of an asset over a given period.',
      example: 'If a stock has an ATR of $3, its average daily price swing from high to low is about $3.',
    },
    'liquid stocks': {
      definition: 'Stocks that can be easily bought or sold in large quantities without causing a major shift in their market price.',
      example: 'Apple or Microsoft shares can be traded instantly in millions of volumes, making them highly liquid stocks.',
    },
    'log-linear regression': {
      definition: 'A statistical method used to evaluate exponential or percentage growth rates over time by fitting a straight line to logarithmic price data.',
      example: 'Using log-linear regression helps measure whether a stock is growing at a steady compound percentage rate.',
    },
    cagr: {
      definition: 'Compound Annual Growth Rate (CAGR) measures the average annualized rate of return of an investment over a period longer than one year.',
      example: 'If an account grows from $10,000 to $12,100 over two years, its CAGR is 10% per year.',
    },
    'sharpe ratio': {
      definition: 'A mathematical measure used to evaluate how much excess return an investment yields relative to the volatility and risk taken.',
      example: 'A strategy with a Sharpe ratio above 1.0 is generally considered good, showing high efficiency per unit of risk taken.',
    },
    'max drawdown': {
      definition: 'The maximum percentage drop in portfolio value from its peak level down to its lowest point before making a new high.',
      example: 'If your portfolio drops from $100 to $70 during a crash, the maximum drawdown for that period is 30%.',
    },
    'capital preservation': {
      definition: 'An investment strategy aimed strictly at preventing financial loss and protecting the primary principal amount over market growth.',
      example: 'Shifting portfolio assets into cash during an impending crash is a capital preservation tactic.',
    },
    'performance drag': {
      definition: 'Factors such as holding cash, paying fees, or hedging positions that cause a portfolio to grow more slowly than an unmanaged market benchmark.',
      example: 'Holding 30% cash during an explosive bull market creates performance drag on your overall returns.',
    },
    compounding: {
      definition: 'The process where an investment generates earnings, which are then reinvested to generate their own earnings over time.',
      example: 'Earning 10% on $100 gives you $110; the next year, earning 10% on $110 yields $11 instead of $10 due to compounding.',
    },
  }
};

const STRATEGY_LIST = [
  { strategy: BuyAndHoldStrategy, indexNumber: 1 },
  { strategy: StockHealthFilterStrategy, indexNumber: 2 },
];

/* Breathing room left above a card when it is brought back into view */
const CARD_SCROLL_OFFSET = 24;
/* Roughly how long the glide back to the card takes */
const CARD_GLIDE_MS = 380;
/* How long to keep correcting the scroll, covering the whole collapse transition */
const CARD_HOLD_MS = 900;

/* Readers who ask for reduced motion get the jump instead of the glide */
const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Only one card corrects the scroll at a time. Starting a new collapse takes the
   loop over from any still running, which matters when several cards are open. */
let holdFrame: number | null = null;

const stopCardHold = () => {
  if (holdFrame !== null) cancelAnimationFrame(holdFrame);
  holdFrame = null;
};

/* Closing a card removes a large amount of page height. Left alone the browser
   clamps the scroll position and drops the reader at the very bottom of the
   document, so the position is re-asserted every frame until the collapse
   transition has finished. */
const holdCardInView = (strategyId: string) => {
  stopCardHold();

  const startedAt = performance.now();
  const startScroll = window.scrollY;
  const glideMs = prefersReducedMotion() ? 1 : CARD_GLIDE_MS;

  /* A card's distance from the top of the document does not change as it closes */
  const destination = () => {
    const card = document.getElementById(`strategy-card-${strategyId}`);
    if (!card) return startScroll;
    return Math.max(0, card.getBoundingClientRect().top + window.scrollY - CARD_SCROLL_OFFSET);
  };

  const step = () => {
    const elapsed = performance.now() - startedAt;
    const progress = Math.min(1, elapsed / glideMs);
    const eased = 1 - Math.pow(1 - progress, 3);
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const desired = startScroll + (destination() - startScroll) * eased;

    window.scrollTo(0, Math.max(0, Math.min(desired, maxScroll)));

    holdFrame = elapsed < CARD_HOLD_MS ? requestAnimationFrame(step) : null;
  };

  holdFrame = requestAnimationFrame(step);
};

export const StrategiesPage: React.FC = () => {
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  useEffect(() => stopCardHold, []);

  const toggleStrategy = (strategyId: string) => {
    const isOpen = expandedIds.includes(strategyId);
    if (isOpen) holdCardInView(strategyId);

    setExpandedIds((prev) =>
      isOpen ? prev.filter((id) => id !== strategyId) : [...prev, strategyId]
    );
  };

  const expanded = STRATEGY_LIST.filter(({ strategy }) => expandedIds.includes(strategy.id));

  return (
    <div className="strategies-page page-transition">
      {/* Edge-to-Edge Hero Banner */}
      <div className="strategies-hero-wrapper page-hero-band is-full-bleed is-dot-grid">
        <div className="strategies-hero-inner page-hero-inner">
          <div className="strategies-hero-top">
            <span className="strategies-subtitle">Strategy Library</span>
            <h1 className="strategies-title">Quantitative Strategies</h1>
            <p className="strategies-description">
              Remove the guesswork from your investing with a clear, rules-based approach. Take a look at our performance benchmarks and models below to see how they manage risk and make decisions.
            </p>
          </div>

          <div className="strategies-stats-row">
            <div className="strategy-stat-card">
              <span className="strategy-stat-label">Available Models</span>
              <span className="strategy-stat-value">2 Strategies</span>
            </div>
            <div className="strategy-stat-card">
              <span className="strategy-stat-label">Backtest Data</span>
              <span className="strategy-stat-value">Multi-Timeframe Comparisons</span>
            </div>
            <div className="strategy-stat-card">
              <span className="strategy-stat-label">Evaluation Metrics</span>
              <span className="strategy-stat-value">Benchmark</span>
            </div>
          </div>
        </div>
      </div>

      <div className='strategies-section'>
        {/* Render Strategy Cards */}
        <div className="strategies-list">
          {STRATEGY_LIST.map(({ strategy, indexNumber }) => (
            <StrategyCard
              key={strategy.id}
              strategy={strategy}
              indexNumber={indexNumber}
              isExpanded={expandedIds.includes(strategy.id)}
              onToggle={() => toggleStrategy(strategy.id)}
            />
          ))}
        </div>
      </div>

      {/* Collapse controls stay on screen for every open strategy, so a long card
          never has to be scrolled to the bottom to be closed. */}
      {expanded.length > 0 && (
        <div className="strategy-dock" role="group" aria-label="Open strategies">
          {expanded.map(({ strategy }) => (
            <button
              key={strategy.id}
              type="button"
              className="strategy-dock-btn"
              onClick={() => toggleStrategy(strategy.id)}
              aria-label={`Collapse ${strategy.name}`}
            >
              <ChevronUp size={15} aria-hidden="true" />
              <span className="strategy-dock-action">Collapse</span>
              <span className="strategy-dock-name">{strategy.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default StrategiesPage;