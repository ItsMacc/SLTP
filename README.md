# SLTP

Backtesting for daily US market data: an `sltp` engine on PyPI, a FastAPI backend on top of it, and a React front end on top of that. It runs on your own machine against a local cache of the price history. No broker account, no data subscription, nothing that reaches a real market.

## What SLTP is

You write a trading rule as a Python class. The engine replays every trading day in a date range, fills the orders your code asks for, and hands back the trades, a daily equity curve and a set of metrics. Your code never sees a price it could not have known that day.

Three parts make up the project:

- `sltp` (from `pip install sltp`) is the engine. A `Strategy` subclass declares a universe and returns `Order` objects; everything else (fills, costs, positions, cash, equity) belongs to the portfolio manager. No engine code lives in this repository.
- `backend/` is a thin FastAPI service over that package: public market-data and backtest routes, plus accounts split across two stores by size. Its endpoints are listed under Run the whole app below.
- `frontend/` is the web app: research charts, the strategy library, portfolio onboarding, and settings. It talks to the backend over HTTP; nothing heavy runs in the browser anymore. The Lab page is there too, with its code workspaces opening soon.

## Run the engine anywhere

You need Python 3.13. The package is pure NumPy, so there is no TA-Lib build step.

```bash
python3.13 -m venv .venv
source .venv/bin/activate
pip install sltp
```

The first data call downloads the needed year files from R2 into `~/.sltp/cache`. Later calls are local.

### Run a backtest

```python
# backtest.py
from sltp import Strategy
from sltp.web import run


class Benchmark(Strategy):
    def __init__(self):
        super().__init__()
        self.name = "Benchmark (SPY)"
        self.TICKER = "SPY"
        self.ALLOCATION = 1.0
        self.MAX_POSITIONS = 1
        self.MAX_LOTS_PER_TICKER = 1

    def initialize_universe(self, current_date, histories):
        self.tickers.clear()
        self.tickers.append(self.TICKER)
        return True


result = run(Benchmark(), start_date="2020-01-01", end_date="2021-12-31")

print(result["stats"]["cagr"])   # 21.57
print(len(result["trades"]))     # 1
```

That is SPY held for the two years: the index goes from 100 to 147.67 with a 34.1% max drawdown. If your numbers match, the data loaded correctly. `run()` returns `stats`, `equity` and `trades`.

### Write your own

```python
# my_strategy.py
from sltp import Order, PositionType, Strategy
from sltp.web import run


class TwoFunds(Strategy):
    def __init__(self):
        super().__init__()
        self.name = "Two funds"
        self.MAX_POSITIONS = 2
        self.add_tickers(["QQQ", "TLT"])

    def on_signal(self, ticker, data):
        if ticker in self.open_tickers:
            return None
        close = float(data.close_price[-1])
        return Order(
            ticker=ticker,
            position_type=PositionType.LONG,
            allocation=0.45,
            order_date=str(data.dates[-1]),
            stop_loss=close * 0.95,
            take_profit=close * 1.10,
        )


result = run(TwoFunds(), start_date="2015-01-01", end_date="2024-12-31")
print(result["stats"])
```

`stop_loss` and `take_profit` are prices, not percentages. `allocation` is a fraction of equity by default.

## Run the whole app (optional)

The web app needs accounts and saved data, so it needs both databases. The public routes (`/api/strategies`, `/api/backtest/run`, `/api/stock/*`) only read the market cache and work without either, so the engine path above needs nothing else.

One Python env lives at the repository root; every backend command below assumes it. Copy the template and fill in what you use:

```bash
cp .env.example .env   # every variable the backend reads, with comments
python3.13 -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt

cd backend && ../.venv/bin/uvicorn app.main:app --reload   # API on :8000
cd frontend && npm ci && npm run dev                        # web app on :5173
```

Paste `backend/schema.sql` once into the Supabase dashboard (SQL Editor). Reads degrade to empty until then; writes need the tables.

The front end talks to `http://localhost:8000` by default; set `VITE_API_BASE_URL` to point it elsewhere. Mail is off unless you also set `SENDER_EMAIL` and `APP_PASSWORD`.

### Backend endpoints

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
| GET/PUT | `/api/user/watchlist` | Tracked symbols |
| GET/POST/DELETE | `/api/lab/strategies...` | Cloud copies of Lab code |
| GET/POST/DELETE | `/api/backtest/results...` | Cached runs, reopen without rerunning |

First data call downloads the needed year files from R2 into `~/.sltp/cache`. Later calls are local. Open http://127.0.0.1:8000/docs to try every endpoint.

### Backend scripts (all run from `backend/`)

```bash
../.venv/bin/python scripts/operator_report.py              # print today's brief
../.venv/bin/python scripts/operator_report.py --send       # mail it to the operator
../.venv/bin/python scripts/daily_r2_update.py              # nightly R2 tail top-up (cron)
../.venv/bin/python scripts/daily_r2_update.py --fold-year 2026  # yearly: fold the tail's old year into its year file
../.venv/bin/python scripts/r2_usage.py                     # this month's Class A/B op counts
```

