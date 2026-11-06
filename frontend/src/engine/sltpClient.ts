// sltpClient.ts — the only way pages talk to the engine.
//
// The engine (pip package `sltp`) runs inside a Web Worker under Pyodide, so a
// backtest never blocks rendering. Every response below keeps the shape the
// old backend returned, which is why the pages render unchanged: the data
// moved from localhost:8000 into the browser, not the components.

import type { Bar } from '../components/Chart'
import type { TradeRecord } from '../components/TradeResults'
import { ENGINE_STRATEGIES, engineStrategyById } from './registry'

/** Engine lifecycle, for boot screens and error states. */
export type EngineState = 'idle' | 'loading' | 'ready' | 'error'

export interface TickerInfo {
  ticker: string
  name: string
}

export interface StockHistoryResponse {
  ticker: string
  name?: string
  timeframe: string
  total_bars: number
  data: Bar[]
}

export interface BacktestChartPoint {
  date: string
  portfolio_value: number
}

export interface StrategyOption {
  id: string
  name: string
  description?: string
}

/** Same shape the old `/api/backtest/run` returned. */
export interface BacktestApiResponse {
  strategy_id: string
  strategy_name: string
  metrics: Record<string, any>
  chart_data: BacktestChartPoint[]
  trades?: Record<string, TradeRecord[]> | TradeRecord[]
}

export type ResearchTimeframe = '1y' | '2y' | '5y' | 'all'

const RUN_TIMEOUT_MS = 15 * 60 * 1000
const QUERY_TIMEOUT_MS = 5 * 60 * 1000

let worker: Worker | null = null
let nextId = 1
let engineState: EngineState = 'idle'
let engineError: string | null = null
const pending = new Map<
  number,
  { kind: string; resolve: (value: string) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }
>()

function ensureWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<{ id: number; kind: string; ok: boolean; data?: unknown; error?: string }>) => {
      const entry = pending.get(event.data.id)
      if (!entry) return
      pending.delete(event.data.id)
      clearTimeout(entry.timer)
      if (entry.kind !== event.data.kind) {
        entry.reject(
          new Error(`engine crossed a reply (asked ${entry.kind}, got ${event.data.kind})`)
        )
        return
      }
      if (event.data.ok) entry.resolve(String(event.data.data ?? ''))
      else entry.reject(new Error(event.data.error || 'engine call failed'))
    }
    worker.onerror = (event) => {
      engineState = 'error'
      engineError = event.message || 'engine worker crashed'
      for (const [, entry] of pending) {
        clearTimeout(entry.timer)
        entry.reject(new Error(engineError || 'engine worker crashed'))
      }
      pending.clear()
    }
  }
  return worker
}

function call<T>(kind: string, payload: Record<string, unknown>, timeoutMs: number): Promise<T> {
  const instance = ensureWorker()
  const id = nextId
  nextId += 1
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error('engine call timed out'))
    }, timeoutMs)
    pending.set(id, {
      kind,
      resolve: (text) => {
        try {
          resolve(JSON.parse(text) as T)
        } catch {
          reject(new Error(`engine returned unreadable data: ${text.slice(0, 300)}`))
        }
      },
      reject,
      timer,
    })
    instance.postMessage({ id, kind, ...payload })
  })
}

let booting: Promise<void> | null = null

/** Boot the engine and register the strategies. Concurrent callers share one boot. */
export function ensureEngine(): Promise<void> {
  if (engineState === 'ready') return Promise.resolve()
  if (booting) return booting
  engineState = 'loading'
  engineError = null
  booting = (async () => {
    try {
      await call<{ ready: boolean }>(
        'init',
        {
          strategies: ENGINE_STRATEGIES.map((entry) => ({
            key: entry.id,
            className: entry.className,
            source: entry.source,
          })),
        },
        QUERY_TIMEOUT_MS
      )
      engineState = 'ready'
    } catch (error) {
      engineState = 'error'
      engineError = error instanceof Error ? error.message : String(error)
      throw error
    } finally {
      booting = null
    }
  })()
  return booting
}

/** Current engine state for loading screens. */
export function getEngineState(): EngineState {
  return engineState
}

