// curriculum.ts — The one source of truth for levels, lessons, badges,
// certificates and workshops. Counts are derived from this file, never typed.

import { LESSON_CONTENT } from './lessonContent';
import type { IconKey, Lesson, Level, Part, QuizQuestion, Workshop } from './types';

const lesson = (
  num: string,
  id: string,
  title: string,
  summary: string,
  badge: string,
  icon: IconKey,
  extra: Partial<Lesson> = {},
): Lesson => ({
  id,
  num,
  title,
  summary,
  badge,
  badgeDescription: extra.badgeDescription ?? summary,
  icon,
  status: extra.status ?? 'planned',
  introduces: extra.introduces ?? [],
  assumes: extra.assumes ?? [],
  content: extra.content,
});

const live = (
  num: string,
  id: string,
  title: string,
  summary: string,
  badge: string,
  icon: IconKey,
  badgeDescription: string,
  introduces: string[],
  assumes: string[],
): Lesson => ({
  ...lesson(num, id, title, summary, badge, icon, {
    status: 'live',
    introduces,
    assumes,
    content: LESSON_CONTENT[id],
  }),
  badgeDescription,
});

const part = (title: string, lessons: Lesson[]): Part => ({ title, lessons });

const quiz = (questions: QuizQuestion[]): QuizQuestion[] => questions;

/* ---------- Level 1 ---------- */

