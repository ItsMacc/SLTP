// marketSync.ts — the background download sequence.
//
// First visit (or a new dataset version): check the manifest, fetch the two
// files that cover the last ~5 years for every ticker, then keep going
// backwards one era file at a time until the whole history sits in OPFS.
// Later visits only re-check the version and top up what changed (usually
// just the small `recent` file). Progress is published to subscribers, so any
// page can show "downloading…" while charts already paint what has landed.
//
// Cost model, measured Nov 2026: the priority pair is ~140MB (~4s on a fast
// link); each older era is one file, newest first. Reads stay inside the
// bucket's free Class B allowance because every file downloads once per
// version and is read from disk afterwards.

import { useSyncExternalStore } from 'react';
import { fetchManifest, resolveFileUrl, type Manifest, type ManifestFile } from './remote';
import {
  deleteFile,
  getFile,
  hasFile,
  opfsSupported,
  putFile,
  readVersion,
  writeVersion,
} from './opfsCache';

export type SyncPhase =
  | 'idle'
  | 'checking'
  | 'priority'
  | 'prefetch'
  | 'ready'
  | 'degraded'
  | 'error';

export interface SyncStatus {
  phase: SyncPhase;
  /** Published dataset version (null until the first manifest lands). */
  version: string | null;
  /** Chunk keys fully on disk, newest first. */
  loadedFiles: string[];
  /** Era chunks in the current manifest (excludes the actions sidecar). */
  totalFiles: number;
  bytesLoaded: number;
  bytesTotal: number;
  /** Metered link: priority fetched, older eras wait for prefetchOlder(). */
  olderDeferred: boolean;
  error: string | null;
}

const INITIAL: SyncStatus = {
  phase: 'idle',
  version: null,
  loadedFiles: [],
  totalFiles: 0,
  bytesLoaded: 0,
  bytesTotal: 0,
  olderDeferred: false,
  error: null,
};

let status: SyncStatus = { ...INITIAL };
const listeners = new Set<() => void>();

function setStatus(patch: Partial<SyncStatus>): void {
  status = { ...status, ...patch };
  listeners.forEach((fn) => fn());
}

export function getSyncStatus(): SyncStatus {
  return status;
}

function subscribeSyncStatus(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** React binding for the background sequence. Re-renders on progress. */
export function useMarketSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribeSyncStatus, getSyncStatus, getSyncStatus);
}

/** "market_data_1998_2003.parquet" -> [1998, 2003]; else null. */
export function chunkRange(key: string): [number, number] | null {
  const match = /market_data_(\d{4})_(\d{4})\.parquet$/.exec(key);
  if (!match) return null;
  return [Number(match[1]), Number(match[2])];
}

/** Era bar chunks only: MARKET_DAILY bars, no actions sidecar, no catalog. */
function barKeys(files: ManifestFile[]): string[] {
  return files
    .map((f) => f.key)
    .filter(
      (key) =>
        key.startsWith('MARKET_DAILY/') &&
        key.endsWith('.parquet') &&
        !key.endsWith('market_actions.parquet'),
    );
}

/** The ticker directory sidecar: small, and watchlist search will want it. */
const CATALOG_KEY = 'SYMBOL_DATA/symbol_catalog.parquet';

/** Adds a key to loadedFiles unless it is already counted. */
function markLoaded(key: string): void {
  if (status.loadedFiles.includes(key)) return;
  setStatus({ loadedFiles: newestFirst([...status.loadedFiles, key]) });
}

/**
 * Which bar files overlap [start, end]. Mirrors the engine's bar_files_for:
 * chunks whose filename years overlap the range, plus the `recent` tail when
 * the range reaches the newest chunk. Undefined start/end means open.
 */
export function keysForRange(
  files: ManifestFile[],
  start?: string,
  end?: string,
): string[] {
  const keys = barKeys(files);
  if (start == null && end == null) return keys;

  const firstYear = start == null ? null : Number(start.slice(0, 4));
  const lastYear = end == null ? null : Number(end.slice(0, 4));

  const chunks: { low: number; high: number; key: string }[] = [];
  const others: string[] = [];
  for (const key of keys) {
    const range = chunkRange(key);
    if (!range) {
      others.push(key);
      continue;
    }
    chunks.push({ low: range[0], high: range[1], key });
  }
  if (chunks.length === 0) return keys;

  const selected = chunks
    .filter(
      ({ low, high }) =>
        (firstYear == null || high >= firstYear) &&
        (lastYear == null || low <= lastYear),
    )
    .map(({ key }) => key);

  const newest = Math.max(...chunks.map(({ high }) => high));
  if (lastYear == null || lastYear >= newest) selected.push(...others);
  return selected;
}

