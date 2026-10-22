// CandlestickGuide.tsx — Candlestick pattern guide

import { GlossaryText } from './GlossaryText'
import { STRATEGY_GLOSSARY } from '../../lib/glossary'
import './CandlestickGuide.css'

interface CandleDiagramProps {
  variant: 'bull' | 'bear'
  openPrice: number
  highPrice: number
  lowPrice: number
  closePrice: number
}

function CandleDiagram({
  variant,
  openPrice,
  highPrice,
  lowPrice,
  closePrice,
}: CandleDiagramProps) {
  const colorVar = variant === 'bull' ? 'var(--success)' : 'var(--error)'
  const topLabel = variant === 'bull' ? `Close ($${closePrice})` : `Open ($${openPrice})`
  const bottomLabel = variant === 'bull' ? `Open ($${openPrice})` : `Close ($${closePrice})`

  return (
    <svg className="guide-diagram-svg" viewBox="0 0 320 220" xmlns="http://www.w3.org/2000/svg">
      <line x1={160} x2={160} y1={20} y2={200} stroke={colorVar} strokeWidth={2} />
      <rect x={142} y={65} width={36} height={75} rx={2} fill={colorVar} />

      <circle cx={160} cy={20} r={3} fill="var(--text-primary)" />
      <line x1={178} x2={215} y1={20} y2={20} stroke="var(--border-strong)" strokeDasharray="2 4" />
      <text x={220} y={24} fontSize={12} fontWeight={600} fill="var(--text-primary)">
        High (${highPrice})
      </text>

      <circle cx={160} cy={200} r={3} fill="var(--text-primary)" />
      <line x1={178} x2={215} y1={200} y2={200} stroke="var(--border-strong)" strokeDasharray="2 4" />
      <text x={220} y={204} fontSize={12} fontWeight={600} fill="var(--text-primary)">
        Low (${lowPrice})
      </text>

      <circle cx={160} cy={65} r={3} fill="var(--text-primary)" />
      <line x1={142} x2={105} y1={65} y2={65} stroke="var(--border-strong)" strokeDasharray="2 4" />
      <text x={100} y={69} fontSize={12} fontWeight={600} textAnchor="end" fill="var(--text-primary)">
        {topLabel}
      </text>

      <circle cx={160} cy={140} r={3} fill="var(--text-primary)" />
      <line x1={142} x2={105} y1={140} y2={140} stroke="var(--border-strong)" strokeDasharray="2 4" />
      <text x={100} y={144} fontSize={12} fontWeight={600} textAnchor="end" fill="var(--text-primary)">
        {bottomLabel}
      </text>
    </svg>
  )
}
export default function CandlestickGuide() {
  return (
    <section className="guide">
      <div className="guide-layout-grid">
        <div className="guide-main-column">
          <div className="guide-intro-block">
            <h2 className="guide-heading">Reading the chart</h2>
            <p className="guide-copy">
              Every listed company has a short code, called a ticker: AAPL for Apple,
              TSLA for Tesla. Search for one and the chart fills with its price
              history, drawn as candles. Each candle stands for a single trading day.
            </p>
            <p className="guide-copy">
              A candle compresses a whole session into one shape holding four numbers.
              Once you know how to read those four, the chart stops being decoration
              and starts telling you how much the
              <GlossaryText text="volatility" glossary={STRATEGY_GLOSSARY} /> of each day was.
            </p>
          </div>

          <ol className="guide-steps">
            <li>
              <span className="guide-step-index">1</span>
              <div>
                <p className="guide-step-title">Open price</p>
                <p className="guide-step-body">The first price traded when the session began.</p>
              </div>
            </li>
            <li>
              <span className="guide-step-index">2</span>
              <div>
                <p className="guide-step-title">High and low</p>
                <p className="guide-step-body">
                  The highest and lowest prices reached during the session. The thin
                  vertical lines, called wicks, mark them.
                </p>
              </div>
            </li>
            <li>
              <span className="guide-step-index">3</span>
              <div>
                <p className="guide-step-title">Close price</p>
                <p className="guide-step-body">The last price traded when the session ended.</p>
              </div>
            </li>
            <li>
              <span className="guide-step-index">4</span>
              <div>
                <p className="guide-step-title">Volume</p>
                <p className="guide-step-body">
                  The bars below the chart. Taller bars mean more shares changed hands,
                  which usually means more people were paying attention.
                </p>
              </div>
            </li>
          </ol>

          <div className="guide-intro-block is-spaced">
            <h3 className="guide-heading">Choosing a timeframe</h3>
            <p className="guide-copy">
              The timeframe buttons (1Y, 2Y, 5Y, ALL) decide how much history the
              chart shows. A short window makes daily movement easy to see. A long
              window reveals the larger trend and the cycle the stock sits inside. The
              span you choose is your <GlossaryText text="horizon" glossary={STRATEGY_GLOSSARY} />, and it changes
              what the same chart appears to be saying.
            </p>
          </div>
        </div>

        <aside className="guide-sidebar-column">
          <div className="guide-sidebar-card">
            <h3 className="guide-sidebar-title">Quick reference</h3>
            <ul className="guide-sidebar-list">
              <li>
                <strong>Body and wick:</strong> The thick block is the body, covering the
                range between open and close. The thin lines above and below are wicks,
                showing how far the price wandered before settling.
              </li>
              <li>
                <strong>Size shows conviction:</strong> A tall body means buyers or
                sellers controlled the session. A small body means the day was a
                contest that ended near where it started.
              </li>
              <li>
                <strong>Zoom out before zooming in:</strong> Start on 5Y or ALL to see
                the shape of the stock, then switch to 1Y for the detail.
              </li>
              <li>
                <strong>A chart is a record, not a forecast:</strong> It shows what
                already happened. Use it to research, not to predict, and check any
                conclusion against a
                <GlossaryText text="backtest" glossary={STRATEGY_GLOSSARY} /> before you act on it.
              </li>
              <li>
                <strong>Symbols ending in .TO:</strong> These are listings on the Toronto
                Stock Exchange, quoted in Canadian dollars. SHOP.TO, for instance, is
                Shopify's Canadian listing, and it is a different security from SHOP
                on a U.S. exchange.
              </li>
            </ul>
          </div>
        </aside>
</div>

      <div className="guide-examples is-spaced">
        <article className="guide-example">
          <h3 className="guide-example-title">
            <span className="dot dot-bull" /> Green candle (price rose)
          </h3>
          <p className="guide-copy">
            A stock opens at $180, trades up to $187, falls back to $179, and closes at
            $185. Because it closed above where it opened, the candle is green.
          </p>
          <p className="guide-copy">
            Green means buyers had the upper hand by the end of the session, even
            though the path there included a dip.
          </p>
          <div className="guide-diagram-wrap">
            <CandleDiagram variant="bull" openPrice={180} highPrice={187} lowPrice={179} closePrice={185} />
          </div>
        </article>

        <article className="guide-example">
          <h3 className="guide-example-title">
            <span className="dot dot-bear" /> Red candle (price fell)
          </h3>
          <p className="guide-copy">
            A stock opens at $185, reaches $187, drops to $176, and closes at $180. It
            closed below where it opened, so the candle is red.
          </p>
          <p className="guide-copy">
            Red means sellers had the upper hand by the close, and the day ended
            below where it started.
          </p>
          <div className="guide-diagram-wrap">
            <CandleDiagram variant="bear" openPrice={185} highPrice={187} lowPrice={176} closePrice={180} />
          </div>
        </article>
      </div>
    </section>
  )
}
