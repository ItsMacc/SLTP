// useMarketData.ts — bars for one ticker, painted progressively.
//
// The hook walks the range's chunks newest-first and appends each file's
// rows as its worker finishes: a 5-year chart is interactive after the first
// file parses while deeper history keeps extending it leftwards. A refetch
// (ticker or range change) discards late workers' results, so the chart can
// never show a previous ticker's bars.

import { useEffect, useState } from 'react';
import type { Bar } from '../components/Chart';
import { bootMarketSync } from './marketSync';
import { chunkKeysForRange, queryFile } from './marketQuery';

export type MarketDataState = 'idle' | 'loading' | 'ready' | 'error';

export interface MarketData {
  bars: Bar[];
  state: MarketDataState;
  /** Chunks parsed so far / chunks in this range. */
  filesDone: number;
  filesTotal: number;
  error: string | null;
}

/**
 * Merges one file's rows into the accumulated chart. Era files and the
 * `recent` tail overlap by a few sessions, so dates already present win and
 * no session ever appears twice.
 */
function mergeSorted(prev: Bar[], next: Bar[]): Bar[] {
  if (prev.length === 0) return next;
  if (next.length === 0) return prev;
  const seen = new Set(prev.map((b) => b.date));
  const merged = [...prev];
  for (const b of next) {
    if (!seen.has(b.date)) {
      seen.add(b.date);
      merged.push(b);
    }
  }
  merged.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return merged;
}

interface MarketRequest {
  symbol: string;
  start?: string;
  end?: string;
}

export function useMarketData(
  ticker: string | null,
  start?: string,
  end?: string,
): MarketData {
  const [bars, setBars] = useState<Bar[]>([]);
  const [state, setState] = useState<MarketDataState>('idle');
  const [filesDone, setFilesDone] = useState(0);
  const [filesTotal, setFilesTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<MarketRequest | null>(null);

  // A new ticker or range drops the old chart immediately, during render —
  // the effect below only ever fills the current request, so late workers
  // can never paint a previous ticker's bars.
  const next: MarketRequest | null = ticker
    ? { symbol: ticker.trim().toUpperCase(), start, end }
    : null;
  if (
    next?.symbol !== request?.symbol ||
    next?.start !== request?.start ||
    next?.end !== request?.end
  ) {
    setRequest(next);
    setBars([]);
    setError(null);
    setFilesDone(0);
    setFilesTotal(0);
    setState(next ? 'loading' : 'idle');
  }

  useEffect(() => {
    if (!request) return;
    let cancelled = false;

    (async () => {
      try {
        // The sync owns the downloads; the query waits for its manifest so
        // chunk choice and on-demand fetches agree on one file list.
        await bootMarketSync();
        if (cancelled) return;
        const keys = chunkKeysForRange(request.start, request.end);
        if (!cancelled) setFilesTotal(keys.length);
        // All chunks decode at once through the two-worker pool; each
        // completion paints immediately, so the chart still extends
        // leftwards as older eras land instead of waiting for all of them.
        let done = 0;
        await Promise.all(
          keys.map(async (key) => {
            const rows = await queryFile(key, request.symbol, request.start, request.end);
            if (cancelled) return;
            done += 1;
            if (rows.length > 0) setBars((prev) => mergeSorted(prev, rows));
            setFilesDone(done);
          }),
        );
        if (!cancelled) setState('ready');
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load market data');
          setState('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [request]);

  return { bars, state, filesDone, filesTotal, error };
}
