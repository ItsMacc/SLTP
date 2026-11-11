// store/index.ts — the browser-side data layer: one folder, one way to read.
//
// OPFS is the browser's ~/.sltp/cache: era files download once per dataset
// version and are read locally afterwards. sync owns the background
// sequence and the plan (full history on desktop, the recent pair on
// phones), query answers one ticker out of the cache, and useMarketSyncStatus
// paints progress anywhere. pool runs the parquet decodes off the main
// thread; pyodide warms the strategy engine only when a page asks for it.
//
// Every page reads through here — Research charts, the future Lab runs,
// the watchlist — never the files directly.
export {
  bootMarketSync,
  prefetchOlder,
  useMarketSyncStatus,
  getSyncStatus,
  getManifest,
  getActivePlan,
} from './sync';
export type { SyncPhase, SyncPlan, SyncStatus } from './sync';
export {
  queryMarketData,
  queryFile,
  queryQuotes,
  getTickerDirectory,
  chunkKeysForRange,
} from './query';
export type { Quote, TickerInfo } from './query';
export { isMobileDevice, MOBILE_HISTORY_START } from './device';
export { warmEngine, useEngineStatus, getEngineStatus } from './pyodide';
export type { EnginePhase, EngineStatus } from './pyodide';
