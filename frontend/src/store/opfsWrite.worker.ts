// opfsWrite.worker.ts — large downloads written with a synchronous handle.
//
// Safari's createWritable() gives up on multi-megabyte files with a generic
// `UnknownError` ("unknown transient reason, e.g. out of memory"), and the
// main thread has no second option. A worker does: createSyncAccessHandle()
// writes straight to disk, is the path WebKit documents for OPFS, and holds
// no more than the chunk being read.
//
// The worker fetches the file itself rather than receiving a stream, so no
// transferable body has to survive the postMessage boundary.

interface Job {
  id: number;
  url: string;
  path: string;
}

interface SyncAccess {
  write(buffer: ArrayBufferView, options?: { at?: number }): number;
  truncate(size: number): void;
  flush(): void;
  close(): void;
}

type Reply =
  | { id: number; kind: 'progress'; bytes: number }
  | { id: number; kind: 'done' }
  | { id: number; kind: 'unsupported' }
  | { id: number; kind: 'error'; message: string };

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<Job>) => void) | null;
  postMessage(message: Reply): void;
};

function reply(message: Reply): void {
  scope.postMessage(message);
}

async function write({ id, url, path }: Job): Promise<void> {
  let access: SyncAccess | null = null;
  try {
    const root = await navigator.storage.getDirectory();
    const parts = path.split('/').filter(Boolean);
    const name = parts.pop();
    if (!name) throw new Error(`bad path: ${path}`);
    let dir = root;
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create: true });
    }
    const handle = await dir.getFileHandle(name, { create: true });
    const create = (
      handle as unknown as {
        createSyncAccessHandle?: () => Promise<SyncAccess>;
      }
    ).createSyncAccessHandle;
    if (!create) {
      reply({ id, kind: 'unsupported' });
      return;
    }
    access = await create.call(handle);

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`);

    const reader = res.body.getReader();
    let offset = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      // The sync handle takes ArrayBuffer-backed views only.
      const bytes = new Uint8Array(value.byteLength);
      bytes.set(value);
      access.write(bytes, { at: offset });
      offset += bytes.byteLength;
      reply({ id, kind: 'progress', bytes: bytes.byteLength });
    }
    access.truncate(offset);
    access.flush();
    access.close();
    access = null;
    reply({ id, kind: 'done' });
  } catch (error) {
    try {
      access?.close();
      } catch {
      // A handle that already failed is not worth another error.
    }
    reply({
      id,
      kind: 'error',
      message: error instanceof Error ? error.message : 'OPFS write failed',
    });
  }
}

// One write at a time: sync handles take exclusive locks, and the app's sync is
// sequential anyway.
let queue: Promise<void> = Promise.resolve();
scope.onmessage = (event) => {
  const job = event.data;
  queue = queue.then(() => write(job));
};
