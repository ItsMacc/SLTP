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
        "cagr": -15.05,
        "sharpe": -0.561,
        "max_drawdown": 49.14,
        "ending_value": 58.9522
      },
      "benchmark": {
        "cagr": -15.05,
        "sharpe": -0.561,
        "max_drawdown": 49.14,
        "ending_value": 58.9522
      }
    },
    {
      "key": "bear-gfc",
      "kind": "bear",
      "label": "Global financial crisis",
      "start": "2007-10-01",
      "end": "2009-03-31",
      "strategy": {
        "cagr": -35.92,
        "sharpe": -0.9684,
        "max_drawdown": 56.47,
        "ending_value": 51.3547
      },
      "benchmark": {
        "cagr": -35.92,
        "sharpe": -0.9684,
        "max_drawdown": 56.47,
        "ending_value": 51.3547
      }
    },
    {
      "key": "bear-covid",
      "kind": "bear",
      "label": "COVID crash",
      "start": "2020-02-03",
      "end": "2020-05-29",
      "strategy": {
        "cagr": -21.44,
        "sharpe": -0.1821,
        "max_drawdown": 34.1,
        "ending_value": 92.6229
      },
      "benchmark": {
        "cagr": -21.44,
        "sharpe": -0.1821,
        "max_drawdown": 34.1,
        "ending_value": 92.6229
      }
    },
    {
      "key": "bear-2022",
      "kind": "bear",
      "label": "Rate-hike bear market",
      "start": "2022-01-03",
      "end": "2023-10-31",
      "strategy": {
        "cagr": -7.27,
        "sharpe": -0.2747,
        "max_drawdown": 25.71,
        "ending_value": 87.136
      },
      "benchmark": {
        "cagr": -7.27,
        "sharpe": -0.2747,
        "max_drawdown": 25.71,
        "ending_value": 87.136
      }
    },
    {
      "key": "bull-2012",
      "kind": "bull",
      "label": "Slow recovery bull",
      "start": "2012-01-03",
      "end": "2015-05-29",
      "strategy": {
        "cagr": 16.02,
        "sharpe": 1.3227,
        "max_drawdown": 9.69,
        "ending_value": 165.7466
      },
      "benchmark": {
        "cagr": 16.02,
        "sharpe": 1.3227,
        "max_drawdown": 9.69,
        "ending_value": 165.7466
      }
    },
    {
      "key": "bull-reopening",
      "kind": "bull",
      "label": "Pandemic reopening",
      "start": "2020-06-01",
      "end": "2021-11-30",
      "strategy": {
        "cagr": 30.15,
        "sharpe": 1.7903,
        "max_drawdown": 9.8,
        "ending_value": 148.3876
      },
      "benchmark": {
        "cagr": 30.15,
        "sharpe": 1.7903,
        "max_drawdown": 9.8,
        "ending_value": 148.3876
      }
    },
    {
      "key": "bull-ai",
      "kind": "bull",
      "label": "AI-led rally",
      "start": "2023-01-03",
      "end": "2025-06-30",
      "strategy": {
        "cagr": 21.09,
        "sharpe": 1.2718,
        "max_drawdown": 19.0,
        "ending_value": 161.0018
      },
      "benchmark": {
        "cagr": 21.09,
        "sharpe": 1.2718,
        "max_drawdown": 19.0,
        "ending_value": 161.0018
      }
    },
    {
      "key": "bull-2003",
      "kind": "bull",
      "label": "Mid-2000s bull",
      "start": "2003-04-01",
      "end": "2007-07-31",
      "strategy": {
        "cagr": 12.45,
        "sharpe": 1.0853,
        "max_drawdown": 8.19,
        "ending_value": 166.2188
      },
      "benchmark": {
        "cagr": 12.45,
        "sharpe": 1.0853,
        "max_drawdown": 8.19,
        "ending_value": 166.2188
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
        "cagr": 1.94,
        "sharpe": 0.2028,
        "max_drawdown": 38.59,
        "ending_value": 106.4288
      },
      "benchmark": {
        "cagr": -15.05,
        "sharpe": -0.561,
        "max_drawdown": 49.14,
        "ending_value": 58.9522
      }
    },
    {
      "key": "bear-gfc",
      "kind": "bear",
      "label": "Global financial crisis",
      "start": "2007-10-01",
      "end": "2009-03-31",
      "strategy": {
        "cagr": -32.57,
        "sharpe": -0.5296,
        "max_drawdown": 56.68,
        "ending_value": 55.4286
      },
      "benchmark": {
        "cagr": -35.92,
        "sharpe": -0.9684,
        "max_drawdown": 56.47,
        "ending_value": 51.3547
      }
    },
    {
      "key": "bear-covid",
      "kind": "bear",
      "label": "COVID crash",
      "start": "2020-02-03",
      "end": "2020-05-29",
      "strategy": {
        "cagr": -31.13,
        "sharpe": -0.3628,
        "max_drawdown": 34.49,
        "ending_value": 88.8281
      },
      "benchmark": {
        "cagr": -21.44,
        "sharpe": -0.1821,
        "max_drawdown": 34.1,
        "ending_value": 92.6229
      }
    },
    {
      "key": "bear-2022",
      "kind": "bear",
      "label": "Rate-hike bear market",
      "start": "2022-01-03",
      "end": "2023-10-31",
      "strategy": {
        "cagr": 3.37,
        "sharpe": 0.2566,
        "max_drawdown": 26.44,
        "ending_value": 106.2294
      },
      "benchmark": {
        "cagr": -7.27,
        "sharpe": -0.2747,
        "max_drawdown": 25.71,
        "ending_value": 87.136
      }
    },
    {
      "key": "bull-2012",
      "kind": "bull",
      "label": "Slow recovery bull",
      "start": "2012-01-03",
      "end": "2015-05-29",
      "strategy": {
        "cagr": 4.2,
        "sharpe": 0.357,
        "max_drawdown": 21.61,
        "ending_value": 115.0327
      },
      "benchmark": {
        "cagr": 16.02,
        "sharpe": 1.3227,
        "max_drawdown": 9.69,
        "ending_value": 165.7466
      }
    },
    {
      "key": "bull-reopening",
      "kind": "bull",
      "label": "Pandemic reopening",
      "start": "2020-06-01",
      "end": "2021-11-30",
      "strategy": {
        "cagr": 0.66,
        "sharpe": 0.13,
        "max_drawdown": 9.05,
        "ending_value": 100.9872
      },
      "benchmark": {
        "cagr": 30.15,
        "sharpe": 1.7903,
        "max_drawdown": 9.8,
        "ending_value": 148.3876
      }
    },
    {
      "key": "bull-ai",
      "kind": "bull",
      "label": "AI-led rally",
      "start": "2023-01-03",
      "end": "2025-06-30",
      "strategy": {
        "cagr": 19.04,
        "sharpe": 1.3988,
        "max_drawdown": 10.66,
        "ending_value": 154.3087
      },
      "benchmark": {
        "cagr": 21.09,
        "sharpe": 1.2718,
        "max_drawdown": 19.0,
        "ending_value": 161.0018
      }
    },
    {
      "key": "bull-2003",
      "kind": "bull",
      "label": "Mid-2000s bull",
      "start": "2003-04-01",
      "end": "2007-07-31",
      "strategy": {
        "cagr": 5.55,
        "sharpe": 0.6122,
        "max_drawdown": 17.55,
        "ending_value": 126.3521
      },
      "benchmark": {
        "cagr": 12.45,
        "sharpe": 1.0853,
        "max_drawdown": 8.19,
        "ending_value": 166.2188
      }
    }
  ]
};
