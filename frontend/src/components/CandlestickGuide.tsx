// CandlestickGuide.tsx: How to read the price chart, in plain text.
import { useState } from 'react'
import Button from '../ui/Button'
import GuideTabs, { type GuideTab } from './GuideTabs'
import { GlossaryText } from './GlossaryText'
import { STRATEGY_GLOSSARY } from '../../lib/glossary'
import './ResearchGuide.css'

type CandlePart = 'open' | 'high' | 'low' | 'close' | 'body' | 'wick'

const PARTS: CandlePart[] = ['open', 'high', 'low', 'close', 'body', 'wick']

const PART_COPY: Record<CandlePart, { label: string; text: string }> = {
  open: {
    label: 'Open',
    text: 'The first price of the day, and one end of the body. On a green candle it is the bottom edge; on a red one it is the top.',
  },
  high: {
    label: 'High',
    text: 'The highest price reached during the day. It is the tip of the upper wick.',
  },
  low: {
    label: 'Low',
    text: 'The lowest price reached during the day. It is the tip of the lower wick.',
  },
  close: {
    label: 'Close',
    text: 'The last price of the day. Returns are usually measured from closing prices, which is why the close matters most.',
  },
  body: {
    label: 'Body',
    text: 'Open to close, drawn thick. A long body means the day had a clear direction; a short body means it ended near where it started.',
  },
  wick: {
    label: 'Wick',
    text: 'The thin lines above and below the body. They reach the day’s high and low, and record the ground the price covered before it settled.',
  },
}

const CHAPTERS: GuideTab[] = [
  { id: 'anatomy', label: 'Anatomy' },
  { id: 'day', label: 'Worked day' },
  { id: 'numbers', label: 'Six numbers' },
  { id: 'practice', label: 'Reading it well' },
]

interface DayPreset {
  id: string
  label: string
  open: number
  high: number
  low: number
  close: number
  tag: string
  text: string
}

const DAYS: DayPreset[] = [
  {
    id: 'up',
    label: 'Climbs and holds',
    open: 100,
    high: 106,
    low: 98,
    close: 104,
    tag: 'Green',
    text: 'Open 100, close 104: the body runs up four points and the close sits nearer the high than the low. The wicks record a trip to 106 and down to 98 somewhere in the session.',
  },
  {
    id: 'down',
    label: 'Fades and closes lower',
    open: 104,
    high: 106,
    low: 96,
    close: 100,
    tag: 'Red',
    text: 'Open 104, close 100: the body runs down four points, and the wicks mark 106 above and 96 below. The close is nearer the low, which is what makes the candle red.',
  },
  {
    id: 'quiet',
    label: 'Barely moves',
    open: 100,
    high: 102,
    low: 98.6,
    close: 100.4,
    tag: 'Green',
    text: 'Open 100, close 100.4: a sliver of a body and two short wicks. Buyers and sellers were evenly matched, and the day decided very little.',
  },
]

interface NumberCard {
  label: string
  value: string
  tone?: 'up' | 'down'
  text: string
}

const NUMBERS: NumberCard[] = [
  {
    label: 'Range return',
    value: '+28.0%',
    tone: 'up',
    text: 'The change from the first close to the last. A stock that goes from 100 to 128 has a range return of +28%.',
  },
  {
    label: 'High',
    value: '128.40',
    text: 'The highest price traded in the period, taken from daily highs. It can sit above every closing price.',
  },
  {
    label: 'Low',
    value: '96.10',
    text: 'The lowest price traded in the period, taken from daily lows rather than closing prices.',
  },
  {
    label: 'Volatility',
    value: '24.3%',
    text: 'How much the price swings, shown as a yearly figure. 24% is a calmer ride than 60%.',
  },
  {
    label: 'Max drawdown',
    value: '−13.8%',
    tone: 'down',
    text: 'The deepest fall from a peak to a later low. At its worst the price was 13.8% below its earlier high.',
  },
  {
    label: 'Average volume',
    value: '2.4M',
    text: 'The average number of shares traded each day. Busy days are usually easier to trade without moving the price.',
  },
]

interface ShapeCard {
  id: string
  label: string
  open: number
  high: number
  low: number
  close: number
  text: string
}

const SHAPES: ShapeCard[] = [
  {
    id: 'long-body',
    label: 'Long body',
    open: 92,
    high: 100,
    low: 91,
    close: 99,
    text: 'Price moved a long way in one direction and stayed there.',
  },
  {
    id: 'short-body',
    label: 'Short body',
    open: 96,
    high: 97,
    low: 94,
    close: 96.5,
    text: 'Price ended close to where it started. Little was settled.',
  },
  {
    id: 'upper-wick',
    label: 'Long upper wick',
    open: 93,
    high: 100,
    low: 92,
    close: 95,
    text: 'Price traded high, then came back down before the close.',
  },
  {
    id: 'lower-wick',
    label: 'Long lower wick',
    open: 97,
    high: 98,
    low: 90,
    close: 96,
    text: 'Price traded low, then recovered before the close.',
  },
]

