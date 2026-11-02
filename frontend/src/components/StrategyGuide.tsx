// StrategyGuide.tsx — How to read the backtest results, in plain text.

import { GlossaryText } from './GlossaryText'
import { STRATEGY_GLOSSARY } from '../../lib/glossary'

/** A strategy curve against the benchmark, with the drawdown marked. */
function EquityDiagram() {
  return (
    <svg
      viewBox="0 0 320 176"
      role="img"
      aria-label="A strategy curve above a benchmark curve, with the fall from a peak to a later low marked as the drawdown"
    >
      {/* The drawdown: peak, later low, and the band between them. */}
      <rect x={135} y={64} width={25} height={36} fill="var(--accent-muted)" />
      <line x1={135} x2={160} y1={64} y2={64} stroke="var(--accent)" strokeDasharray="3 3" />
      <line x1={160} x2={160} y1={64} y2={100} stroke="var(--accent)" strokeDasharray="3 3" />
      <text x={134} y={56} textAnchor="middle" fontSize={10} fill="var(--text-muted)" fontFamily="var(--font-sans)">
        peak
      </text>
      <text x={166} y={104} fontSize={10} fill="var(--text-muted)" fontFamily="var(--font-sans)">
        later low
      </text>

      {/* SPY: the market the strategy is measured against. */}
      <polyline
        points="10,130 70,122 130,112 190,104 250,98 300,94"
        fill="none"
        stroke="var(--border-strong)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* The strategy. */}
      <polyline
        points="10,128 55,116 95,96 135,64 160,100 200,82 250,56 300,34"
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      <line x1={10} x2={300} y1={140} y2={140} stroke="var(--border-subtle)" />

      <line x1={10} x2={26} y1={162} y2={162} stroke="var(--accent)" strokeWidth={2} />
      <text x={32} y={166} fontSize={11} fill="var(--text-muted)" fontFamily="var(--font-sans)">
        Strategy
      </text>
      <line x1={98} x2={114} y1={162} y2={162} stroke="var(--border-strong)" strokeWidth={2} />
      <text x={120} y={166} fontSize={11} fill="var(--text-muted)" fontFamily="var(--font-sans)">
        SPY
      </text>
    </svg>
  )
}

/** One metric: the name the panel shows, and what it tells you. */
function Metric({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="research-guide-def">
      <span className="research-guide-def-name">{name}</span>
      <span className="research-guide-def-text">{children}</span>
    </div>
  )
}

