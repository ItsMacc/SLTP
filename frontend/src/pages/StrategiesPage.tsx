import React from 'react';
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
      content: 'The Stock Health Filter strategy scans market universes for high-momentum breakouts by evaluating short-term vs. long-term price structural "health." Rather than inspecting simple price momentum, it calculates a compound score based on log-linear regression consistency (R-squared), annualized positive slope growth, and downside volatility frequency. Breakout buys are confirmed when the short-to-long health ratio spikes upward alongside velocity validation.',
    },
    {
      id: 'risk-management',
      title: 'Dynamic Risk Management',
      content: 'This strategy employs a dynamic risk management framework using Average True Range (ATR) to set stop-loss and take-profit levels. The stop-loss is placed at 4x ATR below the entry price, while the take-profit is set at 2x the calculated risk distance above the entry. This approach allows for flexible position sizing and helps protect capital during volatile market conditions.',
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
    'R-squared': {
      definition: 'A statistical measure representing how closely a stock’s price movement fits a straight trend line, indicating trend consistency.',
      example: 'An R-squared value close to 1.0 means a stock follows its upward trend line very closely with minimal random noise.',
    },
  }
};

export const StrategiesPage: React.FC = () => {
  return (
    <div className="strategies-page page-transition">
      {/* Edge-to-Edge Hero Banner */}
      <div className="strategies-hero-wrapper">
        <div className="strategies-hero-inner">
          <div className="strategies-hero-top">
            <span className="strategies-subtitle">Strategy Library</span>
            <h1 className="strategies-title">Quantitative Strategies</h1>
            <p className="strategies-description">
              Remove emotional bias through disciplined, rules-based capital allocation. 
              Inspect our baseline benchmarks and active quantitative momentum models below 
              to evaluate their core logic, risk bounds, and mathematical parameters.
            </p>
          </div>

          <div className="strategies-stats-row">
            <div className="strategy-stat-card">
              <span className="strategy-stat-label">Execution Logic</span>
              <span className="strategy-stat-value">Fully Algorithmic</span>
            </div>
            <div className="strategy-stat-card">
              <span className="strategy-stat-label">Risk Protocol</span>
              <span className="strategy-stat-value">Dynamic ATR &amp; Benchmarks</span>
            </div>
            <div className="strategy-stat-card">
              <span className="strategy-stat-label">Strategies Available</span>
              <span className="strategy-stat-value">2</span>
            </div>
          </div>
        </div>
      </div>

      <h2 className="strategies-section-title">Available Strategy Models</h2>

      {/* Render Strategy Cards */}
      <div className="strategies-list">
        <StrategyCard strategy={BuyAndHoldStrategy} indexNumber={1} />
        <StrategyCard strategy={StockHealthFilterStrategy} indexNumber={2} />
      </div>
    </div>
  );
};

export default StrategiesPage;