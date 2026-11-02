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
    positions: '1 Fund (SPY)',
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
  universeLogic: 'Holds SPY only: one liquid S&P 500 fund, bought on the first session and never replaced. Nothing is ranked or filtered, because there is nothing to choose between.',
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

const STRATEGY_LIST = [
  { strategy: BuyAndHoldStrategy, indexNumber: 1 },
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
            <span className="page-hero-eyebrow">Strategies</span>
            <h1 className="page-hero-title">Published strategies</h1>
            <p className="page-hero-description">
              Browse the strategies published on SLTP. For each one, see its entry and exit rules,
              how it sizes positions, and how its backtest compares with buying and holding.
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