// curriculum.ts — Five-tier quant-literacy curriculum: tiers, modules,
// competency milestones (badges), tier certifications (trophies), and the
// formative validation gates that separate them.
//
// Progress against this curriculum is stored in Supabase (auth
// user_metadata) — see progress.ts. Turso stays out of learning state.

export interface GateQuestion {
  q: string;
  options: string[];
  answer: number; // index into options
  explain: string;
}

export interface Milestone {
  id: string;
  name: string;
  sections: string[]; // earn by completing ALL of these sections
  upcoming?: boolean; // true = its module hasn't shipped yet; stays locked
}

export interface TierSection {
  id: string; // matches LearnPage section ids for real content
  num: string;
  label: string;
  content: boolean; // true = real module, false = stub awaiting build
}

export interface Tier {
  id: string;
  roman: string;
  title: string;
  objective: string;
  certification: string; // the Tier Certification (trophy) name
  sections: TierSection[];
  milestones: Milestone[];
  gate: GateQuestion[]; // Formative Validation Gate — pass to certify the tier
}

export const TIERS: Tier[] = [
  // ---------------------------------------------------------------
  // Tier I — Foundational Market Mechanics & Price Action
  // ---------------------------------------------------------------
  {
    id: 'tier1',
    roman: 'I',
    title: 'Foundational Market Mechanics & Price Action',
    objective:
      'Establish baseline mental models of how value is represented, traded, and visualized over time.',
    certification: 'Foundational Market Practitioner',
    sections: [
      { id: 'stocks', num: 'A', label: 'Understanding stocks', content: true },
      { id: 'prices', num: 'B', label: 'Why prices move', content: true },
      { id: 'orders', num: 'C', label: 'How trades execute', content: true },
      { id: 'candles', num: 'D', label: 'Reading a price chart', content: true },
    ],
    milestones: [
      { id: 't1-equity', name: 'Equity Mechanics Verification', sections: ['stocks'] },
      { id: 't1-chart', name: 'Chart Literacy Badge', sections: ['prices', 'candles'] },
    ],
    gate: [
      {
        q: 'A company is worth $30,000 and you own 20% of it. Your slice is worth:',
        options: ['$6,000', '$600', '$3,000', 'It depends on the share price'],
        answer: 0,
        explain: '20% of $30,000 = $6,000. Every slice of a company grows or shrinks with the company itself.',
      },
      {
        q: 'A stock\'s price rises most directly because:',
        options: [
          'The company officially raised its price',
          'More buyers show up than sellers, and buyers bid higher until someone sells',
          'The exchange adjusts it overnight',
          'Inflation',
        ],
        answer: 1,
        explain: 'Price is a running vote: when buyers outnumber sellers, buyers raise their offer until enough owners are tempted to sell.',
      },
      {
        q: 'You want to buy only at $97 or better, and you\'re willing to wait. Which order?',
        options: ['Market order', 'Limit order', 'Stop-limit order', 'Market-on-close order'],
        answer: 1,
        explain: 'A limit order trades only at your price or better — control over price, at the cost of no guarantee it fills.',
      },
      {
        q: 'A candle has open $100, high $106, low $98, close $103. It should be drawn:',
        options: [
          'Green — the close finished above the open',
          'Red — the close finished below the open',
          'Green — the high was above the open',
          'Red — the low dipped below the open',
        ],
        answer: 0,
        explain: 'Green means the close ended higher than the open: $103 > $100. The wick reaches to the high and low, but the body is open-to-close.',
      },
    ],
  },

  // ---------------------------------------------------------------
  // Tier II — Market Microstructure & Order Dynamics
  // ---------------------------------------------------------------
  {
    id: 'tier2',
    roman: 'II',
    title: 'Market Microstructure & Order Dynamics',
    objective:
      'Demystify execution friction: how bid-ask spreads, liquidity, slippage and short selling shape what you actually pay.',
    certification: 'Market Microstructure Analyst',
    sections: [
      { id: 'long-short', num: 'A', label: 'Long vs. short: betting both ways', content: true },
      { id: 't2-spreads', num: 'B', label: 'Bid-ask spreads & liquidity', content: false },
      { id: 't2-orderbook', num: 'C', label: 'Order books & slippage', content: false },
    ],
    milestones: [
      { id: 't2-longshort', name: 'Order Mechanics Credential', sections: ['long-short'] },
      { id: 't2-liquidity', name: 'Liquidity Analysis Badge', sections: ['t2-spreads'], upcoming: true },
    ],
    gate: [
      {
        q: 'You short a stock at $100. It falls to $90 and you buy it back. Your profit per share is:',
        options: ['$10', '$90', '-$10', '$100'],
        answer: 0,
        explain: 'You sold at $100 and bought back at $90: 100 − 90 = $10 kept. A short profits when the price goes DOWN.',
      },
      {
        q: 'When you short, the share you sell first is:',
        options: [
          'One you already owned',
          'One you borrowed, which you must return later',
          'One printed by the company',
          'One the exchange gives you for free',
        ],
        answer: 1,
        explain: 'You borrow a share, sell it, and owe the lender one share back — like a loan. Returning it is non-negotiable.',
      },
      {
        q: 'The unlimited-risk side of a trade is:',
        options: [
          'Going long — a stock can only fall to $0',
          'Going short — a stock can keep rising with no ceiling',
          'Both sides are equally limited',
          'Neither side has risk',
        ],
        answer: 1,
        explain: 'A long position loses at most everything (price floor: $0). A short can lose far more than it ever gained, which is why SLTP strategies stay long-only.',
      },
    ],
  },

  // ---------------------------------------------------------------
  // Tier III — Technical Indicators & Signal Generation
  // ---------------------------------------------------------------
  {
    id: 'tier3',
    roman: 'III',
    title: 'Technical Indicators & Signal Generation',
    objective:
      'Bridge raw price action to objective mathematical rules, moving from subjective chart reading to programmatic logic.',
    certification: 'Algorithmic Signal Architect',
    sections: [
      { id: 'math', num: 'A', label: 'How strategies are made', content: true },
      { id: 't3-indicators', num: 'B', label: 'Trend indicators: SMA & EMA', content: false },
      { id: 't3-oscillators', num: 'C', label: 'RSI & ATR: momentum and range', content: false },
    ],
    milestones: [
      { id: 't3-rules', name: 'Signal Logic Badge', sections: ['math'] },
      { id: 't3-calibration', name: 'Indicator Calibration Credential', sections: ['t3-indicators'], upcoming: true },
    ],
    gate: [
      {
        q: 'Every strategy has three jobs. Which is NOT one of them?',
        options: [
          'Decide if and when to buy',
          'Decide how much to buy',
          'Predict tomorrow\'s exact closing price',
          'Set the exits (stop-loss and take-profit)',
        ],
        answer: 2,
        explain: 'The three jobs are: when to buy, how much, and where to exit. No strategy — human or computer — knows tomorrow\'s price.',
      },
      {
        q: 'A strategy that trades on patterns in open/high/low/close prices is applying:',
        options: [
          'Financial analysis',
          'Technical analysis',
          'Insider knowledge',
          'Random chance',
        ],
        answer: 1,
        explain: 'Technical analysis reads price action itself; financial analysis reads the business (earnings, debt, profit).',
      },
      {
        q: 'Why apply rules by computer instead of by feel?',
        options: [
          'Computers predict the market better',
          'Computers never miss a trade — they apply the same rules every day without fear, excitement or fatigue',
          'Computers pay no commissions',
          'Human traders always lose money',
        ],
        answer: 1,
        explain: 'The edge is consistency, not prophecy: identical rules applied identically, every single day.',
      },
    ],
  },

  // ---------------------------------------------------------------
  // Tier IV — Quantitative Validation & Backtesting
  // ---------------------------------------------------------------
  {
    id: 'tier4',
    roman: 'IV',
    title: 'Quantitative Validation & Backtesting',
    objective:
      'Instill methodological skepticism toward historical performance data and teach rigorous validation standards.',
    certification: 'Quantitative Validation Specialist',
    sections: [
      { id: 'testing', num: 'A', label: 'Testing a strategy', content: true },
      { id: 't4-sandbox', num: 'B', label: 'Overfitting sandbox', content: false },
      { id: 't4-audit', num: 'C', label: 'Bias-detection audit', content: false },
    ],
    milestones: [
      { id: 't4-integrity', name: 'Backtest Integrity Credential', sections: ['testing'] },
      { id: 't4-bias', name: 'Bias Mitigation Badge', sections: ['t4-audit'], upcoming: true },
    ],
    gate: [
      {
        q: 'You tune a strategy\'s stops and targets until it looks perfect on past data, and it then flops live. That failure is called:',
        options: ['Look-ahead bias', 'Overfitting', 'Survivorship bias', 'Slippage'],
        answer: 1,
        explain: 'The rules memorized one slice of history instead of learning anything transferable — classic overfitting.',
      },
      {
        q: 'A backtest buys at today\'s close using a signal computed from today\'s close. That is:',
        options: [
          'Perfectly valid',
          'Look-ahead bias — nobody knew the close while the market was still open',
          'Overfitting',
          'Good practice for accuracy',
        ],
        answer: 1,
        explain: 'Real traders act during the day with information available then. Using the close to trade the close is grading with the answer sheet.',
      },
      {
        q: 'Testing on only the companies that still exist today deletes the losers from the sample before the test starts. That is:',
        options: ['Look-ahead bias', 'Overfitting', 'Survivorship bias', 'Compound expectancy'],
        answer: 2,
        explain: 'Bankrupt and delisted names vanish from today\'s lists, making the past look far safer than it was.',
      },
    ],
  },

  // ---------------------------------------------------------------
  // Tier V — Execution & Portfolio Construction
  // ---------------------------------------------------------------
  {
    id: 'tier5',
    roman: 'V',
    title: 'Execution & Portfolio Construction',
    objective:
      'Equip users with institutional vocabulary and metrics necessary to evaluate automated systems independently.',
    certification: 'Systematic Portfolio Strategist',
    sections: [
      { id: 'risk', num: 'A', label: 'Risk management', content: true },
      { id: 't5-metrics', num: 'B', label: 'Sharpe, Sortino & drawdown', content: false },
      { id: 't5-allocation', num: 'C', label: 'Position sizing & allocation', content: false },
    ],
    milestones: [
      { id: 't5-risk', name: 'Risk-Adjusted Performance Credential', sections: ['risk'] },
      { id: 't5-portfolio', name: 'Portfolio Architecture Badge', sections: ['t5-allocation'], upcoming: true },
    ],
    gate: [
      {
        q: 'Entry $100, stop-loss $92, take-profit $116. Your risk-reward ratio is:',
        options: ['1:1', '1:2', '1:1.5', '2:1'],
        answer: 1,
        explain: 'Risk $8 to make $16 — every dollar of loss is backed by two dollars of potential gain: 1:2.',
      },
      {
        q: 'With a $10,000 account risking 2% per trade and a stop $8 below entry, how many shares?',
        options: ['25 shares', '125 shares', '1,250 shares', '2 shares'],
        answer: 0,
        explain: '2% of $10,000 = $200 max loss. $200 ÷ $8 risk per share = 25 shares. Sizing keeps any single mistake affordable.',
      },
      {
        q: 'A stop-loss placed exactly at your entry price usually:',
        options: [
          'Protects you perfectly',
          'Gets hit by the first ordinary downward wiggle and sells you out before the trade can be right',
          'Is required by regulation',
          'Converts every trade into a profit',
        ],
        answer: 1,
        explain: 'The stop must sit BELOW entry — it marks where the trade is declared failed, not where it merely paused.',
      },
    ],
  },
];
