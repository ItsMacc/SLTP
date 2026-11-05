# SLTP

A backtesting engine for daily US market data, with a FastAPI service and a React front end built on top of it. It runs on your own machine against a local copy of the price history. No broker account, no data subscription, nothing that reaches a real market.

## What SLTP is

You write a trading rule as a Python class. The engine replays every trading day in a date range, fills the orders your code asks for, and hands back the trades, a daily equity curve and a set of metrics. Your code never sees a price it could not have known that day.

Four parts make up the repository:

- `app/engine/` is the engine. A `Strategy` subclass declares a universe and returns `Order` objects; everything else (fills, costs, positions, cash, equity) belongs to the portfolio manager.
- `app/main.py` is the HTTP layer. It exposes the strategy registry, a backtest runner and price history over FastAPI.
- `frontend/` is the web app: research charts, the strategy library, a portfolio view, and the docs.
- The Lab is the browser editor, served by the same front end. It edits Python in Monaco, type-checks it in the browser, and runs the saved file through the same engine.

## Run the engine on your laptop

You need Python 3.13 and a C build of TA-Lib, because the indicator layer binds to it. On macOS that is `brew install ta-lib`; on Debian and Ubuntu the library is usually built from source before `pip install`.

```bash
git clone <your-fork-url> sltp
cd sltp

python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Download the market data

```bash
python -m app.database.market.market_data init
```

This pulls daily bars for roughly 11,500 symbols from Yahoo and writes `app/database/market/market_data.parquet` (about 400 MB). It takes 30 to 45 minutes and resumes from the last finished chunk if you stop it. No credentials are involved.

```bash
python -m app.database.market.market_data update   # newest bars, safe to run daily
python -m app.database.market.market_data status   # what each symbol is holding
```

### Run a backtest

```python
# backtest.py
from app.engine.backtesting import Backtester
from app.strategies import Benchmark

result = Backtester(Benchmark(), start_date="2020-01-01", end_date="2021-12-31").run()

print(result["metrics"]["cagr"])   # 21.57
print(len(result["trades"]))       # 1
```

```bash
python backtest.py
```

That is SPY held for the two years: the index goes from 100 to 147.67 with a 34.1% max drawdown. If your numbers match, the data loaded correctly. `run()` returns four keys: `metrics`, `equity`, `trades` and `rejections`.

### Write your own

```python
# my_strategy.py
from app.engine.backtesting import Backtester
from app.engine.strategy import Strategy
from app.engine.utils.Order import Order
from app.engine.utils.PositionType import PositionType


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


