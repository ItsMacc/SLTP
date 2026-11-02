// CandlestickGuide.tsx — How to read the price chart, in plain text.

import { GlossaryText } from './GlossaryText'
import { STRATEGY_GLOSSARY } from '../../lib/glossary'

/** One candle with its four prices labelled, drawn from real values. */
function CandleDiagram({
  variant,
  open,
  high,
  low,
  close,
}: {
  variant: 'bull' | 'bear'
  open: number
  high: number
  low: number
  close: number
}) {
  const color = variant === 'bull' ? 'var(--success)' : 'var(--error)'
  const top = variant === 'bull' ? 'Close' : 'Open'
  const bottom = variant === 'bull' ? 'Open' : 'Close'
  const topValue = variant === 'bull' ? close : open
  const bottomValue = variant === 'bull' ? open : close

  // Every price in the diagram maps through the same scale, so the labels sit
  // on the levels they describe. 96 to 106 spans the drawing.
  const y = (value: number) => 120 - (value - 96) * 10
  const bodyTop = Math.min(y(open), y(close))
  const bodyHeight = Math.abs(y(close) - y(open))

  return (
    <svg
      viewBox="0 0 248 140"
      role="img"
      aria-label={`${variant === 'bull' ? 'Green' : 'Red'} candle, open ${open}, high ${high}, low ${low}, close ${close}`}
    >
      <line x1={118} x2={118} y1={y(high)} y2={y(low)} stroke={color} strokeWidth={2} />
      <rect x={98} y={bodyTop} width={40} height={bodyHeight} rx={2} fill={color} />

      <line x1={98} x2={82} y1={y(topValue)} y2={y(topValue)} stroke="var(--border-strong)" strokeDasharray="2 4" />
      <text x={76} y={y(topValue) + 4} textAnchor="end" fontSize={11} fill="var(--text-muted)" fontFamily="var(--font-sans)">
        {top} {topValue}
      </text>

      <line x1={98} x2={82} y1={y(bottomValue)} y2={y(bottomValue)} stroke="var(--border-strong)" strokeDasharray="2 4" />
      <text x={76} y={y(bottomValue) + 4} textAnchor="end" fontSize={11} fill="var(--text-muted)" fontFamily="var(--font-sans)">
        {bottom} {bottomValue}
      </text>

      <line x1={138} x2={154} y1={y(high)} y2={y(high)} stroke="var(--border-strong)" strokeDasharray="2 4" />
      <text x={160} y={y(high) + 4} fontSize={11} fill="var(--text-muted)" fontFamily="var(--font-sans)">
        High {high}
      </text>

      <line x1={138} x2={154} y1={y(low)} y2={y(low)} stroke="var(--border-strong)" strokeDasharray="2 4" />
      <text x={160} y={y(low) + 4} fontSize={11} fill="var(--text-muted)" fontFamily="var(--font-sans)">
        Low {low}
      </text>
    </svg>
  )
}

