// pythonRunner.ts — the page-facing side of the Lab's Python runtime.
//
// One worker, started when the Lab opens and then kept alive across visits, so
// coming back to the page costs nothing. The store exposes a status the page can
// subscribe to (idle, loading, ready, error) and a run call that streams output
// back as it arrives.
//
// A snippet that never finishes would hold the worker forever, so every run has
// a hard limit: the worker is terminated, the reader is told, and a fresh one
// starts in the background. That costs a restart instead of a hung tab.

import type { LabLogEntry } from './backtestTypes';
import type { EngineRunSettings } from './runSettings';
import type { RunResult } from './pythonTypes';

export type PythonStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface PythonState {
  status: PythonStatus;
  /** The interpreter version Pyodide reports, once it is up. */
  version: string | null;
  error: string | null;
  /** What the boot is doing right now, shown while the engine installs. */
  detail: string | null;
  /** Whether the pinned sltp wheel installed at boot. */
  engine: boolean | null;
  /** Whether the OPFS market cache and its metadata are ready. */
  market: boolean | null;
  /** Why the engine is missing, when it is. */
  warning: string | null;
}

/** How long one file may run before the worker is replaced. A backtest can
    warm its cache on the first run, so this is minutes rather than seconds. */
const RUN_TIMEOUT_MS = 300_000;

type OutMessage =
  | { type: 'ready'; version: string; engine: boolean; market: boolean; warning: string | null }
  | { type: 'status'; text: string }
  | { type: 'run-status'; id: number; text: string }
  | { type: 'stdout'; id: number; text: string }
  | { type: 'stderr'; id: number; text: string }
  | {
      type: 'done';
      id: number;
      ok: boolean;
      message?: string;
      notice?: string;
      result?: unknown;
      logs?: LabLogEntry[];
      durationMs: number;
    }
  | { type: 'boot-error'; message: string }
  | { type: 'reset-ok' }
  | { type: 'analyze-result'; id: number; ok: boolean; error?: string; data?: unknown };

interface ActiveRun {
  id: number;
  onOutput?: (text: string) => void;
  onOutputError?: (text: string) => void;
  onProgress?: (text: string) => void;
  resolve: (result: RunResult) => void;
  timer: number;
}

let state: PythonState = { status: 'idle', version: null, error: null, detail: null, engine: null, market: null, warning: null };
const listeners = new Set<() => void>();

let worker: Worker | null = null;
let bootId = 0;
let nextId = 1;
let activeRun: ActiveRun | null = null;

/** Analysis rounds in flight; each one resolves by its own id. */
const pendingAnalysis = new Map<number, (reply: AnalyzeReply) => void>();

export interface AnalyzeRequest {
  method: 'complete' | 'hover' | 'signature' | 'define' | 'diagnostics' | 'imports';
  code: string;
  path: string;
  line: number;
  column: number;
  files: { name: string; content: string }[];
}

export interface AnalyzeReply {
  ok: boolean;
  error?: string;
  data?: unknown;
}

/**
 * Asks the interpreter that is already running to analyse some code. Nothing
 * is installed and nothing is started here: jedi is a Python package, so the
 * answer comes back from the same process a run would use.
 */
export function analyze(request: AnalyzeRequest): Promise<AnalyzeReply> {
  if (!worker) return Promise.resolve({ ok: false, error: 'Python is not ready yet' });
  if (state.status !== 'ready') return Promise.resolve({ ok: false, error: 'Python is still starting' });
  const id = nextId++;
  return new Promise<AnalyzeReply>((resolve) => {
    const finish = (reply: AnalyzeReply) => {
      window.clearTimeout(timer);
      resolve(reply);
    };
    const timer = window.setTimeout(() => {
      pendingAnalysis.delete(id);
      resolve({ ok: false, error: 'the analysis request timed out' });
    }, 15_000);
    pendingAnalysis.set(id, finish);
    worker?.postMessage({ id, kind: 'analyze', ...request });
  });
}

