// backtestResults.ts — generated from app/reports/artifacts by the reports script.
// One row per reported window: the strategy's metrics and buy and hold's, so the
// page never recomputes or hardcodes a number. Re-run with:
//   python -m app.reports.strategy_curves <strategy-id> --force

export interface BacktestMetrics {
  cagr: number;
  sharpe: number;
  max_drawdown: number;
  ending_value: number;
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
        "ending_value": 62.2782
      },
      "benchmark": {
        "cagr": -13.6,
        "sharpe": -0.5079,
        "max_drawdown": 46.67,
        "ending_value": 62.2782
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
        "ending_value": 53.9747
      },
      "benchmark": {
        "cagr": -33.75,
        "sharpe": -0.9175,
        "max_drawdown": 54.24,
        "ending_value": 53.9747
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
        "ending_value": 93.0508
      },
      "benchmark": {
        "cagr": -20.29,
        "sharpe": -0.1586,
        "max_drawdown": 33.69,
        "ending_value": 93.0508
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
        "ending_value": 89.4377
      },
      "benchmark": {
        "cagr": -5.94,
        "sharpe": -0.2082,
        "max_drawdown": 24.76,
        "ending_value": 89.4377
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
        "ending_value": 174.5551
      },
      "benchmark": {
        "cagr": 17.8,
        "sharpe": 1.4932,
        "max_drawdown": 9.65,
        "ending_value": 174.5551
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
        "ending_value": 151.113
      },
      "benchmark": {
        "cagr": 31.74,
        "sharpe": 1.8958,
        "max_drawdown": 9.39,
        "ending_value": 151.113
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
        "ending_value": 165.4724
      },
      "benchmark": {
        "cagr": 22.43,
        "sharpe": 1.3667,
        "max_drawdown": 18.31,
        "ending_value": 165.4724
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
        "ending_value": 176.7985
      },
      "benchmark": {
        "cagr": 14.06,
        "sharpe": 1.2476,
        "max_drawdown": 7.41,
        "ending_value": 176.7985
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
        "ending_value": 118.0938
      },
      "benchmark": {
        "cagr": -13.6,
        "sharpe": -0.5079,
        "max_drawdown": 46.67,
        "ending_value": 62.2782
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
        "ending_value": 55.2985
      },
      "benchmark": {
        "cagr": -33.75,
        "sharpe": -0.9175,
        "max_drawdown": 54.24,
        "ending_value": 53.9747
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
        "ending_value": 89.3282
      },
      "benchmark": {
        "cagr": -20.29,
        "sharpe": -0.1586,
        "max_drawdown": 33.69,
        "ending_value": 93.0508
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
        "ending_value": 107.4261
      },
      "benchmark": {
        "cagr": -5.94,
        "sharpe": -0.2082,
        "max_drawdown": 24.76,
        "ending_value": 89.4377
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
        "ending_value": 120.4673
      },
      "benchmark": {
        "cagr": 17.8,
        "sharpe": 1.4932,
        "max_drawdown": 9.65,
        "ending_value": 174.5551
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
        "ending_value": 101.1374
      },
      "benchmark": {
        "cagr": 31.74,
        "sharpe": 1.8958,
        "max_drawdown": 9.39,
        "ending_value": 151.113
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
        "ending_value": 159.7649
      },
      "benchmark": {
        "cagr": 22.43,
        "sharpe": 1.3667,
        "max_drawdown": 18.31,
        "ending_value": 165.4724
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
        "ending_value": 131.6114
      },
      "benchmark": {
        "cagr": 14.06,
        "sharpe": 1.2476,
        "max_drawdown": 7.41,
        "ending_value": 176.7985
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
        "ending_value": 118.7093
      },
      "benchmark": {
        "cagr": -13.6,
        "sharpe": -0.5079,
        "max_drawdown": 46.67,
        "ending_value": 62.2782
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
        "ending_value": 102.4747
      },
      "benchmark": {
        "cagr": -33.75,
        "sharpe": -0.9175,
        "max_drawdown": 54.24,
        "ending_value": 53.9747
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
        "ending_value": 94.4857
      },
      "benchmark": {
        "cagr": -20.29,
        "sharpe": -0.1586,
        "max_drawdown": 33.69,
        "ending_value": 93.0508
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
        "ending_value": 86.3031
      },
      "benchmark": {
        "cagr": -5.94,
        "sharpe": -0.2082,
        "max_drawdown": 24.76,
        "ending_value": 89.4377
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
        "ending_value": 204.9895
      },
      "benchmark": {
        "cagr": 17.8,
        "sharpe": 1.4932,
        "max_drawdown": 9.65,
        "ending_value": 174.5551
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
        "ending_value": 159.7598
      },
      "benchmark": {
        "cagr": 31.74,
        "sharpe": 1.8958,
        "max_drawdown": 9.39,
        "ending_value": 151.113
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
        "ending_value": 173.0799
      },
      "benchmark": {
        "cagr": 22.43,
        "sharpe": 1.3667,
        "max_drawdown": 18.31,
        "ending_value": 165.4724
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
        "ending_value": 156.5453
      },
      "benchmark": {
        "cagr": 14.06,
        "sharpe": 1.2476,
        "max_drawdown": 7.41,
        "ending_value": 176.7985
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
        "max_drawdown": 14.60,
        "ending_value": 86.8634
      },
      "benchmark": {
        "cagr": -13.60,
        "sharpe": -0.5079,
        "max_drawdown": 46.67,
        "ending_value": 62.2782
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
        "ending_value": 98.4500
      },
      "benchmark": {
        "cagr": -33.75,
        "sharpe": -0.9175,
        "max_drawdown": 54.24,
        "ending_value": 53.9747
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
        "max_drawdown": 9.10,
        "ending_value": 98.3492
      },
      "benchmark": {
        "cagr": -20.29,
        "sharpe": -0.1586,
        "max_drawdown": 33.69,
        "ending_value": 93.0508
      }
    },
    {
      "key": "bear-2022",
      "kind": "bear",
      "label": "Rate-hike bear market",
      "start": "2022-01-03",
      "end": "2023-10-31",
      "strategy": {
        "cagr": -4.40,
        "sharpe": -0.6309,
        "max_drawdown": 11.00,
        "ending_value": 92.1201
      },
      "benchmark": {
        "cagr": -5.94,
        "sharpe": -0.2082,
        "max_drawdown": 24.76,
        "ending_value": 89.4377
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
        "max_drawdown": 5.30,
        "ending_value": 122.7823
      },
      "benchmark": {
        "cagr": 17.80,
        "sharpe": 1.4932,
        "max_drawdown": 9.65,
        "ending_value": 174.5551
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
        "ending_value": 119.9825
      },
      "benchmark": {
        "cagr": 31.74,
        "sharpe": 1.8958,
        "max_drawdown": 9.39,
        "ending_value": 151.1130
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
        "ending_value": 129.5743
      },
      "benchmark": {
        "cagr": 22.43,
        "sharpe": 1.3667,
        "max_drawdown": 18.31,
        "ending_value": 165.4724
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
        "ending_value": 149.6963
      },
      "benchmark": {
        "cagr": 14.06,
        "sharpe": 1.2476,
        "max_drawdown": 7.41,
        "ending_value": 176.7985
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
        "cagr": -1.32,
        "sharpe": 0.0065,
        "max_drawdown": 23.70,
        "ending_value": 95.7855
      },
      "benchmark": {
        "cagr": -13.60,
        "sharpe": -0.5079,
        "max_drawdown": 46.67,
        "ending_value": 62.2782
      }
    },
    {
      "key": "bear-gfc",
      "kind": "bear",
      "label": "Global financial crisis",
      "start": "2007-10-01",
      "end": "2009-03-31",
      "strategy": {
        "cagr": -20.75,
        "sharpe": -0.8339,
        "max_drawdown": 37.63,
        "ending_value": 70.5850
      },
      "benchmark": {
        "cagr": -33.75,
        "sharpe": -0.9175,
        "max_drawdown": 54.24,
        "ending_value": 53.9747
      }
    },
    {
      "key": "bear-covid",
      "kind": "bear",
      "label": "COVID crash",
      "start": "2020-02-03",
      "end": "2020-05-29",
      "strategy": {
        "cagr": -40.68,
        "sharpe": -0.7167,
        "max_drawdown": 33.41,
        "ending_value": 84.7150
      },
      "benchmark": {
        "cagr": -20.29,
        "sharpe": -0.1586,
        "max_drawdown": 33.69,
        "ending_value": 93.0508
      }
    },
    {
      "key": "bear-2022",
      "kind": "bear",
      "label": "Rate-hike bear market",
      "start": "2022-01-03",
      "end": "2023-10-31",
      "strategy": {
        "cagr": -3.11,
        "sharpe": -0.1702,
        "max_drawdown": 17.30,
        "ending_value": 94.4026
      },
      "benchmark": {
        "cagr": -5.94,
        "sharpe": -0.2082,
        "max_drawdown": 24.76,
        "ending_value": 89.4377
      }
    },
    {
      "key": "bull-2012",
      "kind": "bull",
      "label": "Slow recovery bull",
      "start": "2012-01-03",
      "end": "2015-05-29",
      "strategy": {
        "cagr": 13.30,
        "sharpe": 1.4698,
        "max_drawdown": 6.77,
        "ending_value": 152.9157
      },
      "benchmark": {
        "cagr": 17.80,
        "sharpe": 1.4932,
        "max_drawdown": 9.65,
        "ending_value": 174.5551
      }
    },
    {
      "key": "bull-reopening",
      "kind": "bull",
      "label": "Pandemic reopening",
      "start": "2020-06-01",
      "end": "2021-11-30",
      "strategy": {
        "cagr": 11.28,
        "sharpe": 1.0655,
        "max_drawdown": 7.03,
        "ending_value": 117.3567
      },
      "benchmark": {
        "cagr": 31.74,
        "sharpe": 1.8958,
        "max_drawdown": 9.39,
        "ending_value": 151.1130
      }
    },
    {
      "key": "bull-ai",
      "kind": "bull",
      "label": "AI-led rally",
      "start": "2023-01-03",
      "end": "2025-06-30",
      "strategy": {
        "cagr": 10.20,
        "sharpe": 0.9805,
        "max_drawdown": 12.18,
        "ending_value": 127.3405
      },
      "benchmark": {
        "cagr": 22.43,
        "sharpe": 1.3667,
        "max_drawdown": 18.31,
        "ending_value": 165.4724
      }
    },
    {
      "key": "bull-2003",
      "kind": "bull",
      "label": "Mid-2000s bull",
      "start": "2003-04-01",
      "end": "2007-07-31",
      "strategy": {
        "cagr": 13.03,
        "sharpe": 1.5459,
        "max_drawdown": 5.99,
        "ending_value": 169.9944
      },
      "benchmark": {
        "cagr": 14.06,
        "sharpe": 1.2476,
        "max_drawdown": 7.41,
        "ending_value": 176.7985
      }
    }
  ]
};
