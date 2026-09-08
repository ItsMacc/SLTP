// src/components/StrategyChart.tsx
import React, { useState, useMemo, useRef, useLayoutEffect, useCallback, useEffect } from 'react'
import './StrategyChart.css'
import Select, { type SelectOption } from '../ui/Select'
import TradeResults, { type TradeRecord } from './TradeResults'
import DatePicker from '../ui/DatePicker'

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
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStrategies([{ id: 'stock-health-filter', name: 'Stock Health Filter' }])
        }
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

  const handleRunCalculation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!startDate) {
      setInputError('Please select a valid start date.')
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
        throw new Error(errData.detail || 'Backtest run failed. Please check inputs.')
      }

      const data: BacktestApiResponse = await response.json()
      setBacktestResult(data)
    } catch (err: any) {
      setError(err.message || 'Error executing backtest.')
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

    const findKey = (...aliases: string[]) => {
      const keys = Object.keys(rawMetrics)
      return keys.find((k) =>
        aliases.some(
          (alias) =>
            k.toLowerCase().replace(/[^a-z0-9]/g, '') === alias.toLowerCase().replace(/[^a-z0-9]/g, '')
        )
      )
    }

    const startValKey = findKey('starting_value', 'start_value', 'initial_capital')
    const endValKey = findKey('ending_value', 'end_value', 'final_value')

    const cagrKey = findKey('cagr', 'annualized_return')
    const sharpeKey = findKey('sharpe', 'sharpe_ratio')

    const sortinoKey = findKey('sortino', 'sortino_ratio')
    const psrKey = findKey('psr', 'probabilistic_sharpe_ratio')

    const winRateKey = findKey('win_rate', 'winrate')
    const lossRateKey = findKey('loss_rate', 'lossrate')

    const avgWinKey = findKey('average_win', 'avg_win')
    const avgLossKey = findKey('average_loss', 'avg_loss')

    const maxDrawdownKey = findKey('max_drawdown', 'max_drawdown_pct')
    const expectancyKey = findKey('expectancy')

    const ddRecoveryKey = findKey('drawdown_recovery', 'recovery_factor')
    const unrealizedCashKey = findKey('unrealized_cash', 'unrealised_cash', 'cash')

    const items: Array<{ key: string; label: string; value: any }> = []
    const usedKeySet = new Set<string>()

    const rawPnlKey = findKey('pnl')
    if (rawPnlKey) usedKeySet.add(rawPnlKey)

    const appendKey = (k?: string) => {
      if (k && rawMetrics[k] !== undefined && !usedKeySet.has(k)) {
        usedKeySet.add(k)
        items.push({ key: k, label: formatMetricKey(k), value: rawMetrics[k] })
      }
    }

    appendKey(startValKey)
    appendKey(endValKey)
    appendKey(cagrKey)
    appendKey(sharpeKey)
    appendKey(sortinoKey)
    appendKey(psrKey)
    appendKey(winRateKey)
    appendKey(lossRateKey)
    appendKey(avgWinKey)
    appendKey(avgLossKey)
    appendKey(maxDrawdownKey)
    appendKey(expectancyKey)
    appendKey(ddRecoveryKey)
    appendKey(unrealizedCashKey)

    Object.keys(rawMetrics).forEach((k) => {
      if (!usedKeySet.has(k)) {
        appendKey(k)
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

  const selectOptions = useMemo(() => {
    const options: SelectOption[] = [{ label: 'None', value: '' }]
    strategies.forEach((s) => {
      options.push({ label: s.name, value: s.id })
    })
    return options
  }, [strategies])

  return (
    <div className="strategy-card">
      <div className="strategy-controls-bar">
        <form className="strategy-date-form" onSubmit={handleRunCalculation}>
          {selectOptions.length > 0 && (
            <Select
              label="Strategy"
              options={selectOptions}
              value={selectedStrategy}
              onChange={(val) => setSelectedStrategy(val as string)}
            />
          )}

          <DatePicker
            id="start-date"
            label="Start Date *"
            value={startDate}
            error={inputError || undefined}
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

          <button type="submit" className="run-strategy-btn" disabled={loading}>
            {loading ? 'Running...' : 'Run Analysis'}
          </button>
        </form>
      </div>

      {loading && <p className="status-text">Executing backtest engine...</p>}
      {error && <p className="status-text is-error">{error}</p>}

      {!loading && !error && !backtestResult && (
        <div className="empty-state">
          <p className="empty-state-title">No Strategy Selected</p>
          <p className="empty-state-body">
            Select a start date above and click 'Run Analysis' to execute the backtest.
          </p>
        </div>
      )}

      {!loading && !error && backtestResult && (
        <div className="strategy-content-layout">
          <div className="strategy-chart-container">
            <div className="strategy-chart-header">
              <h3 className="strategy-title">{backtestResult.strategy_name}</h3>
              {candles.length > 0 && (
                <span className="strategy-subtext">
                  {candles[0].date} — {candles[candles.length - 1].date}
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
                  )
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
          </div>

          <div className="strategy-metrics-sidebar">
            <h4 className="metrics-title">Performance Metrics</h4>
            <div className="metrics-grid">
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
                  <div className="metric-card" key={key}>
                    <span className="metric-label">{label}</span>
                    <span className={`metric-value ${colorClass}`}>{formattedVal}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {backtestResult && <TradeResults trades={backtestResult.trades ?? null} />}
    </div>
  )
}