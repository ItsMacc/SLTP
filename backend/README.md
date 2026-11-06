# SLTP backend

Thin HTTP over `pip install sltp` for market data, plus Supabase-only
accounts. No engine code lives here, and there is exactly one database.

## Run

```bash
/Library/Frameworks/Python.framework/Versions/3.13/bin/python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
cd backend && ../.venv/bin/uvicorn app.main:app --reload
```

Open http://127.0.0.1:8000/docs to try every endpoint.

## One-time setup

Paste `backend/schema.sql` once into the Supabase dashboard (SQL Editor).
Reads degrade to empty until then; writes need the tables.

## Endpoints

| Method | Path | What it does |
|---|---|---|
| GET | `/api/strategies` | Prebuilt strategies the API can run |
| GET | `/api/stock/ticker-details` | Tradable ticker directory |
| GET | `/api/stock/all-tickers` | Sorted ticker symbols |
| GET | `/api/stock/history?ticker=SPY&timeframe=1y` | OHLCV bars (`1y`, `2y`, `5y`, `all`) |
| GET | `/api/backtest/run?strategy_id=buy-and-hold&start_date=2020-01-02&end_date=2020-12-31` | Metrics, equity curve, trades |
| POST | `/api/user/provision` | Create the profile row on login (idempotent) |
| GET/POST | `/api/user/settings`, `/api/user/sync-settings` | Load / save settings |
| GET/POST | `/api/portfolio/status`, `/api/portfolio/complete-setup` | Onboarding state / wizard answers |
| GET/POST/DELETE | `/api/user/api-keys...` | Personal API keys (hashes only) |
| POST | `/api/user/login-event` | Record sign-in device (IP hash only) |
| DELETE | `/api/user/account` | Full erasure: auth, profile, portfolios, keys |

First data call downloads the needed chunks from R2 into `~/.sltp/cache`.
Later calls are local.

## Operator brief

```bash
cd backend
../.venv/bin/python scripts/operator_report.py            # print today's brief
../.venv/bin/python scripts/operator_report.py --send     # mail it to the operator
```

Sent state lives in `~/.sltp/operator_report_sent`, so a rerun on the same
day stays quiet unless `--force` is passed.