`scripts/r2.py` is shared plumbing the jobs import (repo-root `.env`, SigV4-signed R2 transport) — not a job itself. The nightly updater mails the operator through `backend/app/notify/mailer.py` if it crashes; that file is the only place in the codebase that sends mail. Two one-off repairs live alongside the jobs until they have run once against working R2 keys, then get deleted: `backfill_missing_once.py` (bars pass, then `--actions-only` payouts pass) and `restamp_manifest.py`.

## Tech stack

**Engine.** The `sltp` package owns the math: the backtester walks the trading calendar one session at a time and the portfolio manager keeps the book. The rules that matter:

- Orders and signal exits fill at the next session's open, never at the close that produced the signal.
- Slippage is 0.05% against the position on every fill and the fee is 0.1% of notional per side. They are applied for you.
- `turnover` is annualized two-way traded notional divided by average equity. `cost_drag` is annualized fees plus slippage as a share of average equity, and `total_trading_cost` is the cumulative bill in index points. Slippage is already inside the fill prices, so these are reporting measures, not extra deductions.
- Stops are checked before targets, against the day's high and low, so a bar that touches both takes the stop. A gap through a level fills at the open, not at the level.
- Equity is an index that starts at 100. Position sizing is a fraction of that equity by default. Short exposure is not cash funded.
- Rejections are counted by reason instead of raising: too many positions, too many lots on one ticker, an allocation over `MAX_ALLOCATION_PER_TICKER`, no cash left, or a missing bar.
- Callbacks receive arrays sliced to the current day, which is how lookahead is prevented at the source rather than by convention.

A `Strategy` overrides `initialize_universe`, `on_signal`, `on_rebalance`, `should_exit` and `run_daily`, and exposes `_sma`, `_ema`, `_rsi`, `_macd`, `_atr`, `_adx` and the rest of the indicator set, plus exit helpers such as `_time_stop_days`, `_trailing_stop` and `_atr_stop`. Constraints are class attributes: `MAX_POSITIONS`, `MAX_LOTS_PER_TICKER`, `MAX_ALLOCATION_PER_TICKER`, `REBALANCE_FREQUENCY`, `MIN_BARS_REQUIRED`, `LIQUIDATE_ON_END`. Because a strategy's warmup can push its start date past the one you asked for, the engine probes forward up to 1,826 calendar days before it gives up.

**Market data.** The `sltp` package serves daily bars from 1998 over US listings, fetched one file per calendar year from R2 into `~/.sltp/cache` (plus a small recent tail) and reloaded when the files change, so a long-running API picks up fresh bars without a restart. The tradable directory keeps symbols that later stopped trading, so a backtest does not quietly pick today's survivors.

**API and auth.** FastAPI with routers for users, portfolios, the Lab, API keys and account deletion. Protected routes depend on `get_current_user`, which verifies the Supabase session token against the project's JWKS endpoint (ES256) and falls back to the legacy HS256 secret. Every query is scoped by the user id from that token, never the request body.

**Storage.** Supabase owns identity and the small rows: the profile row with settings, and the churn log. Turso (libsql over HTTP) holds everything bulky, keyed by the Supabase uid: portfolios, API keys and tiers, watchlists, Lab strategies, and cached backtest results. `backend/schema.sql` is create-only: it is for a fresh project, not for upgrading one.

**Front end.** React 19 and TypeScript on Vite 8, with plain CSS built on the design tokens in `frontend/src/index.css`. Pages use plain `fetch` through `frontend/lib/api.ts` against the API base URL; Supabase in the browser is only the auth client. TanStack Query backs the Lab editor's cached reads. The Lab runs Monaco with a Pyright language server (`monaco-pyright-lsp`), so the editor reports type errors without a Python process — the workspace panels are live, but opening code stays disabled until the server file APIs land. The interactive tours use driver.js against the live pages.

**Scheduled jobs.** `backend/scripts/operator_report.py` prints (or with `--send`, mails) a daily brief of signups and usage, recording what it sent under `~/.sltp` so a rerun stays quiet. `backend/scripts/daily_r2_update.py` tops up the R2 tail file nightly (plus a `--fold-year` run each January to fold the old year into its year file) and mails the operator if it crashes. `backend/app/notify/mailer.py` is the only module that sends mail: the operator brief and crash alerts plus the account mail (login security notices and notifications).

## Repository layout

```
backend/
  app/             FastAPI app: market routes, users, Turso, auth, notify
  strategies/      plain sltp strategies the /api/backtest/run ids map to
  schema.sql       create-only Supabase schema (paste once into SQL Editor)
  scripts/         nightly R2 update, operator brief, usage readout, one-off repairs
frontend/
  src/             pages, components, ui primitives, engine HTTP client
  lib/             API client, Supabase auth client, session, settings
  scripts/         docs checker (npm run check-docs)
.venv/             local Python env (gitignored)
.env               secrets (gitignored)
LICENSE
```

## Limits

This is a research tool. It does not connect to a broker, hold positions or place orders, and it has no path to live trading. Backtest results are hypothetical: fills assume the open, costs are fixed at the rates above, and dividends are recorded but not paid into a position. There are no automated tests and no CI pipeline.

## Credits

sltp, FastAPI, Turso, Supabase, React, Vite, Monaco, driver.js.
