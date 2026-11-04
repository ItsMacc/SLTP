// StrategyGuide.tsx: How to read the backtest results, in plain text.
import { useState } from 'react'
import Button from '../ui/Button'
import GuideTabs, { type GuideTab } from './GuideTabs'
import { GlossaryText } from './GlossaryText'
import { STRATEGY_GLOSSARY } from '../../lib/glossary'
import './ResearchGuide.css'

type MetricGroup = 'Return' | 'Risk' | 'Trades'
type MetricFilter = 'All' | MetricGroup

interface Metric {
  name: string
  group: MetricGroup
  text: string
}

const METRICS: Metric[] = [
  {
    name: 'Starting value',
    group: 'Return',
    text: 'Equity on the first session of the run. Every backtest starts at 100, which makes two runs directly comparable even when their share prices or position sizes differ.',
  },
  {
    name: 'Ending value',
    group: 'Return',
    text: 'Equity on the last session of the run, on the same 100 base. It is the simplest score in the panel: whether the account finished above or below where it started after the rules ran to the end.',
  },
  {
    name: 'CAGR',
    group: 'Return',
    text: 'CAGR stands for Compound Annual Growth Rate. It is the constant yearly rate that would take the starting value to the ending value, so a run of several years becomes one figure you can compare against another strategy or a fund.',
  },
  {
    name: 'Sharpe',
    group: 'Risk',
    text: 'The return earned for each unit of risk taken. A higher figure means the strategy earned more for the swings it put the account through; a lower one means it took more risk than the return justified. Above 1 is generally considered decent.',
  },
  {
    name: 'Sortino',
    group: 'Risk',
    text: 'Sharpe’s sibling, but only losing sessions count as risk. Large gains are not treated as something to be penalised, so a strategy that rises in sharp jumps scores better here.',
  },
  {
    name: 'PSR',
    group: 'Risk',
    text: 'Probabilistic Sharpe Ratio: the chance that the Sharpe reflects a real edge rather than a lucky stretch. It falls when the run has few trades, or when one very large loss carries the result, and it is the number to trust when the two disagree.',
  },
  {
    name: 'Max drawdown',
    group: 'Risk',
    text: 'The deepest fall from a peak to a later low. It is the worst loss you would have had to sit through, and often the figure that decides whether a strategy is holdable in real life.',
  },
  {
    name: 'Drawdown recovery',
    group: 'Risk',
    text: 'The longest stretch the account spent below an earlier peak. It counts sessions rather than calendar days, so it measures the recovery in market time.',
  },
  {
    name: 'Trades',
    group: 'Trades',
    text: 'How many closed trades the run produced. A small number makes every other trade figure unreliable, because one or two outcomes can swing the averages.',
  },
  {
    name: 'Win rate',
    group: 'Trades',
    text: 'The share of closed trades that made money. On its own it says little, because a strategy can win most trades and still lose money when the losers are much larger.',
  },
  {
    name: 'Loss rate',
    group: 'Trades',
    text: 'The rest of the closed trades. Trades that ended exactly flat are counted here rather than as wins.',
  },
  {
    name: 'Average win',
    group: 'Trades',
    text: 'The mean return of the winning trades. Read it beside the average loss to see whether the winners are big enough to pay for the losers.',
  },
  {
    name: 'Average loss',
    group: 'Trades',
    text: 'The mean return of the losing trades, written as a negative number. Its size compared with the average win is what makes a win rate meaningful.',
  },
  {
    name: 'Expectancy',
    group: 'Trades',
    text: 'The average result of one closed trade, as a fraction of equity. It folds win rate and the size of wins and losses into a single number, so it answers whether the system makes money at all.',
  },
  {
    name: 'Unrealized profit',
    group: 'Trades',
    text: 'Profit on positions still open at the last close, in index points. It is not a closed trade yet, so it does not count towards win rate, expectancy, or the trade figures.',
  },
]

const FILTERS: MetricFilter[] = ['All', 'Return', 'Risk', 'Trades']

const CHAPTERS: GuideTab[] = [
  { id: 'chart', label: 'The chart' },
  { id: 'numbers', label: 'The metrics' },
  { id: 'judge', label: 'Judging a run' },
  { id: 'limits', label: 'Costs & caveats' },
]

