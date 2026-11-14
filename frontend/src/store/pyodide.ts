// pyodide.ts — the in-browser strategy engine, loaded only when needed.
//
// Nothing here runs at page load. The first warmEngine call (today: the
// Research page mount on desktop) starts a dedicated worker that boots
// Pyodide inside itself, so the main thread never downloads Python and the
// page never janks while the runtime compiles. The worker mounts the OPFS
// market cache where sltp looks for it and installs the pinned wheels from
// the OPFS wheel cache, so the second visit has nothing to download.
//
// Phones never warm: strategy runs stay a desktop feature, and a warm
// would spend a phone plan on megabytes nothing can use yet. The status
// store drives the loading screen — first run shows it, later runs skip
// straight to the backtest.
//
// User-written strategies stay out: only the registry below (the same five
// sources as backend/strategies) is ever exec'd. The Lab's code runs come
// later, through their own gate.

import { useSyncExternalStore } from 'react';

import benchmarkSource from './strategies/benchmark.py?raw';
import adaptiveMomentumSource from './strategies/adaptive_momentum.py?raw';
import gtaSource from './strategies/global_trend_allocation.py?raw';
import minVolSource from './strategies/minimum_volatility.py?raw';
import smrSource from './strategies/statistical_mean_reversion.py?raw';

export type EnginePhase =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'unsupported'
  | 'error';

export interface EngineStatus {
  phase: EnginePhase;
  /** Human line for the loading screen ("Loading engine…") or the error. */
  detail: string | null;
  /** True when every wheel came from OPFS — the visit downloaded nothing. */
  cachedWheels: boolean;
}

const INITIAL: EngineStatus = { phase: 'idle', detail: null, cachedWheels: false };

/** What each worker boot stage means to a reader. */
const WARM_STAGE: Record<string, string> = {
  python: 'Loading the Python runtime…',
  numpy: 'Loading numpy…',
  cache: 'Mounting the market cache…',
  wheels: 'Installing the engine…',
  engine: 'Registering strategies…',
  data: 'Reading market files…',
};

let status: EngineStatus = { ...INITIAL };
const listeners = new Set<() => void>();

function setStatus(patch: Partial<EngineStatus>): void {
  status = { ...status, ...patch };
  listeners.forEach((fn) => fn());
}

export function getEngineStatus(): EngineStatus {
  return status;
}

