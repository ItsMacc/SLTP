// pyodide.ts — the in-browser Python engine, loaded only when needed.
//
// Nothing here runs at page load. The first call to warmEngine (today: the
// Research page mount on desktop) downloads the runtime from the CDN, then
// installs the engine's two real dependencies — numpy from the Pyodide
// package repo, and the sltp + dateutil wheels from an OPFS cache that
// survives reloads, so the second visit skips the PyPI round-trip
// entirely. Phones never warm: strategy runs stay a desktop feature, and a
// warm would spend a phone plan on megabytes nothing can use yet.
//
// The wheels land in OPFS as plain bytes, are written into the Emscripten
// filesystem, and install through micropip's `emfs:` scheme (note: single
// colon — `emfs://` does not resolve). Status is published like the market
// sync, so the future strategy view can show its first-run loading screen
// off useEngineStatus and a silent warm everywhere else.

import { useSyncExternalStore } from 'react';
import { isMobileDevice } from './device';
import { getFile, hasFile, putFile } from './opfs';

/** Pinned runtime: the full build serves loadPyodide plus every wheel. */
const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/';
/** Engine pin: matches backend/requirements.txt. */
const SLTP_VERSION = '0.1.27';
/** Pure-Python date library the strategy base imports. */
const DATEUTIL_VERSION = '2.9.0';

/** OPFS directory holding one pinned wheel file per engine dependency. */
const WHEELS_DIR = 'WHEELS';

export type EnginePhase =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'unsupported'
  | 'error';

export interface EngineStatus {
  phase: EnginePhase;
  /** Human line for the loading screen ("Installing sltp…") or the error. */
  detail: string | null;
  /** True when every wheel came from OPFS — the visit downloaded nothing. */
  cachedWheels: boolean;
}

const INITIAL: EngineStatus = { phase: 'idle', detail: null, cachedWheels: false };

let status: EngineStatus = { ...INITIAL };
const listeners = new Set<() => void>();

function setStatus(patch: Partial<EngineStatus>): void {
  status = { ...status, ...patch };
  listeners.forEach((fn) => fn());
}

export function getEngineStatus(): EngineStatus {
  return status;
}

function subscribeEngineStatus(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** React binding for the engine warm. Re-renders on phase changes. */
export function useEngineStatus(): EngineStatus {
  return useSyncExternalStore(subscribeEngineStatus, getEngineStatus, getEngineStatus);
}

/** The slice of the Pyodide JS API this module touches. */
interface PyodideApi {
  loadPackage: (names: string | string[]) => Promise<void>;
  runPythonAsync: (code: string) => Promise<unknown>;
  FS: { writeFile: (path: string, data: Uint8Array) => void };
}

async function loadPyodideApi(): Promise<PyodideApi> {
  // @vite-ignore keeps this a runtime CDN fetch instead of a build asset.
  const mod = (await import(/* @vite-ignore */ `${PYODIDE_CDN}pyodide.mjs`)) as {
    loadPyodide: (opts: { indexURL: string }) => Promise<PyodideApi>;
  };
  return mod.loadPyodide({ indexURL: PYODIDE_CDN });
}

/** Exact wheel URL for a pinned pure-Python release, via the PyPI API. */
async function pypiWheelUrl(name: string, version: string): Promise<{ filename: string; url: string }> {
  const res = await fetch(`https://pypi.org/pypi/${name}/${version}/json`, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`PyPI lookup failed for ${name}==${version} (${res.status})`);
  const meta = (await res.json()) as {
    urls?: { filename: string; url: string; packagetype?: string }[];
  };
  const wheel = (meta.urls ?? []).find(
    (u) => u.filename.endsWith('.whl') && !u.filename.includes('cp') && !u.filename.includes('pp'),
  ) ?? (meta.urls ?? []).find((u) => u.filename.endsWith('.whl'));
  if (!wheel) throw new Error(`No wheel found for ${name}==${version}`);
  return { filename: wheel.filename, url: wheel.url };
}

/**
 * One pinned wheel, from OPFS when present, else PyPI (and then stored).
 * Returns whether this visit downloaded nothing.
 */
async function ensureWheel(name: string, version: string): Promise<{ filename: string; cached: boolean }> {
  const { filename, url } = await pypiWheelUrl(name, version);
  const key = `${WHEELS_DIR}/${filename}`;
  if (await hasFile(key)) return { filename, cached: true };
  const res = await fetch(url, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`Wheel download failed for ${filename} (${res.status})`);
  await putFile(key, new Blob([await res.arrayBuffer()]));
  return { filename, cached: false };
}

let warmPromise: Promise<EngineStatus> | null = null;

/**
 * Loads the engine in the background. Desktop only — on a phone this
 * resolves `unsupported` immediately, before a single byte is fetched.
 * Safe to call from every page mount; runs once per page load.
 */
export function warmEngine(): Promise<EngineStatus> {
  if (!warmPromise) warmPromise = runWarm().catch(handleWarmError);
  return warmPromise;
}

function handleWarmError(err: unknown): EngineStatus {
  const detail = err instanceof Error ? err.message : 'Engine warm failed';
  setStatus({ phase: 'error', detail });
  return { ...status };
}

async function runWarm(): Promise<EngineStatus> {
  if (isMobileDevice()) {
    setStatus({ phase: 'unsupported', detail: 'Strategy runs need a desktop browser' });
    return { ...status };
  }
  setStatus({ phase: 'loading', detail: 'Loading Python runtime…', cachedWheels: false });

  const pyodide = await loadPyodideApi();

  setStatus({ detail: 'Loading numpy…' });
  await pyodide.loadPackage(['numpy', 'micropip']);

  // The pinned wheels ride OPFS: first visit downloads them from PyPI once,
  // later visits install straight from disk with no network at all.
  setStatus({ detail: 'Installing engine wheels…' });
  const wheels = await Promise.all([
    ensureWheel('sltp', SLTP_VERSION),
    ensureWheel('python-dateutil', DATEUTIL_VERSION),
  ]);
  const allCached = wheels.every((w) => w.cached);
  for (const { filename } of wheels) {
    const file = await getFile(`${WHEELS_DIR}/${filename}`);
    if (!file) throw new Error(`Wheel vanished after download: ${filename}`);
    pyodide.FS.writeFile(`/tmp/${filename}`, new Uint8Array(await file.arrayBuffer()));
    await pyodide.runPythonAsync(
      `import micropip\nawait micropip.install("emfs:/tmp/${filename}")`,
    );
  }

  setStatus({ detail: 'Verifying engine…' });
  const version = (await pyodide.runPythonAsync(
    'import sltp\nfrom sltp import Strategy\nsltp.__version__',
  )) as string;

  setStatus({ phase: 'ready', detail: `sltp ${version}`, cachedWheels: allCached });
  return { ...status };
}

/** For tests and sign-out cleanup: forget the warm so the next call reruns. */
export function resetEngineForTests(): void {
  warmPromise = null;
  setStatus({ ...INITIAL });
}
