// query.ts — one ticker's bars out of the OPFS cache.
//
// Chunk choice mirrors the engine's bar_files_for (filename year overlap, so
// a 5-year chart never touches the 1998 file), then intersects the active
// sync plan — a phone only ever holds its two newest chunks, so a wide
// range resolves from what is on disk instead of fetching 28 years.
// Every missing chunk is fetched on demand: a chart with a cold cache still
// resolves, it just takes the download first. All of the range's chunks
// decode at once through the two-worker pool; each file prunes to its
// matching row groups first, so memory stays bounded no matter how deep
// the requested range goes.
//
// This is the one read path every page uses — Research charts, the future
// Lab runs and the watchlist all ask here, never the files directly.

import type { Bar } from '../components/Chart';
import {
  bootMarketSync,
  ensureFile,
  getActivePlan,
  getChunkFile,
  getManifest,
  keysForRange,
  newestFirst,
} from './sync';
import { getFile } from './opfs';
import { readTickerSidecar, writeTickerSidecar } from './sidecar';
import { callWorker } from './pool';

export interface QueryPerf {
  fileBytes: number;
  footerMs: number;
  parseMs: number;
  rowsScanned: number;
}

interface WorkerSuccess {
  rows?: Bar[];
  perf?: QueryPerf;
  quotes?: Record<
    string,
    { price: number; changePct: number; lastDate: string; prevDate: string | null; prevClose: number | null }
  >;
  entries?: { ticker: string; name: string }[];
  error?: string;
}

async function runWorker(query: object): Promise<WorkerSuccess> {
  const data = await callWorker<WorkerSuccess>(query);
  if (data.error) throw new Error(data.error);
  return data;
}

/* ---------- In-memory caches ----------
 * OPFS is the durable layer; these Maps are the speed layer. Parsed rows
 * live for the page session so a ticker revisit or a timeframe switch
 * slices memory instead of re-parsing (and re-reading) a 140MB file.
 */

/** Full per-file series per symbol (`${chunk}|${symbol}`), sorted by date. */
const barsCache = new Map<string, Bar[]>();
const MAX_CACHED_SERIES = 50;

function rememberSeries(key: string, rows: Bar[]): void {
  barsCache.delete(key);
  barsCache.set(key, rows);
  while (barsCache.size > MAX_CACHED_SERIES) {
    const oldest = barsCache.keys().next();
    if (oldest.done) break;
    barsCache.delete(oldest.value);
  }
}

/** Batched quote reads keyed by sorted symbols; the strip repeats batches. */
const quotesCache = new Map<string, Record<string, Quote>>();
const MAX_CACHED_QUOTE_BATCHES = 10;

let catalogCache: TickerInfo[] | null = null;

/**
 * Bars for one chunk file. Exported so the hook can paint file-by-file:
 * the chart extends leftwards as older eras land instead of waiting for all
 * of them. The full symbol series is cached per file; the range slices
 * memory, so timeframe switches never touch OPFS again.
 */
/** Parses in flight: concurrent queries for the same chunk share one parse. */
const parseInflight = new Map<string, Promise<Bar[]>>();

function perfLog(key: string, symbol: string, perf: QueryPerf | undefined): void {
  try {
    if (localStorage.getItem('sltp_perf') !== '1' || !perf) return;
  } catch {
    return;
  }
  // eslint-disable-next-line no-console
  console.debug(
    `[market] ${symbol} ${key}: ${(perf.fileBytes / 1048576).toFixed(0)}MB file, ` +
      `footer ${perf.footerMs}ms, parse ${perf.parseMs}ms, scanned ${perf.rowsScanned.toLocaleString()} rows`,
  );
}

function sidecarLog(key: string, symbol: string, hit: boolean, ms: number, rows: number): void {
  try {
    if (localStorage.getItem('sltp_perf') !== '1') return;
  } catch {
    return;
  }
  // eslint-disable-next-line no-console
  console.debug(
    `[market] ${symbol} ${key}: sidecar ${hit ? 'HIT' : 'MISS'} ${Math.round(ms)}ms` +
      (hit ? `, ${rows.toLocaleString()} rows` : ''),
  );
}

