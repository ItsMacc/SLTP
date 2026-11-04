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
  {
    id: 'momentum-20',
    name: 'Momentum 20',
    category: 'Trading',
    summary:
      'Buys the 20 strongest liquid US stocks and moves the whole book to cash when the S&P 500 loses its 200-day trend.',
    facts: [
      { label: 'Horizon', value: 'Months' },
      { label: 'Activity', value: 'High' },
      { label: 'Positions', value: 'Up to 20' },
      { label: 'Rebalance', value: 'Monthly' },
    ],
    hypothesis:
      'Stocks that have outperformed over the past year tend to keep outperforming for a few more months, because investors underreact to new information and then chase the move. The strategy only takes that bet in liquid shares, sizes the signal by volatility, and steps aside when the index itself is below its 200-day average.',
    whyItWorks: [
      'The 12-month ranking skips the latest month, avoiding the short-term reversal that often hits the freshest winners.',
      'Dividing the return by 126-day volatility favours a steady climb over a single parabolic move, and the 60% volatility ceiling removes the stocks most likely to give the whole gain back.',
      'The $75 million dollar-volume floor keeps the book in names that can actually be traded, while the 200-day market filter cuts exposure before a long decline turns into a portfolio problem.',
      'The top-40 buffer means a held name is not sold the moment it slips to 21st; it has room to recover without adding turnover.',
    ],
    whyItDoesnt: [
      'Momentum crashes. When the market snaps back, the names that led the fall can rip higher while this book is still in cash.',
      'The 200-day filter is slow at the top and whipsaws in a sideways market: it can sell after the drop and buy back after the bounce.',
      'Twenty names is concentrated. One earnings shock can cost more than a broad index fund would lose.',
      'Monthly turnover creates short-term gains and transaction costs; the backtest charges both, but taxes are not modelled.',
    ],
    overviewNotes: [
      {
        title: 'Why the volatility ceiling is there',
        body: 'A plain 12-month momentum screen kept buying parabolic stocks in 2020 and 2021, then held them through 50-70% falls. The 60% annualized volatility ceiling is deliberately loose: it does not turn this into a low-volatility fund, it just refuses the names whose own price action says the move is a lottery ticket.',
      },
      {
        title: 'What would change our mind',
        body: 'If the strategy stopped beating the index over a full cycle after costs, or if the volatility filter only worked in the one window it was fitted to, the rules would be retired rather than re-tuned until the curve looked good again.',
      },
    ],
    universe:
      'US common stocks with at least 252 bars, a close above $5 and at least $75 million of average daily dollar volume over the last 63 sessions. ETFs are excluded; SPY is used only as the market filter.',
    rebalance:
      'Monthly. The book is rebuilt from the latest ranking, with a top-40 buffer for names already held.',
    settings: [
      { label: 'Max positions', value: '20' },
      { label: 'Lots per ticker', value: '1' },
      { label: 'Rebalance', value: 'Monthly' },
      { label: 'Lookback', value: '12 months, skipping 1' },
      { label: 'Score', value: '12-1 return ÷ 126-day volatility' },
      { label: 'Max volatility', value: '60% annualized' },
      { label: 'Liquidity floor', value: '$75M average daily volume' },
      { label: 'Market filter', value: 'SPY above its 200-day average' },
      { label: 'Position size', value: '1/22 of the book, about 4.5%' },
      { label: 'Buffer', value: 'Top 40 names' },
      { label: 'Stops', value: 'None; the market filter is the exit' },
      { label: 'Minimum history', value: '252 bars' },
    ],
    notes: [
      {
        title: 'How the score is built',
        body: 'For each stock, the strategy takes the close from 21 bars ago and divides it by the close from 252 bars ago. That is the 12-month return with the latest month removed. It then divides that return by the annualized standard deviation of daily returns over the last 126 bars. A stock that climbed 40% with 20% volatility scores higher than one that climbed 40% with 60% volatility.',
      },
      {
        title: 'What happens when the filter turns off',
        body: 'When SPY closes below its 200-day average, the target list is emptied and every open lot is queued for the next open. The strategy does not try to pick the bottom or hold a defensive sleeve; it sits in cash until the index reclaims the average.',
      },
      {
        title: 'How a day runs, in order',
        body: 'At the open, exits queued yesterday fill first, then entries. The monthly rebalance ranks the universe and refreshes the target list. Each target is checked once: already held, skip; market filter off, skip; no slot, skip; otherwise queue a 4.5% order for the next open. Stops and targets are not used; a name leaves when it drops out of the top 40 or the market filter turns off.',
      },
    ],
    glossary: {
      momentum: {
        definition:
          'The tendency of recent winners to keep winning for a while, and recent losers to keep losing.',
        example: 'A stock up 40% over the past year is a momentum candidate.',
      },
      volatility: {
        definition:
          'How much a price moves around over a window, usually quoted as an annualized percentage.',
        example: 'A stock with 60% volatility typically moves much more than one with 20%.',
      },
      '200-day average': {
        definition:
          'The average closing price over the last 200 trading days, a common long-term trend line.',
        example: 'SPY above its 200-day average is the risk-on state for this strategy.',
      },
      drawdown: {
        definition: 'The percentage drop from a peak to the lowest point before a new peak.',
        example: 'A book that goes from 120 to 90 has a 25% drawdown.',
      },
      whipsaw: {
        definition:
          'A signal that flips just after you act, so you sell low and buy back higher.',
        example:
          'A one-month dip below the 200-day average that immediately reverses is a whipsaw.',
      },
      liquidity: {
        definition: 'How easily a stock can be traded without moving its own price.',
        example:
          'A $75 million daily dollar-volume floor keeps the book in liquid names.',
      },
      'position size': {
        definition: 'The share of the account one holding uses.',
        example:
          'Twenty positions at 4.5% each leave roughly 10% in cash for fees and rebalancing.',
      },
      universe: {
        definition: 'The list of stocks a strategy is allowed to buy.',
        example:
          'This universe is every US stock that passes the price and liquidity floors.',
      },
      'transaction cost': {
        definition: 'Fees and slippage paid when buying or selling.',
        example: 'The backtest charges 0.1% per fill plus 0.05% slippage.',
      },
      'market filter': {
        definition: 'A rule that cuts exposure when the broad market is in a downtrend.',
        example: 'SPY below its 200-day average turns this strategy to cash.',
      },
    },
  },
];