const levelOne: Level = {
  id: 'beginner',
  number: 1,
  name: 'Beginner',
  title: 'Stocks and the market',
  status: 'live',
  lead: 'What a stock is, why its price moves, how a trade happens, and how to read a chart. What the market is, how stocks make money, and what can go wrong.',
  outcomes: [
    'Explain what a share is and why its price moves',
    'Read a candle and place a basic order',
    'Say how stocks make money and what can go wrong',
  ],
  certificate: 'Can explain how stocks and markets work.',
  parts: [
    part('Part 1: Ownership and price', [
      live(
        'A',
        'what-is-a-stock',
        'What is a stock?',
        'A share is a small piece of a company, and its value comes from the business behind it.',
        'Part Owner',
        'building',
        'You can explain what a share is and what its owner gets.',
        ['stock', 'share', 'shareholder', 'company', 'profit', 'stake', 'valuation'],
        [],
      ),
      live(
        'B',
        'why-prices-move',
        'Why do prices move?',
        'A price moves when buyers and sellers change their minds about future profit.',
        'Tug of War',
        'trend',
        'You can explain why a price rises or falls.',
        ['buyer', 'seller', 'supply', 'demand', 'price', 'news', 'expectation', 'trade'],
        ['stock', 'share', 'company', 'profit'],
      ),
      live(
        'C',
        'how-to-buy',
        'How do you buy one?',
        'A broker sends your order to an exchange, and the order type decides the price you may pay.',
        'First Order',
        'receipt',
        'You can place a market order and a limit order.',
        ['exchange', 'broker', 'ticker', 'order', 'market order', 'limit order', 'commission', 'trading hours'],
        ['share', 'price', 'buyer', 'seller', 'trade'],
      ),
    ]),
    part('Part 2: Reading the market', [
      live(
        'D',
        'read-a-chart',
        'How do you read a price chart?',
        'A candle records four prices for one trading day, and a chart puts many days in order.',
        'Chart Reader',
        'chart',
        'You can read the open, high, low and close from a candle.',
        ['chart', 'candle', 'open', 'close', 'high', 'low', 'body', 'wick', 'trading day', 'trend', 'volume'],
        ['price', 'stock', 'buyer', 'seller'],
      ),
      live(
        'E',
        'the-market',
        'What is "the market"?',
        'An index tracks a group of stocks, and an index fund buys the whole group at once.',
        'Whole Market',
        'layers',
        'You can explain what an index is and why it is used as a benchmark.',
        ['market', 'index', 'S&P 500', 'ETF', 'index fund', 'portfolio', 'benchmark', 'diversification'],
        ['stock', 'share', 'price', 'company'],
      ),
    ]),
    part('Part 3: Reward and risk', [
      live(
        'F',
        'making-money',
        'How do people make money from stocks?',
        'A stock can pay a dividend and its price can rise. Compounding adds the two over time.',
        'Money Over Time',
        'coins',
        'You can calculate a total return over a holding period.',
        ['return', 'percent return', 'dividend', 'total return', 'compounding', 'holding period'],
        ['share', 'stock', 'price', 'profit'],
      ),
      live(
        'G',
        'what-can-go-wrong',
        'What can go wrong?',
        'Prices fall, companies fail, and a fall can last longer than an owner expects.',
        'Know the Risks',
        'shield',
        'You can name the main risks of owning a stock.',
        ['risk', 'volatility', 'drawdown', 'loss', 'delisted', 'time horizon'],
        ['stock', 'share', 'price', 'return', 'compounding'],
      ),
    ]),
  ],
  quiz: quiz([
    {
      id: 'b1',
      lessonId: 'what-is-a-stock',
      prompt: 'A company has 1,000 shares. You own 50. What part of the company do you own?',
      options: ['5%', '10%', '20%', '50%'],
      correctIndex: 0,
      explanation: '50 divided by 1,000 is 0.05, which is 5%.',
      hint: 'Divide the shares you own by the total number of shares.',
    },
    {
      id: 'b2',
      lessonId: 'what-is-a-stock',
      prompt: 'What does a shareholder receive from a company?',
      options: [
        'A guaranteed yearly payment',
        'A share of profit when it is paid out, and a vote on some decisions',
        'The right to run the company day to day',
        'A refund of the share price at any time',
      ],
      correctIndex: 1,
      explanation: 'A shareholder owns a piece of the company. Profit can be paid as a dividend, and shareholders usually vote on some decisions.',
      hint: 'Ownership is not a loan and it is not a job.',
    },
    {
      id: 'b3',
      lessonId: 'why-prices-move',
      prompt: 'More buyers want a stock than there are sellers willing to sell. What usually happens to the price?',
      options: ['It falls', 'It rises', 'It stays exactly the same', 'Trading stops'],
      correctIndex: 1,
      explanation: 'Buyers must offer a higher price to persuade holders to sell.',
      hint: 'Think about which side has to work harder to get a trade.',
    },
    {
      id: 'b4',
      lessonId: 'why-prices-move',
      prompt: 'A company reports profit above expectations. The price falls. Which explanation fits?',
      options: [
        'The report had no effect',
        'The expected profit was already in the price',
        'Buyers always sell after good news',
        'The exchange sets the price',
      ],
      correctIndex: 1,
      explanation: 'A price reflects expectations. Good news that was already expected does not add anything new.',
      hint: 'Ask what buyers already expected before the report.',
    },
    {
      id: 'b5',
      lessonId: 'how-to-buy',
      prompt: 'You want to buy only if the price is $50 or lower. Which order fits?',
      options: ['Market order', 'Limit order at $50', 'Limit order at $55', 'Any order placed after trading hours'],
      correctIndex: 1,
      explanation: 'A limit order sets the highest price you will pay. At $50 it waits for that price or better.',
      hint: 'A market order accepts the best available price.',
    },
    {
      id: 'b6',
      lessonId: 'read-a-chart',
      prompt: 'A candle has an open of 100, a close of 104, a high of 106 and a low of 98. Which part is the body?',
      options: ['98 to 100', '100 to 104', '104 to 106', '98 to 106'],
      correctIndex: 1,
      explanation: 'The body runs from the open to the close. Here that is 100 to 104.',
      hint: 'The body uses the open and the close, not the high and the low.',
    },
    {
      id: 'b7',
      lessonId: 'the-market',
      prompt: 'What does the S&P 500 track?',
      options: ['One large company', '500 large US companies', 'Every company in the world', 'The price of gold'],
      correctIndex: 1,
      explanation: 'The S&P 500 is an index of about 500 large US companies, weighted by size.',
      hint: 'The name contains the number of companies.',
    },
    {
      id: 'b8',
      lessonId: 'making-money',
      prompt: 'You buy at $50, receive $2 in dividends, and sell at $60. What is your total return per share?',
      options: ['$2', '$10', '$12', '$60'],
      correctIndex: 2,
      explanation: 'The price gain is $10 and the dividend is $2, so the total is $12 per share.',
      hint: 'Add the price gain and the dividend.',
    },
    {
      id: 'b9',
      lessonId: 'what-can-go-wrong',
      prompt: 'A portfolio falls from $10,000 to $7,000. What is the drawdown?',
      options: ['3%', '7%', '30%', '70%'],
      correctIndex: 2,
      explanation: 'The fall is $3,000. As a share of the $10,000 peak, that is 30%.',
      hint: 'Divide the fall by the peak value.',
    },
    {
      id: 'b10',
      lessonId: 'what-can-go-wrong',
      prompt: 'Which owner is least likely to be forced to sell during a temporary fall?',
      options: [
        'An owner who needs the money next month',
        'An owner with a ten-year horizon and a cash reserve',
        'An owner who borrowed to buy the shares',
        'An owner who checks the price every hour',
      ],
      correctIndex: 1,
      explanation: 'Many years and money set aside make it easier to wait for a recovery.',
      hint: 'Think about who can leave the money invested.',
    },
  ]),
};

