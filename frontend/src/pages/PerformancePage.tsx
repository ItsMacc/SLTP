// PerformancePage.tsx — Price history workspace: ticker list, chart, stats
import { useEffect, useMemo, useRef, useState, type UIEvent } from 'react'
import { Search, X } from 'lucide-react'
import CandlestickGuide from '../components/CandlestickGuide'
import Chart, { type Bar } from '../components/Chart'
import StrategyChart from '../components/StrategyChart'
import { LoaderRow, LoaderScreen } from '../ui/Loader'
import './PerformancePage.css'
import type { PerformanceTimeframe } from '../../lib/settings'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const TIMEFRAMES: PerformanceTimeframe[] = ['1y', '2y', '5y', 'all']

const TIMEFRAME_LABEL: Record<PerformanceTimeframe, string> = {
  '1y': '1Y',
  '2y': '2Y',
  '5y': '5Y',
  all: 'all history',
}

// The watchlist quotes itself as it scrolls: each scroll near the end pulls
// in another batch, and the batch is read a few tickers at a time.
const QUOTE_BATCH = 24
const QUOTE_CONCURRENCY = 6
const SPARK_POINTS = 24

/* Stable empty series so the derived stats below do not recompute per render. */
const NO_BARS: Bar[] = []

interface StockHistoryResponse {
  ticker: string
  name?: string
  timeframe: string
  total_bars: number
  data: Bar[]
}

type Mode = 'stocks' | 'strategies'
type ChartStyle = 'candles' | 'line'

const TABS: { id: Mode; label: string; meta: string }[] = [
  { id: 'stocks', label: 'Stocks', meta: 'Price history' },
  { id: 'strategies', label: 'Strategies', meta: 'Backtests' },
]

// A one-line summary of a ticker for the watchlist: last close, the day's
// move, and a downsampled close series for the sparkline.
interface Quote {
  price: number
  changePct: number
  spark: number[]
}

interface PerformancePageProps {
  userId?: string
  initialSettings?: { defaultTimeframe?: string; [key: string]: any }
}

const priceText = (value: number) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const signedText = (value: number, digits = 2) => `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`

const compactVolume = (value: number) => {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toFixed(0)
}

const dateText = (iso: string) => {
  if (!iso) return ''
  const parsed = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return iso
  return parsed.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })
}

const buildQuote = (bars: Bar[]): Quote | null => {
  if (bars.length === 0) return null
  const last = bars[bars.length - 1]!
  const previous = bars.length > 1 ? bars[bars.length - 2]! : last
  const changePct = previous.close !== 0 ? ((last.close - previous.close) / previous.close) * 100 : 0

  const step = Math.max(1, Math.ceil(bars.length / SPARK_POINTS))
  const spark: number[] = []
  for (let i = 0; i < bars.length; i += step) spark.push(bars[i]!.close)
  if (spark[spark.length - 1] !== last.close) spark.push(last.close)

  return { price: last.close, changePct, spark }
}

// Range return, extremes, annualised volatility, deepest drawdown, and the
// average day's volume — all read off the bars already on screen.
const computeStats = (bars: Bar[]) => {
  if (bars.length < 2) return null

  const first = bars[0]!
  const last = bars[bars.length - 1]!
  let high = -Infinity
  let low = Infinity
  let volumeSum = 0
  let peak = first.close
  let maxDrawdown = 0
  const returns: number[] = []

  for (let i = 0; i < bars.length; i += 1) {
    const bar = bars[i]!
    high = Math.max(high, bar.high)
    low = Math.min(low, bar.low)
    volumeSum += bar.volume
    peak = Math.max(peak, bar.close)
    const drawdown = peak !== 0 ? ((bar.close - peak) / peak) * 100 : 0
    maxDrawdown = Math.min(maxDrawdown, drawdown)
    if (i > 0) {
      const previous = bars[i - 1]!.close
      if (previous !== 0) returns.push((bar.close - previous) / previous)
    }
  }

  const mean = returns.reduce((sum, value) => sum + value, 0) / Math.max(1, returns.length)
  const variance =
    returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, returns.length - 1)
  const volatility = Math.sqrt(variance) * Math.sqrt(252) * 100

  return {
    rangePct: first.close !== 0 ? ((last.close - first.close) / first.close) * 100 : 0,
    high,
    low,
    volatility,
    maxDrawdown,
    avgVolume: volumeSum / bars.length,
  }
}

