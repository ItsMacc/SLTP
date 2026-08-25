import React, { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react'
import './PerformancePage.css'
import type { PerformanceTimeframe } from '../../lib/settings'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

interface BarData {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface StockDataResponse {
  ticker: string
  timeframe: string
  total_bars: number
  data: BarData[]
}

const AXIS_WIDTH = 50
const PADDING_TOP = 12
const PADDING_BOTTOM = 22
const VOLUME_RATIO = 0.2
const MIN_VISIBLE = 15

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const priceLabel = (value: number) =>
  value >= 1000 ? value.toFixed(0) : value >= 10 ? value.toFixed(1) : value.toFixed(2)

const dateLabel = (iso: string) => {
  if (!iso) return ''
  const parts = iso.split('-')
  if (parts.length < 3) return iso
  const [y, m, d] = parts
  return `${d}/${m}/${y?.slice(2)}`
}

/* ----------------------------------------------------------------
   Candle SVG Diagram Component
   ---------------------------------------------------------------- */

interface CandleDiagramProps {
  variant: 'bull' | 'bear'
  openPrice: number
  highPrice: number
  lowPrice: number
  closePrice: number
}

function CandleDiagram({ variant, openPrice, highPrice, lowPrice, closePrice }: CandleDiagramProps) {
  const color = variant === 'bull' ? 'var(--bull)' : 'var(--bear)'
  const topLabel = variant === 'bull' ? `Close ($${closePrice})` : `Open ($${openPrice})`
  const bottomLabel = variant === 'bull' ? `Open ($${openPrice})` : `Close ($${closePrice})`

  return (
    <svg className="guide-diagram-svg" viewBox="0 0 320 220" xmlns="http://www.w3.org/2000/svg">
      {/* Wick line */}
      <line x1={160} x2={160} y1={20} y2={200} stroke={color} strokeWidth={2} />
      {/* Candle Body */}
      <rect x={142} y={65} width={36} height={75} rx={2} fill={color} />

      {/* High Point */}
      <circle cx={160} cy={20} r={3} fill="var(--foreground-text)" />
      <line x1={178} x2={215} y1={20} y2={20} stroke="var(--muted-text)" strokeDasharray="2 4" />
      <text x={220} y={24} fontSize={12} fontWeight={600} fill="var(--text)">
        High (${highPrice})
      </text>

      {/* Low Point */}
      <circle cx={160} cy={200} r={3} fill="var(--foreground-text)" />
      <line x1={178} x2={215} y1={200} y2={200} stroke="var(--muted-text)" strokeDasharray="2 4" />
      <text x={220} y={204} fontSize={12} fontWeight={600} fill="var(--text)">
        Low (${lowPrice})
      </text>

      {/* Top of Body */}
      <circle cx={160} cy={65} r={3} fill="var(--foreground-text)" />
      <line x1={142} x2={105} y1={65} y2={65} stroke="var(--muted-text)" strokeDasharray="2 4" />
      <text x={100} y={69} fontSize={12} fontWeight={600} textAnchor="end" fill="var(--text)">
        {topLabel}
      </text>

      {/* Bottom of Body */}
      <circle cx={160} cy={140} r={3} fill="var(--foreground-text)" />
      <line x1={142} x2={105} y1={140} y2={140} stroke="var(--muted-text)" strokeDasharray="2 4" />
      <text x={100} y={144} fontSize={12} fontWeight={600} textAnchor="end" fill="var(--text)">
        {bottomLabel}
      </text>
    </svg>
  )
}

/* ----------------------------------------------------------------
   GUIDE SECTION
   ---------------------------------------------------------------- */

export function CandlestickGuide() {
  return (
    <div className="guide-wrapper">
      {/* Outer Section Title */}
      <div className="guide-header">
        <p className="guide-eyebrow">GUIDE</p>
        <div className="guide-divider" />
      </div>

      {/* Dark Box Section */}
      <section className="guide-section">
        <h2 className="guide-heading">What is a stock symbol?</h2>
        <p className="guide-intro">
          A <strong>stock symbol</strong> (or ticker) is a unique series of letters assigned to a publicly traded company on a stock exchange. For example, <strong>AAPL</strong> stands for Apple, <strong>TSLA</strong> stands for Tesla, and <strong>MSFT</strong> stands for Microsoft. You can enter these short codes into the search box above to instantly look up and view any stock's performance data.
        </p>

        <h2 className="guide-heading" style={{ marginTop: '2rem' }}>How to read a candle</h2>

        <p className="guide-intro">
          To read a candle, we first decide the timeframe. It can be a <strong>1-day candle</strong>, representing how much a stock changed in 1 day; or a <strong>1-minute candle</strong>, which reflects price changes in 1 minute.
        </p>

        <p className="guide-intro">
          Let's look at a <strong>1-day candle</strong>. First, here is what candles are made of:
        </p>

        <dl className="guide-glossary">
          <dt>Open</dt>
          <dd>The opening price of the stock at the very start of the day.</dd>
          <dt>Close</dt>
          <dd>The final or current price of the stock when the day ended.</dd>
          <dt>High</dt>
          <dd>The highest price reached by the stock throughout the day.</dd>
          <dt>Low</dt>
          <dd>The lowest price hit by the stock throughout the day.</dd>
        </dl>

        <p className="guide-intro-type">
          There are two types of candles: <strong>Green</strong> and <strong>Red</strong>.
        </p>

        {/* Stacked Vertical Layout */}
        <div className="guide-vertical-stack">
          {/* 1. Green Candle Example */}
          <div className="guide-candle-card">
            <h3 className="guide-candle-title text-green">1. Green Candle (Price Went Up)</h3>
            <p className="guide-narrative">
              A candle turns green when the stock ends the day higher than it started. In this example, the stock <strong>opened at $180</strong> at the start of the day, reached a <strong>high of $187</strong>, dipped to a <strong>low of $179</strong>, and finally <strong>closed at $185</strong> at the end of the day.
            </p>
            <p className="guide-narrative">
              If you decided to buy the stock today at its opening price ($180), and sold it today at its closing price ($185), you would have profited $5. In simple words, green means price started low and ended up higher.
            </p>
            <div className="guide-diagram-wrap">
              <CandleDiagram variant="bull" openPrice={180} highPrice={187} lowPrice={179} closePrice={185} />
            </div>
          </div>

          {/* 2. Red Candle Example */}
          <div className="guide-candle-card">
            <h3 className="guide-candle-title text-red">2. Red Candle (Price Went Down)</h3>
            <p className="guide-narrative">
              A candle turns red when the stock ends the day lower than it started. Here, on the next day, the stock <strong>opened at $185</strong>, climbed to a <strong>high of $187</strong>, dropped to a <strong>low of $176</strong>, and <strong>closed down at $180</strong> at the end of the day.
            </p>
            <p className="guide-narrative">
              If you decided to buy the stock today at its opening price ($185), and sold it today at its closing price ($180), you would have lost $5. In simple words, red means price started high and ended up lower.
            </p>
            <div className="guide-diagram-wrap">
              <CandleDiagram variant="bear" openPrice={185} highPrice={187} lowPrice={176} closePrice={180} />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

/* ----------------------------------------------------------------
   MAIN CONTAINER PAGE
   ---------------------------------------------------------------- */

interface PerformancePageProps {
  defaultTimeframe?: PerformanceTimeframe
}

export default function PerformancePage({ defaultTimeframe = '1y' }: PerformancePageProps) {
  const [mode, setMode] = useState<'stocks' | 'strategies'>('stocks')
  const [query, setQuery] = useState<string>('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)
  const [timeframe, setTimeframe] = useState<string>(defaultTimeframe)
  const [stockData, setStockData] = useState<StockDataResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Instant local filtering using sessionStorage cache
  useEffect(() => {
    if (query.trim().length === 0 || mode !== 'stocks') {
      setSuggestions([])
      return
    }

    const cached = sessionStorage.getItem('all_tickers')
    if (cached) {
      try {
        const allTickers: string[] = JSON.parse(cached)
        const filtered = allTickers
          .filter(symbol => symbol.startsWith(query.toUpperCase()))
          .slice(0, 8)
        setSuggestions(filtered)
      } catch (err) {
        console.error("Error reading ticker cache:", err)
      }
    }
  }, [query, mode])

  useEffect(() => {
    if (!selectedTicker || mode !== 'stocks') return

    const fetchHistory = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/stock/history?ticker=${selectedTicker}&timeframe=${timeframe}`
        )
        if (!response.ok) throw new Error('Failed to fetch stock history data')
        const data: StockDataResponse = await response.json()
        setStockData(data)
      } catch (err: any) {
        setError(err.message || 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [selectedTicker, timeframe, mode])

  const handleSelectTicker = (symbol: string) => {
    setSelectedTicker(symbol)
    setQuery(symbol)
    setSuggestions([])
  }

  return (
    <div className="main-wrapper">
      {/* Main Interactive App Container */}
      <div className="container">
        <div className="mode-container">
          <button
            onClick={() => {
              setMode('stocks')
              setSelectedTicker(null)
              setStockData(null)
              setQuery('')
            }}
            className={`mode-btn ${mode === 'stocks' ? 'active' : ''}`}
          >
            Stocks
          </button>
          <button
            onClick={() => {
              setMode('strategies')
              setSelectedTicker(null)
              setStockData(null)
            }}
            className={`mode-btn ${mode === 'strategies' ? 'active' : ''}`}
          >
            Strategies
          </button>
        </div>

        <div className="control-bar">
          {mode === 'stocks' ? (
            <div className="search-wrapper">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value.toUpperCase())}
                placeholder="Search symbol (e.g. AAPL)..."
                className="search-input"
              />
              {suggestions.length > 0 && (
                <div className="autocomplete-dropdown">
                  {suggestions.map((symbol) => (
                    <div
                      key={symbol}
                      onClick={() => handleSelectTicker(symbol)}
                      className="suggestion-item"
                    >
                      {symbol}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <h3>Strategy Overview</h3>
          )}

          <div className="timeframe-group">
            {['1y', '2y', '5y', 'all'].map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`timeframe-btn ${timeframe === tf ? 'active' : ''}`}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {mode === 'stocks' && !selectedTicker && (
          <div className="empty-card">
            <h3>Nothing selected</h3>
            <p>Type a stock symbol above to load candlestick history.</p>
          </div>
        )}

        {loading && <p className="loading-text">Loading market data...</p>}
        {error && <p className="error-text">Error: {error}</p>}

        {!loading && !error && stockData && mode === 'stocks' && (
          <InteractiveCandlestickChart bars={stockData.data} />
        )}

        {/* GUIDE Section Positioned Below The Search Controls and Graph */}
        {mode === 'stocks' && <CandlestickGuide />}
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------
   Chart Rendering Component
   ---------------------------------------------------------------- */

function InteractiveCandlestickChart({ bars }: { bars: BarData[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(360)
  const [height, setHeight] = useState(400)
  const preferred = useRef(60)
  const [visible, setVisibleState] = useState(60)

  const setVisible = useCallback((next: number | ((current: number) => number)) => {
    setVisibleState((current) => {
      const value = typeof next === 'function' ? next(current) : next
      preferred.current = value
      return value
    })
  }, [])

  const [end, setEnd] = useState(bars.length)
  const [hover, setHover] = useState<{ index: number; x: number; y: number } | null>(null)

  useEffect(() => {
    if (bars.length === 0) return
    setVisibleState(clamp(preferred.current, MIN_VISIBLE, Math.max(MIN_VISIBLE, bars.length)))
    setEnd(bars.length)
  }, [bars])

  useLayoutEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        const w = entry.contentRect.width
        setWidth(w)
        setHeight(w < 500 ? 350 : 450)
      }
    })
    observer.observe(element)
    setWidth(element.clientWidth)
    setHeight(element.clientWidth < 500 ? 350 : 450)
    return () => observer.disconnect()
  }, [])

  const count = Math.min(visible, bars.length)
  const safeEnd = clamp(end, count, bars.length)
  const start = Math.max(0, safeEnd - count)
  const windowData = useMemo(() => bars.slice(start, safeEnd), [bars, start, safeEnd])

  const plotWidth = Math.max(100, width - AXIS_WIDTH)
  const volumeHeight = Math.round((height - PADDING_TOP - PADDING_BOTTOM) * VOLUME_RATIO)
  const priceHeight = height - PADDING_TOP - PADDING_BOTTOM - volumeHeight - 8
  const slot = plotWidth / Math.max(1, windowData.length)
  const candleWidth = Math.max(1, Math.min(14, slot * 0.7))

  const { min, max, maxVolume } = useMemo(() => {
    if (windowData.length === 0) return { min: 0, max: 1, maxVolume: 1 }
    let lo = Infinity
    let hi = -Infinity
    let vol = 0
    for (const bar of windowData) {
      lo = Math.min(lo, bar.low)
      hi = Math.max(hi, bar.high)
      vol = Math.max(vol, bar.volume)
    }
    const pad = (hi - lo) * 0.05 || 1
    return { min: lo - pad, max: hi + pad, maxVolume: vol || 1 }
  }, [windowData])

  const yPrice = useCallback(
    (value: number) => PADDING_TOP + ((max - value) / (max - min)) * priceHeight,
    [max, min, priceHeight]
  )
  const volumeTop = PADDING_TOP + priceHeight + 8
  const yVolume = (value: number) => volumeTop + volumeHeight - (value / maxVolume) * volumeHeight

  const gridLines = useMemo(() => {
    const steps = 4
    return Array.from({ length: steps + 1 }, (_, i) => min + ((max - min) * i) / steps)
  }, [min, max])

  const dateTicks = useMemo(() => {
    if (windowData.length === 0) return []
    const target = Math.max(2, Math.floor(plotWidth / (width < 500 ? 80 : 110)))
    const step = Math.max(1, Math.floor(windowData.length / target))
    const ticks: { index: number; label: string }[] = []
    for (let i = windowData.length - 1; i >= 0; i -= step) {
      ticks.push({ index: i, label: dateLabel(windowData[i]!.date) })
    }
    return ticks
  }, [windowData, plotWidth, width])

  const stateRef = useRef({ count, safeEnd, total: bars.length, slot })
  stateRef.current = { count, safeEnd, total: bars.length, slot }

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const s = stateRef.current
      const factor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1
      const dx = event.deltaX * factor
      const dy = event.deltaY * factor
      if (event.ctrlKey || Math.abs(dx) < Math.abs(dy)) {
        const next = clamp(
          Math.round(s.count * Math.exp(dy * 0.0018)),
          MIN_VISIBLE,
          Math.max(MIN_VISIBLE, s.total)
        )
        setVisible(next)
        setEnd((e) => clamp(e, next, s.total))
      } else {
        const barsMoved = dx / Math.max(1, s.slot)
        setEnd((e) => clamp(Math.round(e + barsMoved), s.count, s.total))
      }
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [setVisible])

  const dragRef = useRef<{ x: number; end: number; touchDist?: number } | null>(null)

  const handlePointerDown = (event: React.PointerEvent) => {
    dragRef.current = { x: event.clientX, end: safeEnd }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const px = event.clientX - rect.left
    const drag = dragRef.current

    if (drag) {
      const moved = (drag.x - event.clientX) / Math.max(1, slot)
      setEnd(clamp(Math.round(drag.end + moved), count, bars.length))
      return
    }

    if (px > plotWidth || windowData.length === 0) {
      setHover(null)
      return
    }
    const index = clamp(Math.floor(px / slot), 0, windowData.length - 1)
    setHover({ index, x: index * slot + slot / 2, y: event.clientY - rect.top })
  }

  const endDrag = () => {
    dragRef.current = null
  }

  const hovered = hover ? windowData[hover.index] : undefined
  const atLatest = safeEnd >= bars.length

  return (
    <div className="chart-card chart-stack">
      <div className="chart-controls-bar">
        <span className="chart-bars-count">{windowData.length} bars</span>
        <div className="chart-controls-actions">
          <button
            type="button"
            className="zoom-btn"
            onClick={() =>
              setVisible((v) =>
                clamp(Math.round(v * 1.3), MIN_VISIBLE, Math.max(MIN_VISIBLE, bars.length))
              )
            }
          >
            −
          </button>
          <button
            type="button"
            className="zoom-btn"
            onClick={() => setVisible((v) => clamp(Math.round(v / 1.3), MIN_VISIBLE, bars.length))}
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setEnd(bars.length)}
            disabled={atLatest}
            className="latest-btn"
          >
            Latest
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => {
          endDrag()
          setHover(null)
        }}
        className="chart-plot-area"
        style={{ height, cursor: dragRef.current ? 'grabbing' : 'crosshair' }}
      >
        <svg width={width} height={height}>
          {gridLines.map((value) => (
            <g key={value}>
              <line
                x1={0}
                x2={plotWidth}
                y1={yPrice(value)}
                y2={yPrice(value)}
                stroke="#1e293b"
                strokeDasharray="2 4"
              />
              <text x={plotWidth + 6} y={yPrice(value) + 4} fontSize={10} fill="#64748b">
                {priceLabel(value)}
              </text>
            </g>
          ))}

          {windowData.map((bar, index) => {
            const cx = index * slot + slot / 2
            const up = bar.close >= bar.open
            const color = up ? '#22c55e' : '#ef4444'
            const top = yPrice(Math.max(bar.open, bar.close))
            const bottom = yPrice(Math.min(bar.open, bar.close))

            return (
              <g key={bar.date || index}>
                <line
                  x1={cx}
                  x2={cx}
                  y1={yPrice(bar.high)}
                  y2={yPrice(bar.low)}
                  stroke={color}
                  strokeWidth={1}
                />
                <rect
                  x={cx - candleWidth / 2}
                  y={top}
                  width={candleWidth}
                  height={Math.max(1, bottom - top)}
                  fill={color}
                />
                <rect
                  x={cx - candleWidth / 2}
                  y={yVolume(bar.volume)}
                  width={candleWidth}
                  height={Math.max(1, volumeTop + volumeHeight - yVolume(bar.volume))}
                  fill={color}
                  opacity={0.35}
                />
              </g>
            )
          })}

          {dateTicks.map((tick) => (
            <text
              key={tick.index}
              x={tick.index * slot + slot / 2}
              y={height - 6}
              fontSize={10}
              textAnchor="middle"
              fill="#64748b"
            >
              {tick.label}
            </text>
          ))}

          {hover && hovered && (
            <g pointerEvents="none">
              <line
                x1={hover.x}
                x2={hover.x}
                y1={PADDING_TOP}
                y2={height - PADDING_BOTTOM}
                stroke="#64748b"
                strokeDasharray="3 3"
              />
              <line
                x1={0}
                x2={plotWidth}
                y1={hover.y}
                y2={hover.y}
                stroke="#64748b"
                strokeDasharray="3 3"
              />
            </g>
          )}
        </svg>

        {hover && hovered && (
          <div
            className="chart-tooltip"
            style={{
              left: clamp(hover.x + 10, 8, Math.max(8, plotWidth - 150)),
              top: clamp(hover.y - 10, 8, height - 120),
            }}
          >
            <p className="chart-tooltip-date">{hovered.date}</p>
            <dl className="chart-tooltip-grid">
              <dt className="chart-tooltip-label">Open</dt>
              <dd className="chart-tooltip-value">${priceLabel(hovered.open)}</dd>
              <dt className="chart-tooltip-label">High</dt>
              <dd className="chart-tooltip-value text-green">${priceLabel(hovered.high)}</dd>
              <dt className="chart-tooltip-label">Low</dt>
              <dd className="chart-tooltip-value text-red">${priceLabel(hovered.low)}</dd>
              <dt className="chart-tooltip-label">Close</dt>
              <dd
                className={`chart-tooltip-value ${
                  hovered.close >= hovered.open ? 'text-green' : 'text-red'
                }`}
              >
                ${priceLabel(hovered.close)}
              </dd>
            </dl>
          </div>
        )}
      </div>
    </div>
  )
}