export async function queryFile(
  key: string,
  symbol: string,
  start?: string,
  end?: string,
): Promise<Bar[]> {
  const cacheKey = `${key}|${symbol}`;
  let all = barsCache.get(cacheKey);
  if (!all) {
    let inflight = parseInflight.get(cacheKey);
    if (!inflight) {
      inflight = (async () => {
        // The binary sidecar answers in milliseconds when this chunk+symbol
        // has been parsed before; otherwise the parquet file is the source
        // of truth and its rows are stored for next time.
        const version = getManifest()?.version ?? null;
        if (version) {
          const t0 = performance.now();
          const cached = await readTickerSidecar(version, key, symbol);
          if (cached) {
            rememberSeries(cacheKey, cached);
            sidecarLog(key, symbol, true, performance.now() - t0, cached.length);
            return cached;
          }
          sidecarLog(key, symbol, false, performance.now() - t0, 0);
        }
        const file = await getChunkFile(key);
        const data = await runWorker({ kind: 'bars', file, symbol });
        const rows = data.rows ?? [];
        rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
        rememberSeries(cacheKey, rows);
        perfLog(key, symbol, data.perf);
        if (version) await writeTickerSidecar(version, key, symbol, rows);
        return rows;
      })().finally(() => {
        parseInflight.delete(cacheKey);
      });
      parseInflight.set(cacheKey, inflight);
    }
    all = await inflight;
  }
  if (start == null && end == null) return all;
  return all.filter(
    (bar) => (start == null || bar.date >= start) && (end == null || bar.date <= end),
  );
}

export interface FileQuote {
  price: number;
  changePct: number;
  lastDate: string;
  prevDate: string | null;
  prevClose: number | null;
}

/* Per-symbol quote facts per file (`version|file|symbol`). A file never
 * changes under a dataset version, so a quote read once is true all
 * session — including the negative (this file holds no session for that
 * symbol), which is what stops dead names like L.TO from re-parsing every
 * era file on every search. Absence is stored as a null entry.
 */
const fileQuoteCache = new Map<string, FileQuote | null>();
const MAX_FILE_QUOTES = 4000;
let fileQuoteVersion: string | null = null;

function rememberFileQuote(cacheKey: string, quote: FileQuote | null): void {
  fileQuoteCache.delete(cacheKey);
  fileQuoteCache.set(cacheKey, quote);
  while (fileQuoteCache.size > MAX_FILE_QUOTES) {
    const oldest = fileQuoteCache.keys().next();
    if (oldest.done) break;
    fileQuoteCache.delete(oldest.value);
  }
}

/** Identical concurrent file reads share one worker parse. */
const quotesInflight = new Map<string, Promise<Record<string, FileQuote>>>();

/** One file's latest quotes for many tickers in a single parse. Symbols
already answered from this file (present or provably absent) never reach
the worker again, so typing a search re-reads nothing it has seen. */
async function queryFileQuotes(
  key: string,
  symbols: string[],
): Promise<Record<string, FileQuote>> {
  const version = getManifest()?.version ?? '';
  if (fileQuoteVersion !== version) {
    fileQuoteVersion = version;
    fileQuoteCache.clear();
    quotesInflight.clear();
  }
  const missing = symbols.filter(
    (symbol) => !fileQuoteCache.has(`${version}|${key}|${symbol}`),
  );
  const out: Record<string, FileQuote> = {};
  for (const symbol of symbols) {
    const hit = fileQuoteCache.get(`${version}|${key}|${symbol}`);
    if (hit) out[symbol] = hit;
  }
  if (missing.length === 0) return out;
  const inflightKey = `${version}|${key}|${[...missing].sort().join(',')}`;
  let inflight = quotesInflight.get(inflightKey);
  if (!inflight) {
    inflight = (async () => {
      const file = await getChunkFile(key);
      const data = await runWorker({ kind: 'quotes', file, symbols: missing });
      perfLog(key, `quotes(${missing.length})`, data.perf);
      const fresh = data.quotes ?? {};
      for (const symbol of missing) {
        rememberFileQuote(`${version}|${key}|${symbol}`, fresh[symbol] ?? null);
      }
      return fresh;
    })().finally(() => {
      quotesInflight.delete(inflightKey);
    });
    quotesInflight.set(inflightKey, inflight);
  }
  return { ...out, ...((await inflight) as Record<string, FileQuote>) };
}

export interface TickerInfo {
  ticker: string;
  name: string;
}

const CATALOG_KEY = 'SYMBOL_DATA/symbol_catalog.parquet';

/**
 * The tradable ticker directory out of the OPFS catalog sidecar (fetched on
 * first use like any other chunk). Sorted by symbol for a stable list.
 */
export async function getTickerDirectory(): Promise<TickerInfo[]> {
  if (catalogCache) return catalogCache;
  await bootMarketSync();
  await ensureFile(CATALOG_KEY);
  const file = await getFile(CATALOG_KEY);
  if (!file) throw new Error('Ticker catalog vanished after download');
  const data = await runWorker({ kind: 'catalog', file });
  catalogCache = data.entries ?? [];
  return catalogCache;
}

export interface Quote {
  price: number;
  changePct: number;
}

/**
 * Last close and previous-session move for many tickers. Reads the newest
 * planned chunks until every symbol has two dated sessions (a halted name
 * falls back to older eras on desktop, and era-boundary overlaps merge by
 * date, not file order); symbols with no bars at all are left out.
 */