const price = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1))

/** One labelled candle, drawn from real values on a single fixed scale. */
function CandleDiagram({
  open,
  high,
  low,
  close,
  highlight = null,
}: {
  open: number
  high: number
  low: number
  close: number
  highlight?: CandlePart | null
}) {
  const up = close >= open
  const color = up ? 'var(--success)' : 'var(--error)'

  // Every price maps through the same scale, so a label always sits on the
  // level it names. 96 to 106 spans the drawing.
  const y = (value: number) => 200 - (value - 96) * 17
  const bodyTop = Math.min(y(open), y(close))
  const bodyHeight = Math.max(2, Math.abs(y(close) - y(open)))
  const bodyGap = Math.abs(y(open) - y(close))

  // When open and close are close together their labels would collide, so
  // each one steps outside the body instead of sitting on its line.
  const tight = bodyGap < 20
  const openHigher = y(open) < y(close)
  const openLabelY = tight ? (openHigher ? y(open) - 6 : y(open) + 14) : y(open) + 4
  const closeLabelY = tight ? (openHigher ? y(close) + 14 : y(close) - 6) : y(close) + 4

  // Dimmed, not hidden: the unselected parts still have to read as one candle.
  const fade = (part: CandlePart) => (highlight === null || highlight === part ? 1 : 0.35)

  return (
    <svg
      className="guide-diagram"
      viewBox="0 0 320 220"
      role="img"
      aria-label={`${up ? 'Green' : 'Red'} candle, open ${open}, high ${high}, low ${low}, close ${close}`}
    >
      <g opacity={fade('wick')}>
        <line x1={160} x2={160} y1={y(high)} y2={bodyTop} stroke={color} strokeWidth={2} />
        <line
          x1={160}
          x2={160}
          y1={bodyTop + bodyHeight}
          y2={y(low)}
          stroke={color}
          strokeWidth={2}
        />
      </g>

      <rect
        x={128}
        y={bodyTop}
        width={64}
        height={bodyHeight}
        rx={3}
        fill={color}
        opacity={fade('body')}
      />

      <g opacity={fade('open')}>
        <line
          x1={128}
          x2={92}
          y1={y(open)}
          y2={y(open)}
          stroke="var(--border-strong)"
          strokeDasharray="2 4"
        />
        <text
          x={86}
          y={openLabelY}
          textAnchor="end"
          fontSize={12}
          fill="var(--text-secondary)"
          fontFamily="var(--font-ui)"
        >
          Open {price(open)}
        </text>
      </g>

      <g opacity={fade('close')}>
        <line
          x1={128}
          x2={92}
          y1={y(close)}
          y2={y(close)}
          stroke="var(--border-strong)"
          strokeDasharray="2 4"
        />
        <text
          x={86}
          y={closeLabelY}
          textAnchor="end"
          fontSize={12}
          fill="var(--text-secondary)"
          fontFamily="var(--font-ui)"
        >
          Close {price(close)}
        </text>
      </g>

      <g opacity={fade('high')}>
        <line
          x1={192}
          x2={228}
          y1={y(high)}
          y2={y(high)}
          stroke="var(--border-strong)"
          strokeDasharray="2 4"
        />
        <text
          x={234}
          y={y(high) + 4}
          fontSize={12}
          fill="var(--text-secondary)"
          fontFamily="var(--font-ui)"
        >
          High {price(high)}
        </text>
      </g>

      <g opacity={fade('low')}>
        <line
          x1={192}
          x2={228}
          y1={y(low)}
          y2={y(low)}
          stroke="var(--border-strong)"
          strokeDasharray="2 4"
        />
        <text
          x={234}
          y={y(low) + 4}
          fontSize={12}
          fill="var(--text-secondary)"
          fontFamily="var(--font-ui)"
        >
          Low {price(low)}
        </text>
      </g>
    </svg>
  )
}

/** The small unlabelled glyph used by the shape cards. */
function CandleGlyph({
  open,
  high,
  low,
  close,
}: {
  open: number
  high: number
  low: number
  close: number
}) {
  const up = close >= open
  const color = up ? 'var(--success)' : 'var(--error)'
  const y = (value: number) => 44 - (value - 90) * 4
  const top = Math.min(y(open), y(close))
  const height = Math.max(1.5, Math.abs(y(close) - y(open)))

  return (
    <svg className="guide-shape-glyph" viewBox="0 0 28 48" aria-hidden="true">
      <line x1={14} x2={14} y1={y(high)} y2={top} stroke={color} strokeWidth={1.5} />
      <line x1={14} x2={14} y1={top + height} y2={y(low)} stroke={color} strokeWidth={1.5} />
      <rect x={9} y={top} width={10} height={height} rx={1} fill={color} />
    </svg>
  )
}

