// StrategyChart.tsx — Strategy runner: strategy list, equity chart, metrics

import React, { useState, useMemo, useRef, useLayoutEffect, useCallback, useEffect } from 'react'
import './StrategyChart.css'
import TradeResults, { type TradeRecord } from './TradeResults'
import DatePicker from '../ui/DatePicker'
import ErrorToast from '../ui/ErrorToast'
import StrategyGuide from './StrategyGuide'
import { LoaderRow, LoaderScreen } from '../ui/Loader'
import Button from '../ui/Button'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export interface BacktestChartPoint {
  date: string
  portfolio_value: number
  active_positions?: number
  transaction_cost?: number
}

export interface StrategyOption {
  id: string
  name: string
  description?: string
}

interface BacktestApiResponse {
  strategy_id: string
  strategy_name: string
  metrics: Record<string, any>
  chart_data: BacktestChartPoint[]
  trades?: Record<string, TradeRecord[]> | TradeRecord[]
}

export interface PortfolioCandle {
  date: string
  open: number
  high: number
  low: number
  close: number
}

const AXIS_WIDTH = 65
const PADDING_TOP = 20
const PADDING_BOTTOM = 30

const formatNumber = (val: number) =>
  val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const formatMetricKey = (key: string) => {
  if (key.toLowerCase() === 'cagr') return 'CAGR'
  if (key.toLowerCase() === 'psr') return 'PSR'
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

const formatMetricValue = (val: any): string => {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return val.toLocaleString()
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
  }
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  return String(val)
}

