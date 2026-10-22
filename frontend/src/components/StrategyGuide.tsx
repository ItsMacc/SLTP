// StrategyGuide.tsx — Long-form strategy guide chapters

import { GlossaryText } from './GlossaryText'
import { STRATEGY_GLOSSARY } from '../../lib/glossary'
import './StrategyGuide.css'

export default function StrategyGuide() {
  return (
    <section className="stg-guide">
      <h2 className="stg-title">Reading the performance panel</h2>
      <p className="stg-deck">
        A backtest produces more numbers than anyone can hold in their head at once.
        This guide walks through each one, what it measures, and how to read it next
        to a strategy's own results.
      </p>

      <div className="stg-flow">
        <article className="stg-chapter" data-num="01">
          <h3 className="stg-chapter-title">What a strategy actually is</h3>
          <p className="stg-copy">
            A <GlossaryText text="strategy is a set of rules that decides what to buy, when to sell, and when to look again." glossary={STRATEGY_GLOSSARY} />
            Nothing more. A rule might be as blunt as <em>hold the ten healthiest stocks
            and review them every Monday</em>, or as precise as a price crossing a moving
            average on rising volume.
          </p>
          <p className="stg-copy">
            The point of writing the rules down is that the computer then follows them
            without hesitation. People are good at reasoning and bad at consistency:
            fear shows up in a drawdown, and excitement shows up in a rally. A rule set
            removes that. It applies the same test on a quiet Tuesday in March as it
            does on the day the market falls eight percent.
          </p>
        </article>

        <article className="stg-chapter" data-num="02">
          <h3 className="stg-chapter-title">The universe</h3>
          <p className="stg-copy">
            Before any rule can fire, a strategy needs a defined set of assets to work
            with. That set is its <strong><GlossaryText text="universe" glossary={STRATEGY_GLOSSARY} /></strong>. It might be
            the 25 most liquid stocks on an exchange, or every share in a broad index.
            Anything outside the universe is invisible to the strategy, no matter how
            tempting the price action looks.
          </p>
          <p className="stg-copy">
            The universe is not a detail to skip. A strategy that works on a hand-picked
            list of large, liquid companies is being judged on a much easier problem
            than one working across the whole market. When you compare results, check
            that both runs were allowed to trade the same things.
          </p>
        </article>

        <div className="stg-chapter" data-num="03">
          <h3 className="stg-chapter-title">Investing and trading are different jobs</h3>
          <p className="stg-copy">
            Strategies on SLTP are sorted into two families. Knowing which one you are
            looking at tells you how to judge its risk, its costs, and its timeline.
          </p>
          <div className="stg-duo">
            <div className="stg-duo-card is-invest">
              <p className="stg-duo-tag">Long-Term Horizon</p>
              <h4 className="stg-duo-title">Investing</h4>
              <p className="stg-duo-copy">
                Held for years at a time, usually because the business itself is
                expected to grow. Day-to-day price swings are treated as noise. Trading
                rarely happens, so fees and taxes stay small and the return has room
                to compound.
              </p>
            </div>
            <div className="stg-duo-card is-trade">
              <p className="stg-duo-tag">Short-Term Execution</p>
              <h4 className="stg-duo-title">Trading</h4>
              <p className="stg-duo-copy">
                Held for days, hours, or minutes, aiming to profit from movement
                rather than from a company's growth. More decisions means more
                attention, and costs matter more: fees and slippage take a larger bite
                out of a smaller profit.
              </p>
            </div>
          </div>
          <p className="stg-copy">
            Neither is the better one. Investing is built for accumulation over a long
            horizon. Trading is built for reacting to price. A strategy is only
            reasonable if its approach matches the goal you have in mind.
          </p>
        </div>

        <article className="stg-chapter" data-num="04">
          <h3 className="stg-chapter-title">What a backtest does</h3>
          <p className="stg-copy">
            A <GlossaryText text="backtest" glossary={STRATEGY_GLOSSARY} /> replays a strategy over recorded
            market history. The engine walks forward one trading day at a time and
            applies the rules using only the information that existed on that day,
            which is what keeps <GlossaryText text="forward-looking bias" glossary={STRATEGY_GLOSSARY} /> out of the
            result. Every order, fill, and fee is written down as it happens.
          </p>
          <p className="stg-copy">
            The output is an equity curve: the account balance after every session.
            A backtest cannot promise what happens next, but it does show how a set of
            rules behaved under real conditions, including the drawdowns, the losing
            streaks, and the costs nobody remembers to include in a chart.
          </p>
          <p className="stg-copy">
            A strategy that holds up across a bull market, a crash, and a sideways
            stretch tells you more than one that only works in a single favourable
            year. Look for that consistency before you look at the headline return.
          </p>
        </article>

        <article className="stg-chapter" data-num="05">
          <h3 className="stg-chapter-title">Why the chart starts at 100</h3>
          <p className="stg-copy">
            Some tools plot the raw balance, so a $10,000 account that ends at $12,500
            looks better than a $1,000 account that ends at $1,250, even though both
            grew by exactly the same 25 percent. Comparing balances like that compares
            account size, not performance.
          </p>
          <p className="stg-copy">
            To avoid it, backtests are usually plotted as an index. The starting balance
            is set to <strong><GlossaryText text="base 100" glossary={STRATEGY_GLOSSARY} /></strong> and every later
            value is expressed as a percentage of it. An ending value of 110 means a
            ten percent gain; 92 means an eight percent loss.
          </p>
          <div className="stg-example">
            Indexed comparison:
            - A $2,000 account ending at an index value of 110 grew to $2,200 (+10%).
            - A $500,000 account ending at an index value of 110 grew to $550,000 (+10%).
            The index shows the same rate of return for both.
          </div>
          <div className="stg-sign">
            <p>
              <strong>Read the ending value first.</strong> Above 100 means the rules
              made money over the period. Below 100 means they lost it. Exactly 100
              means they broke even.
            </p>
          </div>
        </article>

        <article className="stg-chapter" data-num="06">
          <h3 className="stg-chapter-title">CAGR: the yearly pace</h3>
          <p className="stg-copy">
            A single total return hides how long it took. $100 growing to $110 and then
            to $130 is a thirty percent total return, but the second year started from
            $110, not $100. Dividing the total by the number of years would therefore
            overstate the pace.
          </p>
          <p className="stg-copy">
            The <strong><GlossaryText text="Compound Annual Growth Rate (CAGR)" glossary={STRATEGY_GLOSSARY} /></strong> is the
            constant yearly rate that would take the starting value to the ending
            value, with compounding included. It is the standard way to compare a
            five-year result with a fifteen-year one.
          </p>
          <div className="stg-example">
            Initial Capital: 100 | Year 1: 110 | Year 2: 130
            Total Return: 30.0%
            CAGR: ~14.0% per year (100 × 1.14 × 1.14 ≈ 130)
          </div>
          <p className="stg-copy">
            Here is the same 10 percent yearly rate, compounded, over ten years:
          </p>
          <div className="stg-example">
            Year 1:  110.0 | Year 6:  177.2
            Year 2:  121.0 | Year 7:  194.9
            Year 3:  133.1 | Year 8:  214.4
            Year 4:  146.4 | Year 9:  235.8
            Year 5:  161.1 | Year 10: 259.4
            Total 10-Year Growth: +159.4%
          </div>
          <p className="stg-copy">
            Push that to twenty years and the starting 100 becomes roughly 672.7. The
            later years carry the most of the growth, which is the practical argument
            for starting early and staying invested.
          </p>
          <div className="stg-sign">
            <p>
              <strong>A CAGR above 10 percent over a multi-year backtest is a strong
              result.</strong> Read shorter periods carefully. A one-year CAGR often
              reflects a trend that was already running when the test began.
            </p>
          </div>
        </article>

        <article className="stg-chapter" data-num="07">
          <h3 className="stg-chapter-title">Sharpe ratio: return for the wobble</h3>
          <p className="stg-copy">
            Two strategies can both return fifteen percent a year and be very
            different investments. One might climb steadily. The other might do the
            same work while dropping twenty percent on the way. The <strong><GlossaryText text="Sharpe ratio" glossary={STRATEGY_GLOSSARY} /></strong> separates
            them by measuring return against total <GlossaryText text="volatility" glossary={STRATEGY_GLOSSARY} />: the amount
            the account moved up and down, not just downward.
          </p>
          <p className="stg-copy">
            In risk terms, volatility is uncertainty. A high Sharpe ratio means the
            return was large relative to the movement that came with it. A low ratio
            means the account took a lot of shaking for what it earned.
          </p>
          <p className="stg-copy">
            Backtests on this platform are run without a risk-free rate adjustment, so
            a Sharpe ratio of 1.0 is the practical baseline to compare against.
          </p>
          <div className="stg-sign">
            <p>
              <strong>Above 1.0 is acceptable, 1.0 to 2.0 is solid, and above 2.0 is
              strong.</strong> The number matters less on its own than next to the
              drawdown figures, which tell you how deep the bad stretches went.
            </p>
          </div>
        </article>

        <article className="stg-chapter" data-num="08">
          <h3 className="stg-chapter-title">PSR: how much of this is luck</h3>
          <p className="stg-copy">
            A backtest is one path through history, and history does not repeat
            exactly. The <strong><GlossaryText text="Probabilistic Sharpe Ratio (PSR)" glossary={STRATEGY_GLOSSARY} /></strong> estimates
            how likely it is that the strategy's true Sharpe ratio is above 1.0, once
            the length of the test and the shape of its returns are taken into account.
          </p>
          <p className="stg-copy">
            Reported as a percentage, it answers a question the other numbers cannot:
            did the rules produce this result, or did the market simply hand us a
            favourable stretch of history? Longer tests and smoother return
            distributions push the figure up; a short test with wild swings pushes it
            down.
          </p>
          <div className="stg-example">
            50% PSR: the result is not distinguishable from luck.
            70% PSR: reasonable confidence that the edge is real.
            90% PSR: strong statistical support for the result holding up.
          </div>
          <div className="stg-sign">
            <p>
              <strong>Above 50% means there is a positive statistical case.</strong>
              The higher the number, the harder it is to explain the result as an
              accident of timing.
            </p>
          </div>
        </article>

        <article className="stg-chapter" data-num="09">
          <h3 className="stg-chapter-title">Sortino ratio: only the bad moves count</h3>
          <p className="stg-copy">
            The <strong>Sortino ratio</strong> is a variation on the Sharpe ratio that
            penalises only downward movement. Upward movement is treated as
            reward, not risk, which is a more useful framing for a strategy whose
            gains tend to arrive in jumps.
          </p>
          <p className="stg-copy">
            This matters when a strategy's volatility is mostly upside. A high Sortino
            alongside an ordinary Sharpe says the account moves a lot, but most of
            that movement is upward, and the painful drops are the smaller part.
          </p>
          <div className="stg-sign">
            <p>
              <strong>Above 1.0 means the return covers the downside risk taken.</strong>
              Above 2.0 indicates the account rarely gave back much of what it had
              made.
            </p>
          </div>
        </article>

        <article className="stg-chapter" data-num="10">
          <h3 className="stg-chapter-title">Win rate and expectancy</h3>
          <p className="stg-copy">
            The trade log gives the per-trade picture:
          </p>
          <ul className="stg-list">
            <li><strong>Win rate:</strong> The share of closed positions that finished with a net gain.</li>
            <li><strong>Loss rate:</strong> The share of closed positions that finished with a net loss.</li>
            <li><strong>Average win:</strong> The mean gain across the profitable trades.</li>
            <li><strong>Average loss:</strong> The mean loss across the losing trades.</li>
            <li>
              <strong>Expectancy:</strong> The expected net result of one trade, averaged across
              the whole sample.
            </li>
          </ul>
          <p className="stg-copy">
            Expectancy is the number that matters, and win rate on its own can be
            misleading. A system that wins nine times out of ten but loses ten times
            what it wins is losing money. What counts is the gap between the average
            win and the average loss, weighted by how often each one happens.
          </p>
          <div className="stg-sign">
            <p>
              <strong>Expectancy above zero means the rules make money over
              repetitions.</strong> Always read it next to the average win and loss.
            </p>
          </div>
        </article>

        <article className="stg-chapter" data-num="11">
          <h3 className="stg-chapter-title">Max drawdown: the worst stretch</h3>
          <p className="stg-copy">
            Account balances rarely rise in a straight line. <strong>Max drawdown</strong>
            is the largest percentage fall from a peak balance to the lowest point
            before the account got back above that peak. It answers the question a
            return figure cannot: how bad did it get while you were holding it?
          </p>
          <div className="stg-example">
            Peak Portfolio Value: 100
            Trough Value: 90
            Max Drawdown: 10.0% peak-to-trough fall.
          </div>
          <p className="stg-copy">
            The rough bands most people work with: under 10 percent is a shallow dip,
            10 to 20 percent is a real test of nerve, and anything above 20 percent
            is the kind of fall that makes people sell at the bottom.
          </p>
          <div className="stg-sign">
            <p>
              <strong>Max drawdown sets the size of the position you can hold.</strong>
              A strategy with a thirty percent historical drawdown needs a position
              small enough that you can sit through it without acting.
            </p>
          </div>
        </article>

        <article className="stg-chapter" data-num="12">
          <h3 className="stg-chapter-title">Drawdown recovery: how long it took</h3>
          <p className="stg-copy">
            Depth is only half the story. <strong>Drawdown recovery</strong> measures
            the number of trading days it took for the account to climb back to the
            level it had before the fall. A ten percent drop that takes six months to
            recover is a different experience from a ten percent drop recovered in two
            weeks, even though the percentages match.
          </p>
          <div className="stg-example">
            Equity drop from 100 to 90, then back up to 101.
            Recovery Duration: 20 trading days.
          </div>
          <div className="stg-sign">
            <p>
              <strong>A short recovery is a healthier sign than a deep one.</strong>
              Recovery times that stretch into many months describe a strategy that
              spends a long time flat.
            </p>
          </div>
        </article>

        <article className="stg-chapter" data-num="13">
          <h3 className="stg-chapter-title">Reading the trade log</h3>
          <p className="stg-copy">
            Each row in the trade table records four prices:
          </p>
          <ul className="stg-list">
            <li>
              <strong>Entry price:</strong> The price the position was opened at.
            </li>
            <li>
              <strong>Exit price:</strong> The price the position was closed at.
            </li>
            <li>
              <strong>Stop loss:</strong> The level set below entry that closes the position
              automatically, limiting the loss.
            </li>
            <li>
              <strong>Take profit:</strong> The level set above entry that closes the position
              automatically, locking in a gain.
            </li>
          </ul>
          <p className="stg-copy">
            Setting the stop and the target in advance means the exit is decided while
            nobody is watching a position move in the wrong direction. The table also
            records <strong>allocated size</strong>, the share of the account committed to
            each trade.
          </p>
        </article>

        <article className="stg-chapter" data-num="14">
          <h3 className="stg-chapter-title">The benchmark: simply holding</h3>
          <p className="stg-copy">
            A strategy has to earn its keep against the easiest alternative: buying
            and holding. The <strong>buy and hold</strong> benchmark puts the whole
            account to work on day one and leaves it there for the length of the
            test, with no trades and no decisions.
          </p>
          <p className="stg-copy">
            Holding costs almost nothing in fees, so the comparison is demanding. If a
            strategy cannot beat it after costs, the extra machinery is not earning
            its keep.
          </p>
          <div className="stg-sign">
            <p>
              <strong>Beating buy and hold is the minimum bar, not the finish
              line.</strong> Where an active strategy falls short, an index fund would
              have produced a better result with less work.
            </p>
          </div>
        </article>

        <article className="stg-chapter" data-num="15">
          <h3 className="stg-chapter-title">Unrealized cash</h3>
          <p className="stg-copy">
            <strong>Unrealized cash</strong> is the part of the account that is not
            currently in a position. It changes as the strategy opens and closes
            positions, and it is worth watching because a large idle balance is
            money that is not being put to work.
          </p>
          <p className="stg-copy">
            Holding cash is sometimes deliberate, and a strategy with strict entry
            rules will often sit in cash for a while. But when the account is mostly
            idle through a rising market, that idle time is part of the reason the
            result trails the benchmark.
          </p>
        </article>
      </div>

      <div className="stg-section-gap">
        <span className="stg-kicker">Reference</span>
        <h3 className="stg-title">Target values</h3>
        <p className="stg-deck">
          The figures below are the usual yardsticks for reading a strategy's metrics.
          They are guides rather than rules, and a strategy that misses one of them
          can still be worth using for a different purpose.
        </p>
        <div className="stg-scorecard-wrap">
          <table className="stg-scorecard">
            <thead>
              <tr>
                <th>Metric</th>
                <th>What it measures</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Ending value</td>
                <td>Total return over the whole run</td>
                <td>Above 100</td>
              </tr>
              <tr>
                <td>CAGR</td>
                <td>Annualised compound growth rate</td>
                <td>Above 10% (multi-year)</td>
              </tr>
              <tr>
                <td>Sharpe</td>
                <td>Return per unit of total volatility</td>
                <td>&gt; 1.0 (strong above 2.0)</td>
              </tr>
              <tr>
                <td>Sortino</td>
                <td>Return per unit of downside volatility</td>
                <td>&gt; 1.0 (strong above 2.0)</td>
              </tr>
              <tr>
                <td>PSR</td>
                <td>Statistical confidence that the result is not luck</td>
                <td>&gt; 50% (strong above 70%)</td>
              </tr>
              <tr>
                <td>Expectancy</td>
                <td>Expected profit per trade</td>
                <td>Above 0.0</td>
              </tr>
              <tr>
                <td>Win rate / loss rate</td>
                <td>How the trades split between gains and losses</td>
                <td>Read alongside average win and loss</td>
              </tr>
              <tr>
                <td>Max drawdown</td>
                <td>Largest peak-to-trough fall</td>
                <td>&lt; 10% low, &gt; 20% high</td>
              </tr>
              <tr>
                <td>Drawdown recovery</td>
                <td>Trading days needed to regain the peak</td>
                <td>Shorter is better</td>
              </tr>
              <tr>
                <td>Unrealized cash</td>
                <td>Share of the account sitting idle</td>
                <td>Depends on the trading style</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="stg-section-gap">
        <div className="stg-2col">
          <div>
            <span className="stg-tag">Worth keeping in mind</span>
            <h3 className="stg-title">Five ideas that decide most results</h3>
            <div className="stg-fact">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L12 2L5 12L19 12L12 22Z M2 12L12 12L22 12L12 2Z" />
              </svg>
              <div className="stg-fact-body">
                <span className="stg-tag">The benchmark is the standard</span>
                <p className="stg-fact-copy">
                  Holding an index costs almost nothing to maintain. Any strategy that
                  trades has to earn back its fees before its cleverness counts.
                </p>
              </div>
            </div>
            <div className="stg-fact">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L12 2L5 12L19 12L12 22Z M2 12L12 12L22 12L12 2Z" />
              </svg>
              <div className="stg-fact-body">
                <span className="stg-tag">Losses are not symmetrical</span>
                <p className="stg-fact-copy">
                  A 30 percent loss takes a 42.8 percent gain to undo. Keeping drawdowns
                  shallow matters more than chasing extra return.
                </p>
              </div>
            </div>
            <div className="stg-fact">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L12 2L5 12L19 12L12 22Z M2 12L12 12L22 12L12 2Z" />
              </svg>
              <div className="stg-fact-body">
                <span className="stg-tag">Costs scale with frequency</span>
                <p className="stg-fact-copy">
                  Fees, spreads, and slippage grow with the number of trades. A
                  backtest that leaves them out flatters the strategy.
                </p>
              </div>
            </div>
            <div className="stg-fact">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L12 2L5 12L19 12L12 22Z M2 12L12 12L22 12L12 2Z" />
              </svg>
              <div className="stg-fact-body">
                <span className="stg-tag">Time does the heavy lifting</span>
                <p className="stg-fact-copy">
                  Under compounding, the same rate over ten extra years changes the
                  outcome more than any single year being better than another.
                </p>
              </div>
            </div>
            <div className="stg-fact">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L12 2L5 12L19 12L12 22Z M2 12L12 12L22 12L12 2Z" />
              </svg>
              <div className="stg-fact-body">
                <span className="stg-tag">Sizing decides survival</span>
                <p className="stg-fact-copy">
                  How much goes into each trade matters as much as which trade to take.
                  A good entry with an oversized position is still a bad outcome.
                </p>
              </div>
            </div>
          </div>

          <div>
            <span className="stg-tag">How to read a backtest</span>
            <h3 className="stg-title">A working checklist</h3>
            <div className="stg-notes">
              <h4 className="stg-notes-heading">Questions worth asking of any result</h4>
              <ul className="stg-notes-list">
                <li>
                  <strong>Consistency first:</strong> A twelve percent yearly return across
                  different kinds of market beats a twenty-five percent return that
                  depends on one lucky stretch.
                </li>
                <li>
                  <strong>Look across market types:</strong> Check the bull runs, the
                  corrections, and the flat sideways periods separately. A strategy
                  that only appears in bull runs is not a strategy, it is a bet.
                </li>
                <li>
                  <strong>Match the style to the goal:</strong> Decide first whether you
                  are building a position over years or trading over weeks, then
                  judge the metrics that follow from that choice.
                </li>
                <li>
                  <strong>Rebalancing is not a cost by itself:</strong> Adjusting a
                  portfolio to stay inside risk limits is the strategy working as
                  designed.
                </li>
                <li>
                  <strong>Compare on a risk basis:</strong> Check that the return holds up
                  after fees and after the drawdowns, not just on the headline number.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="stg-ritual stg-section-gap">
        <h3 className="stg-ritual-heading">Before you judge a strategy</h3>
        <p className="stg-ritual-deck">
          Run through these eight checks before deciding whether a strategy deserves
          a place in your research.
        </p>
        <ol className="stg-ritual-list">
          <li><strong>Ending value above 100:</strong> The rules made money over the period.</li>
          <li><strong>CAGR above 10 percent:</strong> The yearly pace is worth having, over a multi-year test.</li>
          <li><strong>Sharpe and Sortino above 1.0:</strong> The return covers the movement that came with it.</li>
          <li><strong>PSR above 50 percent:</strong> There is a statistical case that the result is not chance.</li>
          <li><strong>Max drawdown you can sit through:</strong> The worst historical fall stays inside your tolerance.</li>
          <li><strong>Recovery time is reasonable:</strong> The account gets back to its high-water mark in a period you can wait out.</li>
          <li><strong>Expectancy is positive:</strong> Each trade has positive expected value on its own.</li>
          <li><strong>It beats the benchmark:</strong> The active management is worth more than simply holding.</li>
        </ol>
        <p className="stg-ritual-outro">
          A strategy that clears all eight is worth taking further, first on data it
          has not seen and then in a paper portfolio. One that misses several needs
          different parameters or a different design before it is worth more of your
          attention.
        </p>
      </div>

      <div className="stg-disclaimer stg-section-gap">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 4L22 19H2L12 4Z" />
          <line x1="12" y1="10" x2="12" y2="14" />
          <line x1="12" y1="16.5" x2="12" y2="16.5" />
        </svg>
        <div className="stg-disclaimer-body">
          <span className="stg-tag">Before you rely on any of this</span>
          <p className="stg-disclaimer-copy">
            Every backtest on this page is hypothetical. It was produced from
            historical data, so it describes how a set of rules would have behaved,
            not how it will behave. Live markets add slippage, liquidity, and
            conditions no simulation can reproduce.
          </p>
          <p className="stg-disclaimer-copy">
            Treat a backtest as the start of your thinking, not the end of it. Use the
            signals as a starting point for your own research, size any position so
            that being wrong is survivable, and make the final call yourself.
          </p>
        </div>
      </div>
    </section>
  )
}
