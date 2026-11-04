// strategies.ts: the published strategy library, in one place.
//
// The page reads everything from this file: the index list, the three tabs, and
// the glossary annotations. Shapes here are deliberately plain strings, so the
// copy can be edited without touching the layout.
//
// Backtest numbers are not written here. They come from BACKTESTS, generated
// from app/reports, so a rerun of the report script is the only way a figure on
// the page changes.

import type { DetailedPoint, GlossaryTerm } from '../types/strategy';

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
  whyItWorks: DetailedPoint[];
  whyItDoesnt: DetailedPoint[];
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
      'Owns the S&P 500 through a single fund for the entire run. Nothing is bought after the first session, nothing is sold, and no signal has to be right.',
    facts: [
      { label: 'Horizon', value: '10+ years' },
      { label: 'Activity', value: 'Low' },
      { label: 'Positions', value: '1 fund (SPY)' },
      { label: 'Rebalance', value: 'Never' },
    ],
    hypothesis:
      'The index is a claim on the earnings of the largest listed US companies, and those earnings have grown over most long stretches. Holding the index passes that growth to the investor without a forecast, a ranking or a timetable. The strategy does not try to avoid declines. It accepts them in exchange for never missing a recovery, and keeps the cost of participating close to the fund’s own fee.',
    whyItWorks: [
      {
        title: 'The index makes the selection',
        description:
          'No analyst has to identify the next winner in advance. The fund owns every name in the S&P 500, so the small number of companies that produce most of the market’s return are held by default rather than by luck.',
      },
      {
        title: 'Costs stay near the fund fee',
        description:
          'There are no rebalancing trades, no spread paid on repeated entries and exits, and no research budget. The expense ratio is the main recurring cost, and it is charged whether the market rises or falls.',
      },
      {
        title: 'Nothing is sold, so nothing is taxed yet',
        description:
          'Gains stay unrealised and the tax bill waits until the holder chooses to sell. Deferral is not a loophole, but over decades it quietly adds to the compounded result.',
      },
      {
        title: 'There is no rule to second-guess',
        description:
          'A bad month does not create a decision. That removes the most reliable way investors turn a temporary decline into a permanent loss: selling after the fall and buying back after the recovery.',
      },
    ],
    whyItDoesnt: [
      {
        title: 'Every decline arrives in full',
        description:
          'No rule reduces exposure before prices fall, so the account carries the whole peak-to-trough loss. In the dot-com window the index gives back more than a third of its starting value, and the fall from the high is close to half.',
      },
      {
        title: 'No exit means no gain is protected',
        description:
          'Nothing is ever realised or locked in. If the market turns after a long climb, the account keeps the exposure and waits for the next recovery, however long that takes.',
      },
      {
        title: 'Valuation plays no part',
        description:
          'The fund is bought at whatever price the first session offers and is never trimmed when the index looks expensive. The result therefore depends heavily on the starting point of the run, which the holder does not control.',
      },
      {
        title: 'It rests on one long-run assumption',
        description:
          'The approach works while US large-cap earnings keep growing over decades. The sample supports that, but a sample is not a guarantee, and nothing in the holding adapts if the assumption weakens.',
      },
    ],
    overviewNotes: [
      {
        title: 'Why the yardstick is one fund',
        body: 'SPY is a single liquid fund that a real investor can buy, which makes it a fair comparison for any strategy that also has to be bought. Holding every name in the dataset instead would equal-weight thousands of illiquid stocks and end up measuring the data rather than the market.',
      },
      {
        title: 'What the run includes',
        body: 'The backtest buys at the first session it can trade, receives the fund’s cash distributions, and charges the same fill and slippage rules as every other strategy. Nothing is tuned to flatter the benchmark; it is the plain version of the trade.',
      },
      {
        title: 'What would change our mind',
        body: 'If earnings stopped growing over long stretches, or if a simple rule beat this after costs in every window, holding would stop being the sensible default. Until then it remains the number every other strategy has to clear.',
      },
    ],
    universe:
      'SPY only. One liquid S&P 500 fund is bought on the first session the run can trade and never replaced. There is no ranking, no screen and no second position, because the point is to own the market rather than a selection of it.',
    rebalance:
      'None. The holding changes only when the investor adds or withdraws money. The backtest never trims, tops up or rotates, so the equity curve reflects the fund’s own return.',
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
        body: 'Every other strategy on the platform is measured against this one. It is unmanaged market exposure with no timing decisions and no manager, so an active strategy has to beat it after costs before its extra complexity is worth anything.',
      },
      {
        title: 'What it costs to hold',
        body: 'One entry and no exits make trading costs a rounding error against the position. What remains is the fund’s expense ratio, charged every year, plus the tax that is deferred for as long as nothing is sold. Both are small in a single year and material over twenty.',
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
        definition:
          'How quickly and drastically the price of an investment moves up and down over time.',
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
        definition: 'Trying to buy just before prices rise and sell just before they fall.',
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
        definition: 'A fund that holds a basket of securities designed to track a market index.',
        example:
          'SPY tracks the S&P 500, so one share holds a slice of five hundred companies.',
      },
      'expense ratio': {
        definition:
          'The annual fee a fund charges, expressed as a share of the money invested.',
        example: 'A 0.09% expense ratio costs $9 a year on a $10,000 holding.',
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
      'Buys stocks that have fallen further than their own volatility explains, then waits for the selling to exhaust itself. Two independent filters have to agree before a position is opened.',
    facts: [
      { label: 'Horizon', value: 'Days to months' },
      { label: 'Activity', value: 'Moderate' },
      { label: 'Positions', value: 'Up to 20' },
      { label: 'Rebalance', value: 'Yearly' },
    ],
    hypothesis:
      'A sharp sell-off often pushes a price below the level its recent behaviour would justify. When the pressure clears, the price tends to drift back toward its average. The difficult part is telling a dislocation from the beginning of a long decline, so the strategy asks two different measures to agree before it buys, and sizes the position by how far the price has stretched.',
    whyItWorks: [
      {
        title: 'Two filters, two questions',
        description:
          'RSI over 25 bars measures how one-sided the recent gains and losses have been. The z-score measures distance from the 20-bar average in units of the stock’s own standard deviation. A name has to be oversold on both counts, which removes the volatile stocks a single indicator would flag.',
      },
      {
        title: 'Size follows the dislocation',
        description:
          'Each entry starts near one twentieth of the book. A logistic term reads the z-score and increases that share as the price moves further below its average, so the deepest dislocations receive close to double the base size while the cap keeps one name from taking the whole book.',
      },
      {
        title: 'The exit loosens as the price stretches',
        description:
          'The default exit is RSI back above 70. That threshold falls by two points for each square root of the excess z-score, so a trade three standard deviations below its mean is allowed to leave earlier than one that has barely crossed the entry line.',
      },
      {
        title: 'The universe is built for fills',
        description:
          'The book is restricted to the 100 most heavily traded names by 252-bar dollar volume, with up to 20 ETF slots. A signal only matters if the position can be entered and exited at a realistic price, and that screen keeps the strategy in names where it can.',
      },
    ],
    whyItDoesnt: [
      {
        title: 'Oversold can stay oversold',
        description:
          'A stock in a sustained decline keeps meeting the entry conditions while it falls. The stop three standard deviations below the entry close is the only defence, and a gap through that level fills well below it.',
      },
      {
        title: 'The menu changes once a year',
        description:
          'The universe is rebuilt yearly and held names stay in until they close. A better candidate that appears in March waits for the next rebuild, so the opportunity set is fixed for long stretches.',
      },
      {
        title: 'The edge is visible to everyone',
        description:
          'Two widely followed indicators are not a secret. If enough traders buy the same bounce, it is bought earlier and the remaining move is smaller than the backtest assumed.',
      },
      {
        title: 'The stop and target are symmetrical',
        description:
          'Both sit three standard deviations from the entry close, which ignores the shape of the distribution. A quiet name and a violent one receive the same distance, and the violent one is more likely to gap through it.',
      },
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
      'The 100 most heavily traded names by 252-bar dollar volume, with up to 20 of those slots reserved for ETFs. The list is rebuilt yearly. A name that is still held keeps its place until the position closes, then the vacancy is filled from the latest ranking.',
    rebalance:
      'Yearly. The strategy keeps every name it still holds, then fills the remaining slots from the latest liquidity ranking. Nothing is sold simply because it slipped in the ranking while a position is open.',
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
          'A 0 to 100 score of how one-sided recent gains and losses have been.',
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
        definition: 'A fund that trades like a stock and holds a basket of securities.',
        example: 'Up to 20 of the 100 universe slots are reserved for ETFs.',
      },
      stop_loss: {
        definition: 'The price at which a losing trade is closed.',
        example:
          'A stop 3 standard deviations below entry sits well outside a normal day’s move.',
      },
      dislocation: {
        definition:
          'A price move large enough to sit outside the range a stock’s own volatility would suggest.',
        example:
          'A name three standard deviations below its average is dislocated from its recent behaviour.',
      },
      'sell-off': {
        definition: 'A sharp run of selling that pushes a price down quickly.',
        example: 'A 15% fall over four sessions is a sell-off.',
      },
    },
  },
  {
    id: 'momentum-20',
    name: 'Momentum 20',
    category: 'Trading',
    summary:
      'Holds the 20 strongest liquid US stocks while the S&P 500 is above its 200-day average, and moves the entire book to cash when it is not.',
    facts: [
      { label: 'Horizon', value: 'Months' },
      { label: 'Activity', value: 'High' },
      { label: 'Positions', value: 'Up to 20' },
      { label: 'Rebalance', value: 'Monthly' },
    ],
    hypothesis:
      'Relative strength persists over intermediate horizons because information spreads slowly and investors tend to chase performance they have already seen. The strategy ranks liquid US stocks on 12-month return with the latest month removed, divides that return by the stock’s own volatility, and only takes the bet while the index itself is in an uptrend. The result is a book that is either fully invested in leaders or entirely in cash.',
    whyItWorks: [
      {
        title: 'The ranking skips the latest month',
        description:
          'The score compares the close from 21 bars ago with the close from 252 bars ago. Dropping the most recent month avoids the short-term reversal that often hits the freshest winners, while the remaining year still captures the trend the strategy is trying to own.',
      },
      {
        title: 'Volatility is part of the score',
        description:
          'A 40% climb with 20% volatility ranks above the same climb with 60% volatility, because the second move is far more likely to give the gain back. Names above a 60% annualized ceiling are removed entirely rather than merely ranked lower.',
      },
      {
        title: 'The filter cuts exposure before the long decline',
        description:
          'SPY below its 200-day average empties the target list and queues every open lot for the next open. The rule is slow and will never sell the exact top, but it keeps the book out of the part of a bear market that does the most damage.',
      },
      {
        title: 'Liquidity and a buffer keep turnover honest',
        description:
          'A $75 million average daily dollar-volume floor keeps the book in names that can actually be traded. The top-40 buffer means a held name is not sold the moment it slips to 21st, which cuts turnover without changing the entry list.',
      },
    ],
    whyItDoesnt: [
      {
        title: 'Momentum crashes',
        description:
          'When the market snaps back, the names that led the fall can rip higher while the book is still in cash. The 200-day filter is especially exposed to a sharp reversal, because it sells after the drop and buys back after the bounce.',
      },
      {
        title: 'The filter whipsaws in a sideways market',
        description:
          'A one-month dip below the 200-day average that immediately reverses becomes a sell-low, buy-high round trip. The cost is not only the spread but the days of the recovery that are missed.',
      },
      {
        title: 'Twenty names is concentrated',
        description:
          'One earnings shock can cost more than a broad index fund would lose. The volatility ceiling helps, but it does not turn a 20-stock book into a diversified portfolio.',
      },
      {
        title: 'Monthly turnover has a tax bill the backtest does not show',
        description:
          'Short-term gains and transaction costs are charged in the run, but taxes on realised gains are not modelled. A taxable investor keeps less than the curve suggests.',
      },
    ],
    overviewNotes: [
      {
        title: 'Why the volatility ceiling is there',
        body: 'A plain 12-month momentum screen kept buying parabolic stocks in 2020 and 2021, then held them through 50% to 70% falls. The 60% annualized volatility ceiling is deliberately loose. It does not turn this into a low-volatility fund, it just refuses the names whose own price action says the move is a lottery ticket.',
      },
      {
        title: 'What would change our mind',
        body: 'If the strategy stopped beating the index over a full cycle after costs, or if the volatility filter only worked in the one window it was fitted to, the rules would be retired rather than re-tuned until the curve looked good again.',
      },
    ],
    universe:
      'US common stocks with at least 252 bars, a close above $5, and at least $75 million of average daily dollar volume over the last 63 sessions. ETFs are excluded. SPY is used only as the market filter and is never held.',
    rebalance:
      'Monthly. The book is rebuilt from the latest ranking, with a top-40 buffer for names already held. Exits queue for the next open, then the vacant slots are filled from the new target list.',
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
        body: 'When SPY closes below its 200-day average, the target list is emptied and every open lot is queued for the next open. The strategy does not try to pick the bottom or hold a defensive sleeve. It sits in cash until the index reclaims the average.',
      },
      {
        title: 'Why the book keeps a cash buffer',
        body: 'Each position is 1/22 of the book, about 4.5%, so 20 full slots leave roughly 9% in cash. The gap covers entry fees and the difference between the price used to size an order and the price it actually fills at.',
      },
      {
        title: 'How a day runs, in order',
        body: 'At the open, exits queued yesterday fill first, then entries. The monthly rebalance ranks the universe and refreshes the target list. Each target is checked once: already held, skip; market filter off, skip; no slot, skip; otherwise queue a 4.5% order for the next open. Stops and targets are not used. A name leaves when it drops out of the top 40 or the market filter turns off.',
      },
    ],
    glossary: {
      momentum: {
        definition:
          'The tendency of recent winners to keep winning for a while, and recent losers to keep losing.',
        example: 'A stock up 40% over the past year is a momentum candidate.',
      },
      'relative strength': {
        definition:
          'A stock’s own return compared with the rest of the market or with its own past, used to rank leaders.',
        example:
          'A stock up 30% while the index is flat has strong relative strength.',
      },
      volatility: {
        definition:
          'How much a price moves around over a window, usually quoted as an annualized percentage.',
        example:
          'A stock with 60% volatility typically moves much more than one with 20%.',
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
      'bear market': {
        definition:
          'A prolonged period when market prices fall, usually 20% or more from recent highs.',
        example:
          'The 2007 to 2009 decline took the S&P 500 down more than 50%, a severe bear market.',
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
          'Twenty positions at 4.5% each leave roughly 9% in cash for fees and rebalancing.',
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
        definition:
          'A rule that cuts exposure when the broad market is in a downtrend.',
        example: 'SPY below its 200-day average turns this strategy to cash.',
      },
      'momentum crash': {
        definition:
          'A sharp reversal in which the stocks that led the market higher fall hardest.',
        example:
          'In early 2021, crowded momentum names gave back a year of gains in weeks.',
      },
    },
  },
  {
    id: 'global-trend-allocation',
    name: 'Global Trend Allocation',
    category: 'Investing',
    summary:
      'Builds a five-ETF book from trend, correlation and relative momentum, and exits each sleeve when its own trend breaks. The matrix is rebuilt monthly; every entry is sized at 19.9% of the book.',
    facts: [
      { label: 'Horizon', value: 'Months to years' },
      { label: 'Activity', value: 'Moderate' },
      { label: 'Positions', value: 'Up to 5 ETFs' },
      { label: 'Rebalance', value: 'Monthly' },
    ],
    hypothesis:
      'A trend that has held for ten months is more likely to continue than to reverse, and a book spread across assets that do not move together can survive the failure of one sleeve. The strategy ranks liquid ETFs, keeps only those above their own ten-month average, isolates a second sleeve with low correlation to the first, then fills the remaining slots with one-year momentum leaders and a gold-or-Treasury haven. Each position is held while its own trend holds.',
    whyItWorks: [
      {
        title: 'The ten-month average is the gate',
        description:
          'Every pick has to close above its own 210-bar average before it can enter the book. A held name is sold when its close falls back below that line, even between monthly rebuilds. The filter is slow, but it keeps the book out of assets that are already in a downtrend.',
      },
      {
        title: 'The second sleeve has to be uncorrelated',
        description:
          'After the first pick, the strategy looks for an ETF whose daily returns have an absolute correlation of 0.20 or less with it over up to 252 bars. A negative correlation is as useful as a low positive one: both make the second sleeve respond differently to the same market shock.',
      },
      {
        title: 'Momentum chooses the middle',
        description:
          'The third and fourth picks are the best and second-best one-year returns among the remaining ETFs that are still above their ten-month average. Relative strength fills the slots that the trend and correlation tests leave open.',
      },
      {
        title: 'The haven slot is deliberately narrow',
        description:
          'The fifth slot can only go to GLD or TLT. The strategy compares their three-month returns and takes the stronger one, provided it is still above its ten-month average. The rule gives the book a defensive sleeve without opening the universe to every bond or commodity fund.',
      },
      {
        title: 'Five equal sleeves keep the book simple',
        description:
          'Each entry asks for 19.9% of equity, so five full positions use 99.5% of the book and the remainder stays in cash. The cap prevents a sixth position and keeps the portfolio from taking leverage through a larger single order.',
      },
    ],
    whyItDoesnt: [
      {
        title: 'Five sleeves is still a concentrated book',
        description:
          'One ETF can be a fifth of the portfolio. A shock in a single country, sector or asset class is large enough to dominate the result, even when the five holdings look different on paper.',
      },
      {
        title: 'Trailing correlation is not crisis correlation',
        description:
          'The 0.20 test is measured over past daily returns. Assets that looked independent in a calm sample can fall together in a liquidation, which is exactly when the second sleeve is supposed to help.',
      },
      {
        title: 'The trend filter is slow',
        description:
          'A 210-bar average turns only after the price has already moved. A sharp reversal can leave the book in a falling asset until the close breaks the line, and the exit fills at the next open. A brief break can also sell a holding just before it recovers.',
      },
      {
        title: 'The first pick narrows the rest',
        description:
          'The matrix is sequential. The first trend anchor constrains which ETF can fill the second slot, and those two choices constrain the momentum and haven slots. A better combination can be excluded because an earlier pick consumed the position.',
      },
      {
        title: 'Cash is a position',
        description:
          'When fewer than five ETFs pass, the unused slots stay in cash. That helps in a broad decline, but it is a drag in a rally where the missing sleeve would have participated. The strategy does not force a pick to stay fully invested.',
      },
    ],
    overviewNotes: [
      {
        title: 'How the five picks are made',
        body: 'The universe is ranked by median 30-bar dollar volume. Pick one is the highest-ranked ETF above its 210-bar average. Pick two is the next ETF above that average whose returns are weakly correlated with pick one. Picks three and four are the strongest one-year returns among the remaining trend-positive ETFs. Pick five is the stronger three-month return of GLD and TLT, if it is also above its 210-bar average. Duplicates are removed before the list reaches the engine.',
      },
      {
        title: 'Why the correlation test is absolute',
        body: 'The strategy is looking for a sleeve that does not duplicate the first one, not for a positive relationship. An absolute threshold accepts a low positive correlation and a negative one on the same terms. That is why a bond or gold fund can qualify as the second pick when it is moving against equities.',
      },
      {
        title: 'Why the last fill can be refused',
        body: 'Five entries at 19.9% add up to 99.5%, leaving half a percent for fees. Earlier fills still consume cash before the last one is sized, so the fifth entry can be refused when the remaining cash is below 19.9% of equity. The rejection is recorded in the run rather than hidden by resizing the order.',
      },
      {
        title: 'What would change our mind',
        body: 'If the trend and correlation filters stopped reducing drawdown across the reported windows, or if the five-sleeve book no longer beat a simpler allocation after costs, the rules would be retired rather than re-tuned until the curve looked better.',
      },
    ],
    universe:
      'Fourteen liquid ETFs: SPY, QQQ, IWM, EFA, EEM, VNQ, DBC, GLD, TLT, IEF, LQD, HYG, AGG and UUP. They are ranked by median 30-bar dollar volume, and only ETFs are eligible. The list is fixed; the strategy selects from it rather than rebuilding a stock universe.',
    rebalance:
      'Monthly. The matrix is rebuilt at the first session after the month changes. A name that drops out is queued for exit, and an open name is also sold as soon as its close falls below its 210-bar average. Both exits fill at the next open.',
    settings: [
      { label: 'Max positions', value: '5' },
      { label: 'Lots per ticker', value: '1' },
      { label: 'Rebalance', value: 'Monthly' },
      { label: 'Universe', value: '14 ETFs' },
      { label: 'Ranking', value: '30-bar median dollar volume' },
      { label: 'Trend filter', value: '210-bar SMA' },
      { label: 'Correlation threshold', value: 'Absolute 0.20' },
      { label: 'Momentum window', value: '252 bars' },
      { label: 'Haven window', value: '63 bars' },
      { label: 'Position size', value: '19.9% of equity' },
      { label: 'Order sizing', value: 'EQUITY' },
      { label: 'Stops and targets', value: 'None' },
      { label: 'Minimum history', value: '252 bars' },
    ],
    notes: [
      {
        title: 'How a day runs, in order',
        body: 'At the open, exits and entries queued yesterday fill first. Each open lot then updates its rolling 210-bar average from the latest history. On a monthly rebuild, the selection matrix refreshes the target list. Each target is checked once: already held, skip; otherwise queue a 19.9% order for the next open. should_exit closes a name that has left the matrix or whose close has fallen below its ten-month average.',
      },
      {
        title: 'Why the strategy holds cash',
        body: 'The matrix can return fewer than five names when the trend or correlation tests fail. The empty slots are not filled with a default ETF. That cash is a deliberate position, not an accounting leftover, and it is the main reason the book can lag a rising market.',
      },
      {
        title: 'What the backtest includes',
        body: 'The reported windows use daily closes, next-open fills, 0.05% slippage, a 0.1% fee per side and cash dividends. The run does not model fund expense ratios or taxes on realised gains, so a taxable account would keep less than the curve shows.',
      },
    ],
    glossary: {
      trend: {
        definition:
          'The direction a price has been moving over a window, used here as a filter rather than a forecast.',
        example: 'An ETF above its 210-bar average is in an uptrend for this strategy.',
      },
      'ten-month average': {
        definition:
          'The average closing price over the last 210 trading sessions, roughly ten months.',
        example: 'A close below the ten-month average queues the position for exit.',
      },
      correlation: {
        definition:
          'A measure of how closely two return series move together, from −1 to +1.',
        example:
          'A correlation near zero means the second ETF adds a different return stream.',
      },
      momentum: {
        definition:
          'The tendency of recent winners to keep winning for a while, measured here by one-year return.',
        example: 'The ETF with the highest 252-bar return can fill the third slot.',
      },
      etf: {
        definition: 'A fund that trades like a stock and holds a basket of securities.',
        example: 'SPY, QQQ and TLT are the kinds of ETFs this strategy ranks.',
      },
      haven: {
        definition:
          'A defensive sleeve intended to hold up when the growth assets fall.',
        example: 'GLD or TLT fills the fifth slot when it passes the trend test.',
      },
      drawdown: {
        definition: 'The percentage drop from a peak to the lowest point before a new peak.',
        example: 'A book that falls from 120 to 108 has a 10% drawdown.',
      },
      whipsaw: {
        definition:
          'A signal that flips just after the trade, so the strategy sells low and buys back higher.',
        example:
          'A close just below the ten-month average that reverses the next week is a whipsaw.',
      },
      cash: {
        definition: 'The part of the book that is not invested in a position.',
        example: 'Four positions at 19.9% leave roughly 20% in cash.',
      },
      'relative strength': {
        definition:
          'One asset’s return compared with the other assets in the same universe.',
        example: 'The top one-year return among the remaining ETFs gets the third slot.',
      },
    },
  },
];
