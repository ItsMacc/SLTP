// src/pages/PerformancePage.tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import Chart, { type Bar } from '../components/Chart'
import StrategyChart from '../components/StrategyChart'
import './PerformancePage.css'
import type { PerformanceTimeframe } from '../../lib/settings'
import { supabase } from '../../lib/supabase'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const TIMEFRAMES: PerformanceTimeframe[] = ['1y', '2y', '5y', 'all']

interface StockHistoryResponse {
  ticker: string
  timeframe: string
  total_bars: number
  data: Bar[]
}

type Mode = 'stocks' | 'strategies'

interface PerformancePageProps {
  userId?: string
}

export default function PerformancePage({ userId }: PerformancePageProps) {
  const [mode, setMode] = useState<Mode>('stocks')
  const [allTickers, setAllTickers] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)

  const [timeframe, setTimeframe] = useState<PerformanceTimeframe>('1y')
  const [settingsLoaded, setSettingsLoaded] = useState(false)

  const [stockData, setStockData] = useState<StockHistoryResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const searchWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    async function loadUserSettings() {
      try {
        let activeUserId = userId
        if (!activeUserId) {
          const { data: sessionData } = await supabase.auth.getSession()
          activeUserId = sessionData?.session?.user?.id
        }

        if (!activeUserId) {
          if (!cancelled) setSettingsLoaded(true)
          return
        }

        const { data, error } = await supabase
          .from('users')
          .select('settings')
          .eq('id', activeUserId)
          .single()

        if (!cancelled && !error && data?.settings?.defaultTimeframe) {
          const savedTf = data.settings.defaultTimeframe.toLowerCase() as PerformanceTimeframe
          if (TIMEFRAMES.includes(savedTf)) {
            setTimeframe(savedTf)
          }
        }
      } catch {
        // Fallback silently
      } finally {
        if (!cancelled) setSettingsLoaded(true)
      }
    }

    loadUserSettings()
    return () => {
      cancelled = true
    }
  }, [userId])

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE_URL}/api/stock/all-tickers`)
      .then((res) => res.json())
      .then((data: string[]) => {
        if (!cancelled) setAllTickers(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (!cancelled) setAllTickers([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(event.target as Node)) {
        setSuggestionsOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const suggestions = useMemo(() => {
    const q = query.trim().toUpperCase()
    if (!q) return []

    const startsWithMatches: string[] = []
    const containsMatches: string[] = []

    for (const symbol of allTickers) {
      const upperSymbol = symbol.toUpperCase()
      if (upperSymbol.startsWith(q)) {
        startsWithMatches.push(symbol)
      } else if (upperSymbol.includes(q)) {
        containsMatches.push(symbol)
      }
    }

    return [...startsWithMatches, ...containsMatches].slice(0, 8)
  }, [query, allTickers])

  useEffect(() => {
    if (!settingsLoaded || !selectedTicker || mode !== 'stocks') return

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
  }, [selectedTicker, timeframe, mode, settingsLoaded])

  const handleSelectTicker = (symbol: string) => {
    setSelectedTicker(symbol)
    setQuery(symbol)
    setSuggestionsOpen(false)
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setSelectedTicker(null)
    setStockData(null)
    setError(null)
    setQuery('')
  }

  if (!settingsLoaded) {
    return (
      <div className="perf-page">
        <p className="status-text">Loading preferences...</p>
      </div>
    )
  }

  return (
    <div className="perf-page">
      <header className="perf-header">
        <div>
          <h1 className="perf-title">Performance</h1>
          <p className="perf-subtitle">Track price history for a stock, or review saved strategy results.</p>
        </div>

        <div className="mode-switch" role="tablist" aria-label="View mode">
          <span className={`mode-switch-thumb ${mode === 'strategies' ? 'is-right' : ''}`} aria-hidden="true" />
          <button
            role="tab"
            aria-selected={mode === 'stocks'}
            className={`mode-switch-btn ${mode === 'stocks' ? 'is-active' : ''}`}
            onClick={() => switchMode('stocks')}
          >
            Stocks
          </button>
          <button
            role="tab"
            aria-selected={mode === 'strategies'}
            className={`mode-switch-btn ${mode === 'strategies' ? 'is-active' : ''}`}
            onClick={() => switchMode('strategies')}
          >
            Strategies
          </button>
        </div>
      </header>

      {mode === 'stocks' && (
        <>
          <div className="perf-controls">
            <div className="ticker-search" ref={searchWrapRef}>
              <span className="ticker-search-icon">⌕</span>
              <input
                type="text"
                value={query}
                onFocus={() => setSuggestionsOpen(true)}
                onChange={(e) => {
                  setQuery(e.target.value.toUpperCase())
                  setSuggestionsOpen(true)
                }}
                placeholder="Search a ticker, e.g. AAPL"
                className="ticker-search-input"
                aria-autocomplete="list"
              />
              {suggestionsOpen && suggestions.length > 0 && (
                <ul className="ticker-suggestions">
                  {suggestions.map((symbol) => (
                    <li key={symbol}>
                      <button type="button" onClick={() => handleSelectTicker(symbol)}>
                        {symbol}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="timeframe-group" role="group" aria-label="Timeframe">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`timeframe-btn ${timeframe === tf ? 'is-active' : ''}`}
                >
                  {tf.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {!selectedTicker && (
            <div className="empty-state">
              <p className="empty-state-title">No ticker selected</p>
              <p className="empty-state-body">Search for a symbol above to load its price history.</p>
            </div>
          )}

          {loading && <p className="status-text">Loading market data...</p>}
          {error && <p className="status-text is-error">{error}</p>}

          {!loading && !error && stockData && <Chart bars={stockData.data} ticker={stockData.ticker} />}

          <CandlestickGuide />
        </>
      )}

      {mode === 'strategies' && <StrategyChart />}
    </div>
  )
}

function CandleDiagram({
  variant,
  openPrice,
  highPrice,
  lowPrice,
  closePrice,
}: {
  variant: 'bull' | 'bear'
  openPrice: number
  highPrice: number
  lowPrice: number
  closePrice: number
}) {
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

function CandlestickGuide() {
  return (
    <section className="guide">
      <div className="guide-layout-grid">
        <div className="guide-main-column">
          <div className="guide-intro-block">
            <h2 className="guide-heading">Beginner Guide: Understanding the Chart</h2>
            <p className="guide-copy">
              Every stock has a unique shortcut code called a ticker, such as AAPL for Apple or TSLA for Tesla. When you search for a ticker, the chart populates with its historical price action, displayed using candles where each individual candle represents a single trading day.
            </p>
            <p className="guide-copy">
              Instead of looking at rows of text data, a single candle summarizes an entire day of market activity into one visual block containing four vital metrics.
            </p>
          </div>

          <ol className="guide-steps">
            <li>
              <span className="guide-step-index">1</span>
              <div>
                <p className="guide-step-title">Open Price</p>
                <p className="guide-step-body">The initial price at which shares began trading when the market opened for the day.</p>
              </div>
            </li>
            <li>
              <span className="guide-step-index">2</span>
              <div>
                <p className="guide-step-title">High and Low Extremes</p>
                <p className="guide-step-body">
                  The absolute peak and lowest pricing points touched during the trading session, visualized via the thin vertical wicks.
                </p>
              </div>
            </li>
            <li>
              <span className="guide-step-index">3</span>
              <div>
                <p className="guide-step-title">Close Price</p>
                <p className="guide-step-body">The final transaction price registered when the market closed for the session.</p>
              </div>
            </li>
            <li>
              <span className="guide-step-index">4</span>
              <div>
                <p className="guide-step-title">Volume Activity</p>
                <p className="guide-step-body">
                  The vertical bars aligned underneath the main chart. Taller bars indicate heavy trading activity and heightened market interest.
                </p>
              </div>
            </li>
          </ol>

          <div className="guide-intro-block" style={{ marginTop: '2rem', marginBottom: '1.5rem' }}>
            <h3 className="guide-heading" style={{ fontSize: '1.25rem' }}>Decoding Timeframes</h3>
            <p className="guide-copy">
              You can toggle between different horizons using the timeframe buttons (1Y, 2Y, 5Y, ALL). Choosing a shorter window zooms in on recent sessions to inspect daily volatility, while longer selections reveal multi-year structural trends and broader market cycles.
            </p>
          </div>
        </div>

        <aside className="guide-sidebar-column">
          <div className="guide-sidebar-card">
            <h3 className="guide-sidebar-title">Quick Reference &amp; Tips</h3>
            <ul className="guide-sidebar-list">
              <li>
                <strong>Body vs wick:</strong> The thick block is the body, representing the range between open and close. The thin lines above and below are wicks, showing how far price wandered before settling back.
              </li>
              <li>
                <strong>Size shows conviction:</strong> A tall body means buyers or sellers were firmly in control all day. A tiny body means the day was a tug-of-war that ended close to where it started.
              </li>
              <li>
                <strong>Zoom out before zooming in:</strong> Start on 5Y or ALL to get the big picture, then switch to 1Y once you know which period to inspect closely.
              </li>
              <li>
                <strong>Past price isn't a promise:</strong> A chart shows what already happened, not what happens next. Treat it as context for research, not a guarantee of future performance.
              </li>
              <li>
                <strong>.TO Symbols</strong> Some symbols end with .TO, which indicates they are listed on the Toronto Stock Exchange. For example, SHOP.TO is Shopify's Canadian listing. This helps diffrentiate which exchange a stock belongs to, as well as the currency it trades in (CAD vs USD).
              </li>
            </ul>
          </div>
        </aside>
      </div>

      <div className="guide-examples" style={{ marginTop: '2rem' }}>
        <article className="guide-example">
          <h3 className="guide-example-title">
            <span className="dot dot-bull" /> Green Candle (Price Increased)
          </h3>
          <p className="guide-copy">
            Suppose a stock opened at $180, climbed up to $187, dipped to $179, and closed at $185. Because the closing price ended higher than the opening value, the candle turns green.
          </p>
          <p className="guide-copy">
            This pattern highlights bullish momentum, showing that buyers ultimately pushed valuations higher over the course of the day.
          </p>
          <div className="guide-diagram-wrap">
            <CandleDiagram variant="bull" openPrice={180} highPrice={187} lowPrice={179} closePrice={185} />
          </div>
        </article>

        <article className="guide-example">
          <h3 className="guide-example-title">
            <span className="dot dot-bear" /> Red Candle (Price Decreased)
          </h3>
          <p className="guide-copy">
            Conversely, if a stock opened at $185, spiked to $187, dropped to a low of $176, and closed at $180, the closing value sits lower than the start, turning the candle red.
          </p>
          <p className="guide-copy">
            This indicates downward selling pressure, meaning sellers dominated the session and drove prices down from the morning open.
          </p>
          <div className="guide-diagram-wrap">
            <CandleDiagram variant="bear" openPrice={185} highPrice={187} lowPrice={176} closePrice={180} />
          </div>
        </article>
      </div>
    </section>
  )
}