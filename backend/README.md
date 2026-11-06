# SLTP backend

Thin HTTP over `pip install sltp`. No engine code lives here.

## Run

```bash
/Library/Frameworks/Python.framework/Versions/3.13/bin/python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
cd backend && ../.venv/bin/uvicorn app.main:app --reload
```

Open http://127.0.0.1:8000/docs to try every endpoint.

## Endpoints

| Method | Path | What it does |
|---|---|---|
| GET | `/api/strategies` | Prebuilt strategies the API can run |
| GET | `/api/stock/ticker-details` | Tradable ticker directory |
| GET | `/api/stock/history?ticker=SPY&timeframe=1y` | OHLCV bars (`1y`, `2y`, `5y`, `all`) |
| GET | `/api/backtest/run?strategy_id=buy-and-hold&start_date=2020-01-02&end_date=2020-12-31` | Metrics, equity curve, trades |

First data call downloads the needed chunks from R2 into `~/.sltp/cache`.
Later calls are local.
