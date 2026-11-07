// sltpClient.ts — the only way pages talk to the engine.
//
// The engine is the FastAPI backend (`pip install sltp` under the hood), so
// pages fetch market data and backtests over HTTP instead of booting Pyodide
// in the browser. A run never blocks rendering, and no dataset is downloaded
// into the visitor's browser. Response shapes are what the components
// already render, so the pages did not change — only the transport did.
import type { Bar } from '../components/Chart';
import type { TradeRecord } from '../components/TradeResults';
import type { ResearchTimeframe } from '../../lib/settings';
import { listStrategies as listCatalog } from '../../lib/api';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export interface TickerInfo {
  ticker: string;
  name: string;
}

export interface StockHistoryResponse {
  ticker: string;
  name?: string;
  timeframe: string;
  total_bars: number;
  data: Bar[];
}

export interface BacktestChartPoint {
  date: string;
  portfolio_value: number;
}

export interface StrategyOption {
  id: string;
  name: string;
  description?: string;
}

/** Same shape `/api/backtest/run` returns. */
export interface BacktestApiResponse {
  strategy_id: string;
  strategy_name: string;
  metrics: Record<string, any>;
  chart_data: BacktestChartPoint[];
  trades?: Record<string, TradeRecord[]> | TradeRecord[];
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    let detail = body;
    try {
      detail = JSON.parse(body).detail || body;
    } catch {
      /* keep raw text */
    }
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

/**
 * The strategies the backend can run. No local list is kept: the server owns
 * the registry, so a strategy removed there disappears here instead of
 * offering a run the server will reject.
 */
export async function listStrategies(): Promise<StrategyOption[]> {
  const entries = await listCatalog();
  return entries.map(({ id, name, description }) => ({ id, name, description }));
}

/** Run a strategy on the backend and return the equity curve, metrics and trades. */
export async function runBacktest(
  strategyId: string,
  start: string,
  end?: string,
): Promise<BacktestApiResponse> {
  const params = new URLSearchParams({ strategy_id: strategyId, start_date: start });
  if (end) params.set('end_date', end);
  return getJson<BacktestApiResponse>(`/api/backtest/run?${params.toString()}`);
}

/** The tradable ticker directory for the watchlist. */
export async function getTickerDirectory(): Promise<TickerInfo[]> {
  const list = await getJson<TickerInfo[]>('/api/stock/ticker-details');
  return Array.isArray(list) ? list : [];
}

/** Bars for one ticker over a Research timeframe. */
export async function getStockHistory(
  ticker: string,
  timeframe: ResearchTimeframe,
): Promise<StockHistoryResponse> {
  const params = new URLSearchParams({ ticker, timeframe });
  return getJson<StockHistoryResponse>(`/api/stock/history?${params.toString()}`);
}
