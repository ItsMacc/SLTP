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
  signal_date?: string | null
  [key: string]: any
}

interface TradeResultsProps {
  trades: Record<string, TradeRecord[]> | TradeRecord[] | null
}

const PAGE_SIZE = 6

export default function TradeResults({ trades }: TradeResultsProps) {
  const [currentPage, setCurrentPage] = useState(1)

  /* Flatten every trade into one chronological list */
  const allTrades = useMemo(() => {
    if (!trades) return []

    const list: { ticker: string; trade: TradeRecord; dateKey: string }[] = []

    if (Array.isArray(trades)) {
      for (const trade of trades) {
        const dateKey = trade.exit_date || trade.entry_date || trade.signal_date || ''
        list.push({ ticker: trade.ticker || 'UNKNOWN', trade, dateKey })
      }
    } else {
      for (const [ticker, entries] of Object.entries(trades)) {
        if (Array.isArray(entries)) {
          for (const trade of entries) {
            const dateKey = trade.exit_date || trade.entry_date || trade.signal_date || ''
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
              const realizedReturn = Number(trade.realized_return_pct)
              const actionClass = isClosedTrade
                ? realizedReturn > 0
                  ? 'is-winning'
                  : realizedReturn < 0
                    ? 'is-losing'
                    : action === 'TAKE_PROFIT'
                      ? 'is-winning'
                      : action === 'STOP_LOSS'
                        ? 'is-losing'
                        : 'is-exit'
                : action === 'SHORT'
                  ? 'is-short'
                  : 'is-buy'

              const displayDate = trade.exit_date || trade.entry_date || trade.signal_date || '-'
              const allocationVal =
                trade.allocation_size !== null && trade.allocation_size !== undefined
                  ? `${(Number(trade.allocation_size) * 100).toFixed(2)}%`
                  : '-'
              const entryPriceVal = trade.entry_price !== undefined ? `$${Number(trade.entry_price).toFixed(2)}` : '-'
              const exitPriceVal =
                trade.exit_price !== null && trade.exit_price !== undefined
                  ? `$${Number(trade.exit_price).toFixed(2)}`
                  : '-'

              return (
                <tr key={`${ticker}-${displayDate}-${idx}`}>
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