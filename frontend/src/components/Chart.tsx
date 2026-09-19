// Chart.tsx — Candlestick chart with toolbar and tooltip
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import './Chart.css'

export interface Bar {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface ChartProps {
  bars: Bar[]
  ticker: string
}

const AXIS_WIDTH = 54
const PADDING_TOP = 16
const PADDING_BOTTOM = 24
const VOLUME_RATIO = 0.18
const MIN_VISIBLE = 15
const DEFAULT_VISIBLE = 90

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const priceLabel = (value: number) =>
  value >= 1000 ? value.toFixed(0) : value >= 10 ? value.toFixed(1) : value.toFixed(2)

const dateLabel = (iso: string) => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y.slice(2)}`
}

const volumeLabel = (value: number) => {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return `${value}`
}

/**
 * Candle + volume chart with wheel-zoom, click-drag panning, and a
 * crosshair tooltip. All the interaction state lives here so the page
 * itself only ever has to pass in a ticker and a list of bars.
 */
export default function Chart({ bars, ticker }: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(360)
  const [height, setHeight] = useState(420)

  const preferred = useRef(DEFAULT_VISIBLE)
  const [visible, setVisibleState] = useState(DEFAULT_VISIBLE)
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
      if (!entry) return
      const w = entry.contentRect.width
      setWidth(w)
      setHeight(w < 560 ? 360 : 440)
    })
    observer.observe(element)
    setWidth(element.clientWidth)
    setHeight(element.clientWidth < 560 ? 360 : 440)
    return () => observer.disconnect()
  }, [])

  const count = Math.min(visible, bars.length)
  const safeEnd = clamp(end, count, bars.length)
  const start = Math.max(0, safeEnd - count)
  const windowData = useMemo(() => bars.slice(start, safeEnd), [bars, start, safeEnd])

  const plotWidth = Math.max(100, width - AXIS_WIDTH)
  const volumeHeight = Math.round((height - PADDING_TOP - PADDING_BOTTOM) * VOLUME_RATIO)
  const priceHeight = height - PADDING_TOP - PADDING_BOTTOM - volumeHeight - 10
  const slot = plotWidth / Math.max(1, windowData.length)
  const candleWidth = Math.max(1, Math.min(14, slot * 0.66))

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
    const pad = (hi - lo) * 0.06 || 1
    return { min: lo - pad, max: hi + pad, maxVolume: vol || 1 }
  }, [windowData])

  const yPrice = useCallback(
    (value: number) => PADDING_TOP + ((max - value) / (max - min)) * priceHeight,
    [max, min, priceHeight]
  )
  const volumeTop = PADDING_TOP + priceHeight + 10
  const yVolume = (value: number) => volumeTop + volumeHeight - (value / maxVolume) * volumeHeight

  const gridLines = useMemo(() => {
    const steps = 4
    return Array.from({ length: steps + 1 }, (_, i) => min + ((max - min) * i) / steps)
  }, [min, max])

  const dateTicks = useMemo(() => {
    if (windowData.length === 0) return []
    const target = Math.max(2, Math.floor(plotWidth / (width < 560 ? 84 : 120)))
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
        const next = clamp(Math.round(s.count * Math.exp(dy * 0.0018)), MIN_VISIBLE, Math.max(MIN_VISIBLE, s.total))
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

  const dragRef = useRef<{ x: number; end: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  const handlePointerDown = (event: React.PointerEvent) => {
    dragRef.current = { x: event.clientX, end: safeEnd }
    setDragging(true)
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
    setDragging(false)
  }

  const hovered = hover ? windowData[hover.index] : undefined
  const atLatest = safeEnd >= bars.length
  const first = bars[0]
  const last = bars[bars.length - 1]
  const change = first && last ? last.close - first.close : 0
  const changePct = first && last && first.close !== 0 ? (change / first.close) * 100 : 0

  return (
    <div className="chart-card">
      <div className="chart-toolbar">
        <div className="chart-toolbar-info">
          <span className="chart-ticker">{ticker}</span>
          {last && (
            <span className="chart-last-price">
              ${priceLabel(last.close)}
              <span className={`chart-change ${change >= 0 ? 'is-up' : 'is-down'}`}>
                {change >= 0 ? '+' : ''}
                {change.toFixed(2)} ({changePct >= 0 ? '+' : ''}
                {changePct.toFixed(2)}%)
              </span>
            </span>
          )}
        </div>
        <div className="chart-toolbar-actions">
          <span className="chart-bars-count">{windowData.length} bars visible</span>
          <div className="chart-zoom-group">
            <button
              type="button"
              aria-label="Zoom out"
              className="chart-zoom-btn"
              onClick={() => setVisible((v) => clamp(Math.round(v * 1.3), MIN_VISIBLE, Math.max(MIN_VISIBLE, bars.length)))}
            >
              −
            </button>
            <button
              type="button"
              aria-label="Zoom in"
              className="chart-zoom-btn"
              onClick={() => setVisible((v) => clamp(Math.round(v / 1.3), MIN_VISIBLE, bars.length))}
            >
              +
            </button>
          </div>
          <button type="button" onClick={() => setEnd(bars.length)} disabled={atLatest} className="chart-latest-btn">
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
        style={{ height, cursor: dragging ? 'grabbing' : 'crosshair' }}
      >
        <svg width={width} height={height}>
          {gridLines.map((value) => (
            <g key={value}>
              <line x1={0} x2={plotWidth} y1={yPrice(value)} y2={yPrice(value)} className="chart-grid-line" />
              <text x={plotWidth + 8} y={yPrice(value) + 4} className="chart-axis-label">
                {priceLabel(value)}
              </text>
            </g>
          ))}

          {windowData.map((bar, index) => {
            const cx = index * slot + slot / 2
            const up = bar.close >= bar.open
            const top = yPrice(Math.max(bar.open, bar.close))
            const bottom = yPrice(Math.min(bar.open, bar.close))

            return (
              <g key={bar.date || index} className={up ? 'candle-up' : 'candle-down'}>
                <line x1={cx} x2={cx} y1={yPrice(bar.high)} y2={yPrice(bar.low)} className="candle-wick" />
                <rect x={cx - candleWidth / 2} y={top} width={candleWidth} height={Math.max(1, bottom - top)} className="candle-body" />
                <rect
                  x={cx - candleWidth / 2}
                  y={yVolume(bar.volume)}
                  width={candleWidth}
                  height={Math.max(1, volumeTop + volumeHeight - yVolume(bar.volume))}
                  className="candle-volume"
                />
              </g>
            )
          })}

          {dateTicks.map((tick) => (
            <text key={tick.index} x={tick.index * slot + slot / 2} y={height - 6} textAnchor="middle" className="chart-axis-label">
              {tick.label}
            </text>
          ))}

          {hover && hovered && (
            <g pointerEvents="none">
              <line x1={hover.x} x2={hover.x} y1={PADDING_TOP} y2={height - PADDING_BOTTOM} className="chart-crosshair" />
              <line x1={0} x2={plotWidth} y1={hover.y} y2={hover.y} className="chart-crosshair" />
            </g>
          )}
        </svg>

        {hover && hovered && (
          <div
            className="chart-tooltip"
            style={{
              left: clamp(hover.x + 12, 8, Math.max(8, plotWidth - 160)),
              top: clamp(hover.y - 10, 8, height - 140),
            }}
          >
            <p className="chart-tooltip-date">{hovered.date}</p>
            <dl className="chart-tooltip-grid">
              <dt>Open</dt>
              <dd>${priceLabel(hovered.open)}</dd>
              <dt>High</dt>
              <dd className="is-up">${priceLabel(hovered.high)}</dd>
              <dt>Low</dt>
              <dd className="is-down">${priceLabel(hovered.low)}</dd>
              <dt>Close</dt>
              <dd className={hovered.close >= hovered.open ? 'is-up' : 'is-down'}>${priceLabel(hovered.close)}</dd>
              <dt>Volume</dt>
              <dd>{volumeLabel(hovered.volume)}</dd>
            </dl>
          </div>
        )}
      </div>

      <p className="chart-hint">Scroll to zoom, drag to pan, hover for detail.</p>
    </div>
  )
}