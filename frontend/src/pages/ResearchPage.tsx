// ResearchPage.tsx — Price history workspace: ticker list, chart, stats
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type UIEvent,
} from 'react'
import { Search, X } from 'lucide-react'
import CandlestickGuide from '../components/CandlestickGuide'
import Chart, { type Bar } from '../components/Chart'
import StrategyChart from '../components/StrategyChart'
import { LoaderRow } from '../ui/Loader'
import { GlossaryText } from '../components/GlossaryText'
import { STRATEGY_GLOSSARY } from '../../lib/glossary'
import './ResearchPage.css'
import { chartMaxBarsToNumber, readChartMaxBars, type ResearchTimeframe } from '../../lib/settings'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const TIMEFRAMES: ResearchTimeframe[] = ['1y', '2y', '5y', 'all']

const TIMEFRAME_LABEL: Record<ResearchTimeframe, string> = {
  '1y': '1Y',
  '2y': '2Y',
  '5y': '5Y',
  all: 'all history',
}

// The watchlist quotes itself as it scrolls: each scroll near the end pulls
// in another batch, and the batch is read a few tickers at a time.
const QUOTE_BATCH = 24
const QUOTE_CONCURRENCY = 6

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

// A one-line summary of a ticker for the watchlist: last close and the move
// since the previous session.
interface Quote {
  price: number
  changePct: number
}

interface ResearchPageProps {
  userId?: string
  initialSettings?: { defaultTimeframe?: string; [key: string]: any }
}