export default function CandlestickGuide() {
  return (
    <section className="guide research-guide" aria-labelledby="chart-guide-title">
      <div className="research-guide-head">
        <h2 id="chart-guide-title" className="research-guide-title">
          How to read the chart
        </h2>
        <p className="research-guide-lede">
          Every listed company has a short code called a{' '}
          <GlossaryText text="ticker" glossary={STRATEGY_GLOSSARY} />, like AAPL for Apple.
          Search for one and the chart shows its price history, one{' '}
          <GlossaryText text="candle" glossary={STRATEGY_GLOSSARY} /> for each trading day.
        </p>
      </div>

      <aside className="research-guide-aside" aria-label="Candle diagrams">
        <figure className="research-guide-figure">
          <CandleDiagram variant="bull" open={100} high={106} low={98} close={104} />
          <figcaption>
            <strong>Green candle.</strong> The close (104) is above the open (100), so the body
            runs up and the top wick reaches 106.
          </figcaption>
        </figure>
        <figure className="research-guide-figure">
          <CandleDiagram variant="bear" open={104} high={106} low={96} close={100} />
          <figcaption>
            <strong>Red candle.</strong> The close (100) is below the open (104), so the body
            runs down and the bottom wick reaches 96.
          </figcaption>
        </figure>
      </aside>

      <div className="research-guide-body">
        <p>
          A candle packs one day into a single shape. It shows four prices: where the price
          started, where it ended, and the highest and lowest points it reached in between.
        </p>

        <div className="research-guide-grid">
          <div className="research-guide-term">
            <span className="research-guide-term-name">Open</span>
            <span className="research-guide-term-text">The first price of the day.</span>
          </div>
          <div className="research-guide-term">
            <span className="research-guide-term-name">High</span>
            <span className="research-guide-term-text">
              The highest price reached during the day.
            </span>
          </div>
          <div className="research-guide-term">
            <span className="research-guide-term-name">Low</span>
            <span className="research-guide-term-text">
              The lowest price reached during the day.
            </span>
          </div>
          <div className="research-guide-term">
            <span className="research-guide-term-name">Close</span>
            <span className="research-guide-term-text">
              The last price of the day. Returns are usually measured from closing prices.
            </span>
          </div>
        </div>

        <h3 className="research-guide-subhead">Body and wick</h3>
        <p>
          The thick part of a candle is the body. It runs from the open to the close. The thin
          lines above and below are wicks. They reach up to the day's high and down to its low.
        </p>
        <p>
          Take a day that opens at 100, climbs to 106, drops to 98 and closes at 104. The body
          runs from 100 to 104. The top wick reaches 106 and the bottom wick reaches 98. The
          close is above the open, so the candle is green. Both diagrams on the right draw
          exactly those two days.
        </p>
        <p>Green means the close was above the open. Red means the close was below it.</p>

        <h3 className="research-guide-subhead">What the shapes tell you</h3>
        <ul className="research-guide-list">
          <li>A long body means the price moved a lot in one direction that day.</li>
          <li>A short body means it ended close to where it started.</li>
          <li>A long wick means the price went far, then came back.</li>
        </ul>

        <h3 className="research-guide-subhead">The six numbers under the chart</h3>
        <ul className="research-guide-list">
          <li>
            <strong>Range return:</strong> how much the price changed over the period you
            picked. If a stock goes from 100 to 128, the range return is +28%.
          </li>
          <li>
            <strong>High and Low:</strong> the highest and lowest prices in the period. They
            use each day's high and low, so they can sit beyond any closing price.
          </li>
          <li>
            <strong>
              <GlossaryText text="Volatility" glossary={STRATEGY_GLOSSARY} />:
            </strong>{' '}
            how much the price swings, shown as a yearly figure. A higher number means bigger
            swings. 24% is calmer than 60%.
          </li>
          <li>
            <strong>
              <GlossaryText text="Max drawdown" glossary={STRATEGY_GLOSSARY} />:
            </strong>{' '}
            the biggest fall from a peak to a later low, using closing prices. A value of
            -13.8% means that at its worst the price was 13.8% below its earlier high.
          </li>
          <li>
            <strong>
              Average <GlossaryText text="volume" glossary={STRATEGY_GLOSSARY} />:
            </strong>{' '}
            the average number of shares traded per day. When many shares trade, it is usually
            easier to buy or sell without moving the price.
          </li>
        </ul>

        <h3 className="research-guide-subhead">Using the chart</h3>
        <ul className="research-guide-list">
          <li>Start with 5Y or ALL to see the overall shape, then switch to 1Y for detail.</li>
          <li>
            Use the minus and plus buttons to zoom. Use Latest to jump back to the newest day.
          </li>
          <li>A chart shows what happened. It does not say what will happen next.</li>
        </ul>
      </div>
    </section>
  )
}