function subscribeEngineStatus(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** React binding for the engine warm. Re-renders on phase changes. */
export function useEngineStatus(): EngineStatus {
  return useSyncExternalStore(subscribeEngineStatus, getEngineStatus, getEngineStatus);
}

export interface EngineStrategy {
  /** Stable id used by the UI and the worker. Matches the backend ids. */
  id: string;
  /** Class name defined inside `source`. */
  className: string;
  /** Display name, as the strategy list shows it. */
  name: string;
  /** One line on what it does. */
  description: string;
  /** The .py source, exec'd in the worker. */
  source: string;
}

/** The five prebuilt strategies the browser may run. Adding one means one
    entry here plus its source next to the others — the worker registers
    exactly this list, nothing else. */
export const ENGINE_STRATEGIES: EngineStrategy[] = [
  {
    id: 'buy-and-hold',
    className: 'Benchmark',
    name: 'Buy and Hold',
    description: 'Owns the S&P 500 through one fund for the whole run. The benchmark.',
    source: benchmarkSource,
  },
  {
    id: 'adaptive-momentum',
    className: 'AdaptiveMomentum',
    name: 'Adaptive Momentum',
    description: 'Holds the 20 strongest liquid US stocks while SPY is above its 200-day average.',
    source: adaptiveMomentumSource,
  },
  {
    id: 'global-trend-allocation',
    className: 'GlobalTrendAllocation',
    name: 'Global Trend Allocation',
    description: 'Five-ETF book from trend, correlation and momentum. Exits a sleeve when its trend breaks.',
    source: gtaSource,
  },
  {
    id: 'minimum-volatility',
    className: 'MinimumVolatility',
    name: 'Minimum Volatility',
    description: 'Equal-weighted 30 least volatile liquid US stocks, rebuilt quarterly.',
    source: minVolSource,
  },
  {
    id: 'statistical-mean-reversion',
    className: 'StatisticalMeanReversionStrategy',
    name: 'Statistical Mean Reversion',
    description: 'Buys stocks that fell further than their volatility explains, then waits for the snap back.',
    source: smrSource,
  },
];

/** One run's payload, straight from sltp.web.run. */
export interface EngineTimings {
  /** Seconds this run waited for the engine to boot (first run of a visit). */
  warm_seconds?: number;
  run_seconds: number;
  io_seconds: number;
  io_calls: number;
  bridge_seconds: number;
  bridge_bytes: number;
  bridge_files: number;
}

export interface EngineRun {
  key: string;
  name: string;
  stats: Record<string, number>;
  equity: { date: string; value: number }[];
  trades: Record<string, unknown>[];
  /** Where the run's wall clock went, measured inside the worker. */
  timings?: EngineTimings;
}

/**
 * One engine trade as the record the Research page reads. This mirrors
 * `_trade_to_record` in backend/app/main.py on purpose: the browser and the
 * API must hand the table the same fields, or a run over the worker renders
 * dashes where the API shows numbers. sltp names the size `allocation` and
 * nests the exit, so both are flattened here.
 */
function toTradeRecord(trade: Record<string, any>, index: number): Record<string, unknown> {
  const exit = (trade.exit ?? {}) as { date?: string; price?: number; type?: string }
  return {
    id: trade.id ?? index + 1,
    ticker: trade.ticker,
    action: trade.position_type === 'short' ? 'SHORT' : 'BUY',
    position_type: trade.position_type,
    entry_date: trade.entry_date,
    signal_date: trade.entry_date,
    entry_price: trade.entry_price,
    allocation_size: trade.allocation,
    stop_loss: trade.stop_loss,
    take_profit: trade.take_profit,
    exit_date: exit.date ?? null,
    exit_price: exit.price ?? null,
    exit_type: exit.type ?? null,
    transaction_cost: trade.fees,
  }
}

interface PendingRun {
  kind: 'init' | 'run';
  resolve: (reply: { text: string; wheelsCached: boolean }) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** A full-window backtest can chew minutes on a phone-class CPU; the worker
    answers when it answers. Fifteen minutes, then the run is declared dead —
    the worker keeps going, but the page has moved on. */
const RUN_TIMEOUT_MS = 15 * 60 * 1000;

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, PendingRun>();

function ensureWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<{
      id: number;
      kind: string;
      ok: boolean;
      data?: unknown;
      error?: string;
      wheelsCached?: boolean;
      stage?: string;
    }>) => {
      // Stage messages have no id and are not replies to anything: they only
      // move the loading line along while the first engine boot runs.
      if (event.data.kind === 'progress') {
        setStatus({ phase: 'loading', detail: WARM_STAGE[event.data.stage ?? ''] ?? 'Loading engine…' });
        return;
      }
      const entry = pending.get(event.data.id);
      if (!entry) return;
      pending.delete(event.data.id);
      clearTimeout(entry.timer);
      if (event.data.kind !== entry.kind) {
        entry.reject(new Error(`engine crossed a reply (asked ${entry.kind}, got ${event.data.kind})`));
        return;
      }
      if (!event.data.ok) {
        entry.reject(new Error(event.data.error || 'engine call failed'));
        return;
      }
      entry.resolve({
        text: String(event.data.data ?? 'null'),
        wheelsCached: event.data.wheelsCached === true,
      });
    };
    worker.onerror = (event) => {
      const message = event.message || 'engine worker crashed';
      setStatus({ phase: 'error', detail: message });
      for (const [, entry] of pending) {
        clearTimeout(entry.timer);
        entry.reject(new Error(message));
      }
      pending.clear();
      worker = null;
    };
  }
  return worker;
}

function callWorker(
  kind: 'init' | 'run',
  payload: Record<string, unknown>,
): Promise<{ text: string; wheelsCached: boolean }> {
  const instance = ensureWorker();
  const id = (seq += 1);
  return new Promise<{ text: string; wheelsCached: boolean }>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('engine call timed out'));
    }, RUN_TIMEOUT_MS);
    pending.set(id, { kind, resolve, reject, timer });
    instance.postMessage({ id, kind, ...payload });
  });
}