// Prices sit on today's share basis, so an old bar in a fund that reverse-split reads as
// a six-figure number. Past five digits a short suffix keeps the table and the strip from
// overflowing; below that, two decimals are what a quote needs.
const priceText = (value: number) => {
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(1)}T`
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 10_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

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
  return { price: last.close, changePct }
}

// Range return, extremes, yearly volatility, deepest drawdown, and the
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

interface TickerInfo {
  ticker: string
  name: string
}

/* ---------- Segmented control ---------- */

interface SegmentedOption<T extends string> {
  id: T
  label: string
}

/**
 * One control renders both the page's tab pair and the two option groups in
 * the chart panel. Tabs move with the arrow keys and expose aria-selected;
 * the smaller groups are plain pressed buttons, which is what they are.
 */
function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  kind = 'group',
  size = 'sm',
  className = '',
}: {
  options: SegmentedOption<T>[]
  value: T
  onChange: (next: T) => void
  ariaLabel: string
  kind?: 'tabs' | 'group'
  size?: 'sm' | 'md'
  className?: string
}) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([])

  const move = (from: number, step: number) => {
    const next = (from + step + options.length) % options.length
    const option = options[next]
    if (!option) return
    onChange(option.id)
    buttons.current[next]?.focus()
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      move(index, 1)
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      move(index, -1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      onChange(options[0]!.id)
      buttons.current[0]?.focus()
    } else if (event.key === 'End') {
      event.preventDefault()
      onChange(options[options.length - 1]!.id)
      buttons.current[options.length - 1]?.focus()
    }
  }

  return (
    <div
      className={`seg-control is-${size} ${className}`.trim()}
      role={kind === 'tabs' ? 'tablist' : 'group'}
      aria-label={ariaLabel}
    >
      {options.map((option, index) => {
        const active = option.id === value
        return (
          <button
            key={option.id}
            ref={(element) => {
              buttons.current[index] = element
            }}
            type="button"
            role={kind === 'tabs' ? 'tab' : undefined}
            aria-selected={kind === 'tabs' ? active : undefined}
            aria-pressed={kind === 'tabs' ? undefined : active}
            tabIndex={kind === 'tabs' && !active ? -1 : undefined}
            className={`seg-option${active ? ' is-active' : ''}`}
            onClick={() => onChange(option.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

const MODE_OPTIONS: SegmentedOption<Mode>[] = [
  { id: 'stocks', label: 'Stocks' },
  { id: 'strategies', label: 'Strategies' },
]

const STYLE_OPTIONS: SegmentedOption<ChartStyle>[] = [
  { id: 'candles', label: 'Candles' },
  { id: 'line', label: 'Line' },
]

const TIMEFRAME_OPTIONS: SegmentedOption<ResearchTimeframe>[] = TIMEFRAMES.map((tf) => ({
  id: tf,
  label: tf.toUpperCase(),
}))

export default function ResearchPage({ initialSettings }: ResearchPageProps) {
  const [mode, setMode] = useState<Mode>('stocks')
  // Which side the view slides in from after a switch. Empty on first paint, so
  // opening the page does not animate.
  const [swap, setSwap] = useState<'' | 'forward' | 'back'>('')
  const [allTickers, setAllTickers] = useState<TickerInfo[]>([])
  // The ticker list is read from the market-data store on mount.
  const [tickersLoading, setTickersLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)

  const [timeframe, setTimeframe] = useState<ResearchTimeframe>(() => {
    const savedTf = initialSettings?.defaultTimeframe?.toLowerCase() as ResearchTimeframe
    return TIMEFRAMES.includes(savedTf) ? savedTf : '1y'
  })
  const [chartStyle, setChartStyle] = useState<ChartStyle>(
    initialSettings?.chartStyle === 'line' ? 'line' : 'candles'
  )

  const [stockData, setStockData] = useState<StockHistoryResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Bumped by "Try again" so the fetch effect runs again for the same ticker.
  const [reloadKey, setReloadKey] = useState(0)

  const [quotes, setQuotes] = useState<Record<string, Quote>>({})
  const [quoteLimit, setQuoteLimit] = useState(QUOTE_BATCH)
  const quotesRef = useRef<Record<string, Quote>>({})
  const pendingQuotes = useRef<Set<string>>(new Set())
  // On phones the list is a sheet over the chart, opened from the search bar.
  const [listOpen, setListOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!listOpen) return
    searchRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setListOpen(false)
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [listOpen])

  useEffect(() => {
    if (initialSettings?.defaultTimeframe) {
      const savedTf = initialSettings.defaultTimeframe.toLowerCase() as ResearchTimeframe
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
  }, [selectedTicker, timeframe, mode, reloadKey])

  const handleSelectTicker = (symbol: string) => {
    setSelectedTicker(symbol)
    setListOpen(false)
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

  const switchMode = useCallback((next: Mode) => {
    if (next === mode) return

    // The view arrives from the side of the tab that was picked: right for
    // Strategies, left for Stocks.
    const movingRight =
      MODE_OPTIONS.findIndex((option) => option.id === next) >
      MODE_OPTIONS.findIndex((option) => option.id === mode)
    setSwap(movingRight ? 'forward' : 'back')

    // The chosen ticker survives a trip to the backtest view and back; only
    // the loaded bars are dropped so they are fetched fresh on return.
    setMode(next)
    setStockData(null)
    setError(null)
    setQuery('')
    setQuoteLimit(QUOTE_BATCH)
  }, [mode])

  const bars = stockData?.data ?? NO_BARS
  const lastBar = bars.length > 0 ? bars[bars.length - 1] : null
  const firstBar = bars.length > 0 ? bars[0] : null
  // The percentage only. The dollar difference between the first and last bar is
  // not a real gain or loss for a fund that split inside the range: every price
  // before the split has been restated, so the two ends are not comparable dollars.
  const rangePct =
    firstBar && lastBar && firstBar.close !== 0
      ? ((lastBar.close - firstBar.close) / firstBar.close) * 100
      : 0
  const stats = useMemo(() => computeStats(bars), [bars])

  // The chart gets every bar in the timeframe. It keeps its own zoom and pan state,
  // and the identity here only changes when a new response lands, which is what tells
  // it to snap back to the newest bar.
  const chartBars = bars

  const searching = query.trim().length > 0
  const quoteName =
    stockData?.name || allTickers.find((item) => item.ticker === selectedTicker)?.name

  return (
    <div className="research-page">
      <div className="research-top">
        <h1 className="research-sr-only">Research</h1>
        <Segmented
          options={MODE_OPTIONS}
          value={mode}
          onChange={switchMode}
          ariaLabel="Research view"
          kind="tabs"
          size="md"
          className="mode-switch"
        />
      </div>

      <div className={`research-view${swap ? ` is-${swap}` : ''}`} key={mode}>
        <div className="research-workspace">
          {mode === 'stocks' && (
            <>
              <button
                type="button"
                className="ticker-trigger"
                onClick={() => setListOpen(true)}
                aria-expanded={listOpen}
              >
                <Search size={14} aria-hidden="true" />
                Search ticker or company
              </button>

              {listOpen && (
                <button
                  type="button"
                  className="ticker-backdrop"
                  aria-label="Close ticker list"
                  onClick={() => setListOpen(false)}
                />
              )}

              <aside className={`ticker-panel${listOpen ? ' is-open' : ''}`} aria-label="Tickers">
                <div className="ticker-search">
                  <Search size={14} aria-hidden="true" className="ticker-search-icon" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={query}
                    onChange={(event) => handleSearch(event.target.value)}
                    placeholder="Search ticker or company"
                    className="ticker-search-input"
                    aria-label="Search ticker or company"
                  />
                  {query && (
                    <button
                      type="button"
                      className="ticker-search-clear"
                      onClick={() => handleSearch('')}
                      aria-label="Clear search"
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  )}
                  <button
                    type="button"
                    className="ticker-close"
                    onClick={() => setListOpen(false)}
                    aria-label="Close ticker list"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>

                <div className="ticker-head" aria-hidden="true">
                  <span>Symbol</span>
                  <span className="is-last">Last</span>
                </div>

                <div className="ticker-scroll" onScroll={handleWatchlistScroll}>
                  {tickersLoading && (
                    <div className="ticker-status">
                      <LoaderRow label="Loading tickers…" />
                    </div>
                  )}

                  {!tickersLoading && filteredTickers.length === 0 && (
                    <p className="ticker-status">No ticker matches “{query}”.</p>
                  )}

                  {!tickersLoading && filteredTickers.length > 0 && (
                    <ul className="ticker-list">
                      {visibleTickers.map(({ ticker: symbol, name }) => {
                        const quote = quotes[symbol]
                        const isActive = symbol === selectedTicker
                        const up = quote ? quote.changePct >= 0 : true

                        return (
                          <li key={symbol} className="ticker-item">
                            <button
                              type="button"
                              className={`ticker-row${isActive ? ' is-active' : ''}`}
                              aria-pressed={isActive}
                              onClick={() => handleSelectTicker(symbol)}
                            >
                              <span className="ticker-identity">
                                <span className="ticker-symbol">{symbol}</span>
                                <span className="ticker-name">{name}</span>
                              </span>
                              <span className="ticker-figures">
                                <span className="ticker-price">
                                  {quote ? priceText(quote.price) : '—'}
                                </span>
                                <span
                                  className={`ticker-change ${
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

                <div className="ticker-foot">
                  {searching
                    ? `${filteredTickers.length.toLocaleString()} match${filteredTickers.length === 1 ? '' : 'es'}`
                    : `Showing ${visibleTickers.length.toLocaleString()} of ${filteredTickers.length.toLocaleString()} tickers`}
                </div>
              </aside>

              {loading && selectedTicker && (
                <section className="quote-panel is-busy" aria-busy="true">
                  <p className="research-sr-only" role="status">Loading {selectedTicker}</p>
                  <div className="quote-skeleton" aria-hidden="true">
                    <span className="research-skel is-price" />
                    <span className="research-skel is-block" />
                  </div>
                </section>
              )}

              {!loading && error && selectedTicker && (
                <section className="quote-panel">
                  <div className="research-state">
                    <p className="research-state-title">
                      Could not load price history for {selectedTicker}.
                    </p>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setReloadKey((key) => key + 1)}
                    >
                      Try again
                    </button>
                  </div>
                </section>
              )}

              {!loading && !error && lastBar && (
                <section className="quote-panel" aria-label={`${selectedTicker} price history`}>
                  <header className="quote-head">
                    <div className="quote-identity">
                      <div className="quote-naming">
                        <h2 className="quote-symbol">{stockData?.ticker ?? selectedTicker}</h2>
                        {quoteName && <span className="quote-name">{quoteName}</span>}
                      </div>
                      <p className="quote-price-row">
                        <span className="quote-price">${priceText(lastBar.close)}</span>
                        <span className={`quote-change ${rangePct >= 0 ? 'is-up' : 'is-down'}`}>
                          {signedText(rangePct)}%
                        </span>
                        <span className="quote-span">over {TIMEFRAME_LABEL[timeframe]}</span>
                      </p>
                    </div>

                    <div className="quote-controls">
                      <Segmented
                        options={STYLE_OPTIONS}
                        value={chartStyle}
                        onChange={setChartStyle}
                        ariaLabel="Chart style"
                      />
                      <Segmented
                        options={TIMEFRAME_OPTIONS}
                        value={timeframe}
                        onChange={setTimeframe}
                        ariaLabel="Timeframe"
                        className="is-timeframe"
                      />
                    </div>
                  </header>

                  <p className="quote-ohlc">
                    <span className="quote-date">{dateText(lastBar.date)}</span>
                    <span><span className="quote-ohlc-label">Open</span> <b>{priceText(lastBar.open)}</b></span>
                    <span><span className="quote-ohlc-label">High</span> <b>{priceText(lastBar.high)}</b></span>
                    <span><span className="quote-ohlc-label">Low</span> <b>{priceText(lastBar.low)}</b></span>
                    <span><span className="quote-ohlc-label">Close</span> <b>{priceText(lastBar.close)}</b></span>
                    <span><span className="quote-ohlc-label">Volume</span> <b>{compactVolume(lastBar.volume)}</b></span>
                  </p>

                  <Chart
                    bars={chartBars}
                    ticker={stockData?.ticker ?? selectedTicker ?? ''}
                    chartStyle={chartStyle}
                    showAll={timeframe === 'all'}
                    maxVisible={chartMaxBarsToNumber(readChartMaxBars(initialSettings))}
                    defaultZoom={
                      typeof initialSettings?.defaultZoom === 'number'
                        ? initialSettings.defaultZoom
                        : undefined
                    }
                    showQuote={false}
                  />

                  {stats && (
                    <div className="quote-stats">
                      <div className="quote-stat">
                        <span className="quote-stat-label">Range return</span>
                        <span
                          className={`quote-stat-value ${stats.rangePct >= 0 ? 'is-up' : 'is-down'}`}
                        >
                          {signedText(stats.rangePct)}%
                        </span>
                        <span className="quote-stat-note">Over {TIMEFRAME_LABEL[timeframe]}</span>
                      </div>
                      <div className="quote-stat">
                        <span className="quote-stat-label">High</span>
                        <span className="quote-stat-value">{priceText(stats.high)}</span>
                        <span className="quote-stat-note">Highest price</span>
                      </div>
                      <div className="quote-stat">
                        <span className="quote-stat-label">Low</span>
                        <span className="quote-stat-value">{priceText(stats.low)}</span>
                        <span className="quote-stat-note">Lowest price</span>
                      </div>
                      <div className="quote-stat">
                        <span className="quote-stat-label">
                          <GlossaryText text="Volatility" glossary={STRATEGY_GLOSSARY} />
                        </span>
                        <span className="quote-stat-value">{stats.volatility.toFixed(1)}%</span>
                        <span className="quote-stat-note">Yearly, from daily moves</span>
                      </div>
                      <div className="quote-stat">
                        <span className="quote-stat-label">
                          <GlossaryText text="Max drawdown" glossary={STRATEGY_GLOSSARY} />
                        </span>
                        <span className="quote-stat-value is-down">
                          {stats.maxDrawdown.toFixed(1)}%
                        </span>
                        <span className="quote-stat-note">Peak to trough</span>
                      </div>
                      <div className="quote-stat">
                        <span className="quote-stat-label">Avg volume</span>
                        <span className="quote-stat-value">{compactVolume(stats.avgVolume)}</span>
                        <span className="quote-stat-note">Shares traded per day</span>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {!loading && !error && !lastBar && !selectedTicker && (
                <section className="quote-panel">
                  <div className="research-state">
                    <p className="research-state-title">No ticker selected</p>
                    <p className="research-state-body">
                      Pick a symbol from the list to load its price history.
                    </p>
                  </div>
                </section>
              )}
            </>
          )}

          {mode === 'strategies' && <StrategyChart />}
        </div>

        {mode === 'stocks' && <CandlestickGuide />}
      </div>
    </div>
  )
}
