// pool.ts — a pool of exactly two parquet workers for the whole app.
//
// One worker chews one file at a time, and era files are independent: two
// workers decode two files side by side, which is where the chart speedup
// comes from. Two is the whole pool on purpose — each decode holds a few
// hundred MB transiently, and a phone browser kills tabs that grab much
// more. Jobs wait in two client-side lanes and only one is ever inside each
// worker: quotes (fast, user-visible) always jump ahead of bars (slow,
// background-fill). FIFO within a lane keeps ordering predictable.
//
// When workers are blocked (some locked-down WebViews refuse `new Worker`),
// the pool falls back to the same code on the main thread: slower and with
// visible jank on big files, but the app keeps working.

import type { CatalogEntry, WorkerQuote, WorkerRow } from './parquet';

interface Pending {
  resolve: (data: Record<string, unknown>) => void;
  reject: (err: Error) => void;
}

const POOL_SIZE = 2;

let seq = 0;
const pending = new Map<number, Pending>();

interface Queued {
  id: number;
  message: object;
  high: boolean;
}

let inlineFallback = false;
let inlineBusy = false;
const highLane: Queued[] = [];
const normalLane: Queued[] = [];

/** Runs one query on the main thread when no Worker can be created. */
async function runInline(message: object): Promise<Record<string, unknown>> {
  const query = message as { kind?: string; file?: Blob; symbol?: string; symbols?: string[] };
  const mod = await import('./parquet');
  if (query.kind === 'bars') {
    const { rows, perf } = await mod.readBars(query.file as Blob, query.symbol as string);
    return { rows: rows as WorkerRow[], perf };
  }
  if (query.kind === 'quotes') {
    const { quotes, perf } = await mod.readQuotes(query.file as Blob, (query.symbols ?? []) as string[]);
    return { quotes: quotes as Record<string, WorkerQuote>, perf };
  }
  const entries = await mod.readCatalog(query.file as Blob);
  return { entries: entries as CatalogEntry[] };
}

interface Slot {
  worker: Worker;
  busy: boolean;
  job: number | null;
}

const slots: Slot[] = [];

function dropSlot(slot: Slot): void {
  const at = slots.indexOf(slot);
  if (at >= 0) slots.splice(at, 1);
  try {
    slot.worker.terminate();
  } catch {
    /* already gone */
  }
}

function pump(): void {
  const next = highLane.shift() ?? normalLane.shift();
  if (!next) return;
  if (inlineFallback) {
    if (inlineBusy) {
      (next.high ? highLane : normalLane).unshift(next);
      return;
    }
    inlineBusy = true;
    runInline(next.message).then(
      (data) => {
        inlineBusy = false;
        pending.get(next.id)?.resolve(data);
        pending.delete(next.id);
        pump();
      },
      (err: unknown) => {
        inlineBusy = false;
        const entry = pending.get(next.id);
        pending.delete(next.id);
        entry?.reject(err instanceof Error ? err : new Error('Parquet read failed'));
        pump();
      },
    );
    return;
  }
  let slot = slots.find((s) => !s.busy);
  if (!slot && slots.length < POOL_SIZE) {
    try {
      const worker = new Worker(new URL('./parquet.worker.ts', import.meta.url), {
        type: 'module',
      });
      const fresh: Slot = { worker, busy: false, job: null };
      worker.onmessage = (e: MessageEvent<{ id: number } & Record<string, unknown>>) => {
        const { id, ...rest } = e.data;
        const entry = pending.get(id);
        pending.delete(id);
        fresh.busy = false;
        fresh.job = null;
        if (entry) entry.resolve(rest);
        pump();
      };
      worker.onerror = () => {
        // A dead worker must not hang its in-flight query: reject it and
        // drop the handle, so the next pump starts a fresh Worker.
        const entry = fresh.job != null ? pending.get(fresh.job) : undefined;
        if (fresh.job != null) pending.delete(fresh.job);
        dropSlot(fresh);
        if (entry) entry.reject(new Error('Parquet worker failed'));
        pump();
      };
      slots.push(fresh);
      slot = fresh;
    } catch {
      // Workers are blocked in this context: run everything inline.
      inlineFallback = true;
      (next.high ? highLane : normalLane).unshift(next);
      pump();
      return;
    }
  }
  if (!slot) {
    (next.high ? highLane : normalLane).unshift(next);
    return;
  }
  slot.busy = true;
  slot.job = next.id;
  try {
    slot.worker.postMessage({ ...next.message, id: next.id });
  } catch (err) {
    slot.busy = false;
    slot.job = null;
    const entry = pending.get(next.id);
    pending.delete(next.id);
    dropSlot(slot);
    entry?.reject(err instanceof Error ? err : new Error('Could not reach parquet worker'));
    pump();
  }
}

/** Sends one query to the pool. Quotes ride the priority lane. */
export function callWorker<T>(message: object): Promise<T> {
  const id = (seq += 1);
  return new Promise<T>((resolve, reject) => {
    pending.set(id, {
      resolve: (data) => resolve(data as T),
      reject,
    });
    const queued: Queued = {
      id,
      message,
      high: (message as { kind?: string }).kind === 'quotes',
    };
    (queued.high ? highLane : normalLane).push(queued);
    pump();
  });
}
