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
  ]
}
