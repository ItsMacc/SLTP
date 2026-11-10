// workerClient.ts — one shared parquet worker for the whole app.
//
// Spinning a Worker up per file meant every query re-loaded and
// re-evaluated the hyparquet module before reading a single byte — the
// dominant cost of a chart load. This module keeps a single Worker alive
// and multiplexes requests through it by id, so the module loads once per
// page and every later query starts parsing immediately.

interface Pending {
  resolve: (data: Record<string, never> | Record<string, unknown>) => void;
  reject: (err: Error) => void;
}

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, Pending>();

/* ---------- Scheduling ----------
 * The worker chews one parse at a time, so arrival order is service order.
 * A chart load posts several multi-second bars parses; without scheduling,
 * a 100ms quotes scan posted after them waits behind all of it and the
 * ticker list feels dead while the chart loads. Jobs therefore wait in two
 * client-side lanes and only one is ever inside the worker: quotes (fast,
 * user-visible) always jump ahead of bars (slow, background-fill). FIFO
 * within a lane keeps ordering predictable.
 */
interface Queued {
  id: number;
  message: object;
  high: boolean;
}

let busy = false;
const highLane: Queued[] = [];
const normalLane: Queued[] = [];

function pump(): void {
  if (busy) return;
  const next = highLane.shift() ?? normalLane.shift();
  if (!next) return;
  busy = true;
  try {
    getWorker().postMessage({ ...next.message, id: next.id });
  } catch (err) {
    busy = false;
    const entry = pending.get(next.id);
    pending.delete(next.id);
    entry?.reject(err instanceof Error ? err : new Error('Could not reach parquet worker'));
    pump();
  }
}

function failAll(err: Error): void {
  pending.forEach((entry) => entry.reject(err));
  pending.clear();
  highLane.length = 0;
  normalLane.length = 0;
  busy = false;
  worker?.terminate();
  worker = null;
}

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./parquet.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e: MessageEvent<{ id: number } & Record<string, unknown>>) => {
      const { id, ...rest } = e.data;
      const entry = pending.get(id);
      pending.delete(id);
      busy = false;
      if (entry) entry.resolve(rest);
      pump();
    };
    worker.onerror = (e: ErrorEvent) => {
      // A dead worker must not hang every in-flight query: fail them all
      // and drop the handle so the next call starts a fresh Worker.
      const err = e.error instanceof Error ? e.error : new Error('Parquet worker failed');
      failAll(err);
    };
  }
  return worker;
}

/** Sends one query to the shared worker. Quotes ride the priority lane;
 * everything else waits its turn. Blobs clone per post, cheaply. */
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
