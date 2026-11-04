// strategies.ts — the published strategy library, in one place.
//
// The page reads everything from this file: the index list, the four tabs, and
// the glossary. Shapes here are deliberately plain strings, so the copy can be
// edited without touching the layout.
//
// Backtest numbers are not written here. They come from BACKTESTS, generated
// from app/reports, so a rerun of the report script is the only way a figure on
// the page changes.

import type { GlossaryTerm } from '../types/strategy';

export type StrategyCategory = 'Investing' | 'Trading';

export interface StrategyFact {
  label: string;
  value: string;
}

export interface StrategyNote {
  title: string;
  body: string;
}

export interface StrategyProfile {
  id: string;
  name: string;
  category: StrategyCategory;
  summary: string;
  facts: StrategyFact[];
  hypothesis: string;
  whyItWorks: string[];
  whyItDoesnt: string[];
  overviewNotes: StrategyNote[];
  universe: string;
  rebalance: string;
  settings: StrategyFact[];
  notes: StrategyNote[];
  glossary: Record<string, GlossaryTerm>;
}

export const STRATEGIES: StrategyProfile[] = [
  {
    id: 'buy-and-hold',
    name: 'Buy and Hold',
    category: 'Investing',
    summary:
      'Buy the market and hold it for years. Price swings in between are ignored, and no position is ever sold or replaced.',
    facts: [
      { label: 'Horizon', value: '10+ years' },
      { label: 'Activity', value: 'Low' },
      { label: 'Positions', value: '1 fund (SPY)' },
      { label: 'Rebalance', value: 'Never' },
    ],
    hypothesis:
      'Over long periods the market tends to rise because the companies inside it keep earning more. Holding through the noise captures that growth, keeps fees and taxes low, and removes the temptation to act on a bad month.',
    whyItWorks: [
      'Captures the growth of the market as a whole, with no need to time entries or exits.',
      'Costs almost nothing to run: no trading fees, and no capital gains tax triggered by selling.',
      'Removes the decisions that hurt most, such as selling in panic after a sharp drop or buying back in at the top.',
      'Owns the whole index, so it cannot miss the small number of companies that produce most of the market’s long-run return.',
    ],
    whyItDoesnt: [
      'Takes the full decline in a bear market, because no rule reduces exposure before prices fall.',
      'Has no exit rules, so gains are never locked in and no part of the account moves to cash when the market turns.',
      'Leaves you nothing to do when the market is expensive: no rule trims the position at high valuations, so the return depends on the price paid on the first day.',
      'Rests on a single assumption for decades: that the market keeps rising over long stretches. Nothing in the holding adapts if that stops being true.',
    ],
    overviewNotes: [
      {
        title: 'Why the yardstick is one fund',
        body: 'SPY is one liquid fund that a real investor can actually buy, which makes it a fair comparison for any strategy that also has to be bought. Holding every name in the dataset instead would equal-weight thousands of illiquid stocks and end up measuring the data rather than the market.',
      },
      {
        title: 'What would change our mind',
        body: 'If company earnings stopped growing over long stretches, or if one simple rule beat this after costs in every window, holding would stop being the sensible default. Until then it stays the number every other strategy has to clear.',
      },
    ],
    universe:
      'SPY only: one liquid S&P 500 fund, bought on the first session the run can trade and never replaced. Nothing is ranked or filtered, because there is nothing to choose between.',
    rebalance:
      'No automatic buying or selling. The holding changes only when you add or withdraw funds yourself.',
    settings: [
      { label: 'Ticker', value: 'SPY' },
      { label: 'Allocation', value: '100% of the book' },
      { label: 'Max positions', value: '1' },
      { label: 'Lots per ticker', value: '1' },
      { label: 'Rebalance', value: 'Never' },
      { label: 'Stop and target', value: 'None' },
      { label: 'Exit rules', value: 'None' },
      { label: 'Minimum history', value: '1 bar' },
    ],
    notes: [
      {
        title: 'Why this is the benchmark',
        body: 'Every other strategy on the platform is measured against this one. It is plain, unmanaged market exposure with no timing decisions and no management fee, so an active strategy has to beat this after costs before its extra complexity is worth anything.',
      },
      {
        title: 'What it costs to hold',
        body: 'There is one entry and no exits, so trading costs are a rounding error against the position. What remains is the fund’s own expense ratio, charged every year whether the market rises or falls, plus the tax bill that is deferred for as long as nothing is sold.',
      },
    ],
    glossary: {
      portfolio: {
        definition:
          'The total collection of financial investments owned by a single person or organization.',
        example:
          'If you own shares in five different companies inside one account, those combined investments make up your portfolio.',
      },
      volatility: {
        definition: 'How quickly and drastically the price of an investment moves up and down over time.',
        example:
          'A stock whose price swings between $80 and $120 in a single week has high volatility.',
      },
      'bear market': {
        definition:
          'A prolonged period when market prices fall, usually 20% or more from recent highs.',
        example:
          'If the overall index falls from 1,000 to 780 points and stays there for months, it is a bear market.',
      },
      drawdown: {
        definition:
          'The percentage drop from an account peak to its lowest point before recovering.',
        example:
          'If your account grows to $10,000 and then falls to $7,500, you had a 25% drawdown.',
      },
      benchmark: {
        definition:
          'The simple baseline a strategy is measured against, so its result means something.',
        example:
          'A strategy returning 8% while the benchmark returns 10% underperformed it that year.',
      },
      exposure: {
        definition: 'How much of your account is tied to a particular market or investment.',
        example:
          'With $40,000 of a $100,000 account in technology stocks, technology exposure is 40%.',
      },
      'market timing': {
        definition:
          'Trying to buy just before prices rise and sell just before they fall.',
        example: 'Waiting for the exact bottom before investing is market timing.',
      },
      'transaction cost': {
        definition: 'Any fee paid when buying or selling, including commission and slippage.',
        example: 'A $5 commission on a $1,000 order is a transaction cost of 0.5%.',
      },
      'risk-adjusted return': {
        definition:
          'Profit measured against the risk taken to earn it, so two strategies can be compared fairly.',
        example:
          'If both make 10% but one swung 40% along the way, the calmer one has the better risk-adjusted return.',
      },
      'capital gains tax': {
        definition: 'Tax paid on the profit when an investment is sold for more than it cost.',
        example: 'Buying at $100 and selling at $150 leaves tax due on the $50 gain.',
      },
      'index fund': {
        definition:
          'A fund that holds a basket of securities designed to track a market index.',
        example: 'SPY tracks the S&P 500, so one share holds a slice of five hundred companies.',
      },
      'active trading': {
        definition: 'Frequent buying and selling to profit from short-term price moves.',
        example: 'Several trades a week, driven by news, is active trading.',
      },
    },
  },
  {
    id: 'statistical-mean-reversion',
    name: 'Statistical Mean Reversion',
    category: 'Investing',
    summary:
      'Buys names that have fallen further than their own volatility explains, then holds until the selling pressure clears. Two filters must agree before anything is bought.',
    facts: [
      { label: 'Horizon', value: 'Days to months' },
      { label: 'Activity', value: 'Moderate' },
      { label: 'Positions', value: 'Up to 20' },
      { label: 'Rebalance', value: 'Yearly' },
    ],
    hypothesis:
      'When a stock is sold off harder than its own recent volatility explains, the price tends to drift back toward its average. The strategy only acts when two independent measures agree that the move is unusual for that particular name: RSI below 30 and a z-score below −1.5.',
    whyItWorks: [
      'The two filters answer different questions: RSI counts how one-sided recent moves have been, while the z-score measures distance from the 20-bar average in units of the stock’s own volatility.',
      'Size scales with the dislocation, so a name that is further below its mean gets a larger share of the book than one that has only just crossed the line.',
      'The exit threshold loosens as price stretches further from its mean, so a trade is not forced out while it is still far below.',
    ],
    whyItDoesnt: [
      'A stock can keep falling. Oversold names in a downtrend stay oversold, and the stop three standard deviations below entry is the only defence.',
      'The universe is rebuilt yearly, so the names it may buy are fixed for long stretches even when better candidates appear.',
      'If enough traders run the same two filters, the bounce gets bought earlier and the remaining edge shrinks.',
    ],
    overviewNotes: [
      {
        title: 'Why the two filters have to agree',
        body: 'RSI on its own flags a stock that has fallen quickly; the z-score on its own flags one that sits far from its average. Requiring both removes names that are simply volatile, which is the failure that makes a single indicator look better than it deserves.',
      },
      {
        title: 'What would change our mind',
        body: 'If the average bounce after a two-standard-deviation drop stopped covering the losers bought alongside it, or if costs and crowding ate the difference, the rule would be retired rather than re-tuned until it looked good again.',
      },
    ],
    universe:
      'The 100 most heavily traded names by 252-bar dollar volume, with up to 20 of those slots reserved for ETFs. Rebuilt yearly; a name that is still held stays in until it closes.',
    rebalance:
      'Yearly. Held names keep their place, and the vacancies are filled from the latest liquidity ranking.',
    settings: [
      { label: 'Max positions', value: '20' },
      { label: 'Lots per ticker', value: '1' },
      { label: 'Rebalance', value: 'Yearly' },
      { label: 'Universe', value: '100 names' },
      { label: 'ETF quota', value: '20 slots' },
      { label: 'Liquidity window', value: '252 bars' },
      { label: 'RSI period', value: '25 bars' },
      { label: 'RSI entry', value: 'Below 30' },
      { label: 'RSI exit', value: '70, lowered as price stretches' },
      { label: 'Z-score period', value: '20 bars' },
      { label: 'Z-score entry', value: 'Below −1.5' },
      { label: 'Stop and target', value: '3σ from the entry close' },
    ],
    notes: [
      {
        title: 'How the position size is set',
        body: 'Base size is one twentieth of the book, roughly 5% per name. A logistic confidence term reads the z-score and scales that base up as the dislocation deepens, capped so one name can never take the whole book. A name that has only just crossed −1.5 gets close to base size; one at −3 gets close to double.',
      },
      {
        title: 'How the exit adapts',
        body: 'The default exit is RSI back above 70. That line drops as price sits further from its mean, by two points for each square root of the excess z-score, so a name that is 3 standard deviations below its average leaves earlier than one that is barely stretched. The fixed stop and target are three standard deviations from the entry close.',
      },
      {
        title: 'How a day runs, in order',
        body: 'At the open, orders queued after yesterday’s close are filled, including any stop or target. Each of the 100 names is then checked in turn: already held, skip; RSI at or above 30, skip; z-score above −1.5, skip; otherwise the order is sized and queued for the next open. run_daily is unused here, because the strategy needs nothing beyond each ticker’s own history.',
      },
    ],
    glossary: {
      'z-score': {
        definition:
          'How many standard deviations a price sits from its average over a window.',
        example:
          'A z-score of −2 means the price is two typical wiggles below its 20-bar average.',
      },
      rsi: {
        definition:
          'A 0–100 score of how one-sided recent gains and losses have been.',
        example: 'An RSI of 25 means recent selling has been far heavier than buying.',
      },
      'mean reversion': {
        definition:
          'The idea that a price stretched away from its average tends to drift back toward it.',
        example:
          'A stock two standard deviations below its average is a mean-reversion candidate.',
      },
      'standard deviation': {
        definition: 'The typical size of a price’s wiggle over a window.',
        example:
          'With a standard deviation of $2, a price $6 below its average is three deviations out.',
      },
      oversold: {
        definition:
          'Shorthand for a price that has fallen fast enough to look stretched to the downside.',
        example: 'RSI below 30 is the usual oversold line.',
      },
      liquidity: {
        definition: 'How easily a stock can be traded without moving its own price.',
        example:
          'Ranking by 252-day dollar volume favours names that trade in size every day.',
      },
      'position size': {
        definition: 'The share of the account a single trade uses.',
        example: 'Twenty positions at 5% each would fill the book.',
      },
      universe: {
        definition: 'The list of names a strategy is allowed to buy.',
        example: 'This universe is rebuilt once a year from a liquidity ranking.',
      },
      etf: {
        definition:
          'A fund that trades like a stock and holds a basket of securities.',
        example: 'Up to 20 of the 100 universe slots are reserved for ETFs.',
      },
      stop_loss: {
        definition: 'The price at which a losing trade is closed.',
        example: 'A stop 3 standard deviations below entry sits well outside a normal day’s move.',
      },
    },
  },
];