/* ---------- Levels 2 to 5: outlines ---------- */

const levelTwo: Level = {
  id: 'intermediate',
  number: 2,
  name: 'Intermediate',
  title: 'How investors think',
  status: 'outline',
  lead: 'Investing and trading, cash and inflation, stocks and bonds, a simple long-term approach, crowd behaviour, reading a company, spreading risk, and a written plan.',
  outcomes: [
    'Tell investing from trading',
    'Spread risk across companies and assets',
    'Write a plan you can follow when prices fall',
  ],
  certificate: 'Can tell investing from trading and spread risk sensibly.',
  parts: [
    part('Part 1: Two approaches', [
      lesson('A', 'investing-or-trading', 'Investing or trading?', 'Two ways to use the market, judged on different time horizons.', 'Two Mindsets', 'compass'),
      lesson('B', 'why-not-cash', 'Why not just keep cash?', 'Prices rise over time, so cash buys less unless it earns enough interest.', 'Cash Has a Cost', 'coins'),
      lesson('C', 'stocks-bonds-cash', 'Stocks, bonds and cash', 'Three asset classes with different risks and different jobs.', 'Three Assets', 'layers'),
      lesson('D', 'simple-way-to-invest', 'The simple way to invest', 'Regular contributions, broad funds and low fees.', 'Steady Investor', 'scale'),
    ]),
    part('Part 2: Why crowds move prices', [
      lesson('E', 'fear-and-greed', 'Fear and greed', 'A real episode in five stages, from calm to panic to recovery.', 'Fear and Greed', 'gauge'),
      lesson('F', 'following-the-herd', 'Following the herd', 'Herding, FOMO, momentum and overreaction.', 'Following the Herd', 'trend'),
      lesson('G', 'why-losses-hurt', 'Why losses hurt more', 'Loss aversion, anchoring, and selling winners too early.', 'Hurts More', 'shield'),
      lesson('H', 'why-rules', 'Why this matters for rules', 'Many strategies are built on behaviours like these.', 'Why Rules Exist', 'book'),
    ]),
    part('Part 3: Judging a business', [
      lesson('I', 'company-worth', 'What is a company worth?', 'Revenue, costs, profit and earnings per share.', 'Reads Earnings', 'building'),
      lesson('J', 'is-it-expensive', 'Is it expensive?', 'Market capitalisation, the P/E ratio, and cheap for a reason.', 'Price vs Value', 'calculator'),
    ]),
    part('Part 4: Putting it together', [
      lesson('K', 'spreading-risk', 'Spreading the risk', 'Concentration, correlation, sectors and allocation.', 'Spread the Risk', 'layers'),
      lesson('L', 'written-plan', 'Your plan, in writing', 'A short builder for a goal, a horizon and a fall you can sit through.', 'Written Plan', 'book'),
    ]),
  ],
  quiz: [],
};

