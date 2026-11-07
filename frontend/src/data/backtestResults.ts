// backtestResults.ts — generated from app/reports/artifacts by the reports script.
// One row per reported window: the strategy's metrics and buy and hold's, so the
// page never recomputes or hardcodes a number. Re-run with:
//   python -m app.reports.strategy_curves <strategy-id> --force
//   python -m app.reports.single_curves buy-and-hold --force

export interface BacktestMetrics {
  cagr: number;
  sharpe: number;
  max_drawdown: number;
  ending_value: number;
  turnover: number;
  cost_drag: number;
  total_trading_cost: number;
}

export interface BacktestRow {
  key: string;
  kind: 'bear' | 'bull';
  label: string;
  start: string;
  end: string;
  strategy: BacktestMetrics;
  benchmark: BacktestMetrics;
}

export const BACKTESTS: Record<string, BacktestRow[]> = {
  "buy-and-hold": [
    {
      "key": "bear-dotcom",
      "kind": "bear",
      "label": "Dot-com bust",
      "start": "2000-01-03",
      "end": "2003-03-31",
      "strategy": {
        "cagr": -13.6,
        "sharpe": -0.5079,
        "max_drawdown": 46.67,
        "ending_value": 62.2782,
        "turnover": 36.8,
        "cost_drag": 0.06,
        "total_trading_cost": 0.15
      },
      "benchmark": {
        "cagr": -13.6,
        "sharpe": -0.5079,
        "max_drawdown": 46.67,
        "ending_value": 62.2782,
        "turnover": 36.8,
        "cost_drag": 0.06,
        "total_trading_cost": 0.15
      }
    },
    {
      "key": "bear-gfc",
      "kind": "bear",
      "label": "Global financial crisis",
      "start": "2007-10-01",
      "end": "2009-03-31",
      "strategy": {
        "cagr": -33.75,
        "sharpe": -0.9175,
        "max_drawdown": 54.24,
        "ending_value": 53.9747,
        "turnover": 84.7,
        "cost_drag": 0.13,
        "total_trading_cost": 0.15
      },
      "benchmark": {
        "cagr": -33.75,
        "sharpe": -0.9175,
        "max_drawdown": 54.24,
        "ending_value": 53.9747,
        "turnover": 84.7,
        "cost_drag": 0.13,
        "total_trading_cost": 0.15
      }
    },
    {
      "key": "bear-covid",
      "kind": "bear",
      "label": "COVID crash",
      "start": "2020-02-03",
      "end": "2020-05-29",
      "strategy": {
        "cagr": -20.29,
        "sharpe": -0.1586,
        "max_drawdown": 33.69,
        "ending_value": 93.0508,
        "turnover": 357.05,
        "cost_drag": 0.54,
        "total_trading_cost": 0.15
      },
      "benchmark": {
        "cagr": -20.29,
        "sharpe": -0.1586,
        "max_drawdown": 33.69,
        "ending_value": 93.0508,
        "turnover": 357.05,
        "cost_drag": 0.54,
        "total_trading_cost": 0.15
      }
    },
    {
      "key": "bear-2022",
      "kind": "bear",
      "label": "Rate-hike bear market",
      "start": "2022-01-03",
      "end": "2023-10-31",
      "strategy": {
        "cagr": -5.94,
        "sharpe": -0.2082,
        "max_drawdown": 24.76,
        "ending_value": 89.4377,
        "turnover": 62.62,
        "cost_drag": 0.09,
        "total_trading_cost": 0.15
      },
      "benchmark": {
        "cagr": -5.94,
        "sharpe": -0.2082,
        "max_drawdown": 24.76,
        "ending_value": 89.4377,
        "turnover": 62.62,
        "cost_drag": 0.09,
        "total_trading_cost": 0.15
      }
    },
    {
      "key": "bull-2012",
      "kind": "bull",
      "label": "Slow recovery bull",
      "start": "2012-01-03",
      "end": "2015-05-29",
      "strategy": {
        "cagr": 17.8,
        "sharpe": 1.4932,
        "max_drawdown": 9.65,
        "ending_value": 174.5551,
        "turnover": 21.31,
        "cost_drag": 0.03,
        "total_trading_cost": 0.15
      },
      "benchmark": {
        "cagr": 17.8,
        "sharpe": 1.4932,
        "max_drawdown": 9.65,
        "ending_value": 174.5551,
        "turnover": 21.31,
        "cost_drag": 0.03,
        "total_trading_cost": 0.15
      }
    },
    {
      "key": "bull-reopening",
      "kind": "bull",
      "label": "Pandemic reopening",
      "start": "2020-06-01",
      "end": "2021-11-30",
      "strategy": {
        "cagr": 31.74,
        "sharpe": 1.8958,
        "max_drawdown": 9.39,
        "ending_value": 151.113,
        "turnover": 52.0,
        "cost_drag": 0.08,
        "total_trading_cost": 0.15
      },
      "benchmark": {
        "cagr": 31.74,
        "sharpe": 1.8958,
        "max_drawdown": 9.39,
        "ending_value": 151.113,
        "turnover": 52.0,
        "cost_drag": 0.08,
        "total_trading_cost": 0.15
      }
    },
    {
      "key": "bull-ai",
      "kind": "bull",
      "label": "AI-led rally",
      "start": "2023-01-03",
      "end": "2025-06-30",
      "strategy": {
        "cagr": 22.43,
        "sharpe": 1.3667,
        "max_drawdown": 18.31,
        "ending_value": 165.4724,
        "turnover": 30.15,
        "cost_drag": 0.05,
        "total_trading_cost": 0.15
      },
      "benchmark": {
        "cagr": 22.43,
        "sharpe": 1.3667,
        "max_drawdown": 18.31,
        "ending_value": 165.4724,
        "turnover": 30.15,
        "cost_drag": 0.05,
        "total_trading_cost": 0.15
      }
    },
    {
      "key": "bull-2003",
      "kind": "bull",
      "label": "Mid-2000s bull",
      "start": "2003-04-01",
      "end": "2007-07-31",
      "strategy": {
        "cagr": 14.06,
        "sharpe": 1.2476,
        "max_drawdown": 7.41,
        "ending_value": 176.7985,
        "turnover": 16.1,
        "cost_drag": 0.02,
        "total_trading_cost": 0.15
      },
      "benchmark": {
        "cagr": 14.06,
        "sharpe": 1.2476,
        "max_drawdown": 7.41,
        "ending_value": 176.7985,
        "turnover": 16.1,
        "cost_drag": 0.02,
        "total_trading_cost": 0.15
      }
    }
  ],
  "momentum-20": [
    {
      "key": "bear-dotcom",
      "kind": "bear",
      "label": "Dot-com bust",
      "start": "2000-01-03",
      "end": "2003-03-31",
      "strategy": {
        "cagr": 5.44,
        "sharpe": 0.5045,
        "max_drawdown": 14.73,
        "ending_value": 118.7093,
        "turnover": 194.7,
        "cost_drag": 0.29,
        "total_trading_cost": 1.11
      },
      "benchmark": {
        "cagr": -13.6,
        "sharpe": -0.5079,
        "max_drawdown": 46.67,
        "ending_value": 62.2782,
        "turnover": 36.8,
        "cost_drag": 0.06,
        "total_trading_cost": 0.15
      }
    },
    {
      "key": "bear-gfc",
      "kind": "bear",
      "label": "Global financial crisis",
      "start": "2007-10-01",
      "end": "2009-03-31",
      "strategy": {
        "cagr": 1.65,
        "sharpe": 0.1906,
        "max_drawdown": 15.36,
        "ending_value": 102.4747,
        "turnover": 144.97,
        "cost_drag": 0.22,
        "total_trading_cost": 0.33
      },
      "benchmark": {
        "cagr": -33.75,
        "sharpe": -0.9175,
        "max_drawdown": 54.24,
        "ending_value": 53.9747,
        "turnover": 84.7,
        "cost_drag": 0.13,
        "total_trading_cost": 0.15
      }
    },
    {
      "key": "bear-covid",
      "kind": "bear",
      "label": "COVID crash",
      "start": "2020-02-03",
      "end": "2020-05-29",
      "strategy": {
        "cagr": -16.36,
        "sharpe": -1.0888,
        "max_drawdown": 13.01,
        "ending_value": 94.4857,
        "turnover": 579.23,
        "cost_drag": 0.85,
        "total_trading_cost": 0.26
      },
      "benchmark": {
        "cagr": -20.29,
        "sharpe": -0.1586,
        "max_drawdown": 33.69,
        "ending_value": 93.0508,
        "turnover": 357.05,
        "cost_drag": 0.54,
        "total_trading_cost": 0.15
      }
    },
    {
      "key": "bear-2022",
      "kind": "bear",
      "label": "Rate-hike bear market",
      "start": "2022-01-03",
      "end": "2023-10-31",
      "strategy": {
        "cagr": -7.76,
        "sharpe": -0.5173,
        "max_drawdown": 15.0,
        "ending_value": 86.3031,
        "turnover": 533.61,
        "cost_drag": 0.8,
        "total_trading_cost": 1.4
      },
      "benchmark": {
        "cagr": -5.94,
        "sharpe": -0.2082,
        "max_drawdown": 24.76,
        "ending_value": 89.4377,
        "turnover": 62.62,
        "cost_drag": 0.09,
        "total_trading_cost": 0.15
      }
    },
    {
      "key": "bull-2012",
      "kind": "bull",
      "label": "Slow recovery bull",
      "start": "2012-01-03",
      "end": "2015-05-29",
      "strategy": {
        "cagr": 23.5,
        "sharpe": 1.375,
        "max_drawdown": 16.29,
        "ending_value": 204.9895,
        "turnover": 466.69,
        "cost_drag": 0.71,
        "total_trading_cost": 3.37
      },
      "benchmark": {
        "cagr": 17.8,
        "sharpe": 1.4932,
        "max_drawdown": 9.65,
        "ending_value": 174.5551,
        "turnover": 21.31,
        "cost_drag": 0.03,
        "total_trading_cost": 0.15
      }
    },
    {
      "key": "bull-reopening",
      "kind": "bull",
      "label": "Pandemic reopening",
      "start": "2020-06-01",
      "end": "2021-11-30",
      "strategy": {
        "cagr": 36.73,
        "sharpe": 1.2998,
        "max_drawdown": 18.04,
        "ending_value": 159.7598,
        "turnover": 652.4,
        "cost_drag": 0.98,
        "total_trading_cost": 2.02
      },
      "benchmark": {
        "cagr": 31.74,
        "sharpe": 1.8958,
        "max_drawdown": 9.39,
        "ending_value": 151.113,
        "turnover": 52.0,
        "cost_drag": 0.08,
        "total_trading_cost": 0.15
      }
    },
    {
      "key": "bull-ai",
      "kind": "bull",
      "label": "AI-led rally",
      "start": "2023-01-03",
      "end": "2025-06-30",
      "strategy": {
        "cagr": 24.66,
        "sharpe": 1.1758,
        "max_drawdown": 17.21,
        "ending_value": 173.0799,
        "turnover": 607.97,
        "cost_drag": 0.91,
        "total_trading_cost": 2.94
      },
      "benchmark": {
        "cagr": 22.43,
        "sharpe": 1.3667,
        "max_drawdown": 18.31,
        "ending_value": 165.4724,
        "turnover": 30.15,
        "cost_drag": 0.05,
        "total_trading_cost": 0.15
      }
    },
    {
      "key": "bull-2003",
      "kind": "bull",
      "label": "Mid-2000s bull",
      "start": "2003-04-01",
      "end": "2007-07-31",
      "strategy": {
        "cagr": 10.9,
        "sharpe": 0.6818,
        "max_drawdown": 23.67,
        "ending_value": 156.5453,
        "turnover": 524.98,
        "cost_drag": 0.78,
        "total_trading_cost": 4.46
      },
      "benchmark": {
        "cagr": 14.06,
        "sharpe": 1.2476,
        "max_drawdown": 7.41,
        "ending_value": 176.7985,
        "turnover": 16.1,
        "cost_drag": 0.02,
        "total_trading_cost": 0.15
      }
    }
  ],
  "global-trend-allocation": [
    {
      "key": "bear-dotcom",
      "kind": "bear",
      "label": "Dot-com bust",
      "start": "2000-01-03",
      "end": "2003-03-31",
      "strategy": {
        "cagr": -4.26,
        "sharpe": -0.9198,
        "max_drawdown": 14.6,
        "ending_value": 86.8634,
        "turnover": 153.87,
        "cost_drag": 0.23,
        "total_trading_cost": 0.67
      },
      "benchmark": {
        "cagr": -13.6,
        "sharpe": -0.5079,
        "max_drawdown": 46.67,
        "ending_value": 62.2782,
        "turnover": 36.8,
        "cost_drag": 0.06,
        "total_trading_cost": 0.15
      }
    },
    {
      "key": "bear-gfc",
      "kind": "bear",
      "label": "Global financial crisis",
      "start": "2007-10-01",
      "end": "2009-03-31",
      "strategy": {
        "cagr": -1.04,
        "sharpe": -0.0376,
        "max_drawdown": 12.01,
        "ending_value": 98.45,
        "turnover": 661.67,
        "cost_drag": 0.99,
        "total_trading_cost": 1.53
      },
      "benchmark": {
        "cagr": -33.75,
        "sharpe": -0.9175,
        "max_drawdown": 54.24,
        "ending_value": 53.9747,
        "turnover": 84.7,
        "cost_drag": 0.13,
        "total_trading_cost": 0.15
      }
    },
    {
      "key": "bear-covid",
      "kind": "bear",
      "label": "COVID crash",
      "start": "2020-02-03",
      "end": "2020-05-29",
      "strategy": {
        "cagr": -5.11,
        "sharpe": -0.4254,
        "max_drawdown": 9.1,
        "ending_value": 98.3492,
        "turnover": 739.09,
        "cost_drag": 1.09,
        "total_trading_cost": 0.34
      },
      "benchmark": {
        "cagr": -20.29,
        "sharpe": -0.1586,
        "max_drawdown": 33.69,
        "ending_value": 93.0508,
        "turnover": 357.05,
        "cost_drag": 0.54,
        "total_trading_cost": 0.15
      }
    },
    {
      "key": "bear-2022",
      "kind": "bear",
      "label": "Rate-hike bear market",
      "start": "2022-01-03",
      "end": "2023-10-31",
      "strategy": {
        "cagr": -4.4,
        "sharpe": -0.6309,
        "max_drawdown": 11.0,
        "ending_value": 92.1201,
        "turnover": 621.77,
        "cost_drag": 0.92,
        "total_trading_cost": 1.63
      },
      "benchmark": {
        "cagr": -5.94,
        "sharpe": -0.2082,
        "max_drawdown": 24.76,
        "ending_value": 89.4377,
        "turnover": 62.62,
        "cost_drag": 0.09,
        "total_trading_cost": 0.15
      }
    },
    {
      "key": "bull-2012",
      "kind": "bull",
      "label": "Slow recovery bull",
      "start": "2012-01-03",
      "end": "2015-05-29",
      "strategy": {
        "cagr": 6.22,
        "sharpe": 0.9623,
        "max_drawdown": 5.3,
        "ending_value": 122.7823,
        "turnover": 471.3,
        "cost_drag": 0.7,
        "total_trading_cost": 2.62
      },
      "benchmark": {
        "cagr": 17.8,
        "sharpe": 1.4932,
        "max_drawdown": 9.65,
        "ending_value": 174.5551,
        "turnover": 21.31,
        "cost_drag": 0.03,
        "total_trading_cost": 0.15
      }
    },
    {
      "key": "bull-reopening",
      "kind": "bull",
      "label": "Pandemic reopening",
      "start": "2020-06-01",
      "end": "2021-11-30",
      "strategy": {
        "cagr": 12.94,
        "sharpe": 1.2375,
        "max_drawdown": 5.86,
        "ending_value": 119.9825,
        "turnover": 341.3,
        "cost_drag": 0.52,
        "total_trading_cost": 0.87
      },
      "benchmark": {
        "cagr": 31.74,
        "sharpe": 1.8958,
        "max_drawdown": 9.39,
        "ending_value": 151.113,
        "turnover": 52.0,
        "cost_drag": 0.08,
        "total_trading_cost": 0.15
      }
    },
    {
      "key": "bull-ai",
      "kind": "bull",
      "label": "AI-led rally",
      "start": "2023-01-03",
      "end": "2025-06-30",
      "strategy": {
        "cagr": 10.97,
        "sharpe": 1.3146,
        "max_drawdown": 7.45,
        "ending_value": 129.5743,
        "turnover": 423.19,
        "cost_drag": 0.63,
        "total_trading_cost": 1.76
      },
      "benchmark": {
        "cagr": 22.43,
        "sharpe": 1.3667,
        "max_drawdown": 18.31,
        "ending_value": 165.4724,
        "turnover": 30.15,
        "cost_drag": 0.05,
        "total_trading_cost": 0.15
      }
    },
    {
      "key": "bull-2003",
      "kind": "bull",
      "label": "Mid-2000s bull",
      "start": "2003-04-01",
      "end": "2007-07-31",
      "strategy": {
        "cagr": 9.76,
        "sharpe": 1.0152,
        "max_drawdown": 16.38,
        "ending_value": 149.6963,
        "turnover": 420.8,
        "cost_drag": 0.63,
        "total_trading_cost": 3.53
      },
      "benchmark": {
        "cagr": 14.06,
        "sharpe": 1.2476,
        "max_drawdown": 7.41,
        "ending_value": 176.7985,
        "turnover": 16.1,
        "cost_drag": 0.02,
        "total_trading_cost": 0.15
      }
    }
  ],
  "low-volatility-30": [
    {
      "key": "bear-dotcom",
      "kind": "bear",
      "label": "Dot-com bust",
      "start": "2000-01-03",
      "end": "2003-03-31",
      "strategy": {
        "cagr": -2.08,
        "sharpe": -0.0395,
        "max_drawdown": 25.52,
        "ending_value": 93.4223,
        "turnover": 109.66,
        "cost_drag": 0.17,
        "total_trading_cost": 0.56
      },
      "benchmark": {
        "cagr": -13.6,
        "sharpe": -0.5079,
        "max_drawdown": 46.67,
        "ending_value": 62.2782,
        "turnover": 36.8,
        "cost_drag": 0.06,
        "total_trading_cost": 0.15
      }
    },
    {
      "key": "bear-gfc",
      "kind": "bear",
      "label": "Global financial crisis",
      "start": "2007-10-01",
      "end": "2009-03-31",
      "strategy": {
        "cagr": -19.61,
        "sharpe": -0.7896,
        "max_drawdown": 36.42,
        "ending_value": 72.119,
        "turnover": 155.37,
        "cost_drag": 0.23,
        "total_trading_cost": 0.31
      },
      "benchmark": {
        "cagr": -33.75,
        "sharpe": -0.9175,
        "max_drawdown": 54.24,
        "ending_value": 53.9747,
        "turnover": 84.7,
        "cost_drag": 0.13,
        "total_trading_cost": 0.15
      }
    },
    {
      "key": "bear-covid",
      "kind": "bear",
      "label": "COVID crash",
      "start": "2020-02-03",
      "end": "2020-05-29",
      "strategy": {
        "cagr": -40.65,
        "sharpe": -0.7162,
        "max_drawdown": 33.41,
        "ending_value": 84.732,
        "turnover": 801.76,
        "cost_drag": 1.19,
        "total_trading_cost": 0.33
      },
      "benchmark": {
        "cagr": -20.29,
        "sharpe": -0.1586,
        "max_drawdown": 33.69,
        "ending_value": 93.0508,
        "turnover": 357.05,
        "cost_drag": 0.54,
        "total_trading_cost": 0.15
      }
    },
    {
      "key": "bear-2022",
      "kind": "bear",
      "label": "Rate-hike bear market",
      "start": "2022-01-03",
      "end": "2023-10-31",
      "strategy": {
        "cagr": -3.74,
        "sharpe": -0.2224,
        "max_drawdown": 17.25,
        "ending_value": 93.2815,
        "turnover": 153.73,
        "cost_drag": 0.23,
        "total_trading_cost": 0.41
      },
      "benchmark": {
        "cagr": -5.94,
        "sharpe": -0.2082,
        "max_drawdown": 24.76,
        "ending_value": 89.4377,
        "turnover": 62.62,
        "cost_drag": 0.09,
        "total_trading_cost": 0.15
      }
    },
    {
      "key": "bull-2012",
      "kind": "bull",
      "label": "Slow recovery bull",
      "start": "2012-01-03",
      "end": "2015-05-29",
      "strategy": {
        "cagr": 12.41,
        "sharpe": 1.3702,
        "max_drawdown": 6.47,
        "ending_value": 148.8735,
        "turnover": 146.38,
        "cost_drag": 0.22,
        "total_trading_cost": 0.93
      },
      "benchmark": {
        "cagr": 17.8,
        "sharpe": 1.4932,
        "max_drawdown": 9.65,
        "ending_value": 174.5551,
        "turnover": 21.31,
        "cost_drag": 0.03,
        "total_trading_cost": 0.15
      }
    },
    {
      "key": "bull-reopening",
      "kind": "bull",
      "label": "Pandemic reopening",
      "start": "2020-06-01",
      "end": "2021-11-30",
      "strategy": {
        "cagr": 10.35,
        "sharpe": 0.9777,
        "max_drawdown": 7.13,
        "ending_value": 115.8898,
        "turnover": 170.8,
        "cost_drag": 0.25,
        "total_trading_cost": 0.42
      },
      "benchmark": {
        "cagr": 31.74,
        "sharpe": 1.8958,
        "max_drawdown": 9.39,
        "ending_value": 151.113,
        "turnover": 52.0,
        "cost_drag": 0.08,
        "total_trading_cost": 0.15
      }
    },
    {
      "key": "bull-ai",
      "kind": "bull",
      "label": "AI-led rally",
      "start": "2023-01-03",
      "end": "2025-06-30",
      "strategy": {
        "cagr": 10.28,
        "sharpe": 1.0014,
        "max_drawdown": 12.28,
        "ending_value": 127.5608,
        "turnover": 140.81,
        "cost_drag": 0.21,
        "total_trading_cost": 0.57
      },
      "benchmark": {
        "cagr": 22.43,
        "sharpe": 1.3667,
        "max_drawdown": 18.31,
        "ending_value": 165.4724,
        "turnover": 30.15,
        "cost_drag": 0.05,
        "total_trading_cost": 0.15
      }
    },
    {
      "key": "bull-2003",
      "kind": "bull",
      "label": "Mid-2000s bull",
      "start": "2003-04-01",
      "end": "2007-07-31",
      "strategy": {
        "cagr": 12.4,
        "sharpe": 1.486,
        "max_drawdown": 6.82,
        "ending_value": 165.9203,
        "turnover": 112.57,
        "cost_drag": 0.17,
        "total_trading_cost": 1.01
      },
      "benchmark": {
        "cagr": 14.06,
        "sharpe": 1.2476,
        "max_drawdown": 7.41,
        "ending_value": 176.7985,
        "turnover": 16.1,
        "cost_drag": 0.02,
        "total_trading_cost": 0.15
      }
    }
  ],
  "statistical-mean-reversion": [
    {
      "key": "bear-dotcom",
      "kind": "bear",
      "label": "Dot-com bust",
      "start": "2000-01-03",
      "end": "2003-03-31",
      "strategy": {
        "cagr": 5.27,
        "sharpe": 0.3301,
        "max_drawdown": 33.88,
        "ending_value": 118.0938,
        "turnover": 320.54,
        "cost_drag": 0.47,
        "total_trading_cost": 1.83
      },
      "benchmark": {
        "cagr": -13.6,
        "sharpe": -0.5079,
        "max_drawdown": 46.67,
        "ending_value": 62.2782,
        "turnover": 36.8,
        "cost_drag": 0.06,
        "total_trading_cost": 0.15
      }
    },
    {
      "key": "bear-gfc",
      "kind": "bear",
      "label": "Global financial crisis",
      "start": "2007-10-01",
      "end": "2009-03-31",
      "strategy": {
        "cagr": -32.67,
        "sharpe": -0.5899,
        "max_drawdown": 56.51,
        "ending_value": 55.2985,
        "turnover": 475.99,
        "cost_drag": 0.73,
        "total_trading_cost": 0.9
      },
      "benchmark": {
        "cagr": -33.75,
        "sharpe": -0.9175,
        "max_drawdown": 54.24,
        "ending_value": 53.9747,
        "turnover": 84.7,
        "cost_drag": 0.13,
        "total_trading_cost": 0.15
      }
    },
    {
      "key": "bear-covid",
      "kind": "bear",
      "label": "COVID crash",
      "start": "2020-02-03",
      "end": "2020-05-29",
      "strategy": {
        "cagr": -29.91,
        "sharpe": -0.3339,
        "max_drawdown": 34.22,
        "ending_value": 89.3282,
        "turnover": 1314.8,
        "cost_drag": 1.94,
        "total_trading_cost": 0.53
      },
      "benchmark": {
        "cagr": -20.29,
        "sharpe": -0.1586,
        "max_drawdown": 33.69,
        "ending_value": 93.0508,
        "turnover": 357.05,
        "cost_drag": 0.54,
        "total_trading_cost": 0.15
      }
    },
    {
      "key": "bear-2022",
      "kind": "bear",
      "label": "Rate-hike bear market",
      "start": "2022-01-03",
      "end": "2023-10-31",
      "strategy": {
        "cagr": 4.01,
        "sharpe": 0.2795,
        "max_drawdown": 26.11,
        "ending_value": 107.4261,
        "turnover": 511.7,
        "cost_drag": 0.77,
        "total_trading_cost": 1.33
      },
      "benchmark": {
        "cagr": -5.94,
        "sharpe": -0.2082,
        "max_drawdown": 24.76,
        "ending_value": 89.4377,
        "turnover": 62.62,
        "cost_drag": 0.09,
        "total_trading_cost": 0.15
      }
    },
    {
      "key": "bull-2012",
      "kind": "bull",
      "label": "Slow recovery bull",
      "start": "2012-01-03",
      "end": "2015-05-29",
      "strategy": {
        "cagr": 5.63,
        "sharpe": 0.4525,
        "max_drawdown": 19.19,
        "ending_value": 120.4673,
        "turnover": 289.52,
        "cost_drag": 0.45,
        "total_trading_cost": 1.71
      },
      "benchmark": {
        "cagr": 17.8,
        "sharpe": 1.4932,
        "max_drawdown": 9.65,
        "ending_value": 174.5551,
        "turnover": 21.31,
        "cost_drag": 0.03,
        "total_trading_cost": 0.15
      }
    },
    {
      "key": "bull-reopening",
      "kind": "bull",
      "label": "Pandemic reopening",
      "start": "2020-06-01",
      "end": "2021-11-30",
      "strategy": {
        "cagr": 0.76,
        "sharpe": 0.1445,
        "max_drawdown": 9.05,
        "ending_value": 101.1374,
        "turnover": 157.63,
        "cost_drag": 0.24,
        "total_trading_cost": 0.36
      },
      "benchmark": {
        "cagr": 31.74,
        "sharpe": 1.8958,
        "max_drawdown": 9.39,
        "ending_value": 151.113,
        "turnover": 52.0,
        "cost_drag": 0.08,
        "total_trading_cost": 0.15
      }
    },
    {
      "key": "bull-ai",
      "kind": "bull",
      "label": "AI-led rally",
      "start": "2023-01-03",
      "end": "2025-06-30",
      "strategy": {
        "cagr": 20.72,
        "sharpe": 1.5098,
        "max_drawdown": 10.62,
        "ending_value": 159.7649,
        "turnover": 419.31,
        "cost_drag": 0.63,
        "total_trading_cost": 1.93
      },
      "benchmark": {
        "cagr": 22.43,
        "sharpe": 1.3667,
        "max_drawdown": 18.31,
        "ending_value": 165.4724,
        "turnover": 30.15,
        "cost_drag": 0.05,
        "total_trading_cost": 0.15
      }
    },
    {
      "key": "bull-2003",
      "kind": "bull",
      "label": "Mid-2000s bull",
      "start": "2003-04-01",
      "end": "2007-07-31",
      "strategy": {
        "cagr": 6.55,
        "sharpe": 0.712,
        "max_drawdown": 17.06,
        "ending_value": 131.6114,
        "turnover": 281.54,
        "cost_drag": 0.53,
        "total_trading_cost": 2.62
      },
      "benchmark": {
        "cagr": 14.06,
        "sharpe": 1.2476,
        "max_drawdown": 7.41,
        "ending_value": 176.7985,
        "turnover": 16.1,
        "cost_drag": 0.02,
        "total_trading_cost": 0.15
      }
    }
  ]
};