/** Newest chunk first — the paint-as-you-go order for queries and prefetch. */
export function newestFirst(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const ra = chunkRange(a);
    const rb = chunkRange(b);
    if (!ra && !rb) return a < b ? -1 : 1;
    if (!ra) return -1;
    if (!rb) return 1;
    return rb[1] - ra[1];
  });
}

function isMetered(): boolean {
  const conn = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; type?: string };
    }
  ).connection;
  if (!conn) return false;
  return conn.saveData === true || conn.type === 'cellular';
}

let manifestCache: Manifest | null = null;
let bootPromise: Promise<void> | null = null;
/** Keys already counted in bytesTotal (denominator counts each file once). */
const counted = new Set<string>();
/** Downloads currently in flight, so boot and on-demand queries share one. */
const inflight = new Map<string, Promise<void>>();

/** Adds a file's bytes to the progress denominator exactly once. */
function countBytes(entry: ManifestFile): void {
  if (counted.has(entry.key)) return;
  counted.add(entry.key);
  setStatus({ bytesTotal: status.bytesTotal + entry.bytes });
}

/** Manifest of the current boot (null until the first check completes). */
export function getManifest(): Manifest | null {
  return manifestCache;
}

/** The two files a chart needs first: the tail plus the current era chunk. */
function priorityKeys(files: ManifestFile[]): string[] {
  const keys = barKeys(files);
  const recent = keys.filter((key) => key.includes('recent'));
  const chunks = keys.filter((key) => chunkRange(key) !== null);
  const newest = newestFirst(chunks)[0];
  const priority = [...recent];
  if (newest && !priority.includes(newest)) priority.push(newest);
  return priority;
}

/**
 * Downloads one file into OPFS, streaming progress into the status.
 * Concurrent callers (background prefetch + an open chart) share the same
 * download instead of fetching the same bytes twice.
 */
async function downloadFile(file: ManifestFile): Promise<void> {
  const existing = inflight.get(file.key);
  if (existing) {
    await existing;
    return;
  }
  const run = storeFile(file).finally(() => {
    inflight.delete(file.key);
  });
  inflight.set(file.key, run);
  await run;
}