const levelThree: Level = {
  id: 'advanced',
  number: 3,
  name: 'Advanced',
  title: 'Rules and the maths behind them',
  status: 'outline',
  lead: 'Returns in percent, averages, volatility, unusual moves, expectancy, correlation, indicators, patterns, and rules with limits.',
  outcomes: [
    'Work out a return, an average and a z-score',
    'Turn an idea into exact entry, exit and size rules',
    'Add limits that keep one bad trade small',
  ],
  certificate: 'Can turn an idea into exact rules with limits.',
  parts: [
    part('Part 1: The maths', [
      lesson('A', 'returns', 'Returns in percent', 'Percent change, asymmetry and compounded returns.', 'Percent Sense', 'calculator'),
      lesson('B', 'averages', 'Averages and smoothing', 'Moving averages, windows, lookbacks and lag.', 'Smoothing', 'chart'),
      lesson('C', 'swings', 'How much does it swing?', 'Daily returns, standard deviation and annualised volatility.', 'Measuring Swings', 'gauge'),
      lesson('D', 'how-unusual', 'How unusual is today?', 'The z-score, the bell curve and fat tails.', 'Unusual Moves', 'scale'),
      lesson('E', 'odds-expectancy', 'Odds and expectancy', 'Win rate, average win and loss, and losing streaks.', 'Expected Value', 'calculator'),
      lesson('F', 'moving-together', 'Moving together', 'Correlation from minus one to plus one.', 'Moving Together', 'layers'),
    ]),
    part('Part 2: Ideas and indicators', [
      lesson('G', 'hypothesis', 'From a hunch to a hypothesis', 'Notice, explain, state, define, test, and be ready to drop it.', 'Hunch to Hypothesis', 'compass'),
      lesson('H', 'what-is-an-indicator', 'What is an indicator?', 'A formula applied to prices that answers one question.', 'Indicator Basics', 'gauge'),
      lesson('I', 'trend-indicators', 'Trend indicators', 'Simple and exponential moving averages, and crossovers.', 'Trend Signals', 'trend'),
      lesson('J', 'momentum-indicators', 'Momentum indicators', 'RSI, rate of change, and overbought and oversold levels.', 'Momentum Signals', 'chart'),
      lesson('K', 'volatility-volume-indicators', 'Volatility and volume indicators', 'Bands, average true range and relative volume.', 'Swing and Volume', 'gauge'),
      lesson('L', 'several-indicators', 'Using several indicators', 'Why two indicators built from the same prices add little.', "Don't Double Count", 'layers'),
    ]),
    part('Part 3: Patterns', [
      lesson('M', 'pattern-trends', 'Trends and momentum', 'A long trend, the rule it suggests, and how it fails.', 'Trend Patterns', 'trend'),
      lesson('N', 'pattern-bounces', 'Bounces and reversion', 'Sharp falls, short bounces and the rule behind them.', 'Bounce Patterns', 'chart'),
      lesson('O', 'pattern-breakouts', 'Ranges and breakouts', 'Support, resistance and a false breakout.', 'Breakout Patterns', 'trend'),
      lesson('P', 'patterns-fade', 'Why patterns fade', 'Crowding, costs and plain chance.', 'Healthy Doubt', 'compass'),
    ]),
    part('Part 4: Writing the rules', [
      lesson('Q', 'long-and-short', 'Long and short', 'Profit from a rise or from a fall, and the risk of a short.', 'Long and Short', 'scale'),
      lesson('R', 'what-a-rule-looks-like', 'What a rule looks like', 'Entry, exit and size, written in plain words and exactly.', 'Rule Writer', 'book'),
      lesson('S', 'limits', 'Limits that protect you', 'Positions, exposure, cash reserves and loss limits.', 'Guardrails', 'shield'),
      lesson('T', 'position-sizing', 'How much to buy', 'Fixed amounts, account percentages and risk-based sizing.', 'How Much to Buy', 'calculator'),
      lesson('U', 'exits', 'Exit plans', 'Stops, targets, trailing stops and the risk-to-reward ratio.', 'Exit Plan', 'receipt'),
      lesson('V', 'market-filters', 'Market filters', 'A long average as a warning sign, and its false alarms.', 'Market Filter', 'gauge'),
      lesson('W', 'strategy-on-paper', 'A strategy on paper', 'A one-page card built from every part of a rule.', 'Strategy on Paper', 'book'),
    ]),
  ],
  quiz: [],
};