function Sparkline({ values, up }: { values: number[]; up: boolean }) {
  if (values.length < 2) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100
      const y = 25 - ((value - min) / span) * 22
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg
      className={`perf-spark ${up ? 'is-up' : 'is-down'}`}
      viewBox="0 0 100 28"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

interface TickerInfo {
  ticker: string
  name: string
}

export default function PerformancePage({ initialSettings }: PerformancePageProps) {
  const [mode, setMode] = useState<Mode>('stocks')
  const [allTickers, setAllTickers] = useState<TickerInfo[]>([])
  // The ticker list is read from the market-data store on mount.
  const [tickersLoading, setTickersLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)

  const [timeframe, setTimeframe] = useState<PerformanceTimeframe>(() => {
    const savedTf = initialSettings?.defaultTimeframe?.toLowerCase() as PerformanceTimeframe
    return TIMEFRAMES.includes(savedTf) ? savedTf : '1y'
  })
  const [chartStyle, setChartStyle] = useState<ChartStyle>(
    initialSettings?.chartStyle === 'line' ? 'line' : 'candles'
  )

  const [stockData, setStockData] = useState<StockHistoryResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [quotes, setQuotes] = useState<Record<string, Quote>>({})
  const [quoteLimit, setQuoteLimit] = useState(QUOTE_BATCH)
  const quotesRef = useRef<Record<string, Quote>>({})
  const pendingQuotes = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (initialSettings?.defaultTimeframe) {
      const savedTf = initialSettings.defaultTimeframe.toLowerCase() as PerformanceTimeframe
      if (TIMEFRAMES.includes(savedTf)) {
        setTimeframe(savedTf)
      }
    }
    if (initialSettings?.chartStyle === 'line' || initialSettings?.chartStyle === 'candles') {
      setChartStyle(initialSettings.chartStyle as ChartStyle)
    }
  }, [initialSettings?.defaultTimeframe, initialSettings?.chartStyle])

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE_URL}/api/stock/ticker-details`)
      .then((res) => {
        if (!res.ok) throw new Error('Could not load ticker names')
        return res.json()
      })
      .then((data: TickerInfo[]) => {
        if (cancelled) return
        const list = Array.isArray(data) ? data : []
        setAllTickers(list)
        // Open on a chart rather than an empty frame: Apple when it is in the
        // universe, otherwise whatever the list starts with.
        const symbols = list.map(({ ticker }) => ticker)
        setSelectedTicker((current) => current ?? (symbols.includes('AAPL') ? 'AAPL' : (symbols[0] ?? null)))
      })
      .catch(() => {
        if (!cancelled) setAllTickers([])
      })
      .finally(() => {
        if (!cancelled) setTickersLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Typing narrows the list in place; the matches stay in the same scroll
  // area instead of hanging under the field.
  const filteredTickers = useMemo(() => {
    const q = query.trim().toLocaleLowerCase()
    if (!q) return allTickers

    const startsWithMatches: TickerInfo[] = []
    const containsMatches: TickerInfo[] = []
    const nameMatches: TickerInfo[] = []

    for (const item of allTickers) {
      const symbol = item.ticker.toLocaleLowerCase()
      const name = item.name.toLocaleLowerCase()
      if (symbol.startsWith(q)) {
        startsWithMatches.push(item)
      } else if (symbol.includes(q)) {
        containsMatches.push(item)
      } else if (name.includes(q)) {
        nameMatches.push(item)
      }
    }

    return [...startsWithMatches, ...containsMatches, ...nameMatches]
  }, [query, allTickers])

  const visibleTickers = useMemo(
    () => filteredTickers.slice(0, quoteLimit),
    [filteredTickers, quoteLimit]
  )

  useEffect(() => {
    if (mode !== 'stocks') return

    const queue = visibleTickers
      .map(({ ticker }) => ticker)
      .filter((ticker) => !quotesRef.current[ticker] && !pendingQuotes.current.has(ticker))
    if (queue.length === 0) return

    let cancelled = false
    const controller = new AbortController()

    const worker = async () => {
      while (queue.length > 0) {
        if (cancelled) return
        const ticker = queue.shift()
        if (!ticker || pendingQuotes.current.has(ticker)) continue
        pendingQuotes.current.add(ticker)
        try {
          const res = await fetch(
            `${API_BASE_URL}/api/stock/history?ticker=${encodeURIComponent(ticker)}&timeframe=1y`,
            { signal: controller.signal }
          )
          if (!res.ok) continue
          const payload = (await res.json()) as StockHistoryResponse
          const quote = buildQuote(payload.data ?? [])
          if (!quote || cancelled) continue
          quotesRef.current = { ...quotesRef.current, [ticker]: quote }
          setQuotes(quotesRef.current)
        } catch {
          // A row without a quote keeps its symbol and a rule; the chart for
          // that ticker still loads normally when it is picked.
        } finally {
          pendingQuotes.current.delete(ticker)
        }
      }
    }

    void Promise.all(Array.from({ length: QUOTE_CONCURRENCY }, worker))
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [visibleTickers, mode])

  useEffect(() => {
    if (!selectedTicker || mode !== 'stocks') return

    const controller = new AbortController()
    setLoading(true)
    setError(null)

    fetch(`${API_BASE_URL}/api/stock/history?ticker=${selectedTicker}&timeframe=${timeframe}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`No history found for ${selectedTicker}`)
        return res.json() as Promise<StockHistoryResponse>
      })
      .then((data) => setStockData(data))
      .catch((err: Error) => {
        if (err.name !== 'AbortError') setError(err.message || 'Something went wrong fetching that ticker.')
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [selectedTicker, timeframe, mode])

  const handleSelectTicker = (symbol: string) => {
    setSelectedTicker(symbol)
  }

  const handleSearch = (value: string) => {
    setQuery(value.toUpperCase())
    setQuoteLimit(QUOTE_BATCH)
  }

  const handleWatchlistScroll = (event: UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget
    if (element.scrollTop + element.clientHeight < element.scrollHeight - 120) return
    setQuoteLimit((limit) => (limit >= filteredTickers.length ? limit : limit + QUOTE_BATCH))
  }

  const switchMode = (next: Mode) => {
    // The chosen ticker survives a trip to the backtest view and back; only
    // the loaded bars are dropped so they are fetched fresh on return.
    setMode(next)
    setStockData(null)
    setError(null)
    setQuery('')
    setQuoteLimit(QUOTE_BATCH)
  }

  const bars = stockData?.data ?? NO_BARS
  const lastBar = bars.length > 0 ? bars[bars.length - 1] : null
  const firstBar = bars.length > 0 ? bars[0] : null
  const rangeChange = firstBar && lastBar ? lastBar.close - firstBar.close : 0
  const rangePct =
    firstBar && lastBar && firstBar.close !== 0 ? (rangeChange / firstBar.close) * 100 : 0
  const stats = useMemo(() => computeStats(bars), [bars])

  return (
    <div className="perf-page">
      {/* Edge-to-Edge Hero Banner */}
      <div className="perf-hero-wrapper page-hero-band is-full-bleed is-dot-grid">
        <div className="perf-hero-inner page-hero-inner">
          <div className="perf-hero-copy">
            <span className="page-hero-eyebrow">Charts and backtests</span>
            <h1 className="page-hero-title">Prices and backtest results</h1>
            <p className="page-hero-description">
              Look up price history for any stock, or see how a published strategy would have performed over the same stretch of time.
            </p>
          </div>
        </div>
      </div>

      <div className="perf-section">
        <div className="perf-tabs" role="tablist" aria-label="Performance view">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={mode === tab.id}
              className={`perf-tab ${mode === tab.id ? 'is-active' : ''}`}
              onClick={() => switchMode(tab.id)}
            >
              <span className="perf-tab-label">{tab.label}</span>
              <span className="perf-tab-meta">{tab.meta}</span>
            </button>
          ))}
        </div>

        {mode === 'stocks' && (
          <div className="perf-workspace">
            <aside className="perf-watchlist" aria-label="Tickers">
              <div className="perf-search">
                <span className="perf-search-icon" aria-hidden="true">
                  <Search size={14} />
                </span>
                <input
                  type="text"
                  value={query}
                  onChange={(event) => handleSearch(event.target.value)}
                  placeholder="Search ticker or company"
                  className="perf-search-input"
                  aria-label="Filter tickers"
                />
                {query && (
                  <button
                    type="button"
                    className="perf-search-clear"
                    onClick={() => handleSearch('')}
                    aria-label="Clear search"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
              </div>

              <div className="perf-watchlist-head" aria-hidden="true">
                <span>Company / symbol</span>
                <span>Last / 1D</span>
              </div>

              <div className="perf-watchlist-scroll" onScroll={handleWatchlistScroll}>
                {tickersLoading && (
                  <div className="perf-watchlist-status">
                    <LoaderRow label="Loading tickers…" />
                  </div>
                )}

                {!tickersLoading && filteredTickers.length === 0 && (
                  <p className="perf-watchlist-status">No ticker matches “{query}”.</p>
                )}

                {!tickersLoading && filteredTickers.length > 0 && (
                  <ul className="perf-watchlist-list">
                    {visibleTickers.map(({ ticker: symbol, name }) => {
                      const quote = quotes[symbol]
                      const isActive = symbol === selectedTicker
                      const up = quote ? quote.changePct >= 0 : true

                      return (
                        <li key={symbol}>
                          <button
                            type="button"
                            className={`perf-row ${isActive ? 'is-active' : ''}`}
                            aria-pressed={isActive}
                            onClick={() => handleSelectTicker(symbol)}
                          >
                            <span className="perf-row-identity">
                              <span className="perf-row-symbol">{symbol}</span>
                              <span className="perf-row-name">{name}</span>
                            </span>
                            <span className="perf-row-spark">
                              {quote ? (
                                <Sparkline values={quote.spark} up={up} />
                              ) : (
                                <span className="perf-row-spark-wait" aria-hidden="true" />
                              )}
                            </span>
                            <span className="perf-row-figures">
                              <span className="perf-row-price">
                                {quote ? priceText(quote.price) : '—'}
                              </span>
                              <span
                                className={`perf-row-change ${
                                  quote ? (up ? 'is-up' : 'is-down') : ''
                                }`}
                              >
                                {quote ? `${signedText(quote.changePct)}%` : '·'}
                              </span>
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </aside>

            <div className="perf-detail">
              {/* Price history can take a moment, so the panel turns into
                  the waiting screen until the candles are in. */}
              {loading && (
                <LoaderScreen
                  label={`Loading ${selectedTicker}…`}
                  sub="Fetching price history from the database."
                />
              )}
              {!loading && error && <p className="status-text is-error">{error}</p>}

              {!loading && !error && lastBar && (
                <>
                  <article className="perf-quote-card">
                    <header className="perf-quote-head">
                      <div className="perf-quote-identity">
                        <div className="perf-quote-heading">
                          <h2 className="perf-quote-ticker">{stockData?.ticker ?? selectedTicker}</h2>
                          {(stockData?.name || allTickers.find((item) => item.ticker === selectedTicker)?.name) && (
                            <span className="perf-quote-name">
                              {stockData?.name || allTickers.find((item) => item.ticker === selectedTicker)?.name}
                            </span>
                          )}
                        </div>
                        <p className="perf-quote-price-row">
                          <span className="perf-quote-price">${priceText(lastBar.close)}</span>
                          <span
                            className={`perf-quote-range ${rangePct >= 0 ? 'is-up' : 'is-down'}`}
                          >
                            {signedText(rangeChange)} ({signedText(rangePct)}%)
                          </span>
                          <span className="perf-quote-span">
                            over {TIMEFRAME_LABEL[timeframe]}
                          </span>
                        </p>
                      </div>

                      <div className="perf-quote-controls">
                        <div className="perf-style-group" role="group" aria-label="Chart style">
                          <button
                            type="button"
                            className={`perf-style-btn ${chartStyle === 'candles' ? 'is-active' : ''}`}
                            aria-pressed={chartStyle === 'candles'}
                            onClick={() => setChartStyle('candles')}
                          >
                            Candles
                          </button>
                          <button
                            type="button"
                            className={`perf-style-btn ${chartStyle === 'line' ? 'is-active' : ''}`}
                            aria-pressed={chartStyle === 'line'}
                            onClick={() => setChartStyle('line')}
                          >
                            Line
                          </button>
                        </div>

                        <div className="timeframe-group" role="group" aria-label="Timeframe">
                          {TIMEFRAMES.map((tf) => (
                            <button
                              key={tf}
                              type="button"
                              onClick={() => setTimeframe(tf)}
                              className={`timeframe-btn ${timeframe === tf ? 'is-active' : ''}`}
                            >
                              {tf.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>
                    </header>

                    <p className="perf-quote-ohlc">
                      <span className="perf-quote-date">{dateText(lastBar.date)}</span>
                      <span>O <b>{priceText(lastBar.open)}</b></span>
                      <span>H <b>{priceText(lastBar.high)}</b></span>
                      <span>L <b>{priceText(lastBar.low)}</b></span>
                      <span>C <b>{priceText(lastBar.close)}</b></span>
                      <span>Vol <b>{compactVolume(lastBar.volume)}</b></span>
                    </p>

                    <Chart
                      bars={bars}
                      ticker={stockData?.ticker ?? selectedTicker ?? ''}
                      chartStyle={chartStyle}
                      defaultZoom={
                        typeof initialSettings?.defaultZoom === 'number'
                          ? initialSettings.defaultZoom
                          : undefined
                      }
                      showQuote={false}
                    />
                  </article>

                  {stats && (
                    <article className="perf-stats-card">
                      <div className="perf-stat">
                        <span className="perf-stat-label">Range return</span>
                        <span
                          className={`perf-stat-value ${stats.rangePct >= 0 ? 'is-up' : 'is-down'}`}
                        >
                          {signedText(stats.rangePct)}%
                        </span>
                        <span className="perf-stat-note">Over {TIMEFRAME_LABEL[timeframe]}</span>
                      </div>
                      <div className="perf-stat">
                        <span className="perf-stat-label">High</span>
                        <span className="perf-stat-value">{priceText(stats.high)}</span>
                        <span className="perf-stat-note">Highest print</span>
                      </div>
                      <div className="perf-stat">
                        <span className="perf-stat-label">Low</span>
                        <span className="perf-stat-value">{priceText(stats.low)}</span>
                        <span className="perf-stat-note">Lowest print</span>
                      </div>
                      <div className="perf-stat">
                        <span className="perf-stat-label">Volatility</span>
                        <span className="perf-stat-value">{stats.volatility.toFixed(1)}%</span>
                        <span className="perf-stat-note">Annualised</span>
                      </div>
                      <div className="perf-stat">
                        <span className="perf-stat-label">Max drawdown</span>
                        <span className="perf-stat-value is-down">
                          {stats.maxDrawdown.toFixed(1)}%
                        </span>
                        <span className="perf-stat-note">Peak to trough</span>
                      </div>
                      <div className="perf-stat">
                        <span className="perf-stat-label">Avg volume</span>
                        <span className="perf-stat-value">{compactVolume(stats.avgVolume)}</span>
                        <span className="perf-stat-note">Shares per day</span>
                      </div>
                    </article>
                  )}
                </>
              )}

              {!loading && !error && !lastBar && (
                <div className="empty-state">
                  <p className="empty-state-title">No ticker selected</p>
                  <p className="empty-state-body">
                    Pick a symbol from the list to load its price history.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {mode === 'strategies' && <StrategyChart />}

        {mode === 'stocks' && <CandlestickGuide />}
      </div>
    </div>
  )
}