async function storeFile(file: ManifestFile): Promise<void> {
  const url = await resolveFileUrl(file.key);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status}): ${file.key}`);

  const reader = res.body.getReader();
  const parts: BlobPart[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    received += value.byteLength;
    setStatus({ bytesLoaded: status.bytesLoaded + value.byteLength });
  }
  await putFile(file.key, new Blob(parts));
  // Streams rarely report the manifest's exact byte count; reconcile so the
  // bar lands on 100% instead of hovering near it.
  setStatus({
    bytesLoaded: status.bytesLoaded + Math.max(0, file.bytes - received),
  });
  markLoaded(file.key);
}

/**
 * Fetches one file on demand (a chart asked for a range whose chunk never
 * downloaded). Resolves when the bytes are in OPFS.
 */
export async function ensureFile(key: string): Promise<void> {
  if (await hasFile(key)) return;
  const manifest = manifestCache;
  const entry = manifest?.files.find((f) => f.key === key);
  if (!entry) throw new Error(`Unknown market file: ${key}`);
  countBytes(entry);
  await downloadFile(entry);
}

/** Starts the background sequence. Safe to call often; runs once per load. */
export function bootMarketSync(): Promise<void> {
  if (!bootPromise) bootPromise = runBoot().catch(handleBootError);
  return bootPromise;
}

function handleBootError(err: unknown): void {
  setStatus({
    phase: 'error',
    error: err instanceof Error ? err.message : 'Market sync failed',
  });
}

async function runBoot(): Promise<void> {
  if (!opfsSupported()) {
    setStatus({ phase: 'degraded', error: 'This browser has no OPFS storage' });
    return;
  }

  // Storage pressure is the only thing that can silently take the cache:
  // ask to be excluded from automatic eviction before downloading hundreds
  // of megabytes the visitor would otherwise fetch again.
  try {
    await navigator.storage.persist();
  } catch {
    /* best-effort; the sequence works without it */
  }

  setStatus({ ...INITIAL, phase: 'checking' });

  const manifest = await fetchManifest();
  manifestCache = manifest;
  const bars = barKeys(manifest.files);
  setStatus({ version: manifest.version, totalFiles: bars.length });

  const stored = await readVersion();
  counted.clear();
  if (stored !== manifest.version) {
    // A new dataset version replaces history wholesale, so stale chunks go
    // before the fresh ones land. Best-effort: a half-cleaned cache still
    // self-heals, because queries fetch any chunk they cannot find.
    await Promise.all(bars.map((key) => deleteFile(key)));
    setStatus({ loadedFiles: [], bytesLoaded: 0 });
  } else {
    const present: string[] = [];
    for (const key of bars) {
      if (await hasFile(key)) present.push(key);
    }
    const presentBytes = manifest.files
      .filter((f) => present.includes(f.key))
      .reduce((sum, f) => sum + f.bytes, 0);
    for (const key of present) counted.add(key);
    setStatus({ loadedFiles: newestFirst(present), bytesLoaded: presentBytes });
  }

  // The pair every chart needs: the daily tail plus the current era.
  const priority = priorityKeys(manifest.files);
  const missing = [];
  for (const key of priority) {
    if (!(await hasFile(key))) missing.push(key);
  }
  if (stored !== manifest.version || missing.length > 0) {
    setStatus({ phase: 'priority' });
    for (const key of priority) {
      const entry = manifest.files.find((f) => f.key === key);
      if (!entry) continue;
      countBytes(entry);
      if (await hasFile(key)) {
        markLoaded(key);
        continue;
      }
      try {
        await downloadFile(entry);
      } catch (err) {
        setStatus({
          error: err instanceof Error ? err.message : `Could not fetch ${key}`,
        });
      }
    }
    await writeVersion(manifest.version);
    // The sidecars ride with the priority pair: the actions file (1.2MB —
    // every adjusted chart wants splits and dividends) and the ticker
    // directory (381KB — watchlist search will read it). Neither counts as
    // a history file; they just stop future pages fetching them piecemeal.
    for (const sidecar of manifest.files.filter(
      (f) => f.key.endsWith('market_actions.parquet') || f.key === CATALOG_KEY,
    )) {
      if (await hasFile(sidecar.key)) continue;
      try {
        countBytes(sidecar);
        await downloadFile(sidecar);
      } catch (err) {
        setStatus({
          error: err instanceof Error ? err.message : `Could not fetch ${sidecar.key}`,
        });
      }
    }
  } else {
    // Warm visit: the priority pair is already home, and the present scan
    // above already counted its bytes. Nothing left to add.
  }

  // Then the rest of history, newest era first, one file at a time.
  const remaining = newestFirst(bars).filter((key) => !priority.includes(key));
  if (remaining.length === 0) {
    setStatus({ phase: 'ready' });
    return;
  }
  if (isMetered()) {
    setStatus({ phase: 'ready', olderDeferred: true });
    return;
  }
  await prefetchKeys(manifest, remaining);
  setStatus({ phase: 'ready' });
}

/**
 * Downloads older eras sequentially. Called automatically on unmetered
 * links; call it explicitly (a "load full history" tap) on cellular.
 */
export async function prefetchOlder(): Promise<void> {
  const manifest = manifestCache;
  if (!manifest || status.phase === 'prefetch') return;
  const remaining = newestFirst(barKeys(manifest.files)).filter(
    (key) => !status.loadedFiles.includes(key),
  );
  if (remaining.length === 0) {
    setStatus({ phase: 'ready', olderDeferred: false });
    return;
  }
  setStatus({ phase: 'prefetch', olderDeferred: false });
  try {
    await prefetchKeys(manifest, remaining);
    setStatus({ phase: 'ready' });
  } catch (err) {
    setStatus({
      phase: 'ready',
      error: err instanceof Error ? err.message : 'Prefetch stopped early',
    });
  }
}

async function prefetchKeys(manifest: Manifest, keys: string[]): Promise<void> {
  for (const key of keys) {
    if (await hasFile(key)) {
      markLoaded(key);
      continue;
    }
    const entry = manifest.files.find((f) => f.key === key);
    if (!entry) continue;
    countBytes(entry);
    try {
      await downloadFile(entry);
    } catch (err) {
      // One failed era must not trap the rest behind it: keep walking
      // backwards, and the chart fetches the gap on demand if asked.
      setStatus({
        error: err instanceof Error ? err.message : `Could not fetch ${key}`,
      });
    }
    if (status.phase === 'priority') setStatus({ phase: 'prefetch' });
  }
}

/** For tests and sign-out cleanup: forget the boot so the next call reruns. */
export function resetMarketSyncForTests(): void {
  bootPromise = null;
  manifestCache = null;
  counted.clear();
  inflight.clear();
  setStatus({ ...INITIAL });
}

/** The cached parquet bytes for one chunk (fetches first on a miss). */
export async function getChunkFile(key: string): Promise<File> {
  await ensureFile(key);
  const file = await getFile(key);
  if (!file) throw new Error(`Chunk vanished after download: ${key}`);
  return file;
}
