// backtestCache.ts — saved backtest reports kept on this machine.
//
// The list is cheap but a report is not: one equity point per session, every
// trade, the whole log. Opening one used to cost an API read of that JSON each
// time, so the record is written to OPFS as soon as it arrives and read back
// from disk on the next open. A report never changes after its run — only its
// name can — so the name is patched here on rename, and a miss is always
// "fetch it", never an error.

import type { LabBacktestRecord } from '../../lib/api';

/** Separate from the market cache so sync's plan never sweeps these files. */
const DIR_NAME = 'sltp-backtests';
const FORMAT_VERSION = 1;
/** A report is ~100 KB; forty of them is a few megabytes, not a leak. */
const MAX_REPORTS = 40;

interface StoredBacktest {
  version: number;
  savedAt: number;
  record: LabBacktestRecord;
}

/** Ids arrive as ``backtest#9e7a2a7b``; keep the name friendly to any FS. */
function fileName(id: string): string {
  return `${id.replace(/[^A-Za-z0-9._-]/g, '_')}.json`;
}

async function cacheDir(create: boolean): Promise<FileSystemDirectoryHandle | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) return null;
  try {
    const root = await navigator.storage.getDirectory();
    return await root.getDirectoryHandle(DIR_NAME, { create });
  } catch {
    // Private windows and locked-down browsers simply get no cache.
    return null;
  }
}

/** The cached report, or null on a miss. */
export async function readCachedBacktest(id: string): Promise<LabBacktestRecord | null> {
  const dir = await cacheDir(false);
  if (!dir) return null;
  try {
    const file = await (await dir.getFileHandle(fileName(id))).getFile();
    const parsed = JSON.parse(await file.text()) as StoredBacktest;
    if (parsed.version !== FORMAT_VERSION || parsed.record?.id !== id) return null;
    return parsed.record;
  } catch {
    return null;
  }
}

/** Stores (or replaces) one report. Failure must never break a result open. */
export async function writeCachedBacktest(record: LabBacktestRecord): Promise<void> {
  const dir = await cacheDir(true);
  if (!dir) return;
  try {
    const stored: StoredBacktest = { version: FORMAT_VERSION, savedAt: Date.now(), record };
    const handle = await dir.getFileHandle(fileName(record.id), { create: true });
    const writable = await handle.createWritable();
    try {
      await writable.write(JSON.stringify(stored));
    } finally {
      await writable.close();
    }
    void trimReports(dir);
  } catch {
    // A full quota or a private window is not worth surfacing.
  }
}

/** Keeps the newest reports and drops the rest, oldest first. */
async function trimReports(dir: FileSystemDirectoryHandle): Promise<void> {
  try {
    const entries: { name: string; savedAt: number }[] = [];
    for await (const entry of dir.values()) {
      if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue;
      let savedAt = 0;
      try {
        savedAt = (JSON.parse(await (await entry.getFile()).text()) as StoredBacktest).savedAt ?? 0;
      } catch {
        // Unreadable files are the first to go.
      }
      entries.push({ name: entry.name, savedAt });
    }
    if (entries.length <= MAX_REPORTS) return;
    entries.sort((a, b) => b.savedAt - a.savedAt);
    for (const stale of entries.slice(MAX_REPORTS)) {
      await dir.removeEntry(stale.name).catch(() => undefined);
    }
  } catch {
    // Trimming is housekeeping; a failure leaves the cache as it was.
  }
}

/** A rename is the one field a cached report can disagree on. */
export async function renameCachedBacktest(id: string, name: string): Promise<void> {
  const cached = await readCachedBacktest(id);
  if (!cached) return;
  await writeCachedBacktest({ ...cached, name, updated_at: new Date().toISOString() });
}

/** Drops one report, for a delete or a report the server no longer has. */
export async function dropCachedBacktest(id: string): Promise<void> {
  const dir = await cacheDir(false);
  if (!dir) return;
  try {
    await dir.removeEntry(fileName(id));
  } catch {
    // Already gone.
  }
}
