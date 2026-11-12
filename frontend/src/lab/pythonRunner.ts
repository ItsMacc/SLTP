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

import type { RunResult } from './pythonTypes';

export type PythonStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface PythonState {
  status: PythonStatus;
  /** The interpreter version Pyodide reports, once it is up. */
  version: string | null;
  error: string | null;
}

/** How long one snippet may run before the worker is replaced. */
const RUN_TIMEOUT_MS = 10_000;

type OutMessage =
  | { type: 'ready'; version: string }
  | { type: 'stdout'; id: number; text: string }
  | { type: 'stderr'; id: number; text: string }
  | { type: 'done'; id: number; ok: boolean; message?: string; durationMs: number }
  | { type: 'boot-error'; message: string }
  | { type: 'reset-ok' };

interface ActiveRun {
  id: number;
  onOutput?: (text: string) => void;
  onOutputError?: (text: string) => void;
  resolve: (result: RunResult) => void;
  timer: number;
}

let state: PythonState = { status: 'idle', version: null, error: null };
const listeners = new Set<() => void>();

let worker: Worker | null = null;
let bootId = 0;
let nextId = 1;
let activeRun: ActiveRun | null = null;

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

  if (message.type === 'ready') {
    publish({ status: 'ready', version: message.version || null, error: null });
    return;
  }

  if (message.type === 'boot-error') {
    disposeWorker();
    publish({ status: 'error', error: message.message || 'Python could not start' });
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
    });
  }
}

function startWorker(): void {
  publish({ status: 'loading', error: null });
  const created = new Worker(new URL('./python.worker.ts', import.meta.url), { type: 'module' });
  worker = created;
  created.onmessage = onMessage;
  created.onerror = (event: ErrorEvent) => {
    if (worker !== created) return;
    disposeWorker();
    publish({ status: 'error', error: event.message || 'Python could not start' });
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
  publish({ status: 'idle', error: null, version: null });
  startWorker();
}

/**
 * Runs one snippet, streaming stdout and stderr as they arrive. The promise
 * resolves for a Python error as well, since the error is output, not a crash.
 */
export function runPython(
  code: string,
  handlers: { onOutput?: (text: string) => void; onOutputError?: (text: string) => void } = {},
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
    return Promise.resolve({ ok: false, error: 'A snippet is already running', durationMs: 0 });
  }

  const id = nextId++;
  return new Promise<RunResult>((resolve) => {
    const timer = window.setTimeout(() => {
      settle({
        ok: false,
        error: `Stopped after ${Math.round(RUN_TIMEOUT_MS / 1000)} seconds. Python restarted and the variables from this session were cleared.`,
        durationMs: RUN_TIMEOUT_MS,
      });
      disposeWorker();
      publish({ status: 'idle', version: null, error: null });
      startWorker();
    }, RUN_TIMEOUT_MS);

    activeRun = { id, onOutput: handlers.onOutput, onOutputError: handlers.onOutputError, resolve, timer };
    worker?.postMessage({ id, kind: 'run', code });
  });
}

/** Clears every name the reader defined, keeping the interpreter warm. */
export function resetPythonNamespace(): void {
  worker?.postMessage({ id: nextId++, kind: 'reset' });
}
