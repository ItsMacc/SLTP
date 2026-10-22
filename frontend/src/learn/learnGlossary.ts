// learnGlossary.ts — The beginner course's inline term map.
//
// Moved out of LearnPage.tsx so every Tier II–V module file can share it
// without a circular import.
//
// Two rules keep this aligned with the rest of the site:
//   1. Where a term also lives in lib/glossary.ts (STRATEGY_GLOSSARY), the
//      definition here is copied VERBATIM. A learner meets "drawdown" in the
//      course first and again on Strategy/Performance later - it must read as
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
  'stop-limit order': {
    definition: 'A stop-loss you place in advance with a price attached. When the stock touches your trigger price, the broker tries to sell at that price or better.',
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
  // Strategy and Performance pages use, so they are keyed the same here.
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
    example: 'A signal might read: BUY MU, confidence 82%, because price health is accelerating.',
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
};
