// curriculum.ts — The course, in three levels: Beginner, Intermediate and
// Advanced. Each level is one gate: finishing every lesson opens that level's
// quiz, which awards its certificate and unlocks the next level.
//
// Lesson ids are the real ids used by LearnPage's moduleFor() and by badgeFor()
// in badges.ts. `part` groups the lessons of a long level under a light
// sub-heading so it does not read as one endless list.

export interface GateQuestion {
  q: string;
  options: string[];
  answer: number; // index into options
  explain: string;
}

export interface TierSection {
  id: string; // matches LearnPage section ids for real content
  num: string;
  label: string;
  content: boolean; // true = real lesson, false = stub awaiting build
  /** Optional sub-heading inside a level ("Part 1: Markets"). */
  part?: string;
}

export interface Tier {
  id: string;
  /** Short name used in the stepper and the sidebar. */
  name: string;
  title: string;
  objective: string;
  /** The certificate's name: what the learner can do when the level is done. */
  certification: string;
  sections: TierSection[];
  gate: GateQuestion[];
}

export const TIERS: Tier[] = [
  // ---------------------------------------------------------------
  // Beginner - what is being bought and sold, and how to read it
  // ---------------------------------------------------------------
  {
    id: 'beginner',
    name: 'Beginner',
    title: 'What you are actually buying',
    objective:
      'A share, a price move, an order, a candle and a stop-loss, each explained from zero.',
    certification: 'Reads a price chart',
    sections: [
      { id: 'stocks', num: 'A', label: 'What is a stock?', content: true },
      { id: 'prices', num: 'B', label: 'Why do prices move?', content: true },
      { id: 'orders', num: 'C', label: 'How do you actually buy one?', content: true },
      { id: 'candles', num: 'D', label: 'How to read a price chart', content: true },
      { id: 'long-short', num: 'E', label: 'Going long and going short', content: true },
      { id: 'math', num: 'F', label: 'What is a strategy?', content: true },
      { id: 'risk', num: 'G', label: 'How much can I lose?', content: true },
    ],
    gate: [
      {
        q: 'A company is worth $30,000 and you own 20% of it. Your slice is worth:',
        options: ['$6,000', '$600', '$3,000', 'It depends on the share price'],
        answer: 0,
        explain: '20% of $30,000 = $6,000. Every slice grows or shrinks with the company itself.',
      },
      {
        q: "A stock's price rises most directly because:",
        options: [
          'The company officially raised its price',
          'More buyers show up than sellers, and buyers bid higher until someone sells',
          'The exchange adjusts it overnight',
          'Inflation',
        ],
        answer: 1,
        explain: 'Price is a running vote: when buyers outnumber sellers, buyers raise their offer until enough owners sell.',
      },
      {
        q: 'You want to buy only at $97 or better, and you are willing to wait. Which order?',
        options: ['Market order', 'Limit order', 'Stop order', 'Market-on-close order'],
        answer: 1,
        explain: 'A limit order trades only at your price or better: control over price, at the cost of no guarantee it fills.',
      },
      {
        q: 'A candle has open $100, high $106, low $98, close $103. It should be drawn:',
        options: [
          'Green: the close finished above the open',
          'Red: the close finished below the open',
          'Green: the high was above the open',
          'Red: the low dipped below the open',
        ],
        answer: 0,
        explain: 'Green means the close ended higher than the open: $103 > $100. The wick reaches to the high and low; the body is open-to-close.',
      },
      {
        q: 'Entry $100, stop-loss $92, take-profit $116. Your risk-reward ratio is:',
        options: ['1:1', '1:2', '1:1.5', '2:1'],
        answer: 1,
        explain: 'Risk $8 to make $16: every dollar of loss is backed by two dollars of potential gain, so 1:2.',
      },
    ],
  },

  // ---------------------------------------------------------------
  // Intermediate - where ideas come from and how they become rules
  // ---------------------------------------------------------------
  {
    id: 'intermediate',
    name: 'Intermediate',
    title: 'Where ideas become rules',
    objective:
      'How crowds move prices, how a hunch becomes a testable rule, and how to read a real strategy.',
    certification: 'Can read and judge a strategy',
    sections: [
      { id: 't3-style', num: 'A', label: 'Trader or investor?', content: true, part: 'Part 1: How markets behave' },
      { id: 't3-index', num: 'B', label: 'What is an index?', content: true, part: 'Part 1: How markets behave' },
      { id: 'psychology', num: 'C', label: 'Why crowds move prices', content: true, part: 'Part 1: How markets behave' },
      { id: 'ideas', num: 'D', label: 'Where strategy ideas come from', content: true, part: 'Part 2: Where ideas come from' },
      { id: 'why-math', num: 'E', label: 'Why maths helps', content: true, part: 'Part 2: Where ideas come from' },
      { id: 't3-indicators', num: 'F', label: 'What indicators actually measure', content: true, part: 'Part 3: Indicators and language' },
      { id: 'vocabulary', num: 'G', label: 'Talking like a professional', content: true, part: 'Part 3: Indicators and language' },
      { id: 'anatomy', num: 'H', label: 'Anatomy of an SLTP strategy', content: true, part: 'Part 3: Indicators and language' },
    ],
    gate: [
      {
        q: 'Which statement can actually be tested?',
        options: [
          'Tech stocks are good',
          'A stock that has fallen 10% in five days tends to bounce over the next ten',
          'Markets are irrational',
          'Everyone should own stocks',
        ],
        answer: 1,
        explain: 'It names a measurable condition and a measurable outcome, so a test could prove it wrong. The others cannot fail.',
      },
      {
        q: 'An indicator such as RSI adds:',
        options: [
          'New information the price does not contain',
          'A prediction of tomorrow',
          'Nothing new: it rearranges prices so one question is easier to answer',
          'A guarantee when it reaches 30',
        ],
        answer: 2,
        explain: 'Indicators are formulas over price and volume. They make one thing easier to see, and predict nothing.',
      },
      {
        q: 'Why does hedging against the obvious matter?',
        options: [
          'Because obvious patterns are usually illegal',
          'Because if a pattern were easy and widely known, trading it would tend to remove it',
          'Because charts are unreliable',
          'Because only professionals may trade',
        ],
        answer: 1,
        explain: 'Crowded ideas get competed away. That is why researchers test everything and expect most ideas to fail.',
      },
      {
        q: 'In the SLTP engine, which method must a strategy implement?',
        options: ['initialize_universe', 'on_signal', 'run_daily', 'should_exit'],
        answer: 1,
        explain: 'on_signal(ticker, data) is the only required hook: it returns an Order, or None for no trade.',
      },
      {
        q: 'A parameter is:',
        options: [
          'A number the rules use, which you can change',
          'A type of order',
          'The name of a strategy',
          'A measure of profit',
        ],
        answer: 0,
        explain: 'Parameters are the adjustable numbers, like a 25-day RSI period. Tuning too many of them is how overfitting starts.',
      },
    ],
  },

  // ---------------------------------------------------------------
  // Advanced - code, companies, evidence
  // ---------------------------------------------------------------
  {
    id: 'advanced',
    name: 'Advanced',
    title: 'Code, companies and evidence',
    objective:
      'Read and write a strategy, read a company, and judge a result without being fooled.',
    certification: 'Can read, write and test a strategy',
    sections: [
      { id: 'code-read', num: 'A', label: 'Reading a strategy in code', content: true, part: 'Part 1: Code' },
      { id: 'code-write', num: 'B', label: 'Writing your first strategy', content: true, part: 'Part 1: Code' },
      { id: 'statements', num: 'C', label: 'Reading a company’s numbers', content: true, part: 'Part 2: Companies' },
      { id: 'valuation', num: 'D', label: 'Valuation: is it expensive?', content: true, part: 'Part 2: Companies' },
      { id: 'testing', num: 'E', label: 'Would this have worked?', content: true, part: 'Part 3: Rigor' },
      { id: 't4-walkthrough', num: 'F', label: 'How to read a backtest', content: true, part: 'Part 3: Rigor' },
      { id: 't5-metrics', num: 'G', label: 'Sharpe, Sortino & drawdown', content: true, part: 'Part 3: Rigor' },
      { id: 't5-allocation', num: 'H', label: 'Position sizing & allocation', content: true, part: 'Part 3: Rigor' },
      { id: 't2-spreads', num: 'I', label: 'What a trade really costs', content: true, part: 'Part 4: Market structure' },
      { id: 't2-orderbook', num: 'J', label: 'How big orders move the price', content: true, part: 'Part 4: Market structure' },
    ],
    gate: [
      {
        q: 'Inside on_signal, returning None means:',
        options: ['Sell everything', 'No trade for this ticker today', 'The strategy failed', 'Buy with a zero size'],
        answer: 1,
        explain: 'None is the normal answer: this ticker does not meet the rules right now.',
      },
      {
        q: 'In the Statistical Mean Reversion strategy, the stop and target sit:',
        options: [
          'At a fixed 5% either side of entry',
          'Three standard deviations of the 20-bar price either side of the entry price',
          'At the 25-day moving average',
          'At zero',
        ],
        answer: 1,
        explain: 'It uses STDEV_EXIT_MULTIPLE = 3.0 × the 20-bar standard deviation: a stop that widens with the stock’s own wiggle.',
      },
      {
        q: 'A price-to-earnings ratio of 30 means:',
        options: [
          'The share costs $30',
          'The price equals 30 years of the company’s current yearly profit per share',
          'The company keeps 30% of revenue',
          'The stock rose 30% this year',
        ],
        answer: 1,
        explain: 'Price ÷ earnings per share. It is a way of comparing price with what the business earns.',
      },
      {
        q: 'Testing on a period you did not use to design the rules is called:',
        options: ['In-sample testing', 'Out-of-sample testing', 'Overfitting', 'Sensitivity analysis'],
        answer: 1,
        explain: 'Out-of-sample data is the check that the rules learned something transferable rather than memorising history.',
      },
      {
        q: 'A strategy that trades often in thin stocks will be most hurt by:',
        options: ['Its own stop-loss', 'Spread and slippage on every fill', 'The benchmark', 'Inflation'],
        answer: 1,
        explain: 'Each round trip crosses the spread and can slip; frequent trading multiplies both costs.',
      },
    ],
  },
];