/** The last engine error, if it failed to boot. */
export function getEngineError(): string | null {
  return engineError
}

/** Strategies the browser can run. No I/O: the registry is local. */
export function listStrategies(): StrategyOption[] {
  return ENGINE_STRATEGIES.map(({ id, name, description }) => ({ id, name, description }))
}

interface SltpTradeExit {
  date?: string
  type?: string
  price?: number
}

interface SltpTrade {
  id?: number
  ticker?: string
  position_type?: string
  entry_date?: string
  entry_price?: number
  allocation?: number
  stop_loss?: number
  take_profit?: number
  fees?: number
  exit?: SltpTradeExit | null
}

interface SltpRunPayload {
  stats?: Record<string, unknown>
  equity?: Array<{ date: string; value: number }>
  trades?: SltpTrade[]
}

/** Run a strategy in the engine and return it in the old API shape. */
export async function runBacktest(
  strategyId: string,
  start: string,
  end?: string
): Promise<BacktestApiResponse> {
  const entry = engineStrategyById(strategyId)
  if (!entry) throw new Error(`unknown strategy: ${strategyId}`)
  await ensureEngine()
  const payload = await call<SltpRunPayload>(
    'run',
    { key: strategyId, start, end: end || null },
    RUN_TIMEOUT_MS
  )
  const trades = (payload.trades || []).map((trade) => ({
    id: trade.id,
    ticker: trade.ticker,
    action: (trade.position_type === 'short' ? 'SHORT' : 'BUY') as TradeRecord['action'],
    position_type: trade.position_type as TradeRecord['position_type'],
    entry_date: trade.entry_date,
    signal_date: trade.entry_date,
    entry_price: trade.entry_price,
    allocation_size: trade.allocation,
    stop_loss: trade.stop_loss,
    take_profit: trade.take_profit,
    exit_date: trade.exit?.date ?? null,
    exit_price: trade.exit?.price ?? null,
    transaction_cost: trade.fees,
  }))
  return {
    strategy_id: strategyId,
    strategy_name: entry.name,
    metrics: payload.stats || {},
    chart_data: (payload.equity || []).map((point) => ({
      date: point.date,
      portfolio_value: point.value,
    })),
    trades,
  }
}

/** The tradable ticker directory for the watchlist. */
export async function getTickerDirectory(): Promise<TickerInfo[]> {
  await ensureEngine()
  const list = await call<TickerInfo[]>('directory', {}, QUERY_TIMEOUT_MS)
  return Array.isArray(list) ? list : []
}

/** Latest session in the dataset, for timeframe math. */
export async function getLatestSession(): Promise<string> {
  await ensureEngine()
  return call<string>('latest', {}, QUERY_TIMEOUT_MS)
}

function shiftYears(iso: string, years: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const shifted = new Date(Date.UTC(year || 1970, (month || 1) - 1, day || 1))
  shifted.setUTCFullYear(shifted.getUTCFullYear() - years)
  return shifted.toISOString().slice(0, 10)
}

/** Bars for one ticker over a Research timeframe, in the old API shape. */
export async function getStockHistory(
  ticker: string,
  timeframe: ResearchTimeframe
): Promise<StockHistoryResponse> {
  await ensureEngine()
  const latest = await getLatestSession()
  const start =
    timeframe === '1y'
      ? shiftYears(latest, 1)
      : timeframe === '2y'
        ? shiftYears(latest, 2)
        : timeframe === '5y'
          ? shiftYears(latest, 5)
          : null
  const history = await call<Omit<StockHistoryResponse, 'timeframe'>>(
    'history',
    { ticker, start, end: latest },
    QUERY_TIMEOUT_MS
  )
  return { ...history, timeframe }
}

// Dev-only handle for smoke-testing the engine from the console.
// Production builds exclude it through the import.meta.env.DEV gate.
if (import.meta.env.DEV) {
  ;(window as unknown as Record<string, unknown>).__sltp = {
    ensureEngine,
    getEngineState,
    getEngineError,
    listStrategies,
    runBacktest,
    getTickerDirectory,
    getLatestSession,
    getStockHistory,
  }
}
