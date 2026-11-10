// parquet.worker.ts — reads cached era files off the main thread.
//
// Parsing a ~140MB columnar file takes around a second; doing it here keeps
// scrolling and chart animation at 60fps while rows stream in. The main
// thread posts the OPFS File (structured-cloneable) plus the query; the
// worker projects only the columns it needs, lets hyparquet skip row groups
// that cannot hold the symbols, and returns plain row objects.

import { parquetMetadataAsync, parquetQuery } from 'hyparquet';

const DAY_MS = 86_400_000;

export interface BarsQuery {
  kind: 'bars';
  file: Blob;
  symbol: string;
  /** Every request carries an id so the shared worker can match replies. */
  id: number;
}

export interface QuotesQuery {
  kind: 'quotes';
  file: Blob;
  symbols: string[];
  /** Every request carries an id so the shared worker can match replies. */
  id: number;
}

export interface CatalogQuery {
  kind: 'catalog';
  file: Blob;
  /** Every request carries an id so the shared worker can match replies. */
  id: number;
}

export type WorkerQuery = BarsQuery | QuotesQuery | CatalogQuery;

export interface WorkerRow {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface WorkerQuote {
  price: number;
  changePct: number;
  lastDate: string;
  prevDate: string | null;
  prevClose: number | null;
}

export interface CatalogEntry {
  ticker: string;
  name: string;
}

/** Adapts a Blob to the AsyncBuffer hyparquet reads through. */
function blobBuffer(blob: Blob): { byteLength: number; slice: (s: number, e?: number) => Promise<ArrayBuffer> } {
  return {
    byteLength: blob.size,
    slice: (start: number, end?: number) => blob.slice(start, end).arrayBuffer(),
  };
}

function dayToISO(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export interface QueryPerf {
  /** Bytes of the OPFS file. */
  fileBytes: number;
  /** Footer/metadata read. */
  footerMs: number;
  /** Filtered column parse. */
  parseMs: number;
  /** Rows hyparquet handed back before date slicing. */
  rowsScanned: number;
}

async function queryBars(q: BarsQuery): Promise<{ rows: WorkerRow[]; perf: QueryPerf }> {
  const buf = blobBuffer(q.file);
  const t0 = performance.now();
  const metadata = await parquetMetadataAsync(buf);
  const footerMs = performance.now() - t0;
  // Name stays on disk: dropping it saves ~10% of the parse. The full
  // symbol series comes back unsliced — the caller caches it whole and
  // slices per timeframe, so a timeframe switch never re-parses.
  const t1 = performance.now();
  const rows = await parquetQuery({
    file: buf,
    columns: ['Symbol', 'Date', 'Open', 'High', 'Low', 'Close', 'Volume'],
    filter: { Symbol: { $eq: q.symbol } },
  });
  const parseMs = performance.now() - t1;
  void metadata;
  const out: WorkerRow[] = [];
  for (const row of rows) {
    const day = Number(row.Date);
    if (!Number.isFinite(day)) continue;
    out.push({
      date: dayToISO(day),
      open: Number(row.Open),
      high: Number(row.High),
      low: Number(row.Low),
      close: Number(row.Close),
      volume: Number(row.Volume),
    });
  }
  return {
    rows: out,
    perf: {
      fileBytes: q.file.size,
      footerMs: Math.round(footerMs),
      parseMs: Math.round(parseMs),
      rowsScanned: rows.length,
    },
  };
}

async function queryQuotes(q: QuotesQuery): Promise<Record<string, WorkerQuote>> {
  const wanted = new Set(q.symbols);
  const rows = await parquetQuery({
    file: blobBuffer(q.file),
    columns: ['Symbol', 'Date', 'Close'],
    filter: { Symbol: { $in: q.symbols } },
  });
  // Latest two sessions per symbol: last close and the move since the bar
  // before it. One pass — the file is read once no matter how many tickers
  // the watchlist strip asks about.
  const latest = new Map<string, { day: number; close: number }>();
  const previous = new Map<string, { day: number; close: number }>();
  for (const row of rows) {
    const symbol = String(row.Symbol);
    if (!wanted.has(symbol)) continue;
    const day = Number(row.Date);
    const close = Number(row.Close);
    if (!Number.isFinite(day) || !Number.isFinite(close)) continue;
    const cur = latest.get(symbol);
    if (!cur || day > cur.day) {
      if (cur) {
        const prev = previous.get(symbol);
        if (!prev || cur.day > prev.day) previous.set(symbol, cur);
      }
      latest.set(symbol, { day, close });
    } else {
      const prev = previous.get(symbol);
      if (!prev || day > prev.day) previous.set(symbol, { day, close });
    }
  }
  const out: Record<string, WorkerQuote> = {};
  for (const symbol of q.symbols) {
    const last = latest.get(symbol);
    if (!last) continue;
    const prev = previous.get(symbol);
    out[symbol] = {
      price: last.close,
      changePct:
        prev && prev.close !== 0 ? ((last.close - prev.close) / prev.close) * 100 : 0,
      lastDate: dayToISO(last.day),
      prevDate: prev ? dayToISO(prev.day) : null,
      prevClose: prev ? prev.close : null,
    };
  }
  return out;
}

async function queryCatalog(q: CatalogQuery): Promise<CatalogEntry[]> {
  const rows = await parquetQuery({
    file: blobBuffer(q.file),
    columns: ['Symbol', 'Name'],
  });
  const out: CatalogEntry[] = [];
  for (const row of rows) {
    const ticker = String(row.Symbol ?? '').trim();
    const name = String(row.Name ?? '').trim();
    if (ticker && name) out.push({ ticker, name });
  }
  out.sort((a, b) => (a.ticker < b.ticker ? -1 : a.ticker > b.ticker ? 1 : 0));
  return out;
}

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<WorkerQuery>) => void) | null;
  postMessage: (msg: unknown) => void;
};

ctx.onmessage = async (e: MessageEvent<WorkerQuery>) => {
  const query = e.data;
  try {
    if (query.kind === 'bars') {
      const { rows, perf } = await queryBars(query);
      ctx.postMessage({ id: query.id, rows, perf });
    }
    else if (query.kind === 'quotes')
      ctx.postMessage({ id: query.id, quotes: await queryQuotes(query) });
    else ctx.postMessage({ id: query.id, entries: await queryCatalog(query) });
  } catch (err) {
    ctx.postMessage({
      id: query.id,
      error: err instanceof Error ? err.message : 'Parquet read failed',
    });
  }
};