export default function CandlestickGuide() {
  const [chapter, setChapter] = useState('anatomy')
  const [part, setPart] = useState<CandlePart | null>(null)
  const [dayId, setDayId] = useState(DAYS[0]!.id)
  const day = DAYS.find((item) => item.id === dayId) ?? DAYS[0]!

  return (
    <section className="research-guide" aria-labelledby="chart-guide-title">
      <header className="research-guide-head">
        <p className="research-guide-eyebrow">Guide · Price charts</p>
        <h2 id="chart-guide-title" className="research-guide-title">
          Reading a price chart
        </h2>
        <p className="research-guide-lede">
          A chart is a record of what buyers and sellers agreed on, day by day. This guide
          explains what each shape means and what the numbers underneath it are actually
          saying.
        </p>
        <GuideTabs
          tabs={CHAPTERS}
          value={chapter}
          onChange={setChapter}
          ariaLabel="Chart guide chapters"
          panelId="chart-guide-panel"
        />
      </header>

      <div
        className="research-guide-panel"
        id="chart-guide-panel"
        role="tabpanel"
        aria-labelledby={`chart-guide-panel-tab-${chapter}`}
      >
        {chapter === 'anatomy' && (
          <div className="guide-chapter guide-split">
            <div className="guide-prose">
              <p>
                Every listed company has a short code called a{' '}
                <GlossaryText text="ticker" glossary={STRATEGY_GLOSSARY} />, like AAPL for
                Apple. Search for one and the chart draws its price history, one{' '}
                <GlossaryText text="candle" glossary={STRATEGY_GLOSSARY} /> for each trading
                day.
              </p>
              <p>
                A candle squeezes a whole session into one shape. It records four prices,
                open, high, low and close, and the shape of those four says how much ground
                the price covered, not just where it stopped.
              </p>
              <p>
                Green means the close finished above the open. Red means it finished below.
                The colour marks the direction; the size of the shape marks the distance.
              </p>
              <aside className="guide-callout">
                <p className="guide-callout-title">Why candles instead of a line</p>
                <p>
                  A line chart keeps one price per day, usually the close. A candle keeps the
                  range as well, so a day that swung six percent and finished flat does not
                  vanish into a flat line.
                </p>
              </aside>
            </div>

            <figure className="guide-card">
              <div className="guide-card-head">
                <h3 className="guide-card-title">One day, four prices</h3>
                <span className="guide-card-note">Pick a part</span>
              </div>
              <CandleDiagram open={100} high={106} low={98} close={104} highlight={part} />
              <div className="guide-chips" role="group" aria-label="Candle parts">
                {PARTS.map((item) => (
                  <Button
                    key={item}
                    type="button"
                    variant="chip"
                    size="md"
                    className={`guide-chip${part === item ? ' is-active' : ''}`}
                    aria-pressed={part === item}
                    onClick={() => setPart(item)}
                  >
                    {PART_COPY[item].label}
                  </Button>
                ))}
              </div>
              <figcaption className="guide-caption" aria-live="polite">
                {part ? (
                  <>
                    <strong>{PART_COPY[part].label}.</strong> {PART_COPY[part].text}
                  </>
                ) : (
                  'Four prices, one shape. Pick a part above to see what it marks.'
                )}
              </figcaption>
            </figure>
          </div>
        )}

        {chapter === 'day' && (
          <div className="guide-chapter guide-split">
            <div className="guide-prose">
              <p>
                Take a day that opens at 100 and closes at 104, having traded as high as 106
                and as low as 98. The body runs from 100 to 104. The upper wick reaches 106,
                the lower wick 98, and because the close sits above the open the candle is
                green.
              </p>
              <p>
                A candle does not record the order of events. The high might have come before
                the low, or after; both days would draw the same shape. Read it as a summary,
                not a transcript.
              </p>
              <aside className="guide-callout">
                <p className="guide-callout-title">The body is the decision, the wicks are the argument</p>
                <p>
                  A long body says the day had a clear direction. Long wicks say the price
                  kept changing its mind and finished somewhere else. Neither is good or bad
                  on its own. It depends on what you expected.
                </p>
              </aside>
              <h3 className="guide-subhead">When the day is quiet</h3>
              <p>
                A short body with short wicks means the two sides were evenly matched. Those
                days rarely change a trend by themselves, but a run of them often comes
                before one.
              </p>
            </div>

            <figure className="guide-card">
              <div className="guide-card-head">
                <h3 className="guide-card-title">Draw a day</h3>
                <span className="guide-card-note">{day.tag} candle</span>
              </div>
              <div className="guide-chips" role="group" aria-label="Example days">
                {DAYS.map((item) => (
                  <Button
                    key={item.id}
                    type="button"
                    variant="chip"
                    size="md"
                    className={`guide-chip${item.id === day.id ? ' is-active' : ''}`}
                    aria-pressed={item.id === day.id}
                    onClick={() => setDayId(item.id)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
              <CandleDiagram open={day.open} high={day.high} low={day.low} close={day.close} />
              <div className="guide-ohlc">
                <div className="guide-ohlc-cell">
                  <span className="guide-ohlc-label">Open</span>
                  <span className="guide-ohlc-value">{price(day.open)}</span>
                </div>
                <div className="guide-ohlc-cell">
                  <span className="guide-ohlc-label">High</span>
                  <span className="guide-ohlc-value">{price(day.high)}</span>
                </div>
                <div className="guide-ohlc-cell">
                  <span className="guide-ohlc-label">Low</span>
                  <span className="guide-ohlc-value">{price(day.low)}</span>
                </div>
                <div className="guide-ohlc-cell">
                  <span className="guide-ohlc-label">Close</span>
                  <span className="guide-ohlc-value">{price(day.close)}</span>
                </div>
              </div>
              <figcaption className="guide-caption" aria-live="polite">
                {day.text}
              </figcaption>
            </figure>
          </div>
        )}

        {chapter === 'numbers' && (
          <div className="guide-chapter">
            <div className="guide-prose">
              <p>
                Under the chart, six figures summarise the period you picked. They are all
                calculated from the same daily bars, so they always agree with each other.
                Each one still answers a different question.
              </p>
            </div>

            <div className="guide-stat-grid">
              {NUMBERS.map((item) => (
                <article key={item.label} className="guide-stat">
                  <span className="guide-stat-label">{item.label}</span>
                  <span className={`guide-stat-value${item.tone ? ` is-${item.tone}` : ''}`}>
                    {item.value}
                  </span>
                  <p className="guide-stat-text">{item.text}</p>
                </article>
              ))}
            </div>

            <aside className="guide-callout">
              <p className="guide-callout-title">The return and the high are not the same story</p>
              <p>
                Range return uses closing prices, while high and low use the extremes reached
                during each day. A stock that starts at 100 and ends at 128 can still show a
                high above 128 and a low below 100.
              </p>
            </aside>
          </div>
        )}

        {chapter === 'practice' && (
          <div className="guide-chapter">
            <div className="guide-prose">
              <h3 className="guide-subhead">What the shapes tell you</h3>
              <p>
                Once you can read one candle, a chart becomes a series of sentences about
                who was winning each day.
              </p>
            </div>

            <div className="guide-shape-grid">
              {SHAPES.map((shape) => (
                <article key={shape.id} className="guide-shape">
                  <CandleGlyph
                    open={shape.open}
                    high={shape.high}
                    low={shape.low}
                    close={shape.close}
                  />
                  <div className="guide-shape-body">
                    <span className="guide-shape-name">{shape.label}</span>
                    <p className="guide-shape-text">{shape.text}</p>
                  </div>
                </article>
              ))}
            </div>

            <div className="guide-prose">
              <h3 className="guide-subhead">Using the chart</h3>
            </div>

            <ol className="guide-steps">
              <li className="guide-step">
                <div>
                  <span className="guide-step-title">Start wide</span>
                  <p>
                    Use 5Y or all history to see the overall shape, then switch to 1Y when you
                    want to study what happened recently.
                  </p>
                </div>
              </li>
              <li className="guide-step">
                <div>
                  <span className="guide-step-title">Zoom in on the part that matters</span>
                  <p>
                    The minus and plus buttons control how many candles are on screen. Use
                    Latest to jump back to the newest day, and drag to pan.
                  </p>
                </div>
              </li>
              <li className="guide-step">
                <div>
                  <span className="guide-step-title">Switch to line when candles are too dense</span>
                  <p>
                    On a long range, a line chart makes the trend easier to follow. Candles are
                    better when you care about individual days.
                  </p>
                </div>
              </li>
              <li className="guide-step">
                <div>
                  <span className="guide-step-title">Read the strip with a question in mind</span>
                  <p>
                    Ask what you want to know: how far it moved (range return), how bumpy the
                    ride was (volatility), how bad the worst stretch felt (max drawdown).
                  </p>
                </div>
              </li>
            </ol>

            <aside className="guide-callout">
              <p className="guide-callout-title">A chart is history, not a forecast</p>
              <p>
                It shows what happened. It cannot say what happens next, and a clean uptrend
                is not a promise that the next year looks the same.
              </p>
            </aside>

  

          </div>
        )}
      </div>
    </section>
  )
}