const levelFour: Level = {
  id: 'backtesting',
  number: 4,
  name: 'Backtesting',
  title: 'Testing an idea and reading the results',
  status: 'outline',
  lead: 'What a backtest is, every number on a results page, the ways results fool you, and how to test properly.',
  outcomes: [
    'Read an equity curve and the headline numbers',
    'Spot overfitting, look-ahead bias and survivorship bias',
    'Judge whether a result is likely to hold up',
  ],
  certificate: 'Can read a backtest and spot its weak points.',
  parts: [
    part('Part 1: The run', [
      lesson('A', 'what-is-a-backtest', 'What is a backtest?', 'Rules replayed on past prices, and what the output can and cannot say.', 'Replay', 'compass'),
      lesson('B', 'backtest-setup', 'Stocks, dates and starting cash', 'Why the choice of universe and period changes everything.', 'Setting the Scene', 'layers'),
      lesson('C', 'first-run', 'A first run', 'A simple rule, its trades and its equity curve.', 'Run One', 'chart'),
      lesson('D', 'equity-curve', 'The equity curve', 'The account value over time, beside its benchmark.', 'Reading the Line', 'chart'),
    ]),
    part('Part 2: The numbers', [
      lesson('E', 'return-numbers', 'Return numbers', 'Total return, annualised return and excess return.', 'Fair Comparison', 'calculator'),
      lesson('F', 'worst-stretch', 'The worst stretch', 'Maximum drawdown and recovery time.', 'Worst Stretch', 'shield'),
      lesson('G', 'return-for-risk', 'Return for the risk', 'The Sharpe ratio and the risk-free rate.', 'Return per Risk', 'scale'),
      lesson('H', 'trade-statistics', 'Trade statistics', 'Win rate, profit factor, exposure and sample size.', 'Trade Stats', 'gauge'),
      lesson('I', 'costs-realism', 'Costs and realism', 'Commission, slippage, spreads and turnover.', 'Real-World Costs', 'receipt'),
      lesson('J', 'reading-results', 'Reading a full results page', 'A guided tour of the page and a ten-point checklist.', 'Results Reader', 'book'),
    ]),
    part('Part 3: How results fool you', [
      lesson('K', 'fooling-1', 'How results fool you, part 1', 'Overfitting and data snooping.', 'Too Good', 'gauge'),
      lesson('L', 'fooling-2', 'How results fool you, part 2', 'Look-ahead bias and survivorship bias.', 'Bad Data Tricks', 'shield'),
      lesson('M', 'testing-properly', 'Testing properly', 'Out-of-sample tests, walk-forward tests, regimes and robustness.', 'Holds Up', 'scale'),
      lesson('N', 'spot-the-problem', 'Spot the problem', 'Three results, each hiding a flaw.', 'Skeptic', 'compass'),
    ]),
  ],
  quiz: [],
};

const levelFive: Level = {
  id: 'holds-up',
  number: 5,
  name: 'What holds up',
  title: 'What tends to hold up in practice',
  status: 'outline',
  lead: 'Costs, allocation, trend filters, long-run tendencies, discipline, trading costs, survival, fading edges and choosing a strategy.',
  outcomes: [
    'Judge a strategy by its costs, risks and evidence',
    'Explain why an edge can fade',
    'Choose a strategy that fits a plan',
  ],
  certificate: 'Can judge a strategy and its risks.',
  parts: [
    part('Part 1: Investing', [
      lesson('A', 'costs-time', 'Costs and time', 'Fees compound against you, and time in the market matters.', 'Costs Matter', 'receipt'),
      lesson('B', 'allocation-rebalancing', 'Allocation and rebalancing', 'A mix of assets, and when to bring it back to the target.', 'Rebalancer', 'scale'),
      lesson('C', 'trend-filters', 'Trend filters in practice', 'What a long-average filter does, and what it costs.', 'Cutting the Fall', 'gauge'),
      lesson('D', 'momentum-value', 'Momentum and value', 'Long-run tendencies, why they might exist, and their bad decades.', 'Long-Run Tendencies', 'trend'),
      lesson('E', 'discipline', 'Discipline', 'The gap between a strategy and what people earn when they keep changing it.', 'Sticking to It', 'book'),
    ]),
    part('Part 2: Trading', [
      lesson('F', 'trading-costs', 'Costs eat short-term trading', 'The spread, slippage and turnover as a per-trade cost.', 'Cost per Trade', 'receipt'),
      lesson('G', 'survival', 'Risk per trade and survival', 'Losing streaks, position size and a daily loss limit.', 'Staying in the Game', 'shield'),
      lesson('H', 'edge-decay', 'Why edges fade, and how to check', 'Forward testing, monitoring and when to stop.', 'Does It Still Work?', 'gauge'),
      lesson('I', 'process', 'Process over outcome', 'A trade journal, luck, skill and reviewing mistakes.', 'Trade Journal', 'book'),
      lesson('J', 'day-trading', 'The reality of day trading', 'What large studies of retail day traders have found after costs.', 'Honest Odds', 'compass'),
    ]),
    part('Part 3: Putting it to use', [
      lesson('K', 'choosing-strategies', 'Choosing between the strategies on SLTP', 'How each strategy is built and who it suits.', 'Strategy Anatomy', 'layers'),
    ]),
  ],
  quiz: [],
};

