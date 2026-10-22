// moduleQuizzes.ts — Optional end-of-module quizzes.
//
// One short quiz per module, revealed only when the learner clicks
// "Take the quiz". These are practice checks: answering them never affects
// badges, milestones or certification. The questions test the module the
// learner just read, in the same plain language the course uses.
//
// The gate quizzes that certify a tier live in curriculum.ts and are
// separate; these are for self-checking after each section.

export interface QuizQuestion {
  q: string;
  options: string[];
  answer: number; // index into options
  explain: string;
}

export const MODULE_QUIZZES: Record<string, QuizQuestion[]> = {
  // ---------------------------------------------------------------
  // Tier I
  // ---------------------------------------------------------------
  stocks: [
    {
      q: 'A company is worth $40,000 and is divided into 1,000 identical shares. One share represents:',
      options: ['$40 of the company', '$400 of the company', '$4,000 of the company', 'A loan to the company'],
      answer: 0,
      explain: 'One thousandth of $40,000 is $40. A share is an equal slice of the whole company.',
    },
    {
      q: 'Why do companies sell shares on the stock market?',
      options: [
        'To raise money for growth the owner could not fund alone',
        'To pay off their customers',
        'Because the government requires it',
        'To lower the price of their product',
      ],
      answer: 0,
      explain: 'Selling shares trades a piece of ownership for cash the business can use to expand.',
    },
    {
      q: 'You own 1 share out of 100. The company earns a profit. What happens to your claim?',
      options: [
        'Nothing, profits go only to the founder',
        'Your slice of the company is worth more, like every other slice',
        'Your share count doubles',
        'You must invest more money',
      ],
      answer: 1,
      explain: 'Every slice of a company grows together as the business earns. Your 1% stays 1%, but 1% of something larger.',
    },
  ],
  prices: [
    {
      q: "A stock's price rises most directly because:",
      options: [
        'The company officially raised its price',
        'More buyers show up than sellers, and buyers bid higher until someone sells',
        'The exchange adjusts it overnight',
        'Inflation',
      ],
      answer: 1,
      explain: 'Price is a running agreement between buyers and sellers. When buyers outnumber sellers, they raise their offers until owners sell.',
    },
    {
      q: 'Good news about a company tends to raise its share price because:',
      options: [
        'The news automatically adds cash to the company',
        'More people want to own the company, so buyers compete upward',
        'Sellers are required to raise their asking price',
        'It does not, news never affects prices',
      ],
      answer: 1,
      explain: 'News changes what people are willing to pay. Extra demand with unchanged supply pushes the price up.',
    },
    {
      q: 'On a quiet day with roughly equal numbers of buyers and sellers, the price tends to:',
      options: ['Rise sharply', 'Fall sharply', 'Barely move', 'Be cancelled'],
      answer: 2,
      explain: 'With no imbalance between buyers and sellers, the price has no reason to travel.',
    },
  ],
  orders: [
    {
      q: 'You want to buy only at $97 or better, and you are willing to wait. Which order do you place?',
      options: ['Market order', 'Limit order', 'Stop order', 'None, you must wait for the price to fall on its own'],
      answer: 1,
      explain: 'A limit order trades only at your price or better. You control the price, at the cost of no guarantee it fills.',
    },
    {
      q: 'The main advantage of a market order is:',
      options: [
        'It always gets the best possible price',
        'It fills immediately at the best price currently available',
        'It never pays the spread',
        'It is free of all risk',
      ],
      answer: 1,
      explain: 'A market order prioritises speed: it takes whatever price the market offers right now.',
    },
    {
      q: 'The main risk of a market order is:',
      options: [
        'It may never fill',
        'You do not control the price you pay',
        'It can only be placed after hours',
        'It locks your money for a year',
      ],
      answer: 1,
      explain: 'In a fast or thin market the fill can be worse than the price you saw a moment ago. Speed is bought with price control.',
    },
  ],
  candles: [
    {
      q: 'A candle shows open $100, high $106, low $98, close $103. Its body is drawn green because:',
      options: [
        'The close finished above the open',
        'The high was above the open',
        'The low dipped below the open',
        'Green is the default colour',
      ],
      answer: 0,
      explain: 'The body covers open to close. $103 finished above $100, so the day gained and the body is green.',
    },
    {
      q: 'The thin lines above and below a candle body (the wicks) show:',
      options: [
        'The opening and closing prices',
        'The highest and lowest prices reached during the period',
        'The trading volume',
        'The previous day’s range',
      ],
      answer: 1,
      explain: 'The wick reaches up to the high and down to the low, while the body covers only open to close.',
    },
    {
      q: 'One candle on a daily chart summarises:',
      options: ['One trade', 'One full trading day', 'One week', 'One company'],
      answer: 1,
      explain: 'Each candle compresses one period into four numbers: open, high, low, close.',
    },
  ],

  // ---------------------------------------------------------------
  // Tier II
  // ---------------------------------------------------------------
  'long-short': [
    {
      q: 'You short a stock at $100 and buy it back at $90. Your profit per share is:',
      options: ['$10', '$90', '−$10', '$100'],
      answer: 0,
      explain: 'You sold at $100 and repaid the borrowed share at $90, keeping the $10 difference. A short profits when the price falls.',
    },
    {
      q: 'When you go short, the share you sell first is:',
      options: [
        'One you already owned',
        'One you borrowed and must return later',
        'One printed by the company',
        'One the exchange gives you',
      ],
      answer: 1,
      explain: 'Shorting borrows a share, sells it, and owes the lender one share back. Returning it is not optional.',
    },
    {
      q: 'Which position can lose more than the money you put in?',
      options: [
        'Going long, a stock can fall below zero',
        'Going short, a stock can keep rising with no ceiling',
        'Both sides equally',
        'Neither side',
      ],
      answer: 1,
      explain: 'A long loses at most everything (the price floor is $0). A short loss grows with the price, and the price has no ceiling.',
    },
  ],
  't2-spreads': [
    {
      q: 'The bid is:',
      options: [
        'The highest price a buyer is currently willing to pay',
        'The lowest price a seller will accept',
        'The fee the exchange charges',
        "The company's official share price",
      ],
      answer: 0,
      explain: 'The bid is what buyers offer. Sell right now and you receive the bid.',
    },
    {
      q: 'You buy 10 shares and immediately sell them in a stock whose spread is $0.30. Roughly what did the spread cost you round trip?',
      options: ['$0.30', '$3', '$6', 'Nothing, the commission was zero'],
      answer: 2,
      explain: 'You bought at the ask and sold at the bid, $0.30 worse on each side: 10 shares × $0.30 × 2 = $6.',
    },
    {
      q: 'A stock with heavy daily trading volume usually has:',
      options: [
        'A wide spread',
        'A narrow spread, because buyers and sellers crowd the same price',
        'No spread at all',
        'More volatile intraday prices',
      ],
      answer: 1,
      explain: 'Busy stocks have plenty of counterparties competing, which squeezes the gap between bid and ask tight.',
    },
  ],
  't2-orderbook': [
    {
      q: 'The order book is:',
      options: [
        'The company’s annual report',
        'The public list of resting buy and sell orders, each with a price and a size',
        'A record of past trades only',
        'The list of stocks you own',
      ],
      answer: 1,
      explain: 'It shows who is waiting to trade and at what price, which is the market’s real depth.',
    },
    {
      q: 'A large market order that consumes several price levels will usually:',
      options: [
        'Fill entirely at the quoted ask',
        'Fill at an average price worse than the quoted ask',
        'Fill at a better price than the quoted ask',
        'Be rejected by the exchange',
      ],
      answer: 1,
      explain: 'The cheap shares sit at the top of the book. Bigger orders must climb the ladder, so the average fill gets worse.',
    },
    {
      q: 'Slippage is:',
      options: [
        'The commission the broker charges',
        'The difference between the price you expected and the price you actually got',
        'The spread on a liquid stock',
        'A type of dividend',
      ],
      answer: 1,
      explain: 'Expected versus realised price. Every extra level an order consumes adds to it.',
    },
  ],

  // ---------------------------------------------------------------
  // Tier III
  // ---------------------------------------------------------------
  't3-style': [
    {
      q: 'Which statement best describes investing?',
      options: [
        'Buying assets you expect to be worth more over years, judged mainly by the health of the business',
        'Buying and selling within the same day on small price moves',
        'Only buying when a share price has fallen',
        'Keeping money in cash until markets rise',
      ],
      answer: 0,
      explain: 'Investing measures the business over a long horizon. Trading measures price behaviour over a short one.',
    },
    {
      q: 'A trader who holds positions for days or weeks usually relies on:',
      options: [
        'Financial statements going back ten years',
        'Technical analysis of price action',
        'Insider information',
        'Random selection',
      ],
      answer: 1,
      explain: 'Short horizons are judged by price behaviour itself: trends, momentum and patterns in the chart.',
    },
    {
      q: 'What do trading and investing have in common?',
      options: [
        'Neither one can lose money',
        'Both work from written rules, and both put capital at risk',
        'Both require holding for decades',
        'Trading always beats investing',
      ],
      answer: 1,
      explain: 'Different horizons, same discipline: a plan written down in advance, and real money exposed to real risk.',
    },
  ],
  't3-index': [
    {
      q: 'A market index is:',
      options: [
        'A single company’s share price',
        'A representative list of stocks combined into one number to track the market as a whole',
        'A fee charged by the exchange',
        'A list of the worst performing stocks',
      ],
      answer: 1,
      explain: 'An index groups representative stocks into a single number, so you can see how the market is doing at a glance.',
    },
    {
      q: 'Why compare a strategy against an index?',
      options: [
        'It proves the strategy will work in the future',
        'It shows whether the strategy did better than simply holding the market',
        'It removes all risk from the strategy',
        'It is required by law',
      ],
      answer: 1,
      explain: 'The index is the baseline. A strategy that cannot beat just holding the market has not earned its complexity.',
    },
    {
      q: 'Buy and hold means:',
      options: [
        'Buying an investment and keeping it through ups and downs',
        'Buying and selling within a week',
        'Buying only at market highs',
        'Holding cash instead of shares',
      ],
      answer: 0,
      explain: 'Buy and hold is the simplest possible strategy, which is exactly why it is the benchmark everything else must face.',
    },
  ],
  math: [
    {
      q: 'Financial analysis studies:',
      options: [
        'The business: revenue, profit, debt and their direction',
        'Only the shape of the price chart',
        'What other investors are feeling today',
        'Tomorrow’s exact closing price',
      ],
      answer: 0,
      explain: 'Financial analysis reads the company itself. Technical analysis reads the price action.',
    },
    {
      q: 'Every strategy has three jobs. Which is NOT one of them?',
      options: [
        'Decide if and when to buy',
        'Decide how much to buy',
        'Predict tomorrow’s exact closing price',
        'Set the exits (stop-loss and take-profit)',
      ],
      answer: 2,
      explain: 'When to buy, how much, and where to exit. No strategy, human or computer, knows tomorrow’s price.',
    },
    {
      q: 'Why apply rules by computer instead of by feel?',
      options: [
        'Computers predict the market better',
        'Computers apply the same rules every day, without emotion or fatigue',
        'Computers pay no commissions',
        'Human traders always lose money',
      ],
      answer: 1,
      explain: 'The edge is consistency, not prophecy: identical rules applied identically, every single day.',
    },
  ],
  't3-indicators': [
    {
      q: 'A 10-day moving average is:',
      options: [
        'The average close of the last 10 days, recalculated each day',
        'The highest price of the last 10 days',
        'A prediction of the next 10 days',
        'The total profit over 10 days',
      ],
      answer: 0,
      explain: 'Each day it drops the oldest close, adds the newest, and averages the window again.',
    },
    {
      q: 'What happens when you increase the window N?',
      options: [
        'The line gets smoother and reacts more slowly',
        'The line gets faster and noisier',
        'The line stops moving',
        'The price changes',
      ],
      answer: 0,
      explain: 'Bigger N averages more days, so daily jitter is filtered out at the cost of being later to every turn.',
    },
    {
      q: 'In a moving-average crossover strategy, the buy signal is:',
      options: [
        'The fast average crossing above the slow average',
        'The price falling below both averages',
        'The two averages becoming equal',
        'Volume reaching zero',
      ],
      answer: 0,
      explain: 'Recent prices beating the long-term habit is read as the start of an uptrend.',
    },
  ],

  // ---------------------------------------------------------------
  // Tier IV
  // ---------------------------------------------------------------
  testing: [
    {
      q: 'A backtest is:',
      options: [
        'A rehearsal of rules against real past prices to see what they would have done',
        'A forecast of next year’s returns',
        'A guarantee that a strategy works',
        'A tax document',
      ],
      answer: 0,
      explain: 'The rules are replayed over recorded history, one day at a time, keeping score as they go.',
    },
    {
      q: 'The honesty rule for backtests is:',
      options: [
        'Use the most accurate data available',
        'Each simulated day may only use information available on or before that day',
        'Test only on the best performing years',
        'Always assume the quoted price',
      ],
      answer: 1,
      explain: 'Using a close to trade the same close is grading with the answer sheet. The real world never hands out tomorrow’s price.',
    },
    {
      q: "A backtest's result is best described as:",
      options: [
        'Proof the strategy will work',
        'Evidence of what the rules did, never a promise of what they will do',
        'A marketing asset',
        'Worthless',
      ],
      answer: 1,
      explain: 'The past is the best evidence available, but the future is allowed to differ from it.',
    },
  ],
  't4-walkthrough': [
    {
      q: 'In the 10-year test, the strategy finished at 275 while buy and hold finished at 364, but the strategy’s worst fall was about 19% against 35%. The fair reading is:',
      options: [
        'The strategy failed completely',
        'The strategy grew less but gave its owner a much steadier ride',
        'The benchmark cheated',
        'Both results are identical',
      ],
      answer: 1,
      explain: 'Growth and stability are two different scores. The strategy bought a shallower drawdown at the cost of less growth.',
    },
    {
      q: 'A max drawdown of −19% means:',
      options: [
        'The account lost 19% every year',
        'At the worst point, an account that had been at its peak fell about 19%',
        'The strategy ended 19% lower than it started',
        'The strategy lost 19% of its trades',
      ],
      answer: 1,
      explain: 'Drawdown is measured peak to trough: the deepest fall an owner would have had to sit through.',
    },
    {
      q: 'A strategy with a CAGR of 10.66%:',
      options: [
        'Returned exactly 10.66% every single year',
        'Grew about 10.66% per year on average over the test',
        'Charges a 10.66% fee',
        'Will return 10.66% next year',
      ],
      answer: 1,
      explain: 'CAGR is the smoothed yearly rate that gets you from the starting value to the final one. Individual years vary around it.',
    },
  ],

  // ---------------------------------------------------------------
  // Tier V
  // ---------------------------------------------------------------
  risk: [
    {
      q: 'A stop-loss placed exactly at your entry price usually:',
      options: [
        'Protects you perfectly',
        'Gets hit by the first ordinary downward wiggle and sells you out before the trade can be right',
        'Is required by regulation',
        'Turns every trade into a profit',
      ],
      answer: 1,
      explain: 'The stop marks where the trade is declared failed, so it needs room below entry to survive normal noise.',
    },
    {
      q: 'With a $10,000 account risking 2% per trade and a stop $8 below entry, how many shares do you buy?',
      options: ['25 shares', '125 shares', '1,250 shares', '2 shares'],
      answer: 0,
      explain: '2% of $10,000 is $200 of allowed loss. $200 ÷ $8 per share = 25 shares.',
    },
    {
      q: 'The risk-reward ratio compares:',
      options: [
        'Your profit target against the loss your stop allows',
        'Your account size against the share price',
        'Two different stocks',
        'Win rate against number of trades',
      ],
      answer: 0,
      explain: 'Potential gain divided by potential loss on the same trade. It decides how often you need to be right.',
    },
  ],
  't5-metrics': [
    {
      q: 'Two strategies both return 12% a year. One has 5% volatility, the other 25%. Which has the higher Sharpe ratio?',
      options: [
        'The one with 5% volatility',
        'The one with 25% volatility',
        'They are equal',
        'Sharpe ratio ignores volatility',
      ],
      answer: 0,
      explain: 'Sharpe is return divided by volatility. Same return, less variability, better score.',
    },
    {
      q: 'A drawdown is:',
      options: [
        'A fall from a peak to a subsequent low',
        'A yearly fee',
        'A type of dividend',
        'The difference between bid and ask',
      ],
      answer: 0,
      explain: 'It measures the fall from a high point to the bottom that follows, before recovering.',
    },
    {
      q: 'Why can the steadier of two equal-return strategies be the better investment?',
      options: [
        'It pays more dividends',
        'It is easier to hold through rough periods without abandoning the plan',
        'It cannot lose money',
        'It trades more often',
      ],
      answer: 1,
      explain: 'A strategy you cannot stick with is worth little in practice. Smaller swings make it far easier to stay invested.',
    },
  ],
  't5-allocation': [
    {
      q: 'You split $1,000 equally across 4 companies and one goes bankrupt. You lose:',
      options: ['$250', '$1,000', '$500', '$100'],
      answer: 0,
      explain: 'A quarter of the money sat in that one company, so the bankruptcy takes that quarter and no more.',
    },
    {
      q: "Diversification's main benefit is:",
      options: [
        'Guaranteeing a higher return',
        'One failure cannot end your account',
        'Removing all risk',
        'Avoiding fees',
      ],
      answer: 1,
      explain: 'It buys survival: the worst case becomes a setback instead of a finish.',
    },
    {
      q: 'Twenty technology stocks held together are:',
      options: [
        'Fully diversified',
        'Still largely one bet, because they tend to fall together',
        'Riskier than one technology stock',
        'Guaranteed to smooth returns',
      ],
      answer: 1,
      explain: 'Real diversification mixes sectors and kinds of risk, so one bad month for one industry cannot take everything at once.',
    },
  ],
};