result = Backtester(TwoFunds(), start_date="2015-01-01", end_date="2024-12-31").run()
print(result["metrics"])
```

`stop_loss` and `take_profit` are prices, not percentages. `allocation` is a fraction of equity by default; set `sizing=OrderSizing.FIXED` to read it as index points, or `OrderSizing.AVAILABLE` to cap a fraction at uninvested cash.

## Run the whole app (optional)

The web app needs accounts and saved projects, so it also needs a database. The public routes (`/api/strategies`, `/api/backtest/run`, `/api/stock/*`) read the parquet files and work without one, so the engine path above needs nothing else.

Create `.env` at the repository root:

```env
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE=<service-role-key>
TURSO_DATABASE_URL=libsql://<your-database>.turso.io
TURSO_AUTH_TOKEN=<token>

# Only for older projects that still sign sessions with the HS256 secret.
SUPABASE_JWT=
```

Then create the schema once, and start both halves:

```bash
turso db shell <your-db> < migrations/migrations.sql

uvicorn app.main:app --reload --port 8000        # API
cd frontend && npm ci && npm run dev             # web app on :5173
```

The front end talks to `http://localhost:8000` by default; set `VITE_API_BASE_URL` to point it elsewhere. Mail is off unless you also set `SENDER_EMAIL` and `APP_PASSWORD`.

## Tech stack

**Engine.** `app/engine/backtesting/backtester.py` walks the trading calendar one session at a time and `app/engine/portfolio/portfolio_manager.py` keeps the book. The rules that matter:

- Orders and signal exits fill at the next session's open, never at the close that produced the signal.
- Slippage is 0.05% against the position on every fill and the fee is 0.1% of notional per side. They are applied for you.
- `turnover` is annualized two-way traded notional divided by average equity. `cost_drag` is annualized fees plus slippage as a share of average equity, and `total_trading_cost` is the cumulative bill in index points. Slippage is already inside the fill prices, so these are reporting measures, not extra deductions.
- Stops are checked before targets, against the day's high and low, so a bar that touches both takes the stop. A gap through a level fills at the open, not at the level.
- Equity is an index that starts at 100. Position sizing is a fraction of that equity by default; `OrderSizing.FIXED` reads the same field as index points, and `OrderSizing.AVAILABLE` caps it at cash. Short exposure is not cash funded.
- Rejections are counted by reason instead of raising: too many positions, too many lots on one ticker, an allocation over `MAX_ALLOCATION_PER_TICKER`, no cash left, or a missing bar.
- Callbacks receive arrays sliced to the current day, which is how lookahead is prevented at the source rather than by convention.

A `Strategy` overrides `initialize_universe`, `on_signal`, `on_rebalance`, `should_exit` and `run_daily`, and exposes `_sma`, `_ema`, `_rsi`, `_macd`, `_atr`, `_adx` and the rest of the indicator set, plus exit helpers such as `_time_stop_days`, `_trailing_stop` and `_atr_stop`. Constraints are class attributes: `MAX_POSITIONS`, `MAX_LOTS_PER_TICKER`, `MAX_ALLOCATION_PER_TICKER`, `REBALANCE_FREQUENCY`, `MIN_BARS_REQUIRED`, `LIQUIDATE_ON_END`. Because a strategy's warmup can push its start date past the one you asked for, the engine probes forward up to 1,826 calendar days before it gives up.

**Market data.** `app/database/market/` keeps three parquet files: the master (about 30 million bars), a tail file with bars added since the last compaction, and an actions file with every split and dividend the download carried. The service layer caches each file by modification time, so a long-running API reloads once when a file changes instead of on every call. Universes come from `symbols.parquet` (symbol, name, category) and from the bar files, which keep symbols that later stopped trading, so a backtest does not quietly pick today's survivors. A split restates a symbol's whole history at the source, so an update refetches that symbol entirely rather than appending to bars that sit at the old prices.

**API and auth.** FastAPI with routers for users, portfolios, the Lab, API keys and account deletion. Protected routes depend on `get_current_user`, which verifies the Supabase session token against the project's JWKS endpoint (ES256) and falls back to the legacy HS256 secret. Turso queries are always scoped by the user id from that token.

**Storage.** Turso (libsql) holds user rows, portfolios, Lab workspaces, projects and files, and the bookkeeping tables that stop a digest or an ops report from sending twice. `migrations/migrations.sql` creates the schema and is create-only: it is for a fresh database, not for upgrading one. Supabase owns identity; the browser uses the anon key, and row-level security is the boundary.

**Front end.** React 19 and TypeScript on Vite 8, with plain CSS built on the design tokens in `frontend/src/index.css`. TanStack Query backs the Lab editor's cached reads; the other pages use plain `fetch` against the API base URL. The Lab runs Monaco with a Pyright language server compiled to the browser (`monaco-pyright-lsp`), so the editor reports type errors without a Python process. The interactive tours use driver.js against the live pages.

**Scheduled jobs.** `python -m app.notification.daily_runner` refreshes prices, audits stored splits, syncs settings and sends signal digests. `python -m app.notification.usage_report` emails a summary of signups and usage. Both record what they sent in Turso so a rerun stays quiet.

## Repository layout

```
app/
  engine/          backtester, portfolio manager, Strategy base class, utils
  database/        market data, Turso access, users, portfolio, Lab
  api/             request/response helpers for the market routes
  auth/            JWT verification, login device records
  notification/    nightly runner, ops report, mail
  main.py          FastAPI app and public routes
frontend/
  src/             pages, components, ui primitives, docs
  lib/             API client, Supabase client, settings
  scripts/         docs checker
migrations/        create-only SQL schema
requirements.txt
```

The bar files, `.env` and `frontend/dist` are gitignored. The data has to be downloaded on each machine that runs a backtest.

## Limits

This is a research tool. It does not connect to a broker, hold positions or place orders, and it has no path to live trading. Backtest results are hypothetical: fills assume the open, costs are fixed at the rates above, and dividends are recorded but not paid into a position. Data starts in 1998 and covers US listings, so results outside that window are not available. `app/database/tests/test_market_service.py` is the only automated test, and there is no CI pipeline.

## Credits

FastAPI, pandas, pyarrow, Turso, Supabase, React, Vite, Monaco, driver.js.
