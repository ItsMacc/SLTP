// sync.ts — the background download sequence plus where files come from.
//
// First visit: check the manifest and fetch the plan (desktop: all 29 year
// files; phone: the six newest), then on desktop keep going backwards one
// year at a time. Every later boot reconciles the plan against the manifest
// by byte count and fetches only what's missing or changed — usually just
// the `recent` tail after a daily update, never a wholesale re-download.
// Progress is published to subscribers, so any page can show
// "downloading…" while charts already paint what has landed.
//
// The plan is why "N of M files" always reads true: totalFiles counts the
// plan's bars, and loadedFiles can only ever hold plan keys (plus nothing
// else — sidecars ride along but are never counted). A phone shows 6 of 6,
// a desktop 30 of 30 (29 years plus the tail), and neither can drift apart
// again.
//
// Cost model, measured Nov 2026: the desktop priority pair (tail + current
// year) is ~28MB (~a couple of seconds on a fast link) and the full set
// ~389MB; the phone plan (tail + 2022-2026) is ~118MB. Reads stay inside the
// bucket's free Class B allowance because every file downloads once per
// version and is read from disk afterwards.
//
// The bucket is private: every byte comes through the gate Worker in
// gateway/, which counts one R2 read per file and closes the month at
// 9.95M. A device with no cache marks its requests `?new=1` so it may spend
// the reserve above 9M; everything else stops at 9M. Nothing else in this
// file knows about that.

import { useSyncExternalStore } from 'react';
import { MOBILE_PLAN_CHUNKS, isMobileDevice } from './device';
import { writeWithSyncAccess } from './opfsWrite';
import {
  deleteFile,
  fileSize,
  getFile,
  hasFile,
  listFiles,
  opfsSupported,
  putFileStream,
  readVersion,
  requestPersistentStorage,
  writeVersion,
} from './opfs';

export type SyncPhase =
  | 'idle'
  | 'checking'
  | 'priority'
  | 'prefetch'
  | 'ready'
  | 'degraded'
  | 'error';

/** What this browser intends to hold: everything, or the recent pair. */
export type SyncPlan = 'full' | 'recent';

export interface SyncStatus {
  phase: SyncPhase;
  /** Published dataset version (null until the first manifest lands). */
  version: string | null;
  /** Which plan is running: full history, or the phone-sized recent pair. */
  plan: SyncPlan;
  /** Chunk keys on disk, newest first — always a subset of the plan. */
  loadedFiles: string[];
  /** Planned bar files in the current manifest (what "of M" counts). */
  totalFiles: number;
  bytesLoaded: number;
  bytesTotal: number;
  /** Metered link: priority fetched, older years wait for prefetchOlder(). */
  olderDeferred: boolean;
  error: string | null;
}

