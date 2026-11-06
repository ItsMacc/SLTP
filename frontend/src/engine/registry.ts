// registry.ts — the strategies the browser can run.
//
// Each entry is a strategy file ported to `pip install sltp` imports, loaded
// as text and exec'd inside the Pyodide worker. The engine owns the math; this
// file only decides which source runs under which id. Adding a strategy means
// adding its .py file next to these and one entry here.

import benchmarkSource from './strategies/benchmark.py?raw'
import momentumSource from './strategies/momentum_20.py?raw'
import gtaSource from './strategies/global_trend_allocation.py?raw'
import lowVolSource from './strategies/low_volatility.py?raw'
import smrSource from './strategies/statistical_mean_reversion.py?raw'

export interface EngineStrategy {
  /** Stable id used by the UI and the worker. */
  id: string
  /** Display name. */
  name: string
  /** Class name defined inside `source`. */
  className: string
  /** One line on what it does. */
  description: string
  /** The .py source, exec'd in the worker. */
  source: string
}

export const ENGINE_STRATEGIES: EngineStrategy[] = [
  {
    id: 'buy-and-hold',
    name: 'Buy and Hold',
    className: 'Benchmark',
    description: 'Owns the S&P 500 through one fund for the whole run. The benchmark.',
    source: benchmarkSource,
  },
  {
    id: 'momentum-20',
    name: 'Momentum 20',
    className: 'Momentum20',
    description: 'Holds the 20 strongest liquid US stocks while SPY is above its 200-day average.',
    source: momentumSource,
  },
  {
    id: 'global-trend-allocation',
    name: 'Global Trend Allocation',
    className: 'GlobalTrendAllocation',
    description: 'Five-ETF book from trend, correlation and momentum. Exits a sleeve when its trend breaks.',
    source: gtaSource,
  },
  {
    id: 'low-volatility-30',
    name: 'Low Volatility 30',
    className: 'LowVolatility30',
    description: 'Equal-weighted 30 least volatile liquid US stocks, rebuilt quarterly.',
    source: lowVolSource,
  },
  {
    id: 'statistical-mean-reversion',
    name: 'Statistical Mean Reversion',
    className: 'StatisticalMeanReversionStrategy',
    description: 'Buys stocks that fell further than their volatility explains, then waits for the snap back.',
    source: smrSource,
  },
]

/** The ids the UI may offer, in display order. */
export const ENGINE_STRATEGY_IDS = ENGINE_STRATEGIES.map((entry) => entry.id)

/** Look up a strategy by id. Unknown ids return undefined instead of throwing. */
export function engineStrategyById(id: string): EngineStrategy | undefined {
  return ENGINE_STRATEGIES.find((entry) => entry.id === id)
}
