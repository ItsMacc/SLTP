// src/pages/PerformancePage.tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import CandlestickGuide from '../components/CandlestickGuide'
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