/** An illustrative equity curve: a strategy against its benchmark. */
function EquitySketch() {
  const benchmark =
    '24,150 60,146 96,152 132,140 168,143 204,130 240,134 276,124 312,118 340,112'
  const strategy = '24,150 60,158 96,138 132,150 168,118 204,128 240,96 276,104 312,72 340,60'

  return (
    <figure className="guide-card">
      <div className="guide-card-head">
        <h3 className="guide-card-title">A run at a glance</h3>
        <span className="guide-card-note">Illustration</span>
      </div>
      <svg
        className="guide-diagram"
        viewBox="0 0 360 200"
        role="img"
        aria-label="Illustrative equity curve: a strategy and a benchmark, both starting at 100, with the strategy finishing higher"
      >
        <line
          x1={24}
          x2={344}
          y1={150}
          y2={150}
          stroke="var(--border-strong)"
          strokeDasharray="3 5"
        />
        <text
          x={24}
          y={170}
          fontSize={11}
          fill="var(--text-muted)"
          fontFamily="var(--font-mono)"
        >
          100
        </text>
        <polyline
          points={benchmark}
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />
        <polyline
          points={strategy}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <circle cx={340} cy={112} r={3} fill="var(--text-muted)" />
        <circle cx={340} cy={60} r={3.5} fill="var(--accent)" />
      </svg>

      <div className="guide-legend">
        <span className="guide-legend-item">
          <span className="guide-swatch" aria-hidden="true" />
          Strategy
        </span>
        <span className="guide-legend-item">
          <span className="guide-swatch is-benchmark" aria-hidden="true" />
          Benchmark
        </span>
      </div>

      <figcaption className="guide-caption">
        Both curves start at 100. The gap between them is the only thing a backtest is really
        measuring: what the strategy added over simply holding the market.
      </figcaption>
    </figure>
  )
}

