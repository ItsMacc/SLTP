// backtestTypes.ts — what a Lab strategy run hands to the results window.
//
// The worker normalizes Backtester.run() through sltp.web.to_jsonable(), so
// this is plain JSON: numpy scalars and dates are already gone, stats is the
// metrics dict without its duplicated equity key, and every trade's exit is
// either an event or null for a still-open position.

export interface LabEquityPoint {
  date: string;
  value: number;
}

export interface LabTradeExit {
  date: string;
  type: string;
  price: number;
}

export interface LabTrade {
  id: number;
  ticker: string;
  position_type: string;
  entry_date: string;
  entry_price: number;
  allocation: number;
  equity_at_entry: number;
  stop_loss: number;
  take_profit: number;
  fees: number;
  dividend_income: number;
  exit: LabTradeExit | null;
}

export interface LabLogEntry {
  stream: 'stdout' | 'stderr';
  text: string;
}

export interface LabBacktestPayload {
  /** The static SVG chart the engine drew, first in the download. */
  svg?: string | null;
  stats: Record<string, number | string | boolean | null>;
  equity: LabEquityPoint[];
  trades: LabTrade[];
  /** Buy-and-hold SPY over the same range, when it could be loaded. */
  benchmark: LabEquityPoint[];
  strategy_name: string | null;
  stamp: Record<string, unknown>;
  /** Orders the engine refused, keyed by reason. Present in the download. */
  rejections?: Record<string, number>;
  /** Everything the reader's code printed during this run. */
  logs?: LabLogEntry[];
  /** How the run was started, kept with the saved payload. */
  run?: { auto: boolean; start: string };
  /** The entry file that was run, so a saved result can show it. */
  file_name?: string;
}

export function isLabBacktestPayload(value: unknown): value is LabBacktestPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Partial<LabBacktestPayload>;
  return (
    Array.isArray(payload.equity) &&
    payload.equity.length > 0 &&
    Array.isArray(payload.trades) &&
    !!payload.stats &&
    typeof payload.stats === 'object'
  );
}

/** The first and last equity dates, for the report subtitle. */
export function backtestRange(payload: LabBacktestPayload): string {
  const first = payload.equity[0]?.date;
  const last = payload.equity[payload.equity.length - 1]?.date;
  if (!first || !last) return '';
  return `${first} → ${last} · ${payload.equity.length.toLocaleString()} sessions`;
}