export default function StrategyChart() {
  const [strategies, setStrategies] = useState<StrategyOption[]>([])
  // The strategy library is read from the store on mount.
  const [strategiesLoading, setStrategiesLoading] = useState(true)
  const [selectedStrategy, setSelectedStrategy] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [inputError, setInputError] = useState<string | null>(null)

  const [backtestResult, setBacktestResult] = useState<BacktestApiResponse | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(500)
  const [height] = useState(420)
  const [chartScrollable, setChartScrollable] = useState(false)

  const [hover, setHover] = useState<{ index: number; x: number; y: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE_URL}/api/strategies`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load strategies list')
        return res.json()
      })
      .then((data: StrategyOption[]) => {
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          setStrategies(data)
          // Open on the first published strategy so a run is one click away.
          setSelectedStrategy((current) => current || data[0]!.id)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStrategies([
            { id: 'stock-health-filter', name: 'Stock Health Filter' },
          ])
        }
      })
      .finally(() => {
        if (!cancelled) setStrategiesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useLayoutEffect(() => {
    const element = containerRef.current
    const scrollEl = scrollRef.current
    if (!element) return
    const update = () => {
      setWidth(element.clientWidth)
      if (scrollEl) {
        setChartScrollable(scrollEl.scrollWidth > scrollEl.clientWidth + 1)
      }
    }
    const observer = new ResizeObserver(update)
    observer.observe(element)
    if (scrollEl) observer.observe(scrollEl)
    update()
    return () => observer.disconnect()
  }, [backtestResult])

  const handleCloseErrors = useCallback(() => {
    setInputError(null)
    setError(null)
  }, [])

  const handleRunCalculation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!startDate) {
      setInputError('Please select a valid start date.')
      return
    }
    if (!selectedStrategy) {
      setInputError('Please select a strategy first.')
      return
    }

    setInputError(null)
    setError(null)

    // Clear out the previous results/trades immediately when a new run starts
    setBacktestResult(null)

    setLoading(true)

    try {
      let url = `${API_BASE_URL}/api/backtest/run?strategy_id=${encodeURIComponent(
        selectedStrategy
      )}&start_date=${encodeURIComponent(startDate)}`

      if (endDate) {
        url += `&end_date=${encodeURIComponent(endDate)}`
      }

      const response = await fetch(url)
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        const detail = errData.detail
        throw new Error(
          typeof detail === 'string' ? detail : 'Backtest run failed. Please check your inputs and dates.'
        )
      }

      const data: BacktestApiResponse = await response.json()
      setBacktestResult(data)
    } catch (err: any) {
      setError(err?.message || 'Error executing backtest.')
    } finally {
      setLoading(false)
    }
  }

  const chartData = backtestResult?.chart_data || []
  const rawMetrics = backtestResult?.metrics || {}

  const candles: PortfolioCandle[] = useMemo(() => {
    if (!chartData || chartData.length === 0) return []
    const list: PortfolioCandle[] = []

    for (let i = 0; i < chartData.length; i++) {
      const curr = chartData[i]
      const prevClose = i > 0 ? chartData[i - 1].portfolio_value : curr.portfolio_value
      const open = prevClose
      const close = curr.portfolio_value

      const high = Math.max(open, close) * (open === close ? 1.001 : 1.0005)
      const low = Math.min(open, close) * (open === close ? 0.999 : 0.9995)

      list.push({
        date: curr.date,
        open,
        high,
        low,
        close,
      })
    }
    return list
  }, [chartData])

  const { minVal, maxVal, plotWidth, plotHeight } = useMemo(() => {
    const pw = Math.max(100, width - AXIS_WIDTH)
    const ph = Math.max(100, height - PADDING_TOP - PADDING_BOTTOM)

    if (!candles || candles.length === 0) {
      return { minVal: 0, maxVal: 100, plotWidth: pw, plotHeight: ph }
    }

    let min = Infinity
    let max = -Infinity

    for (const c of candles) {
      if (c.low < min) min = c.low
      if (c.high > max) max = c.high
    }

    const padding = (max - min) * 0.08 || 5
    return {
      minVal: Math.max(0, min - padding),
      maxVal: max + padding,
      plotWidth: pw,
      plotHeight: ph,
    }
  }, [candles, width, height])

  const getY = useCallback(
    (val: number) => {
      if (maxVal === minVal) return PADDING_TOP + plotHeight / 2
      return PADDING_TOP + (1 - (val - minVal) / (maxVal - minVal)) * plotHeight
    },
    [minVal, maxVal, plotHeight]
  )

  const gridTicks = useMemo(() => {
    const steps = 4
    return Array.from({ length: steps + 1 }, (_, i) => minVal + ((maxVal - minVal) * i) / steps)
  }, [minVal, maxVal])

  const orderedMetricsList = useMemo(() => {
    if (!rawMetrics || Object.keys(rawMetrics).length === 0) return []

    // Hardcoded layout ordering for metrics
    const metricOrder = [
      'starting_value',
      'ending_value',
      'cagr',
      'sharpe',
      'sortino',
      'psr',
      'win_rate',
      'loss_rate',
      'average_win',
      'average_loss',
      'max_drawdown',
      'expectancy',
      'drawdown_recovery',
      'unrealized_profit',
    ]

    const normalizeKey = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '')

    // Map normalized key representations to actual backend keys
    const rawKeyMap = new Map<string, string>()
    Object.keys(rawMetrics).forEach((k) => {
      rawKeyMap.set(normalizeKey(k), k)
    })

    const items: Array<{ key: string; label: string; value: any }> = []
    const usedRawKeys = new Set<string>()

    // 1. Process target ordered keys
    metricOrder.forEach((targetKey) => {
      const normalizedTarget = normalizeKey(targetKey)
      const actualRawKey = rawKeyMap.get(normalizedTarget)

      if (actualRawKey && rawMetrics[actualRawKey] !== undefined && !usedRawKeys.has(actualRawKey)) {
        usedRawKeys.add(actualRawKey)
        items.push({
          key: actualRawKey,
          label: formatMetricKey(actualRawKey),
          value: rawMetrics[actualRawKey],
        })
      }
    })

    // 2. Append any extra flat metrics not defined in metricOrder.
    // Nested payloads (e.g. rejected_orders) are diagnostic data, not a
    // headline metric, so they are skipped rather than stringified.
    const isDisplayable = (val: unknown) =>
      typeof val === 'number' || typeof val === 'string' || typeof val === 'boolean'

    Object.keys(rawMetrics).forEach((rawKey) => {
      if (!usedRawKeys.has(rawKey) && isDisplayable(rawMetrics[rawKey])) {
        items.push({
          key: rawKey,
          label: formatMetricKey(rawKey),
          value: rawMetrics[rawKey],
        })
      }
    })

    return items
  }, [rawMetrics])

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!candles || candles.length === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left

    if (px < 0 || px > plotWidth) {
      setHover(null)
      return
    }

    const step = plotWidth / Math.max(1, candles.length - 1)
    const index = Math.min(candles.length - 1, Math.max(0, Math.round(px / step)))
    const x = index * step
    const y = getY(candles[index].close)

    setHover({ index, x, y })
  }

  const hoveredCandle = hover && candles[hover.index] ? candles[hover.index] : null

  return (
    <div className="strategy-card">
      {(inputError || error) && (
        <ErrorToast message={inputError || error!} onClose={handleCloseErrors} />
      )}

      <div className="strategy-workspace">
        <aside className="strategy-library" aria-label="Strategy library">
          <div className="strategy-library-head" aria-hidden="true">
            <span>Strategy</span>
            <span>{strategiesLoading ? '…' : strategies.length}</span>
          </div>

          <div className="strategy-library-scroll">
            {strategiesLoading && (
              <div className="strategy-library-status">
                <LoaderRow label="Loading the strategy library…" />
              </div>
            )}

            {!strategiesLoading && strategies.length === 0 && (
              <p className="strategy-library-status">No published strategies yet.</p>
            )}

            {!strategiesLoading && strategies.length > 0 && (
              <ul className="strategy-library-list">
                {strategies.map((strategy) => {
                  const isActive = strategy.id === selectedStrategy
                  return (
                    <li key={strategy.id}>
                      <button
                        type="button"
                        className={`strategy-row ${isActive ? 'is-active' : ''}`}
                        aria-pressed={isActive}
                        // A run is already in flight; switching underneath it
                        // would leave the results under the wrong name.
                        disabled={loading}
                        onClick={() => {
                          setSelectedStrategy(strategy.id)
                          if (inputError) setInputError(null)
                        }}
                      >
                        <span className="strategy-row-name">{strategy.name}</span>
                        {strategy.description && (
                          <span className="strategy-row-desc">{strategy.description}</span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </aside>

        <div className="strategy-detail">
          <div className="strategy-controls-bar">
            <form className="strategy-date-form" onSubmit={handleRunCalculation}>
              <DatePicker
                id="start-date"
                label="Start Date *"
                value={startDate}
                onChange={(dateStr) => {
                  setStartDate(dateStr)
                  if (inputError) setInputError(null)
                }}
                placeholder="2020-01-01"
              />

              <DatePicker
                id="end-date"
                label="End Date (Optional)"
                value={endDate}
                onChange={(dateStr) => setEndDate(dateStr)}
                placeholder="Select end date"
              />

              <Button type="submit" variant="primary" size="md" disabled={loading || strategiesLoading}>
                {loading ? 'Running...' : 'Run Analysis'}
              </Button>
            </form>
          </div>

          {loading && (
            <LoaderScreen
              label={`Running ${strategies.find((s) => s.id === selectedStrategy)?.name || 'strategy'}…`}
              sub="Simulating the backtest engine over your date range — this can take a moment."
            />
          )}

          {!loading && !error && !backtestResult && !strategiesLoading && (
            <div className="empty-state">
              <p className="empty-state-title">No backtest yet</p>
              <p className="empty-state-body">
                Pick a strategy from the list, set a start date, then run the analysis.
              </p>
            </div>
          )}

          {!loading && !error && backtestResult && (
            <>
              <article className="strategy-chart-container">
                <div className="strategy-chart-header">
                  <h3 className="strategy-title">{backtestResult.strategy_name}</h3>
                  {candles.length > 0 && (
                    <span className="strategy-subtext">
                      {candles[0].date} to {candles[candles.length - 1].date}
                    </span>
                  )}
                </div>

                <div className="strategy-chart-scroll" ref={scrollRef}>
                  <div
                    ref={containerRef}
                    className="strategy-plot-area"
                    style={{ height }}
                    onPointerMove={handlePointerMove}
                    onPointerLeave={() => setHover(null)}
                  >
                    <svg width={width} height={height}>
                      {gridTicks.map((val) => {
                        const y = getY(val)
                        return (
                          <g key={val}>
                            <line x1={0} x2={plotWidth} y1={y} y2={y} className="strategy-grid-line" />
                            <text x={plotWidth + 8} y={y + 4} className="strategy-axis-label">
                              {formatNumber(val)}
                            </text>
                          </g>
                        )
                      })}

                      {candles.map((candle, idx) => {
                        const step = plotWidth / Math.max(1, candles.length - 1)
                        const x = idx * step
                        const openY = getY(candle.open)
                        const closeY = getY(candle.close)
                        const highY = getY(candle.high)
                        const lowY = getY(candle.low)

                        const isBullish = candle.close >= candle.open
                        const candleColor = isBullish ? 'var(--success)' : 'var(--error)'

                        const candleWidth = Math.max(2, Math.min(8, step * 0.7))
                        const topY = Math.min(openY, closeY)
                        const bodyHeight = Math.max(1, Math.abs(closeY - openY))

                        return (
                          <g key={candle.date + idx}>
                            <line x1={x} x2={x} y1={highY} y2={lowY} stroke={candleColor} strokeWidth={1} />
                            <rect
                              x={x - candleWidth / 2}
                              y={topY}
                              width={candleWidth}
                              height={bodyHeight}
                              fill={candleColor}
                              rx={1}
                            />
                          </g>
                        );
                      })}

                      {hover && (
                        <g pointerEvents="none">
                          <line
                            x1={hover.x}
                            x2={hover.x}
                            y1={PADDING_TOP}
                            y2={PADDING_TOP + plotHeight}
                            className="strategy-crosshair"
                          />
                        </g>
                      )}
                    </svg>

                    {hoveredCandle && hover && (
                      <div
                        className="strategy-tooltip"
                        style={{
                          left: Math.min(hover.x + 12, plotWidth - 160),
                          top: Math.max(PADDING_TOP, hover.y - 65),
                        }}
                      >
                        <p className="tooltip-date">{hoveredCandle.date}</p>
                        <p className="tooltip-value">O: {formatNumber(hoveredCandle.open)}</p>
                        <p className="tooltip-value">C: {formatNumber(hoveredCandle.close)}</p>
                      </div>
                    )}
                  </div>
                </div>

                {chartScrollable && (
                  <p className="strategy-scroll-hint">Swipe to scroll chart</p>
                )}
              </article>

              {orderedMetricsList.length > 0 && (
                <article className="strategy-metrics-card">
                  <h4 className="strategy-metrics-title">Performance metrics</h4>
                  <div className="strategy-metrics-grid">
                    {orderedMetricsList.map(({ key, label, value }) => {
                      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '')
                      const formattedVal = formatMetricValue(value)
                      const isNumeric = typeof value === 'number'
                      const isPositive = isNumeric && value > 0
                      const isNegative = isNumeric && value < 0

                      let colorClass = ''
                      if (normalizedKey.includes('winrate')) {
                        colorClass = 'is-positive'
                      } else if (normalizedKey.includes('return') || normalizedKey.includes('cagr')) {
                        colorClass = isPositive ? 'is-positive' : isNegative ? 'is-negative' : ''
                      } else if (normalizedKey.includes('drawdown') || normalizedKey.includes('lossrate')) {
                        colorClass = 'is-negative'
                      }

                      return (
                        <div className="strategy-metric" key={key}>
                          <span className="strategy-metric-label">{label}</span>
                          <span className={`strategy-metric-value ${colorClass}`}>{formattedVal}</span>
                        </div>
                      )
                    })}
                  </div>
                </article>
              )}
            </>
          )}
        </div>
      </div>

      {backtestResult && <TradeResults trades={backtestResult.trades ?? null} />}

      <StrategyGuide />
    </div>
  )
}