let warmPromise: Promise<EngineStatus> | null = null;

/**
 * Boots the engine worker and registers the five strategies. Phones run it
 * too, over their five-year cache. Safe to call from every page mount; runs
 * once per page load.
 */
export function warmEngine(): Promise<EngineStatus> {
  if (!warmPromise) warmPromise = runWarm().catch(handleWarmError);
  return warmPromise;
}

function handleWarmError(err: unknown): EngineStatus {
  const detail = err instanceof Error ? err.message : 'Engine warm failed';
  setStatus({ phase: 'error', detail });
  warmPromise = null;
  return { ...status };
}

async function runWarm(): Promise<EngineStatus> {
  if (status.phase === 'ready') return { ...status };
  setStatus({ phase: 'loading', detail: 'Loading engine…', cachedWheels: false });
  const { wheelsCached } = await callWorker('init', {
    strategies: ENGINE_STRATEGIES.map(({ id, className, source }) => ({ key: id, className, source })),
  });
  setStatus({ phase: 'ready', detail: 'Engine ready', cachedWheels: wheelsCached });
  return { ...status };
}

/**
 * Runs one prebuilt strategy over [start, end] in the worker. Warms the
 * engine first when the page never did. The caller clamps a phone's start
 * date to the decade its cache covers.
 */
export async function runStrategy(
  id: string,
  start: string,
  end?: string,
): Promise<EngineRun> {
  // The first run of a visit also pays for the boot; time that separately so
  // the result can say how much was setup and how much was the backtest.
  const warmStart = performance.now();
  const warmed = await warmEngine();
  const warmSeconds = (performance.now() - warmStart) / 1000;
  if (warmed.phase !== 'ready') {
    throw new Error(warmed.detail || 'The strategy engine did not start.');
  }
  const entry = ENGINE_STRATEGIES.find((strategy) => strategy.id === id);
  if (!entry) throw new Error(`Unknown strategy: ${id}`);
  const { text } = await callWorker('run', { key: id, start, end: end ?? null });
  try {
    const parsed = JSON.parse(text) as EngineRun;
    const trades = (parsed.trades ?? []).map(toTradeRecord);
    parsed.timings = {
      ...(parsed.timings ?? {
        run_seconds: 0,
        io_seconds: 0,
        io_calls: 0,
        bridge_seconds: 0,
        bridge_bytes: 0,
        bridge_files: 0,
      }),
      warm_seconds: Math.round(warmSeconds * 100) / 100,
    };
    return { ...parsed, trades, key: id, name: entry.name };
  } catch {
    throw new Error('engine returned unreadable data');
  }
}

/** For tests and sign-out cleanup: forget the warm so the next call reruns. */
/**
 * One tiny silent run right after the engine is ready.
 *
 * The first real backtest was slow because it paid for two things that are
 * not the strategy: Python's import/compile paths for pandas and pyarrow, and
 * the year file's first read from OPFS. A seven-day benchmark run warms both,
 * costs a few seconds once, and nobody sees it. Best effort: a failure here
 * must never surface anywhere.
 */
let primed = false;

export function primeEngine(): Promise<void> {
  if (primed) return Promise.resolve();
  primed = true;
  return warmEngine()
    .then(async (warmed) => {
      if (warmed.phase !== 'ready') return;
      const end = new Date();
      const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      const iso = (date: Date) => date.toISOString().slice(0, 10);
      await callWorker('run', {
        key: ENGINE_STRATEGIES[0]!.id,
        start: iso(start),
        end: iso(end),
      });
    })
    .catch(() => {
      /* warming is an optimisation, not a feature */
    });
}

/** For tests and sign-out cleanup: forget the warm so the next call reruns. */
export function resetEngineForTests(): void {
  primed = false;
  warmPromise = null;
  if (worker) {
    try {
      worker.terminate();
    } catch {
      /* already gone */
    }
    worker = null;
  }
  pending.clear();
  setStatus({ ...INITIAL });
}
