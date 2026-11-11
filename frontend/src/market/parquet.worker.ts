// parquet.worker.ts — file parsing off the main thread.
//
// The pool (workerClient) keeps two of these alive and feeds each one file
// at a time; the heavy work itself lives in parquetRead so the main-thread
// fallback runs the same code when workers are blocked. The message shape
// is unchanged: every request carries an id, every reply echoes it.

import { readBars, readCatalog, readQuotes } from './parquetRead';

export interface BarsQuery {
  kind: 'bars';
  file: Blob;
  symbol: string;
  /** Every request carries an id so the pool can match replies. */
  id: number;
}

export interface QuotesQuery {
  kind: 'quotes';
  file: Blob;
  symbols: string[];
  /** Every request carries an id so the pool can match replies. */
  id: number;
}

export interface CatalogQuery {
  kind: 'catalog';
  file: Blob;
  /** Every request carries an id so the pool can match replies. */
  id: number;
}

export type WorkerQuery = BarsQuery | QuotesQuery | CatalogQuery;

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<WorkerQuery>) => void) | null;
  postMessage: (msg: unknown) => void;
};

ctx.onmessage = async (e: MessageEvent<WorkerQuery>) => {
  const query = e.data;
  try {
    if (query.kind === 'bars') {
      const { rows, perf } = await readBars(query.file, query.symbol);
      ctx.postMessage({ id: query.id, rows, perf });
    } else if (query.kind === 'quotes') {
      const { quotes, perf } = await readQuotes(query.file, query.symbols);
      ctx.postMessage({ id: query.id, quotes, perf });
    } else {
      ctx.postMessage({ id: query.id, entries: await readCatalog(query.file) });
    }
  } catch (err) {
    ctx.postMessage({
      id: query.id,
      error: err instanceof Error ? err.message : 'Parquet read failed',
    });
  }
};