const INITIAL: SyncStatus = {
  phase: 'idle',
  version: null,
  plan: 'full',
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

/** The gate in front of the private sltp-market-data bucket. */
export const GATEWAY_BASE_URL =
  'https://sltp-data.magicaltitan7.workers.dev';

/** Small file naming which chunks exist and what data version they belong to. */
export const MANIFEST_KEY = 'META/manifest.json';

/** True until this device holds a downloaded dataset. A first sync is the one
    kind of request the gate still serves once the month passes 9M reads. */
let firstSync = true;

export interface ManifestFile {
  key: string;
  bytes: number;
  rows: number;
  row_groups: number;
  first_session: string | null;
  last_session: string | null;
}

export interface Manifest {
  version: string;
  files: ManifestFile[];
}

/** The published dataset version, e.g. "2026-11-11". A few bytes. */
export async function fetchManifest(): Promise<Manifest> {
  const res = await fetch(`${GATEWAY_BASE_URL}/manifest.json${firstSync ? '?new=1' : ''}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Manifest fetch failed (${res.status})`);
  const manifest = (await res.json()) as Manifest;
  if (!manifest?.version || !Array.isArray(manifest.files)) {
    throw new Error('Manifest had an unexpected shape');
  }
  return manifest;
}

/**
 * The URL the browser downloads one file from: the gate's versioned path, so
 * a data version is immutable in the edge cache. `?new=1` only rides on a
 * device's first download; it never changes the cached URL, because the gate
 * keys its cache on the path alone.
 */
export async function resolveFileUrl(key: string): Promise<string> {
  const version = manifestCache?.version;
  const base = version ? `${GATEWAY_BASE_URL}/v/${version}` : GATEWAY_BASE_URL;
  return `${base}/${key}${firstSync ? '?new=1' : ''}`;
}

/**
 * "market_data_2019.parquet" -> [2019, 2019]; the retired six-year shape
 * "market_data_1998_2003.parquet" -> [1998, 2003]; anything else null
 * (the `recent` tail, the actions sidecar). Both shapes flow through the
 * same logic, so a manifest of either vintage plans and queries correctly.
 */
export function chunkRange(key: string): [number, number] | null {
  const single = /market_data_(\d{4})\.parquet$/.exec(key);
  if (single) return [Number(single[1]), Number(single[1])];
  const range = /market_data_(\d{4})_(\d{4})\.parquet$/.exec(key);
  if (!range) return null;
  return [Number(range[1]), Number(range[2])];
}

/** Bar files only: MARKET_DAILY bars (year files plus the tail), no actions
    sidecar, no catalog. */
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

/**
 * The chunk keys this browser plans to hold, newest first. Phones keep the
 * six newest (tail + five years, ~2022 on); desktops everything.
 * Sidecars are outside the plan — they always download with the priority pair.
 */
export function planKeys(files: ManifestFile[]): string[] {
  const ordered = newestFirst(barKeys(files));
  return isMobileDevice() ? ordered.slice(0, MOBILE_PLAN_CHUNKS) : ordered;
}

/** The active plan's keys (null until the first manifest lands). Queries
    intersect their chunk choice with this, so a phone never fetches outside
    its two files and a desktop never fetches the actions sidecar as bars. */
let activePlan: string[] | null = null;

export function getActivePlan(): string[] | null {
  return activePlan;
}

/** Adds a key to loadedFiles unless it is already counted. Plan keys only:
    callers pass bars; sidecars are downloaded with track=false. */
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

/** The files a chart needs first: the tail plus the current year file.
    Always inside the plan — on a phone that pair IS the whole plan. */
function priorityKeys(plan: string[]): string[] {
  const recent = plan.filter((key) => key.includes('recent'));
  const chunks = plan.filter((key) => chunkRange(key) !== null);
  const newest = newestFirst(chunks)[0];
  const priority = [...recent];
  if (newest && !priority.includes(newest)) priority.push(newest);
  return priority.length > 0 ? priority : plan.slice(0, 1);
}

/** Two downloads at a time. The plan used to fetch one file after another,
    which left the link idle while each 28MB chunk was written to OPFS; a
    second lane closes that gap without holding two whole files in memory
    (each is streamed straight to disk). Phones benefit most: the five-year
    plan arrives in two parallel streams, and the priority pair no longer
    waits for the tail to finish before starting the year file. */
const DOWNLOAD_LANES = 2;
let activeDownloads = 0;
const downloadWaiters: (() => void)[] = [];

async function withDownloadLane<T>(job: () => Promise<T>): Promise<T> {
  if (activeDownloads >= DOWNLOAD_LANES) {
    await new Promise<void>((resolve) => downloadWaiters.push(resolve));
  }
  activeDownloads += 1;
  try {
    return await job();
  } finally {
    activeDownloads -= 1;
    downloadWaiters.shift()?.();
  }
}

/**
 * Downloads one file into OPFS, streaming progress into the status.
 * Concurrent callers (background prefetch + an open chart) share the same
 * download instead of fetching the same bytes twice, and at most two
 * different files are in flight at once.
 */
async function downloadFile(file: ManifestFile, track = true): Promise<void> {
  const existing = inflight.get(file.key);
  if (existing) {
    await existing;
    return;
  }
  const run = withDownloadLane(() => storeFile(file, track)).finally(() => {
    inflight.delete(file.key);
  });
  inflight.set(file.key, run);
  await run;
}

/**
 * Downloads one file into OPFS. History chunks join loadedFiles (the
 * "N of M files" count); sidecars pass track=false so the count stays
 * about history.
 */
async function storeFile(file: ManifestFile, track = true): Promise<void> {
  const url = await resolveFileUrl(file.key);
  let received = 0;
  const count = (bytes: number): void => {
    received += bytes;
    setStatus({ bytesLoaded: status.bytesLoaded + bytes });
  };

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok || !res.body) throw new Error(`Download failed (${res.status}): ${file.key}`);
    // Written straight from the response into OPFS: buffering a 28MB chunk as
    // a Blob is what iOS Safari reports as an out-of-memory `UnknownError`.
    await putFileStream(file.key, res.body, count);
  } catch (error) {
    // A DOMException means the file system refused the write, not the network:
    // Safari's createWritable() gives up on large files with a generic
    // `UnknownError`. Retry once through a worker's synchronous handle, the
    // OPFS path WebKit is reliable about. A 401 or an aborted fetch is real.
    if (!(error instanceof DOMException)) throw error;
    setStatus({ bytesLoaded: Math.max(0, status.bytesLoaded - received) });
    received = 0;
    await writeWithSyncAccess(file.key, url, count);
  }
  // Streams rarely report the manifest's exact byte count; reconcile so the
  // bar lands on 100% instead of hovering near it.
  setStatus({
    bytesLoaded: status.bytesLoaded + Math.max(0, file.bytes - received),
  });
  if (track) markLoaded(file.key);
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
  await requestPersistentStorage();

  const mobile = isMobileDevice();
  const plan: SyncPlan = mobile ? 'recent' : 'full';
  setStatus({ ...INITIAL, phase: 'checking', plan });

  // No version on disk means no bytes on disk: this device needs the reserve
  // the gate keeps above its 9M line, so even the manifest is flagged.
  const stored = await readVersion();
  firstSync = stored === null;

  const manifest = await fetchManifest();
  manifestCache = manifest;
  const planList = planKeys(manifest.files);
  activePlan = planList;
  setStatus({ version: manifest.version, totalFiles: planList.length });

  counted.clear();
  if (stored !== manifest.version) {
    // A rollover can strand files the new plan no longer holds: a phone
    // dropping its oldest era in 2028, a renamed chunk. Sweep on-disk bars
    // outside the plan so disk strictly equals plan + sidecars + wheels.
    // Sidecars and the catalog get their own byte checks in the priority
    // pass below; BARS/ and WHEELS/ are version-stamped and self-cleaning.
    // Zero download cost, so this runs on metered links too.
    const planSet = new Set(planList);
    const onDisk = await listFiles('MARKET_DAILY');
    await Promise.all(
      onDisk
        .map((name) => `MARKET_DAILY/${name}`)
        .filter(
          (key) =>
            key.endsWith('.parquet') &&
            !key.endsWith('market_actions.parquet') &&
            !planSet.has(key),
        )
        .map((key) => deleteFile(key)),
    );
  }
  // One reconciliation path for every boot, version bump or not. Year files
  // are effectively immutable — a daily update rewrites only the tail (and
  // sometimes the actions sidecar) — so a new version usually refreshes one
  // small file instead of the whole plan. A backfill that rewrote every year
  // still heals, because every changed byte count re-downloads. Presence is
  // not freshness (files are rewritten in place), so the manifest's byte
  // count decides. Only plan files count as loaded: a desktop-sized cache
  // opened in a phone emulator keeps its extra files on disk but out of
  // the count.
  const expectedBytes = new Map(manifest.files.map((f) => [f.key, f.bytes]));
  const present: string[] = [];
  for (const key of planList) {
    const actual = await fileSize(key);
    if (actual === null) continue;
    const expected = expectedBytes.get(key);
    if (expected !== undefined && actual !== expected) {
      await deleteFile(key);
      continue;
    }
    present.push(key);
  }
  const presentBytes = manifest.files
    .filter((f) => present.includes(f.key))
    .reduce((sum, f) => sum + f.bytes, 0);
  for (const key of present) counted.add(key);
  setStatus({ loadedFiles: newestFirst(present), bytesLoaded: presentBytes });

  // The pair every chart needs: the daily tail plus the current era.
  const priority = priorityKeys(planList);
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
    // The sidecars ride with the priority pair on every device: the actions
    // file (~1MB — every adjusted chart wants splits and dividends) and the
    // ticker directory (~380KB — search will read it). Neither counts as a
    // history file; they just stop future pages fetching them piecemeal.
    for (const sidecar of manifest.files.filter(
      (f) => f.key.endsWith('market_actions.parquet') || f.key === CATALOG_KEY,
    )) {
      const actual = await fileSize(sidecar.key);
      if (actual === null) {
        /* missing — downloaded below */
      } else if (actual === sidecar.bytes) {
        continue;
      } else {
        await deleteFile(sidecar.key);
      }
      try {
        countBytes(sidecar);
        await downloadFile(sidecar, false);
      } catch (err) {
        setStatus({
          error: err instanceof Error ? err.message : `Could not fetch ${sidecar.key}`,
        });
      }
    }
  } else {
    // Warm visit: the plan is already home, and the present scan above
    // already counted its bytes. Nothing left to add.
  }

  // Then the rest of history, newest era first, one file at a time. A phone
  // never gets here — its plan has nothing left after the priority pair.
  const remaining = planList.filter((key) => !priority.includes(key));
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
 * links; call it explicitly (a "load full history" tap) on cellular. On a
 * phone this is a no-op: the plan is already complete by construction.
 */
export async function prefetchOlder(): Promise<void> {
  const manifest = manifestCache;
  if (!manifest || status.phase === 'prefetch') return;
  const remaining = planKeys(manifest.files).filter(
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
  // The lane limiter in downloadFile keeps this two-wide; queueing every key
  // here is what lets the second lane start while the first is still writing.
  await Promise.all(
    keys.map(async (key) => {
      if (await hasFile(key)) {
        markLoaded(key);
        return;
      }
      const entry = manifest.files.find((f) => f.key === key);
      if (!entry) return;
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
    }),
  );
}

/** For tests and sign-out cleanup: forget the boot so the next call reruns. */
export function resetMarketSyncForTests(): void {
  bootPromise = null;
  manifestCache = null;
  firstSync = true;
  activePlan = null;
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