export default function StrategyGuide() {
  const [chapter, setChapter] = useState('chart')
  const [filter, setFilter] = useState<MetricFilter>('All')
  const visible =
    filter === 'All' ? METRICS : METRICS.filter((metric) => metric.group === filter)

  return (
    <section className="research-guide is-strategy" aria-labelledby="results-guide-title">
      <header className="research-guide-head">
        <p className="research-guide-eyebrow">Guide · Backtests</p>
        <h2 id="results-guide-title" className="research-guide-title">
          Reading a backtest
        </h2>
        <p className="research-guide-lede">
          A <GlossaryText text="backtest" glossary={STRATEGY_GLOSSARY} /> replays a set of
          rules over past data and shows what they would have done. The hard part is not
          running one. It is knowing which numbers mean something.
        </p>
        <GuideTabs
          tabs={CHAPTERS}
          value={chapter}
          onChange={setChapter}
          ariaLabel="Backtest guide chapters"
          panelId="results-guide-panel"
        />
      </header>

      <div
        className="research-guide-panel"
        id="results-guide-panel"
        role="tabpanel"
        aria-labelledby={`results-guide-panel-tab-${chapter}`}
      >
        {chapter === 'chart' && (
          <div className="guide-chapter guide-split">
            <div className="guide-prose">
              <p>
                Choose a strategy, pick a start date and run it. The engine walks through the
                sessions one at a time, following the strategy’s rules and recording what the
                account would be worth after each one.
              </p>
              <p>
                The chart plots that value with one candle per session, starting at 100. A
                last reading of 124 means the account is up 24% over the period. Green means
                the value rose that session, red means it fell, and hovering a candle shows
                the value on that date.
              </p>
              <p>
                Because every run starts at the same place, two strategies can be compared
                side by side even when their share prices or position sizes differ.
              </p>
              <h3 className="guide-subhead">The benchmark</h3>
              <p>
                <GlossaryText text="Benchmark" glossary={STRATEGY_GLOSSARY} /> (SPY) buys SPY
                on the first day and holds it to the last. SPY is an{' '}
                <GlossaryText text="ETF" glossary={STRATEGY_GLOSSARY} /> that tracks the S&amp;P
                500, so it stands in for the market itself.
              </p>
              <p>
                The benchmark is the question every other number is answering. If a strategy
                cannot beat it, you could have bought SPY and done nothing.
              </p>
            </div>

            <EquitySketch />
          </div>
        )}

        {chapter === 'numbers' && (
          <div className="guide-chapter">
            <div className="guide-prose">
              <p>
                The panel lists every figure the engine records for the run. None of them is
                the answer on its own. Each one answers a different question. Filter them by
                what you are trying to find out.
              </p>
            </div>

            <div className="guide-chips" role="group" aria-label="Filter metrics">
              {FILTERS.map((item) => (
                <Button
                  key={item}
                  type="button"
                  variant="chip"
                  size="md"
                  className={`guide-chip${filter === item ? ' is-active' : ''}`}
                  aria-pressed={filter === item}
                  onClick={() => setFilter(item)}
                >
                  {item}
                </Button>
              ))}
            </div>

            <div className="guide-metric-grid">
              {visible.map((metric) => (
                <article key={metric.name} className="guide-metric">
                  <div className="guide-metric-top">
                    <h3 className="guide-metric-name">{metric.name}</h3>
                    <span className="guide-metric-tag">{metric.group}</span>
                  </div>
                  <p className="guide-metric-text">{metric.text}</p>
                </article>
              ))}
            </div>

            <aside className="guide-callout">
              <p className="guide-callout-title">Only closed trades count</p>
              <p>
                A strategy that buys and never sells reports a win rate of 0 and an expectancy
                of 0 while its curve climbs. On a run like that, read CAGR and max drawdown
                instead.
              </p>
            </aside>
          </div>
        )}

        {chapter === 'judge' && (
          <div className="guide-chapter">
            <div className="guide-prose">
              <p>
                A full metrics panel invites you to read it in any order. Read it in this one:
                each step narrows down whether the result is worth a second look.
              </p>
            </div>

            <ol className="guide-steps">
              <li className="guide-step">
                <div>
                  <span className="guide-step-title">Start with the benchmark</span>
                  <p>
                    Compare the two curves first. A strategy that matches SPY while falling
                    further has added work, not value.
                  </p>
                </div>
              </li>
              <li className="guide-step">
                <div>
                  <span className="guide-step-title">Put CAGR next to max drawdown</span>
                  <p>
                    A 30% year that loses half the account on the way is harder to hold
                    through than a 12% year that dips 8%. Return without the drawdown is half
                    the story.
                  </p>
                </div>
              </li>
              <li className="guide-step">
                <div>
                  <span className="guide-step-title">Read win rate with the average win and loss</span>
                  <p>
                    Winning six trades out of ten still loses money when the four losers are
                    twice the size of the winners.
                  </p>
                </div>
              </li>
              <li className="guide-step">
                <div>
                  <span className="guide-step-title">Count the trades</span>
                  <p>
                    A Sharpe of 3 from four trades is a coincidence. The same number from four
                    hundred deserves a second look.
                  </p>
                </div>
              </li>
              <li className="guide-step">
                <div>
                  <span className="guide-step-title">Trust PSR over Sharpe when they disagree</span>
                  <p>
                    A high ratio from a short run usually comes with a low PSR, and the PSR is
                    the honest one.
                  </p>
                </div>
              </li>
            </ol>

            <aside className="guide-callout">
              <p className="guide-callout-title">The pair that matters</p>
              <p>
                If you only remember two numbers, remember CAGR and max drawdown. One is what
                you might earn, the other is what you have to survive to earn it.
              </p>
            </aside>

  

          </div>
        )}

        {chapter === 'limits' && (
          <div className="guide-chapter guide-split">
            <div className="guide-prose">
              <h3 className="guide-subhead">Costs are already in the result</h3>
              <p>
                Every fill pays 0.05%{' '}
                <GlossaryText text="slippage" glossary={STRATEGY_GLOSSARY} /> and a 0.1% fee,
                and orders fill at the next open. The figures are after those costs, so do not
                subtract them again, and do not assume a real account would do better.
              </p>

              <h3 className="guide-subhead">The trade list</h3>
              <p>
                Under the chart is every trade in the run, oldest first: the date, the ticker,
                whether it went long or short, the share of equity it used, and the entry and
                exit prices. A dash in the exit column means the position was still open when
                the run ended.
              </p>
              <p>
                The list is where a result stops being a chart and becomes a set of decisions.
                Skim the first few rows and ask whether you would have taken those trades with
                your own money at the time.
              </p>
            </div>

            <div className="guide-rail">
              <div className="guide-card">
                <div className="guide-card-head">
                  <h3 className="guide-card-title">Before you trust a result</h3>
                  <span className="guide-card-note">Checklist</span>
                </div>
                <ul className="guide-list">
                  <li>
                    A backtest is a simulation. It does not capture everything that happens in
                    live trading, from halts to a fill you never got.
                  </li>
                  <li>
                    A strategy tuned until it fits past data can look great and still fail on
                    new data. That is what{' '}
                    <GlossaryText text="overfitting" glossary={STRATEGY_GLOSSARY} /> means.
                  </li>
                  <li>
                    One good year is not a track record. Run the same strategy over several
                    different start dates and see whether the result survives.
                  </li>
                  <li>Always compare against the benchmark over exactly the same dates.</li>
                  <li>
                    A strategy with few trades has a wide range of possible outcomes. Treat its
                    ratios as provisional rather than precise.
                  </li>
                </ul>
              </div>

              <aside className="guide-callout">
                <p className="guide-callout-title">A backtest is a question, not a verdict</p>
                <p>
                  Its job is to tell you whether an idea is worth investigating further, not to
                  promise what happens next. Treat a good result as a reason to look closer, and
                  a bad one as a reason to change the idea rather than the dates.
                </p>
              </aside>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
