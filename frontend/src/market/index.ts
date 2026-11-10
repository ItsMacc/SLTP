// market/index.ts — the browser-side market data layer.
//
// OPFS is the browser's ~/.sltp/cache: era files download once per dataset
// version and are read locally afterwards. marketSync owns the background
// sequence, marketQuery answers one ticker out of the cache, and
// useMarketData paints charts progressively as each file parses.
export { bootMarketSync, prefetchOlder, useMarketSyncStatus, getSyncStatus } from './marketSync';
export type { SyncPhase, SyncStatus } from './marketSync';
export { queryMarketData, queryFile, queryQuotes, getTickerDirectory, chunkKeysForRange } from './marketQuery';
export type { Quote, TickerInfo } from './marketQuery';
export { useMarketData } from './useMarketData';
export type { MarketData, MarketDataState } from './useMarketData';
