// opfsWrite.ts — the main thread's handle on the sync-access writer.
//
// Only used after createWritable() has already failed. The worker fetches the
// URL itself and writes chunk by chunk with createSyncAccessHandle(), which
// Safari handles well and which never holds the whole file in memory.

interface Reply {
  id: number;
  kind: 'progress' | 'done' | 'unsupported' | 'error';
  bytes?: number;
  message?: string;
}

interface Pending {
  onChunk?: (bytes: number) => void;
  resolve: () => void;
  reject: (error: Error) => void;
}

const pending = new Map<number, Pending>();
let worker: Worker | null | undefined;
let sequence = 0;

function ensureWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL('./opfsWrite.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (event: MessageEvent<Reply>) => {
      const { id, kind } = event.data;
      const job = pending.get(id);
      if (!job) return;
      if (kind === 'progress') {
        job.onChunk?.(event.data.bytes ?? 0);
        return;
      }
      pending.delete(id);
      if (kind === 'done') job.resolve();
      else if (kind === 'unsupported') job.reject(new Error('no sync access handle'));
      else job.reject(new Error(event.data.message ?? 'OPFS write failed'));
    };
    worker.onerror = () => {
      for (const job of pending.values()) job.reject(new Error('OPFS writer crashed'));
      pending.clear();
      worker = null;
    };
  } catch {
    worker = null;
  }
  return worker;
}

/**
 * Downloads `url` straight into `path` through a worker-held synchronous file
 * handle. Throws when the browser has no createSyncAccessHandle or the write
 * fails; the caller already has its own error path.
 */
export function writeWithSyncAccess(
  path: string,
  url: string,
  onChunk?: (bytes: number) => void,
): Promise<void> {
  const instance = ensureWorker();
  if (!instance) return Promise.reject(new Error('OPFS writer unavailable'));
  const id = ++sequence;
  return new Promise<void>((resolve, reject) => {
    pending.set(id, { onChunk, resolve, reject });
    instance.postMessage({ id, url, path });
  });
}