export const LEVELS: Level[] = [levelOne, levelTwo, levelThree, levelFour, levelFive];

export const WORKSHOPS: Workshop[] = [
  { id: 'strategy-code', title: 'Reading and writing strategy code', summary: 'The SLTP strategy class, Python basics, and a first strategy.', status: 'planned' },
  { id: 'better-strategies', title: 'Writing better strategies', summary: 'Hypothesis discipline, robustness checks, walk-forward testing and combining strategies.', status: 'planned' },
  { id: 'statistics', title: 'Statistics for researchers', summary: 'Distributions, significance, multiple testing and bootstrapping.', status: 'planned' },
  { id: 'companies', title: 'Companies in depth', summary: 'Statements, ratios and valuation models.', status: 'planned' },
  { id: 'microstructure', title: 'Market microstructure', summary: 'Order books, execution and market impact.', status: 'planned' },
  { id: 'portfolio', title: 'Portfolio construction', summary: 'Optimisation, risk parity and rebalancing rules.', status: 'planned' },
];

/* ---------- Derived helpers ---------- */

export const ALL_LESSONS: Lesson[] = LEVELS.flatMap((level) => level.parts.flatMap((p) => p.lessons));
export const ALL_LIVE_LESSONS: Lesson[] = ALL_LESSONS.filter((l) => l.status === 'live' && l.content);
export const TOTAL_BADGES = ALL_LESSONS.length;
export const TOTAL_CERTIFICATES = LEVELS.length;

export const levelById = (id: string): Level | undefined => LEVELS.find((l) => l.id === id);
export const lessonById = (id: string): Lesson | undefined => ALL_LESSONS.find((l) => l.id === id);
export const levelForLesson = (id: string): Level | undefined =>
  LEVELS.find((level) => level.parts.some((p) => p.lessons.some((l) => l.id === id)));

export const lessonTitleById = (id: string): string => lessonById(id)?.title ?? id;

export function lessonsOf(level: Level): Lesson[] {
  return level.parts.flatMap((p) => p.lessons);
}

export function levelLessonIds(level: Level): string[] {
  return lessonsOf(level).map((l) => l.id);
}

export function nextLevel(levelId: string): Level | undefined {
  const index = LEVELS.findIndex((l) => l.id === levelId);
  return index >= 0 ? LEVELS[index + 1] : undefined;
}

export function lessonLetter(lessonId: string): string {
  return lessonById(lessonId)?.num ?? '';
}

/** Reading time is derived from the text and a fixed allowance per widget. */
export function readingMinutes(lesson: Lesson): number {
  if (!lesson.content) return 5;
  const blocks = lesson.content.blocks;
  const text = blocks
    .map((block) => {
      if ('text' in block) return block.text;
      if (block.kind === 'list') return block.items.join(' ');
      if (block.kind === 'terms') return block.items.map((i) => `${i.term} ${i.text}`).join(' ');
      return '';
    })
    .join(' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  const figures = blocks.filter((b) => b.kind === 'figure').length;
  return Math.max(3, Math.round(words / 220 + figures * 1.5));
}
