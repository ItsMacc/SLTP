// StrategyChart.tsx — Strategy runner: strategy list, equity chart, metrics

import React, {
  useState,
  useMemo,
  useRef,
  useLayoutEffect,
  useCallback,
  useEffect,
  useSyncExternalStore,
} from 'react'
import './StrategyChart.css'
import TradeResults, { type TradeRecord } from './TradeResults'
import DatePicker from '../ui/DatePicker'
import ErrorToast from '../ui/ErrorToast'
import StrategyGuide from './StrategyGuide'
import {
  ENGINE_STRATEGIES,
  MOBILE_HISTORY_START,
  IS_MOBILE,
  runStrategy,
  useEngineStatus,
} from '../store'
import { LoaderRow } from '../ui/Loader'
import Button from '../ui/Button'


export interface BacktestChartPoint {
  date: string
  portfolio_value: number
  active_positions?: number
  transaction_cost?: number
  trading_cost?: number
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
  timings?: Record<string, number>
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

/** One backtest at a time, owned outside React.
 *
 * The run used to live in component state, so leaving Research cancelled the
 * view of it and coming back showed an empty form. This job keeps going while
 * the page is elsewhere: return and you see either the result or the run
 * still ticking. Session-lived on purpose; a reload starts clean.
 */
interface RunJob {
  status: 'idle' | 'running' | 'done' | 'error'
  strategyId: string
  startDate: string
  endDate: string
  result: BacktestApiResponse | null
  error: string | null
  startedAt: number | null
}

let runJob: RunJob = {
  status: 'idle',
  strategyId: '',
  startDate: '',
  endDate: '',
  result: null,
  error: null,
  startedAt: null,
}

const runListeners = new Set<() => void>()

function setRunJob(patch: Partial<RunJob>): void {
  runJob = { ...runJob, ...patch }
  runListeners.forEach((fn) => fn())
}

function subscribeRunJob(fn: () => void): () => void {
  runListeners.add(fn)
  return () => {
    runListeners.delete(fn)
  }
}

function startRunJob(strategyId: string, start: string, end: string): void {
  if (runJob.status === 'running') return
  setRunJob({
    status: 'running',
    strategyId,
    startDate: start,
    endDate: end,
    result: null,
    error: null,
    startedAt: Date.now(),
  })
  void runStrategy(strategyId, start, end || undefined)
    .then((run) => {
      setRunJob({
        status: 'done',
        result: {
          strategy_id: run.key,
          strategy_name: run.name,
          metrics: run.stats as Record<string, any>,
          chart_data: run.equity.map((point) => ({
            date: point.date,
            portfolio_value: point.value,
          })),
          trades: run.trades,
          timings: run.timings as unknown as Record<string, number> | undefined,
        },
      })
    })
    .catch((err: Error) => {
      setRunJob({ status: 'error', error: err?.message || 'Error executing backtest.' })
    })
}

// A phone only holds the last five years of bars, so a run cannot start
// before that day; the field, the submit and the note below all agree.
const MOBILE = IS_MOBILE

const formatNumber = (val: number) =>
  val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** One line naming where a run spent its time, so a slow phone can be
    diagnosed without a console. */
const timingLine = (t: Record<string, number>): string => {
  const total = t.run_seconds ?? 0
  const io = t.io_seconds ?? 0
  const files = t.bridge_files ?? 0
  const mb = (t.bridge_bytes ?? 0) / 1_048_576
  const warm = t.warm_seconds ?? 0
  const parts: string[] = []
  if (warm >= 0.5) parts.push(`first-run setup ${warm.toFixed(1)}s`)
  parts.push(
    `Run ${total.toFixed(1)}s`,
    `bar reads ${io.toFixed(1)}s`,
    `engine ${Math.max(0, total - io).toFixed(1)}s`,
  )
  parts.push(
    files > 0
      ? `${files} file${files === 1 ? '' : 's'} fetched (${mb.toFixed(1)} MB in ${(t.bridge_seconds ?? 0).toFixed(1)}s)`
      : 'all data local',
  )
  return parts.join(' · ')
}

const formatMetricKey = (key: string) => {
  if (key.toLowerCase() === 'cagr') return 'CAGR'
  if (key.toLowerCase() === 'psr') return 'PSR'
  if (key.toLowerCase() === 'turnover') return 'Turnover (annualized)'
  if (key.toLowerCase() === 'cost_drag') return 'Cost drag (annualized)'
  if (key.toLowerCase() === 'total_trading_cost') return 'Total trading cost'
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

const formatMetricValue = (val: any, key = ''): string => {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'number') {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (normalized === 'turnover' || normalized === 'costdrag') {
      return `${val.toFixed(2)}%`
    }
    if (normalized === 'totaltradingcost') return `${val.toFixed(2)} pts`
    if (Number.isInteger(val)) return val.toLocaleString()
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
  }
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  return String(val)
}

export default function StrategyChart({
  initialStrategyId,
}: {
  initialStrategyId?: string
} = {}) {
  const engine = useEngineStatus()
  const engineUnsupported = engine.phase === 'unsupported'
  const [strategies, setStrategies] = useState<StrategyOption[]>([])
  // The strategy library is read from the store on mount.
  const [strategiesLoading, setStrategiesLoading] = useState(true)
  // The registry could not be read, which is not the same as it being empty.
  const [strategiesUnavailable, setStrategiesUnavailable] = useState(false)
  const job = useSyncExternalStore(subscribeRunJob, () => runJob, () => runJob)
  const loading = job.status === 'running'
  const backtestResult = job.result
  const runError = job.error

  const [selectedStrategy, setSelectedStrategy] = useState<string>(runJob.strategyId)
  const [startDate, setStartDate] = useState<string>(runJob.startDate)
  const [endDate, setEndDate] = useState<string>(runJob.endDate)
  const [inputError, setInputError] = useState<string | null>(null)

  // Wall-clock seconds since the run started. A run has no engine-reported
  // percentage yet, so the timer is what tells the reader it is moving.
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!loading) return
    const started = job.startedAt ?? Date.now()
    const update = () => setElapsed(Math.floor((Date.now() - started) / 1000))
    update()
    const tick = setInterval(update, 1000)
    return () => clearInterval(tick)
  }, [loading, job.startedAt])

  // The form keeps its last values for the next visit, but never overwrites
  // the question a run in flight is answering.
  useEffect(() => {
    if (runJob.status === 'running') return
    setRunJob({ strategyId: selectedStrategy, startDate, endDate })
  }, [selectedStrategy, startDate, endDate])

  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(500)
  const [height] = useState(420)
  // The scrubber mirrors the horizontal scroll position, so it has to move
  // when the reader swipes the chart as well as when they drag the thumb.
  const [scrollLeft, setScrollLeft] = useState(0)
  const [scrollMax, setScrollMax] = useState(0)

  const [hover, setHover] = useState<{ index: number; x: number; y: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    // The runnable strategies live in the browser bundle now: the registry
    // above, executed by the engine worker. No server decides what can run.
    Promise.resolve()
      .then(() =>
        ENGINE_STRATEGIES.map(({ id, name, description }) => ({ id, name, description }))
      )
      .then((data: StrategyOption[]) => {
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          setStrategies(data)
          // Open on the strategy the library handed over, then on the first
          // published one, so a run is one click away either way.
          const handed = data.find((entry) => entry.id === initialStrategyId)?.id
          setSelectedStrategy((current) => handed ?? (current || data[0]!.id))
        }
      })
      .catch(() => {
        if (!cancelled) {
          /* No substitute list. The engine decides what can be run, so a
             locally invented entry only offers a strategy the server will
             reject — which is how one deleted from the registry stayed on
             screen here. An unreachable API shows nothing and says so. */
          setStrategiesUnavailable(true)
        }
      })
      .finally(() => {
        if (!cancelled) setStrategiesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [initialStrategyId])

  useLayoutEffect(() => {
    const element = containerRef.current
    const scrollEl = scrollRef.current
    if (!element) return
    const update = () => {
      setWidth(element.clientWidth)
      if (scrollEl) {
        setScrollMax(Math.max(0, scrollEl.scrollWidth - scrollEl.clientWidth))
        setScrollLeft(scrollEl.scrollLeft)
      }
    }
    const onScroll = () => {
      if (scrollEl) setScrollLeft(scrollEl.scrollLeft)
    }
    const observer = new ResizeObserver(update)
    observer.observe(element)
    if (scrollEl) {
      observer.observe(scrollEl)
      scrollEl.addEventListener('scroll', onScroll, { passive: true })
    }
    update()
    return () => {
      observer.disconnect()
      scrollEl?.removeEventListener('scroll', onScroll)
    }
  }, [backtestResult])

  const handleCloseErrors = useCallback(() => {
    setInputError(null)
    setRunJob({ error: null })
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

    // A phone's cache starts five years back. A run asked to start earlier
    // begins at the earliest day it can actually read, not with an error.
    const start = MOBILE && startDate < MOBILE_HISTORY_START ? MOBILE_HISTORY_START : startDate
    if (start !== startDate) setStartDate(start)

    setInputError(null)
    // The run belongs to the module store, so leaving this page neither
    // cancels it nor forgets it.
    startRunJob(selectedStrategy, start, endDate)
  }

  const chartData = useMemo(() => backtestResult?.chart_data || [], [backtestResult])
  const rawMetrics = useMemo(() => backtestResult?.metrics || {}, [backtestResult])

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
      'turnover',
      'cost_drag',
      'total_trading_cost',
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
      {(inputError || runError) && (
        <ErrorToast message={inputError || runError!} onClose={handleCloseErrors} />
      )}

      <div className="strategy-workspace">
        <aside className="strategy-library" aria-label="Strategy library">
          <div className="strategy-library-head">
            <span className="strategy-library-title">Strategies</span>
            <span className="strategy-library-count">
              {strategiesLoading ? '…' : strategies.length}
            </span>
          </div>

          <div className="strategy-library-scroll">
            {strategiesLoading && (
              <div className="strategy-library-status">
                <LoaderRow label="Loading the strategy library…" />
              </div>
            )}

            {!strategiesLoading && strategiesUnavailable && (
              <p className="strategy-library-status">
                Could not load the strategy library. The backtest engine did not respond.
              </p>
            )}

            {!strategiesLoading && !strategiesUnavailable && strategies.length === 0 && (
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
          {engineUnsupported ? (
            <div className="empty-state">
              <p className="empty-state-title">The engine could not start here</p>
              <p className="empty-state-body">
                Backtests run in this browser against the market cache, and this
                browser did not start the engine. The library still reads; reload
                to try the numbers again.
              </p>
            </div>
          ) : (
          <>
          <div className="strategy-controls-bar">
            <form className="strategy-date-form" onSubmit={handleRunCalculation}>
              <DatePicker
                id="start-date"
                label="Start date"
                value={startDate}
                onChange={(dateStr) => {
                  setStartDate(dateStr)
                  if (inputError) setInputError(null)
                }}
                placeholder="2020-01-01"
                min={MOBILE ? MOBILE_HISTORY_START : undefined}
              />

              <DatePicker
                id="end-date"
                label="End date (optional)"
                value={endDate}
                onChange={(dateStr) => setEndDate(dateStr)}
                placeholder="Select end date"
              />

              <Button type="submit" variant="primary" size="md" disabled={loading || strategiesLoading}>
                {loading ? 'Running…' : 'Run backtest'}
              </Button>
            </form>
          </div>

          {MOBILE && (
            <p className="strategy-mobile-note">
              * Backtests on mobiles can only run up to 5 years of data. Switch to
              desktop to get full access to all data.
            </p>
          )}

          {loading && (
            <div className="run-progress" role="status" aria-live="polite">
              <div className="run-progress-head">
                <span className="run-progress-title">
                  Running {strategies.find((s) => s.id === selectedStrategy)?.name || 'strategy'}…
                </span>
                <span className="run-progress-clock">
                  {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
                </span>
              </div>
              <div className="run-progress-track" aria-hidden="true">
                <span className="run-progress-fill" />
              </div>
              <p className="run-progress-note">
                {engine.phase === 'loading'
                  ? engine.detail || 'Loading the engine. The first run of a visit takes a few extra seconds.'
                  : 'The first run can take a while — the engine is warming and the data is being read. Later runs are much quicker. You can leave this tab and come back; the run keeps going.'}
              </p>
            </div>
          )}

          {!loading && !runError && !backtestResult && !strategiesLoading && (
            <div className="empty-state">
              <p className="empty-state-title">No backtest yet</p>
              <p className="empty-state-body">
                Choose a strategy, set a start date and run it.
              </p>
            </div>
          )}

          {!loading && !runError && backtestResult && (
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

                <div className="strategy-chart-frame">
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

                {MOBILE && scrollMax > 0 && (
                  <div className="strategy-chart-scrubber">
                    <input
                      type="range"
                      aria-label="Move through the backtest"
                      min={0}
                      max={scrollMax}
                      step={1}
                      value={Math.min(scrollLeft, scrollMax)}
                      onChange={(event) => {
                        const next = Number(event.target.value)
                        const scrollEl = scrollRef.current
                        if (!scrollEl || !Number.isFinite(next)) return
                        scrollEl.scrollLeft = next
                        setScrollLeft(next)
                      }}
                    />
                  </div>
                )}
                </div>
              </article>

              {orderedMetricsList.length > 0 && (
                <article className="strategy-metrics-card">
                  <h4 className="strategy-metrics-title">Performance metrics</h4>
                  {backtestResult.timings && (
                    <p className="run-timing">{timingLine(backtestResult.timings)}</p>
                  )}
                  <div className="strategy-metrics-grid">
                    {orderedMetricsList.map(({ key, label, value }) => {
                      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '')
                      const formattedVal = formatMetricValue(value, key)
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
                      } else if (normalizedKey.includes('cost')) {
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
          </>
          )}
        </div>
      </div>

      {backtestResult && <TradeResults trades={backtestResult.trades ?? null} />}

      <StrategyGuide />
    </div>
  )
}