/* List quotes only ever walk the two newest planned files (the `recent` tail
 * plus the current era). A quote is a *current* price and yesterday's move:
 * if a symbol's latest session is older than that, its quote would be years
 * stale, so a blank row is more honest than a 5-second full-depth scan
 * that holds the whole batch hostage. Measured: a symbol missing from the
 * newest files forces ~1s of decode per older era (~5s for a full walk),
 * while live names settle from the recent file in ~60ms. The chart path
 * below is untouched — picking a ticker still reads its full history. */
const MAX_QUOTE_FILES = 2;

/** Identical concurrent batch reads share one walk. */
const batchInflight = new Map<string, Promise<Record<string, Quote>>>();

export async function queryQuotes(symbols: string[]): Promise<Record<string, Quote>> {
  const cacheKey = [...symbols].sort().join(',');
  const cached = quotesCache.get(cacheKey);
  if (cached) return cached;
  const inflight = batchInflight.get(cacheKey);
  if (inflight) return inflight;
  const promise = (async () => {
    await bootMarketSync();
    const manifest = getManifest();
    if (!manifest) return {};
    const barKeys = chunkKeysForRange().slice(0, MAX_QUOTE_FILES);
    const pending = new Set(symbols);
    const sessions = new Map<string, { date: string; close: number }[]>();
    const out: Record<string, Quote> = {};
    const settle = (symbol: string) => {
      if (out[symbol]) return;
      const bars = (sessions.get(symbol) ?? [])
        .filter((b, i, arr) => arr.findIndex((x) => x.date === b.date) === i)
        .sort((a, b) => (a.date < b.date ? 1 : -1));
      if (bars.length >= 2) {
        const last = bars[0]!;
        const prev = bars[1]!;
        out[symbol] = {
          price: last.close,
          changePct: prev.close !== 0 ? ((last.close - prev.close) / prev.close) * 100 : 0,
        };
        pending.delete(symbol);
      }
    };
    // Files walk newest-first and one at a time: the recent tail usually
    // answers every live symbol, so the big era file either never parses
    // (pending empties) or parses for the one or two stragglers. Fetching
    // both files up front would hand the era file all thirty symbols and
    // turn a ~1s walk into ~13s (measured Nov 2026) — the shrink is the
    // whole point. Bars parallelize instead; see queryMarketData.
    for (const key of barKeys) {
      if (pending.size === 0) break;
      const quotes = await queryFileQuotes(key, [...pending]);
      for (const symbol of Object.keys(quotes)) {
        const quote = quotes[symbol]!;
        const list = sessions.get(symbol) ?? [];
        list.push({ date: quote.lastDate, close: quote.price });
        if (quote.prevDate != null && quote.prevClose != null) {
          list.push({ date: quote.prevDate, close: quote.prevClose });
        }
        sessions.set(symbol, list);
        settle(symbol);
      }
    }
    // Single-session names (one bar ever) still get a quote with no move.
    for (const symbol of [...pending]) {
      const bars = sessions.get(symbol) ?? [];
      if (bars.length > 0 && !out[symbol]) {
        const newest = [...bars].sort((a, b) => (a.date < b.date ? 1 : -1))[0]!;
        out[symbol] = { price: newest.close, changePct: 0 };
      }
    }
    quotesCache.delete(cacheKey);
    quotesCache.set(cacheKey, out);
    while (quotesCache.size > MAX_CACHED_QUOTE_BATCHES) {
      const oldest = quotesCache.keys().next();
      if (oldest.done) break;
      quotesCache.delete(oldest.value);
    }
    return out;
  })().finally(() => {
    batchInflight.delete(cacheKey);
  });
  batchInflight.set(cacheKey, promise);
  return promise;
}

/**
 * Chunk keys for a range, newest first (the paint order), intersected with
 * the active sync plan. Before the first manifest lands there is no plan,
 * so this is empty and the caller waits for boot.
 */
export function chunkKeysForRange(start?: string, end?: string): string[] {
  const manifest = getManifest();
  if (!manifest) return [];
  const keys = newestFirst(keysForRange(manifest.files, start, end));
  const plan = getActivePlan();
  if (!plan) return keys;
  return keys.filter((key) => plan.includes(key));
}

/** Every bar for one ticker over [start, end]. Open ends fetch everything
    the plan holds — on a phone that is the recent pair, never 28 years. */
export async function queryMarketData(
  ticker: string,
  start?: string,
  end?: string,
): Promise<Bar[]> {
  const symbol = ticker.trim().toUpperCase();
  const seen = new Set<string>();
  const out: Bar[] = [];
  // Every chunk decodes in the pool at once (bounded by its two workers);
  // Promise.all preserves key order, so the newest file still wins overlap
  // dates exactly as in the old sequential walk.
  const perFile = await Promise.all(
    chunkKeysForRange(start, end).map((key) => queryFile(key, symbol, start, end)),
  );
  for (const rows of perFile) {
    // Era files and the `recent` tail overlap by a few sessions.
    for (const row of rows) {
      if (!seen.has(row.date)) {
        seen.add(row.date);
        out.push(row);
      }
    }
  }
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out;
}