function publish(next: Partial<PythonState>): void {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

export function getPythonState(): PythonState {
  return state;
}

export function subscribePython(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Ends the interpreter and forgets it. Only a failed boot uses this. */
function disposeWorker(): void {
  worker?.terminate();
  worker = null;
}

function settle(result: RunResult): void {
  if (!activeRun) return;
  window.clearTimeout(activeRun.timer);
  const { resolve } = activeRun;
  activeRun = null;
  resolve(result);
}

function onMessage(event: MessageEvent<OutMessage>): void {
  const message = event.data;

  if (message.type === 'analyze-result') {
    pendingAnalysis.get(message.id)?.({ ok: message.ok, error: message.error, data: message.data });
    pendingAnalysis.delete(message.id);
    return;
  }

  if (message.type === 'ready') {
    publish({
      status: 'ready',
      version: message.version || null,
      error: null,
      detail: null,
      engine: message.engine,
      market: message.market,
      warning: message.warning,
    });
    return;
  }

  if (message.type === 'status') {
    publish({ detail: message.text });
    return;
  }

  if (message.type === 'boot-error') {
    disposeWorker();
    publish({ status: 'error', error: message.message || 'Python could not start', detail: null });
    return;
  }

  if (message.type === 'run-status') {
    if (!activeRun || message.id !== activeRun.id) return;
    activeRun.onProgress?.(message.text);
    return;
  }

  if (message.type === 'stdout' || message.type === 'stderr') {
    if (!activeRun || message.id !== activeRun.id) return;
    const deliver = message.type === 'stdout' ? activeRun.onOutput : activeRun.onOutputError;
    deliver?.(message.text);
    return;
  }

  if (message.type === 'done') {
    if (!activeRun || message.id !== activeRun.id) return;
    settle({
      ok: message.ok,
      error: message.ok ? undefined : message.message ?? 'The snippet failed',
      durationMs: message.durationMs,
      result: message.result,
      logs: message.logs,
      notice: message.notice,
    });
  }
}

function startWorker(): void {
  publish({ status: 'loading', error: null, detail: 'Loading Python…', engine: null, market: null, warning: null });
  const created = new Worker(new URL('./python.worker.ts', import.meta.url), { type: 'module' });
  worker = created;
  created.onmessage = onMessage;
  // A dead worker used to leave a run pending until the five minute timeout,
  // with the page insisting it was still working and no clue why. Ending the
  // run here turns that into a sentence the reader can act on.
  const fail = (message: string) => {
    if (worker !== created) return;
    disposeWorker();
    settle({ ok: false, error: message, durationMs: 0 });
    publish({ status: 'error', error: message });
  };
  created.onerror = (event: ErrorEvent) => {
    fail(event.message || 'Python stopped unexpectedly. Start the run again.');
  };
  created.onmessageerror = () => {
    fail('Python stopped unexpectedly. Start the run again.');
  };
  bootId = nextId++;
  created.postMessage({ id: bootId, kind: 'init' });
}

/** Boots the interpreter once. Repeated calls are free. */
export function loadPython(): void {
  if (worker || state.status === 'loading' || state.status === 'ready') return;
  startWorker();
}

/** Retries after a failed boot. */
export function restartPython(): void {
  disposeWorker();
  publish({ status: 'idle', error: null, version: null, detail: null, engine: null, market: null, warning: null });
  startWorker();
}

/**
 * Runs one snippet, streaming stdout and stderr as they arrive. The promise
 * resolves for a Python error as well, since the error is output, not a crash.
 */
export function runPython(
  filename: string,
  code: string,
  files: { name: string; content: string }[],
  handlers: {
    onOutput?: (text: string) => void;
    onOutputError?: (text: string) => void;
    onProgress?: (text: string) => void;
  } = {},
  settings?: EngineRunSettings,
): Promise<RunResult> {
  if (!worker || state.status !== 'ready') {
    return Promise.resolve({
      ok: false,
      error: state.status === 'loading' ? 'Python is still starting' : 'Python is not running',
      durationMs: 0,
    });
  }

  // One run at a time: the worker's stdout has no way to tell two apart.
  if (activeRun) {
    return Promise.resolve({ ok: false, error: 'A file is already running', durationMs: 0 });
  }

  const id = nextId++;
  return new Promise<RunResult>((resolve) => {
    const timer = window.setTimeout(() => {
      settle({
        ok: false,
        error: `Stopped after ${Math.round(RUN_TIMEOUT_MS / 1000)} seconds. Python restarted and the files from this session were cleared.`,
        durationMs: RUN_TIMEOUT_MS,
      });
      disposeWorker();
      publish({ status: 'idle', version: null, error: null });
      startWorker();
    }, RUN_TIMEOUT_MS);

    activeRun = {
      id,
      onOutput: handlers.onOutput,
      onOutputError: handlers.onOutputError,
      onProgress: handlers.onProgress,
      resolve,
      timer,
    };
    worker?.postMessage({ id, kind: 'run', filename, code, files, settings });
  });
}

/** Clears the files and modules of the last run, keeping Python warm. */
export function resetProjectFiles(): void {
  worker?.postMessage({ id: nextId++, kind: 'reset' });
}
