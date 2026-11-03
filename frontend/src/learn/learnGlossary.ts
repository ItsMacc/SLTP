// learnGlossary.ts — The beginner course's inline term map.
//
// Moved out of LearnPage.tsx so every Tier II–V module file can share it
// without a circular import.
//
// Two rules keep this aligned with the rest of the site:
//   1. Where a term also lives in lib/glossary.ts (STRATEGY_GLOSSARY), the
//      definition here is copied VERBATIM. A learner meets "drawdown" in the
//      course first and again on Strategy/Research later - it must read as
//      the same word, not a slightly different one.
//   2. Where a term is genuinely beginner-level (share, order book), the
//      wording stays simpler, but the vocabulary matches what the guides say
//      so nothing has to be re-learned.

import type { GlossaryTerm } from '../types/strategy';

export const LEARN_GLOSSARY: Record<string, string | GlossaryTerm> = {
  // ---------------- Tier I - mechanics ----------------
  stock: {
    definition: 'A share of ownership in a company. If the company does well, the value of your share tends to grow.',
    example: 'Buying one share of Apple (AAPL) makes you a tiny part-owner of Apple.',
  },
  'stock market': {
    definition: 'A place where shares of companies are bought and sold, like a permanent marketplace for ownership slices.',
    example: 'The New York Stock Exchange lists thousands of companies that anyone can buy a piece of.',
  },
  shares: {
    definition: 'Tiny equal slices of a company. A company splits its ownership into shares so many people can each buy a piece.',
  },
  share: {
    definition: 'One tiny equal slice of a company. Owning a share means owning that slice of the company and its future profits.',
  },
  profit: {
    definition: 'The money a company has left over after paying all of its costs. Profit belongs to the owners.',
  },
  'moving average': {
    definition: 'The average price of a stock over the last several days, drawn as a smooth line to filter out daily noise.',
  },
  'technical analysis': {
    definition: "Studying a stock's price action, the open, high, low and close of past days, to find patterns worth acting on.",
  },
  'financial analysis': {
    definition: 'Studying a company itself: what it does, how much it earns, its debt and its yearly profit, to judge whether the business is worth owning.',
  },
  'stop-loss': {
    definition: 'A preset rule that sells a holding when its price falls to a set level, capping how much you can lose.',
    example: 'A stop-loss 10% below your buy price sells automatically if the stock drops 10%.',
  },
  'take-profit': {
    definition: 'A preset rule that sells a holding once it reaches a target gain, locking in the profit.',
    example: 'A take-profit set 20% above your buy price automatically sells after a 20% rise.',
  },
  strategy: {
    definition: 'A fixed set of rules that decides what to buy, when to sell, and when to re-check the holdings.',
    example: 'A rule like "hold the 10 healthiest stocks, re-check weekly" is a strategy.',
  },
  backtest: {
    definition:
      'Running a strategy\u2019s rules over past market data to see how it would have performed, without risking real money.',
    example:
      'Backtesting "buy the 10 healthiest stocks, rebalance quarterly" over 20 years shows its returns and its worst losing streak.',
  },
  'index fund': {
    definition: 'A fund that simply holds everything in a market index instead of picking winners.',
    example: 'An S&P 500 index fund owns the same 500 companies as the index, no more and no less.',
  },
  broker: {
    definition: 'A licensed service that places orders on the exchange for you. The app you buy stocks through works with a broker behind the scenes.',
    example: 'When you press Buy in a trading app, that app sends your order to the market through its broker.',
  },
  commission: {
    definition: 'A small fee a broker charges for handling a trade. Many brokers today charge none, but the term still matters.',
  },
  'market order': {
    definition: 'An order that says "buy or sell right now at whatever the current price is." Fast, but the final price is not guaranteed.',
  },
  'limit order': {
    definition: 'An order that says "buy or sell, but only at my price or better." If the price never reaches yours, the trade never happens.',
    example: 'A limit order to buy at $97 waits until the price drops to $97 or lower.',
  },
  'stop order': {
    definition: 'An order that sleeps until the price hits the trigger you set, then becomes a market order and fills at whatever price is available next.',
    example: 'A stop order at $90 turns into a market sell the moment the price touches $90.',
  },
  'stop-limit order': {
    definition: 'A stop order that becomes a limit order at your trigger price, so it fills at that price or better, and may not fill at all if the price gaps past it.',
  },
  slippage: {
    definition:
      'The gap between the price you expected and the price you actually got, which happens when the market moves while your order is in flight.',
  },
  'candlestick chart': {
    definition: 'A chart where each day is drawn as a single candle showing four numbers: open, high, low and close. It packs a full day of price action into one shape.',
  },
  'position size': {
    definition: 'How much money you put into a single trade. Position sizing is the set of rules that decides that amount.',
  },
  'risk-reward ratio': {
    definition: 'How much a trade stands to gain compared to what it stands to lose, before entering. A 2:1 ratio risks $1 to potentially make $2.',
  },

  // ---------------- Tier II - microstructure ----------------
  // "bid-ask spread" / "liquidity" / "order book" are the exact phrases the
  // Strategy and Research pages use, so they are keyed the same here.
  'bid-ask spread': {
    definition:
      'The gap between the highest price a buyer will pay (the bid) and the lowest price a seller will accept (the ask). It is the built-in cost of trading instantly.',
    example: 'A bid of $99.95 and an ask of $100.05 is a 10-cent spread, cross it and you are instantly 10 cents down per share.',
  },
  spread: {
    definition:
      'Short for bid-ask spread: the gap between what buyers offer and what sellers want. A smaller spread means cheaper, easier trading.',
  },
  liquidity: {
    definition:
      'How easily a stock can be bought or sold without moving its price. Many active traders and tight spreads mean high liquidity.',
    example: 'A huge company like Apple is very liquid; a tiny company with few trades is not.',
  },
  'order book': {
    definition:
      'The live list of every buy order and sell order waiting to be filled, ranked by price. It shows how much stock is available at each price.',
  },
  depth: {
    definition:
      'How much stock is waiting in the order book at each price. Thin depth means a large order will eat through the levels and move the price.',
  },
  'market impact': {
    definition:
      'How much your own order moves the price against you. Buying a lot in a thin market pushes the ask up before you are filled.',
  },
  volume: {
    definition: 'How many shares changed hands in a period. High volume means lots of activity and usually easier trading.',
  },

  // ---------------- Tier III - signals ----------------
  // Copied verbatim from lib/glossary.ts where it exists there.
  'average true range': {
    definition:
      'ATR, how much a stock typically moves in one day. It measures movement size, not direction, and is used to set stops that fit the stock.',
  },
  rsi: {
    definition:
      'Relative Strength Index, a 0-to-100 gauge of how fast price has risen or fallen recently. Readings above 70 look stretched; below 20 look beaten down.',
  },
  'overbought': {
    definition: 'When a stock has risen too far, too fast. On RSI this usually means a reading above 70.',
  },
  oversold: {
    definition: 'When a stock has fallen too far, too fast. On RSI this usually means a reading below 30.',
  },
  signal: {
    definition:
      'The moment a strategy\'s rules say to act, buy, sell or hold. A signal is the output of the rules, not a guess.',
    example: 'A signal might read: LONG MU, confidence 82%, because price health is accelerating.',
  },

  // ---------------- Tier IV - validation ----------------
  overfitting: {
    definition:
      'Tweaking rules until they look perfect on past data, so they memorised history instead of learning anything transferable.',
  },
  'look-ahead bias': {
    definition:
      'Using information that was not available at the time, such as trading at a closing price you could only know after it happened.',
  },
  'survivorship bias': {
    definition:
      'Testing only on the companies that still exist today, which quietly deletes the losers and makes the past look safer than it was.',
  },
  'out of sample': {
    definition:
      'Data deliberately held back from tuning. A strategy that only works on the data it was tuned to is being graded on its own homework.',
  },

  // ---------------- Tier V - portfolio ----------------
  drawdown: {
    definition:
      'The worst fall from a previous peak to the lowest point before recovering. It measures how much you would have felt the pain.',
    example: 'A strategy peaking at 120 and falling to 90 has a 25% drawdown.',
  },
  'sharpe ratio': {
    definition: 'Return earned per unit of risk taken. Above 1.0 is generally considered viable; higher is better.',
    example: 'A strategy returning 10% with 5% volatility has roughly a 2.0 Sharpe ratio.',
  },
  volatility: {
    definition:
      'How much the returns swing from period to period. Higher volatility means a bumpier ride, even at the same average return.',
  },
  'risk-adjusted': {
    definition: 'Comparing returns by how much risk produced them, so a calm 8% can beat a chaotic 12%.',
  },
  'win rate': {
    definition:
      'The share of trades that finished profitable. Useful only alongside how much the winners gained versus the losers lost.',
  },
  diversification: {
    definition:
      'Spreading money across many holdings so one bad outcome cannot sink the whole portfolio.',
    example: 'Owning 30 stocks instead of 3 means one bankruptcy hurts, but does not end you.',
  },
  allocation: {
    definition: 'How much of a portfolio sits in each holding. Setting it is a risk decision before it is a return decision.',
  },
  'position sizing': {
    definition:
      'The rule that decides how many shares any single trade gets, usually by capping how much of the account one mistake may cost.',
  },
  benchmark: {
    definition: 'A standard the strategy is measured against, so you can tell whether it added anything.',
    example: 'If a strategy returns 8% and the S&P 500 returned 10%, it underperformed its benchmark.',
  },

  // ---------------- shared vocabulary ----------------
  // Words a beginner meets before any lesson defines them.
  ticker: {
    definition: 'The short code a stock trades under, usually one to five letters.',
    example: 'Apple trades as AAPL, Microsoft as MSFT.',
  },
  'price action': {
    definition: 'The movement of a price itself, day to day, with no reference to the business behind it.',
  },
  delisted: {
    definition: 'Removed from the exchange, so the shares no longer trade publicly. Usually follows bankruptcy or a merger.',
  },
  universe: {
    definition: 'The full list of stocks a strategy or a test is allowed to choose from.',
    example: 'A test whose universe is the 500 largest US companies can only ever buy those, never a smaller one.',
  },
  baseline: {
    definition: 'The simple answer you compare against, so you can tell whether the clever answer added anything.',
    example: 'If a strategy returns 8% and buy and hold returned 10%, it lost to its baseline.',
  },
  valuation: {
    definition: 'What a company, or a slice of it, is thought to be worth in money.',
  },
  equity: {
    definition: 'The ownership value you hold: what your shares would be worth if you sold them today.',
  },
  'data feed': {
    definition: 'The stream of prices a trading system reads: open, high, low, close and volume for each day.',
  },
  revenue: {
    definition: 'The money that comes in from selling the product, before any costs are paid.',
    example: 'A shop selling $1,000 of goods a day has revenue of $1,000, whatever its costs.',
  },
  'profit margin': {
    definition: 'The share of each dollar of revenue the company keeps after costs.',
    example: 'A 20% margin means 20 cents kept from every dollar of sales.',
  },
  debt: {
    definition: 'Money the company has borrowed and must repay, usually with interest, whether or not business is good.',
  },
  'market index': {
    definition: 'A fixed list of stocks whose combined movement stands in for the whole market.',
    example: 'The S&P 500 tracks about 500 large US companies as one number.',
  },
  'buy and hold': {
    definition: 'Buying a broad slice of the market and never selling, which is the baseline every strategy is measured against.',
  },
  cagr: {
    definition: 'Compound annual growth rate: the steady yearly percentage that would take the starting value to the final one.',
    example: 'Turning $100 into $275 over ten years is a CAGR of about 10.7% a year.',
  },
  'short selling': {
    definition: 'Selling a share you borrowed, then buying it back later. You profit if the price falls, and lose if it rises.',
  },
  portfolio: {
    definition: 'Everything you hold at once, treated as one pool of money.',
  },
  exchange: {
    definition: 'The marketplace where buy and sell orders meet and every trade is recorded.',
  },

  // ---------------- Intermediate - crowds and ideas ----------------
  sentiment: {
    definition: 'The overall mood of buyers and sellers towards a stock or a market, which shows up in how eagerly they buy or sell.',
    example: 'Heavy buying after good news is positive sentiment; the price is not the only thing that moved, the willingness to pay did.',
  },
  herding: {
    definition: 'Buying or selling because other people are, rather than because of new information.',
    example: 'A stock rises for a week, more people buy because it is rising, and the rise extends.',
  },
  fomo: {
    definition: 'Fear of missing out: buying late in a move because watching others profit feels worse than the risk of losing.',
  },
  overreaction: {
    definition: 'Pricing news as if it were worse (or better) than it is, which can be partly reversed afterwards.',
  },
  underreaction: {
    definition: 'Absorbing news slowly, so a move keeps going after the news is public.',
  },
  'loss aversion': {
    definition: 'Losses feel worse than an equal gain feels good, which makes people hold losers and sell winners too early.',
    example: 'A $100 loss stings more than a $100 gain pleases, so the losing position stays open hoping to break even.',
  },
  anchoring: {
    definition: 'Fixing on a remembered price and judging every later price against it.',
    example: 'A stock that fell from $100 to $60 can feel cheap at $65, even though $100 was never a promise.',
  },
  trend: {
    definition: 'A price moving mostly in one direction over weeks or months.',
  },
  momentum: {
    definition: 'The strength and speed of a recent move, used as evidence that it may continue.',
  },
  'mean reversion': {
    definition: 'The tendency of an unusually stretched price to move back towards its recent average.',
    example: 'A stock far below its 20-day average is a mean-reversion candidate: the bet is that the gap closes.',
  },
  hypothesis: {
    definition: 'A statement specific enough that data could prove it wrong.',
    example: '“Stocks that fall 10% in five days tend to bounce over the next ten” can fail; “tech stocks are good” cannot.',
  },
  falsifiable: {
    definition: 'Able to be proven wrong by evidence. A claim that cannot fail teaches nothing.',
  },
  edge: {
    definition: 'A repeatable reason a set of rules should beat a fair baseline, after costs.',
  },
  noise: {
    definition: 'Random movement in prices that carries no information, which a rule can mistake for a signal.',
  },

  // ---------------- Intermediate - maths and indicators ----------------
  'percent change': {
    definition: 'How much a value moved, as a share of where it started.',
    example: 'From $80 to $100 is a 25% gain: 20 ÷ 80.',
  },
  average: {
    definition: 'The sum of a set of numbers divided by how many there are.',
    example: 'Closes of 100, 102, 104 average 102.',
  },
  'standard deviation': {
    definition: 'A number for how far values typically sit from their average, which is how volatility is measured.',
    example: 'Closes averaging 100 with a standard deviation of 2 usually sit within a couple of dollars of 100.',
  },
  expectancy: {
    definition: 'What an average trade is worth: win rate times average win, minus loss rate times average loss.',
    example: 'Winning 40% of the time with $300 wins and $150 losses is $120 - $90 = $30 per trade.',
  },
  indicator: {
    definition: 'A formula applied to prices or volume that makes one question easier to answer. It adds no new information.',
  },
  window: {
    definition: 'How many past days an indicator looks at. A 20-day average uses the last 20 closes.',
  },
  lag: {
    definition: 'How far behind today an indicator effectively sits, because it averages old data.',
  },
  'bollinger bands': {
    definition: 'A moving average with two bands above and below it, set a number of standard deviations away, showing how stretched price is.',
  },
  factor: {
    definition: 'A characteristic that can be measured across many stocks, such as size or recent momentum.',
  },
  regime: {
    definition: 'A stretch of market conditions with a similar character, such as a steady bull market or a choppy one.',
  },
  parameter: {
    definition: 'One of the adjustable numbers in a rule, like a 25-day RSI period or a 3-standard-deviation stop.',
  },

  // ---------------- Advanced - code ----------------
  variable: {
    definition: 'A name that holds a value in a program, so the value can be used later.',
  },
  function: {
    definition: 'A named block of code that does one job and can be called by name.',
  },
  condition: {
    definition: 'A test in code, such as “is the price below the 20-day average?”, that decides which lines run.',
  },
  loop: {
    definition: 'Code that repeats the same steps for each item in a list.',
  },
  method: {
    definition: 'A function that belongs to a class, like on_signal belonging to a Strategy.',
  },

  // ---------------- Advanced - companies ----------------
  'net income': {
    definition: 'Profit after every cost, interest and tax: the bottom line of the income statement.',
  },
  'earnings per share': {
    definition: 'Net income divided by the number of shares, so companies of different sizes can be compared.',
    example: '$1m profit across 500,000 shares is $2 of earnings per share.',
  },
  assets: {
    definition: 'Everything the company owns: cash, equipment, buildings, money owed to it.',
  },
  liabilities: {
    definition: 'Everything the company owes to others: debt, unpaid bills, obligations.',
  },
  'cash flow': {
    definition: 'Money actually moving in and out of the business, which differs from profit because of timing and accounting.',
  },
  'free cash flow': {
    definition: 'Cash left after the spending needed to keep the business running, which can be returned to owners or reinvested.',
  },
  'fiscal year': {
    definition: 'A company’s chosen twelve-month accounting period, which does not have to start in January.',
  },
  'market capitalisation': {
    definition: 'Price per share times the number of shares: what the market says the whole company is worth.',
    example: 'A $50 share price with 2m shares is a $100m market capitalisation.',
  },
  'p/e ratio': {
    definition: 'Price divided by earnings per share: how many years of today’s profit the price equals.',
    example: 'A $60 share earning $3 per share has a P/E of 20.',
  },
  'price-to-sales': {
    definition: 'Market value divided by yearly revenue, used when a company has little or no profit.',
  },
  'enterprise value': {
    definition: 'Market capitalisation plus debt minus cash: the price of the whole business, not just the shares.',
  },
  'growth stock': {
    definition: 'A company valued mostly on expected future growth, so its ratios usually look high today.',
  },
  'value stock': {
    definition: 'A company whose price looks low against its current profits or assets.',
  },
};
