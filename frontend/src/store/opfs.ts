// opfs.ts — the browser's disk: market chunks, sidecars and engine wheels.
//
// The Origin Private File System survives reloads; the browser may only
// evict it under storage pressure (sync asks for persistence). Private
// windows may keep it in memory and drop it on close — callers treat a
// miss as "fetch again", never as an error. One directory holds every
// cached file so the whole cache can be reasoned about in one place.

/** Top-level OPFS directory holding every cached file. */
const DIR_NAME = 'sltp-market';

/** Records which dataset version the cached files were downloaded against. */
const VERSION_NAME = '__version.txt';

export function opfsSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.storage?.getDirectory;
}

async function openDir(create: boolean): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(DIR_NAME, { create });
}

/** Walks nested handles: "MARKET_DAILY/market_data_recent.parquet". */
async function parentFor(
  path: string,
  create: boolean,
): Promise<{ dir: FileSystemDirectoryHandle; name: string }> {
  const parts = path.split('/').filter(Boolean);
  const name = parts.pop() as string;
  let dir = await openDir(create);
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, { create });
  }
  return { dir, name };
}

/** True when this exact path is already on disk. */
export async function hasFile(path: string): Promise<boolean> {
  try {
    const { dir, name } = await parentFor(path, false);
    await dir.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}

/** Cached byte count, or null on a miss. The freshness check: a daily script
rewrites files in place, so presence alone cannot tell a stale chunk. */
export async function fileSize(path: string): Promise<number | null> {
  const file = await getFile(path);
  return file ? file.size : null;
}

/** The cached file, or null on a miss. The caller owns the File. */
export async function getFile(path: string): Promise<File | null> {
  try {
    const { dir, name } = await parentFor(path, false);
    const handle = await dir.getFileHandle(name);
    return handle.getFile();
  } catch {
    return null;
  }
}

/** Every file path under a directory, relative to it (`a.parquet`,
    `x/y.bin`). A miss means nothing cached yet, so it reads as empty. */
export async function listFiles(path: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (dir: FileSystemDirectoryHandle, prefix: string): Promise<void> => {
    for await (const entry of dir.values()) {
      if (entry.kind === 'file') out.push(prefix + entry.name);
      else if (entry.kind === 'directory') {
        await walk(entry as FileSystemDirectoryHandle, `${prefix}${entry.name}/`);
      }
    }
  };
  try {
    const parts = path.split('/').filter(Boolean);
    let dir = await openDir(false);
    for (const part of parts) dir = await dir.getDirectoryHandle(part);
    await walk(dir, '');
  } catch {
    /* nothing cached yet */
  }
  return out;
}

/** Stores (or replaces) one file. Writes are atomic per file handle. */
export async function putFile(path: string, data: Blob): Promise<void> {
  const { dir, name } = await parentFor(path, true);
  const handle = await dir.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  try {
    await writable.write(data);
  } finally {
    await writable.close();
  }
}

/** Removes one file. A miss is fine — sync treats it as "fetch again". */
export async function deleteFile(path: string): Promise<void> {
  try {
    const { dir, name } = await parentFor(path, false);
    await dir.removeEntry(name);
  } catch {
    /* already gone */
  }
}

/** Removes a directory and everything under it. A miss is fine. */
export async function removeDir(path: string): Promise<void> {
  try {
    const parts = path.split('/').filter(Boolean);
    const name = parts.pop() as string;
    let dir = await openDir(false);
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part);
    }
    await dir.removeEntry(name, { recursive: true });
  } catch {
    /* already gone */
  }
}

/** Which dataset version the cache holds, or null when never synced. */
export async function readVersion(): Promise<string | null> {
  const file = await getFile(VERSION_NAME);
  if (!file) return null;
  return (await file.text()).trim() || null;
}

export async function writeVersion(version: string): Promise<void> {
  await putFile(VERSION_NAME, new Blob([version], { type: 'text/plain' }));
}
