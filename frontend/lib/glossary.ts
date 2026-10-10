// glossary.ts — Plain-language definitions for the strategy + performance
// guides.
//
// StrategyGuide and CandlestickGuide are the two densest pages on the site and
// they assume vocabulary the beginner course spends three tiers building up.
// This is the shared term map both guides annotate their prose with, so a term
// is defined identically wherever it appears.
//
// Rendered through <GlossaryText glossary={STRATEGY_GLOSSARY} />, which turns
// matching words into hover/click tooltips.

import type { GlossaryTerm } from '../src/types/strategy';

export const STRATEGY_GLOSSARY: Record<string, GlossaryTerm> = {
  // --- What a strategy is made of ---
  backtest: {
    definition:
      'Running a strategy’s rules over past market data to see how it would have performed, without risking real money.',
    example:
      'Backtesting "buy the 10 healthiest stocks, rebalance quarterly" over 20 years shows its returns and its worst losing streak.',
  },
  strategy: {
    definition:
      'A fixed set of rules that decides what to buy, when to sell, and when to re-check the holdings.',
    example: 'A rule like "hold the 10 healthiest stocks, re-check weekly" is a strategy.',
  },
  universe: {
    definition:
      'The pool of stocks a strategy is allowed to trade. Narrowing the universe limits choices, which is usually a deliberate risk decision.',
    example: 'A US-large-cap-only universe might hold 500 names; a global universe would hold thousands.',
  },
  benchmark: {
    definition: 'A standard the strategy is measured against, so you can tell whether it added anything.',
    example: 'If a strategy returns 8% and the S&P 500 returned 10%, it underperformed its benchmark.',
  },
  'buy and hold': {
    definition:
      'Buying an index and never selling it — the simplest possible strategy, and the bar most strategies are measured against.',
  },
  'rebalance': {
    definition:
      'Periodically selling what has grown too large and buying what has shrunk, to return to the target weights.',
    example: 'A 60/40 portfolio that drifts to 70/30 gets rebalanced back to 60/40.',
  },
  horizon: {
    definition: 'How long a strategy is expected to be held before its positions are sold.',
    example: 'A quarterly rebalance implies a horizon measured in months, not days.',
  },

  // --- Measuring performance ---
  CAGR: {
    definition:
      'Compound Annual Growth Rate — the constant yearly rate that would take the starting value to the ending value over the period.',
    example:
      '$100 growing to $130 in two years is a 14% CAGR, not 15%: the second year only grew on the $110 it had reached.',
  },
  'base 100': {
    definition:
      'A way of charting performance: every strategy starts at 100, so curves are directly comparable regardless of share price.',
    example: 'A curve ending at 160 means the strategy grew 60%.',
  },
  volatility: {
    definition:
      'How much the returns swing from period to period. Higher volatility means a bumpier ride, even at the same average return.',
  },
  'drawdown': {
    definition:
      'The worst fall from a previous peak to the lowest point before recovering. It measures how much you would have felt the pain.',
    example: 'A strategy peaking at 120 and falling to 90 has a 25% drawdown.',
  },
  'max drawdown': {
    definition: 'The single deepest peak-to-trough decline across the whole backtest — the worst loss you would have sat through.',
  },
  'sharpe ratio': {
    definition:
      'Return earned per unit of risk taken. Above 1.0 is generally considered viable; higher is better.',
    example: 'A strategy returning 10% with 5% volatility has roughly a 2.0 Sharpe ratio.',
  },
  PSR: {
    definition:
      'Probabilistic Sharpe Ratio — the probability that a strategy’s real edge is strong enough to be worth trusting, rather than luck that happened to look good.',
    example: '90% PSR means a 9-in-10 chance the edge is genuine.',
  },
  'win rate': {
    definition: 'The share of trades that finished profitable. Useful only alongside how much the winners gained versus the losers lost.',
  },
  'risk-adjusted': {
    definition: 'Comparing returns by how much risk produced them, so a calm 8% can beat a chaotic 12%.',
  },
  expectancy: {
    definition:
      'Average profit per trade, averaged over many trades — the number that tells you whether a system works at all.',
  },

  // --- Risk ---
  risk: {
    definition: 'The chance of losing money, and how much you stand to lose when it happens.',
  },
  'stop-loss': {
    definition: 'A preset rule that sells a holding when its price falls to a set level, capping how much you can lose.',
    example: 'A stop-loss 10% below your buy price sells automatically if the stock drops 10%.',
  },
  'slippage': {
    definition:
      'The gap between the price you expected and the price you actually got, which happens when the market moves while your order is in flight.',
  },
  'overfitting': {
    definition:
      'Tweaking rules until they look perfect on past data, so they memorised history instead of learning anything transferable.',
  },
  'forward-looking bias': {
    definition:
      'Using information that was not available at the time, such as trading at a closing price you could only know after it happened.',
  },
};
