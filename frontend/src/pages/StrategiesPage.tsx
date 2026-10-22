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
  summary: 'Buy the market and hold it for years. Price swings in between are ignored, and no position is ever sold or replaced.',
  metrics: {
    horizon: '10+ Years',
    activity: 'Low',
    positions: 'Full Universe', 
    rebalance: 'Never',
  },
  idea: {
    hypothesis: 'Over long periods, markets tend to rise because the companies inside them keep earning more. Holding through the noise captures that growth, keeps fees and taxes low, and removes the temptation to act on a bad month.',
    whyItWorks: [
      'Captures the growth of the market as a whole, with no need to time entries or exits.',
      'Costs almost nothing to run: no trading fees, and no capital gains tax triggered by selling.',
      'Removes the decisions that hurt most, such as selling in panic after a sharp drop or buying back in at the top.',
    ],
    whyItDoesnt: [
      'Takes the full decline in a bear market, because no rule reduces exposure before prices fall.',
      'Has no exit rules, so gains are never locked in and no part of the account moves to cash when the market turns.',
      'Can take years to recover after a major downturn, because nothing reduces the position while prices are falling.',
    ],
  },
  universeLogic: 'Holds every asset in the selected market. Nothing is filtered out, ranked, or excluded.',
  rebalanceLogic: 'No automatic buying or selling. The holdings only change when you add or withdraw funds yourself.',
  inDepthSections: [
    {
      id: 'benchmark-role',
      title: 'Why this strategy is the universal benchmark',
      content:
        'This is the baseline every other strategy on the platform is measured against. It is plain, unmanaged market exposure with no timing decisions and no management fees, so an active strategy has to earn a higher risk-adjusted return than this before its extra complexity and trading costs are worth anything.',
    }
  ],
  pros: [
    'Needs almost no time, effort, or financial knowledge to maintain.',
    'Cheap to run: minimal transaction costs and efficient from a tax point of view.',
    'Gives a transparent baseline for measuring every active strategy on the platform.',
  ],
  cons: [
    'No risk protection at all during a steep market decline.',
    'No exit rules or profit-taking steps, so gains made during a peak can be given back.',
    'Expect uncomfortable paper losses in a severe crash, and no rule to soften them.',
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
  summary: 'A momentum strategy that waits for heavily traded stocks to break out, using the gap between their short-term and long-term price health as the signal.',
  metrics: {
    horizon: '2+ Years',
    activity: 'Medium',
    positions: 'Up to 20',
    rebalance: 'Quarterly',
  },
  idea: {
    hypothesis: 'Stocks that are heavily traded, structurally sound, and still accelerating tend to keep going, while weak ones tend to keep falling. Ranking by the gap between short-term and long-term price health picks out the candidates whose move has only just started.',
    whyItWorks: [
      'Catches breakouts by waiting for a stock’s short-term health score to jump well above its own long-term average, so the move is confirmed rather than guessed.',
      'Trades only heavily traded stocks, so a sudden change in the ratio reflects real buying interest rather than thin liquidity.',
      'Rides the behaviour that tends to follow a sharp move in price, instead of trying to predict where prices are going.',
    ],
    whyItDoesnt: [
      'Can be caught by false breakouts when momentum stalls across the whole market or reverses sharply.',
      'By the time the ratio spikes, the stock may already have run too far and be due for a pullback.',
      'In a choppy, directionless market it produces a lot of false signals, and the losses that follow can come quickly in both directions.',
    ],
  },
  universeLogic: 'The universe is the 25 most liquid stocks, ranked by average daily trading volume and their growth rate over the past three months.',
  rebalanceLogic: 'Rebalanced every quarter. Positions that have stopped qualifying are sold and replaced with the strongest candidates in the universe.',

  inDepthSections: [
    {
      id: 'strategy-overview',
      title: 'Strategy overview',
      content: 'The strategy scans its universe for breakouts by comparing short-term price health against long-term price health. Rather than looking at how far a price has moved, it builds a compound score from three inputs: how consistent a log-linear trend has been, whether the annualised slope is positive, and how often the price has fallen sharply. A buy is confirmed when the short-term health score jumps above its long-term baseline and trading volume supports the move.',
    },
    {
      id: 'risk-management',
      title: 'Dynamic risk management',
      content: 'Stops and targets are set from Average True Range (ATR), which measures how far a stock normally moves in a day. The stop-loss sits four ATR below the entry and the take-profit two ATR above it, so both levels widen when the stock is volatile and tighten when it is calm. Because the levels move with the market, position size can be adjusted to keep the risk per trade constant.',
    },
  ],

  comparisons : [
    {
      id: 'recent-market',
      periodName: 'Recent Market (2024-2026)',
      expectation: 'In a steady market, the strategy is expected to deliver a better risk-adjusted return, giving up some raw growth to protect the account.',
      resultSummary: 'The strategy returned slightly less than the benchmark, but it met its risk goal: its worst fall was smaller than the benchmark’s.',
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
      expectation: 'In a sustained decline, the strategy is expected to protect the account and lose less than simply holding a broad index.',
      resultSummary: 'It did. The peak-to-trough fall was much smaller than the benchmark’s across the whole decline.',
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
      expectation: 'In a major structural downturn, the strategy is expected to exit positions that are deteriorating and limit the damage.',
      resultSummary: 'The rules worked as intended. Overall losses and the depth of the peak-to-trough fall were roughly half the benchmark’s.',
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
      expectation: 'The strategy is expected to limit the fall during a sharp drop while staying invested enough to catch the recovery.',
      resultSummary: 'The protection worked in the initial shock, but holding back cost it during the fast rally that followed.',
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
      expectation: 'In a long bull run, the strategy is expected to compound steadily while holding risk limits tighter than a broad index.',
      resultSummary: 'It grew steadily, but the benchmark returned more, because a long, calm rise rewards simply staying invested.',
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
      expectation: 'Over a multi-year expansion, periodic rebalancing is expected to keep the portfolio’s quality high without slowing the compounding much.',
      resultSummary: 'The ongoing risk management cost it. An uninterrupted run of rising prices is the one case buy and hold struggles to lose.',
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
      expectation: 'Over ten years, dropping underperforming holdings and limiting large drawdowns is expected to produce a better risk-adjusted result.',
      resultSummary: 'It did. The decade produced a stronger risk-adjusted result, mostly because the portfolio was protected from the major drawdowns.',
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
      expectation: 'Across several full market cycles, strict risk controls are expected to protect the account in downturns and steady the long-term compounding.',
      resultSummary: 'The protection held up. Over 15 years the peak-to-trough fall stayed at about half the benchmark’s.',
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
    'Picks assets with a consistent trend and little downside movement.',
    'Uses volatility-scaled stops, so major drops are cut before they get large.',
    'Cleans the portfolio itself, dropping holdings that stop qualifying every quarter.',
  ],

  cons: [
    'In sideways markets it can enter on a false signal and be reversed out quickly.',
    'Needs time to gather history and dependable daily volume data before it can rank its universe.',
    'Can miss a sharp turnaround in a stock that has been falling for a long time.',
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
      example: 'Buying a sudden price spike only for the stock to fall straight back is a classic whipsaw trade.',
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
      example: 'Apple or Microsoft shares can be traded in large quantities without moving the price much, which is what makes them liquid.',
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
          <div className="strategies-hero-copy">
            <span className="page-hero-eyebrow">Strategy library</span>
            <h1 className="page-hero-title">Quantitative strategies</h1>
            <p className="page-hero-description">
              Every strategy here is a written set of rules: what it buys, when it sells, and how
              much it puts at risk. Expand a card to read the reasoning behind those rules and to
              see the strategy backtested against simply buying and holding.
            </p>
          </div>            <div className="strategies-stats-row">
              <div className="strategy-stat-card">
                <span className="strategy-stat-label">Strategies</span>
                <span className="strategy-stat-value">2 published</span>
              </div>
              <div className="strategy-stat-card">
                <span className="strategy-stat-label">Backtest periods</span>
                <span className="strategy-stat-value">8 market regimes</span>
              </div>
              <div className="strategy-stat-card">
                <span className="strategy-stat-label">Compared against</span>
                <span className="strategy-stat-value">Buy and hold</span>
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