export default function StrategyGuide() {
  return (
    <section className="guide research-guide" aria-labelledby="results-guide-title">
      <div className="research-guide-head">
        <h2 id="results-guide-title" className="research-guide-title">
          How to read the results
        </h2>
        <p className="research-guide-lede">
          A <GlossaryText text="backtest" glossary={STRATEGY_GLOSSARY} /> replays a strategy
          over past data and shows what it would have done. Pick a strategy, choose a start
          date and run it.
        </p>
      </div>

      <aside className="research-guide-aside" aria-label="Equity curve diagram">
        <figure className="research-guide-figure">
          <EquityDiagram />
          <figcaption>
            <strong>Two curves, one date range.</strong> The accent line is the strategy, the
            grey one is SPY over the same sessions. The band marks the fall from a peak to a
            later low, which is the drawdown.
          </figcaption>
        </figure>
      </aside>

      <div className="research-guide-body">
        <h3 className="research-guide-subhead">What the chart shows</h3>
        <p>
          The chart is your portfolio value over the run, one candle per session. It starts at
          100, so a last reading of 124 means the account is up 24% over the period. A green
          candle means the value rose that session, red means it fell. Hover a candle to read
          the value on that date.
        </p>

        <h3 className="research-guide-subhead">The benchmark</h3>
        <p>
          <GlossaryText text="Benchmark" glossary={STRATEGY_GLOSSARY} /> (SPY) buys SPY on the
          first day and holds it to the last. SPY is an{' '}
          <GlossaryText text="ETF" glossary={STRATEGY_GLOSSARY} /> that tracks the S&P 500, so
          it stands in for the market itself. If a strategy cannot beat it, you could have
          bought SPY and done nothing.
        </p>

        <h3 className="research-guide-subhead">What each number means</h3>
        <p>
          The panel lists every figure the engine records for the run. Read them in this order.
        </p>

        <div className="research-guide-defs">
          <Metric name="Starting value">
            Equity on the first session. It is always 100, so two runs are easy to compare.
          </Metric>
          <Metric name="Ending value">
            Equity on the last session. 118 means the account finished 18% higher.
          </Metric>
          <Metric name="CAGR">
            The average yearly growth rate. 100 growing to 150 over three years is about 14% a
            year. A run shorter than a year is treated as a year, so check ending value on
            short tests.
          </Metric>
          <Metric name="Sharpe">Return per unit of risk. Higher is better. Above 1 is usually considered good.</Metric>
          <Metric name="Sortino">
            The same idea as Sharpe, but only the losing sessions count as risk.
          </Metric>
          <Metric name="PSR">
            The chance the Sharpe is real and not a lucky stretch. It drops when the run has
            few trades or one very large loss.
          </Metric>
          <Metric name="Win rate">The share of closed trades that made money.</Metric>
          <Metric name="Loss rate">The rest of the closed trades. Trades that ended flat count here.</Metric>
          <Metric name="Average win">The mean return of the winning trades.</Metric>
          <Metric name="Average loss">The mean return of the losing trades. It is a negative number.</Metric>
          <Metric name="Max drawdown">
            The deepest fall from a peak, shown as a positive percentage. 26.5 means the account
            was 26.5% below its high at the worst point.
          </Metric>
          <Metric name="Expectancy">
            The average result of one closed trade, as a fraction. 0.012 means 1.2% per trade.
          </Metric>
          <Metric name="Drawdown recovery">
            The longest stretch of sessions the equity spent below an earlier peak. It counts
            sessions, not calendar days.
          </Metric>
          <Metric name="Unrealized profit">
            Profit on positions still open at the last close, in index points.
          </Metric>
        </div>

        <p>
          Only closed trades count towards the trade figures. A strategy that buys and never
          sells reports a win rate of 0 and an expectancy of 0 while its curve climbs. On a run
          like that, read CAGR and max drawdown instead.
        </p>

        <h3 className="research-guide-subhead">What a good result looks like</h3>
        <ul className="research-guide-list">
          <li>
            Start with the benchmark. A strategy that matches SPY with a deeper drawdown has
            added nothing but work.
          </li>
          <li>
            Read CAGR next to max drawdown. A 30% year that loses half the account on the way is
            harder to sit through than a 12% year that dips 8%.
          </li>
          <li>
            Put win rate beside average win and average loss. Winning six trades out of ten
            still loses money when the four losers are twice the size of the winners.
          </li>
          <li>
            Check how many trades the run produced. A Sharpe of 3 from four trades is noise. The
            same number from four hundred is worth a second look.
          </li>
          <li>
            Trust PSR over Sharpe when the two disagree. A high ratio from a short run usually
            comes with a low PSR, and the PSR is the honest one.
          </li>
        </ul>

        <h3 className="research-guide-subhead">Costs are already in the result</h3>
        <p>
          Every fill pays 0.05% <GlossaryText text="slippage" glossary={STRATEGY_GLOSSARY} />{' '}
          and a 0.1% fee, and orders fill at the next open. The figures above are after those
          costs, so do not subtract them again.
        </p>

        <h3 className="research-guide-subhead">The trade list</h3>
        <p>
          Under the chart is every trade in the run, oldest first: the date, the ticker,
          whether it went long or short, the share of equity it used, and the entry and exit
          prices. A dash in the exit column means the position was still open when the run
          ended.
        </p>

        <h3 className="research-guide-subhead">Before you trust a result</h3>
        <ul className="research-guide-list">
          <li>
            A backtest is a simulation. It does not capture everything that happens in live
            trading.
          </li>
          <li>
            A strategy tuned until it fits past data can look great and still fail on new data.
            That is what <GlossaryText text="overfitting" glossary={STRATEGY_GLOSSARY} /> means.
          </li>
          <li>
            One good year is not a track record. Run the same strategy over a few different
            start dates and see whether the result survives.
          </li>
          <li>Compare against the benchmark over the same dates.</li>
        </ul>
      </div>
    </section>
  )
}
