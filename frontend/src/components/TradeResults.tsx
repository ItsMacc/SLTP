// TradeResults.tsx — Executed trades table with pagination
import { useEffect, useMemo, useState } from 'react'
import Button from '../ui/Button'
import './TradeResults.css'

export interface TradeRecord {
  ticker?: string
  action?: 'BUY' | 'SHORT' | 'TAKE_PROFIT' | 'STOP_LOSS' | 'EXIT'
  entry_date?: string
  allocation_size?: number | null
  entry_price?: number
  stop_loss?: number
  take_profit?: number
  exit_price?: number | null
  exit_date?: string | null
  transaction_cost?: number
  realized_return_pct?: number | null
  id?: number
  position_type?: 'long' | 'short'
  signal_date?: string | null
  [key: string]: any
}

interface TradeResultsProps {
  trades: Record<string, TradeRecord[]> | TradeRecord[] | null
}

const PAGE_SIZE = 6

/* Prices are on today's share basis, so an old fill in a fund that reverse-split can run
   into the millions. Past five digits a short suffix keeps the column readable; below
   that, two decimals are what a quote needs. Same rule as the Research page. */
const priceText = (value: number) => {
  if (!Number.isFinite(value)) return '-'
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(1)}T`
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 10_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function TradeResults({ trades }: TradeResultsProps) {
  const [currentPage, setCurrentPage] = useState(1)

  /* Flatten every trade into one chronological list */
  const allTrades = useMemo(() => {
    if (!trades) return []

    const list: { ticker: string; trade: TradeRecord; dateKey: string }[] = []

    if (Array.isArray(trades)) {
      for (const trade of trades) {
        const dateKey = trade.entry_date || trade.exit_date || trade.signal_date || ''
        list.push({ ticker: trade.ticker || 'UNKNOWN', trade, dateKey })
      }
    } else {
      for (const [ticker, entries] of Object.entries(trades)) {
        if (Array.isArray(entries)) {
          for (const trade of entries) {
            const dateKey = trade.entry_date || trade.exit_date || trade.signal_date || ''
            list.push({ ticker, trade, dateKey })
          }
        }
      }
    }

    list.sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    return list
  }, [trades])

  const totalPages = Math.ceil(allTrades.length / PAGE_SIZE) || 1

  useEffect(() => {
    setCurrentPage(1)
  }, [trades])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [totalPages, currentPage])

  if (allTrades.length === 0) {
    return null
  }

  const startIndex = (currentPage - 1) * PAGE_SIZE
  const currentTrades = allTrades.slice(startIndex, startIndex + PAGE_SIZE)

  const handlePrev = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1)
    }
  }

  const handleNext = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1)
    }
  }

  return (
    <div className="trade-results-container">
      <h3 className="trade-results-heading">Trades</h3>
      <div className="trade-table-wrapper">
        <table className="trade-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Ticker</th>
              <th>Action</th>
              <th>Allocated Size</th>
              <th>Entry Price</th>
              <th>Exit Price</th>
            </tr>
          </thead>
          <tbody>
            {currentTrades.map(({ ticker, trade }, idx) => {
              const rawAction = (trade.action || '').toUpperCase()
              const action = rawAction === '' || rawAction === 'UNKNOWN' ? 'BUY' : rawAction
              const displayAction = action === 'BUY' ? 'LONG' : action

              const isClosedTrade =
                trade.exit_date != null ||
                trade.exit_price != null ||
                action === 'TAKE_PROFIT' ||
                action === 'STOP_LOSS' ||
                action === 'EXIT'
              // Won or lost, read off the fills: a long wins when it sells
              // higher than it bought, a short wins when it buys back lower.
              // The server's realized_return_pct wins when present; ties and
              // open trades stay neutral.
              const isShortTrade = trade.position_type === 'short' || action === 'SHORT'
              const entry = Number(trade.entry_price)
              const exit = Number(trade.exit_price)
              const realizedReturn = Number(trade.realized_return_pct)
              const won = Number.isFinite(entry) && Number.isFinite(exit) && entry > 0
                ? isShortTrade ? exit < entry : exit > entry
                : Number.isFinite(realizedReturn) && realizedReturn !== 0
                  ? realizedReturn > 0
                  : null
              const actionClass = action === 'TAKE_PROFIT'
                ? 'is-winning'
                : action === 'STOP_LOSS'
                  ? 'is-losing'
                  : isClosedTrade
                    ? won === true
                      ? 'is-winning'
                      : won === false
                        ? 'is-losing'
                        : 'is-exit'
                    : action === 'SHORT'
                      ? 'is-short'
                      : 'is-buy'

              const displayDate = trade.entry_date || trade.exit_date || trade.signal_date || '-'
              const allocationVal =
                trade.allocation_size !== null && trade.allocation_size !== undefined
                  ? `${(Number(trade.allocation_size) * 100).toFixed(2)}%`
                  : '-'
              const entryPriceVal = trade.entry_price !== undefined ? `$${priceText(Number(trade.entry_price))}` : '-'
              const exitPriceVal =
                trade.exit_price !== null && trade.exit_price !== undefined
                  ? `$${priceText(Number(trade.exit_price))}`
                  : '-'

              return (
                <tr key={trade.id ?? `${ticker}-${displayDate}-${idx}`}>
                  <td>{displayDate}</td>
                  <td className="trade-ticker-cell">{ticker}</td>
                  <td>
                    <span className={`trade-badge ${actionClass}`}>{displayAction}</span>
                  </td>
                  <td>{allocationVal}</td>
                  <td>{entryPriceVal}</td>
                  <td>{exitPriceVal}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* The fee is paid out of the same cash as the fill, so a fill for the whole
          book lands just under 100% of equity. Say so where the number is read.
          Prices are the engine's own series, which is restated onto today's share
          basis, so they agree with the chart at the same date. */}
      <p className="trade-table-note">
        Allocated size is the share of equity the fill took. The 0.1% entry fee is paid
        from the same cash, so an order for the whole book fills at 99.9%. Prices are on
        today's share basis, the same series the chart draws, so a fund that reverse-split
        reads as a large number in its early years.
      </p>

      <div className="trade-pagination">
        <Button variant="secondary" size="sm" onClick={handlePrev} disabled={currentPage === 1} aria-label="Previous page">
          &lt;
        </Button>
        <span className="trade-page-indicator">
          {currentPage}/{totalPages}
        </span>
        <Button variant="secondary" size="sm" onClick={handleNext} disabled={currentPage === totalPages} aria-label="Next page">
          &gt;
        </Button>
      </div>
    </div>
  )
}