// strategyOutlook.ts — what each strategy is expected to do, and what the eight
// reported windows actually showed.
//
// The backtest table in data/backtestResults.ts is generated. This file is the
// editorial read of it: the prediction a reader should hold before looking at a
// chart, then the honest summary of where the window results met it and where
// they did not. A strategy is allowed to disappoint its own hypothesis here,
// because saying so is more useful than picking a window that flatters it.
//
// Figures quoted below come from that table. A rerun of
// backend/scripts/regime_report.py can move them, so check the numbers against
// backtestResults.ts when either file changes.

export interface StrategyOutlook {
  /** What the rules are built to deliver, before any result is read. */
  expectation: string;
  /** What the eight windows showed, one short paragraph each. */
  windows: string[];
}

export const OUTLOOK: Record<string, StrategyOutlook> = {
  'buy-and-hold': {
    expectation:
      'Nothing here tries to be clever. The fund is bought once and the money stays in the market through every fall and every recovery, so the curve is the market’s curve with the fund fee taken out. Over a decade, expect roughly the index return and nothing more. In a bad decline, expect to give back close to half the account at the worst point, because nothing in the rules sells, hedges or takes a profit on the way down. The plan is to ride the wave and accept its full height.',
    windows: [
      'The declines arrive in full. The financial crisis takes 54.2% off the account at the worst point and finishes near 54 against a start of 100; the dot-com bust falls 46.7% and finishes near 62. The recoveries compound without interruption, 17.8% a year in the slow recovery and 31.7% in the reopening, and three of those four windows never give back more than 10%, with the AI rally the exception at 18.3%.',
      'That imbalance is the whole trade. One severe decline costs several years of the gains that follow it, which is why this strategy is judged over decades and why every other page here has to clear it.',
    ],
  },

  'statistical-mean-reversion': {
    expectation:
      'The rule buys stocks that have fallen further than their own volatility explains, then waits for the selling to stop. Expect it to lag the index through most of a recovery: the strongest names keep climbing, and a stock that is already leading rarely stretches far enough to qualify. Expect it to earn its keep instead in falls that reverse quickly, where an indiscriminate drop hands it a long list of candidates. Two conditions decide whether it works in any given window: the fall is not systemic, and the snap back arrives while the positions are still open.',
    windows: [
      'The declines are where it earns its place. It beats the index in three of the four, 4.4% a year through the dot-com bust against a 13.6% annual loss for the index, 5.6% through the 2022 fall against 5.9% the other way, and level with it through the COVID crash. The recoveries are the other side of the same coin, and the gaps are wide: 4.8% against 17.8%, 0.8% against 31.7%, 7.3% against 14.1%.',
      'The financial crisis is where the idea breaks rather than the implementation. It finished level with the index at 55 against 54 but carried the deepest drawdown on the page, 61%, because it bought the fall the whole way down and the snap back arrived after the window closed. Catching a dislocation only pays when the dislocation ends, and a systemic crash gives no schedule for that.',
      'So this is not a hedge, and the bear-market case for it is weaker than the pitch suggests. What it does have is a real edge in a fast fall that reverses. Whether that is worth the long stretches behind a rising market is a judgement the numbers do not settle for us.',
    ],
  },

  'adaptive-momentum': {
    expectation:
      'Own the 20 strongest liquid stocks while the S&P 500 is above its 200-day average, and hold cash when it is not. In a sustained rally expect to beat the index, because the book is concentrated in the names already moving. In a decline expect the filter to cut most of the damage, though it sells after the drop and buys back after the bounce. Expect drawdowns to stay in a narrow band in the mid-teens to low twenties whatever the market does, and expect roughly one window in four to lag because the filter flipped at the wrong moment.',
    windows: [
      'The rallies hold up. It beats the index in three of the four recoveries, 23.4% against 17.8%, 35.6% against 31.7% and 23.0% against 22.4%, and in three of the four declines, including a 5.9% gain through the dot-com bust while the index lost 13.6% a year.',
      'The misses are the useful part. It trails in the mid-2000s bull, 11.6% against 14.1%, and its drawdown there is 23.4% against 7.4%: twenty names give back more than an index when their own leaders wobble. In the 2022 window it also finishes behind the index, which is the outcome the filter exists to prevent.',
      'Consistency is what actually shows up. No drawdown in the sample is worse than 23.4%, and no window loses more than 16% a year even in the two worst bears. The price is the occasional stretch of lagging a rising market.',
    ],
  },

  'global-trend-allocation': {
    expectation:
      'Five ETFs, each judged on its own trend, and a sleeve that steps aside when its trend breaks. Expect the worst fall to land under 20% even in a window where the index loses half its value, because a broken trend takes that sleeve to cash before the damage compounds. Expect to trail the index by several points a year in a strong rally, because a rule that waits for a ten-month average to turn is late to every turn and holds some cash on the way up. Risk first, return second, and expect the book to lag when US large caps lead because it owns other things too.',
    windows: [
      'The declines behave as planned. The worst fall across all eight windows is 16.3%, against 54.2% for the index in the financial crisis, and three of the four declines finish within 8% of where they started, with the dot-com bust the exception at 13% below. The price is visible in the recoveries, where it trails the index in all four, from 5.7% against 17.8% in the slow recovery to 12.6% against 31.7% in the reopening.',
      'The mid-2000s bull is the window that did not follow the plan. Its 16.3% drawdown there came while the market itself fell only 7.4%, so the fall came from sleeves rotating out and back in rather than from the market. That is the cost of holding several assets instead of one, and it gives up some of the index’s calm as well as some of its return.',
    ],
  },

  'minimum-volatility': {
    expectation:
      'Thirty of the least volatile liquid US stocks, equal weighted and rebuilt quarterly. Expect a fifth to a third less drawdown than the index in an ordinary decline, and expect to trail it by several points a year in a strong rally. Expect no protection at all from a shock that hits every stock at once: there is no filter here, so the account is fully invested on the worst day as well as the best.',
    windows: [
      'The ordinary declines go as planned. It loses less than the index in three of the four: 36.5% against 54.2% in the financial crisis, 4.2% against 5.9% in the 2022 fall, and 25.4% against 46.7% in the dot-com bust. It trails the index in all four recoveries, from 9.3% against 22.4% in the AI-led rally to 11.9% against 31.7% in the reopening.',
      'The COVID crash is the window that breaks the premise. The book fell further than the index, finishing near 83 against 93 with a 35% drawdown, because the calmest names were not the safest ones that spring. A low-volatility screen is a statement about ordinary markets, not a crash helmet.',
    ],
  },
};
