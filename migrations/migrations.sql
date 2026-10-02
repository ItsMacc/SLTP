-- ============================================================
-- SLTP — Full Turso schema (bootstrap)
--
-- ONE file, built for a fresh database. Every table is created here,
-- including the portfolio tables, so a new environment only needs this
-- script run once.
--
-- IMPORTANT — this script DROPS every table before recreating it. That is
-- deliberate for now (no real users yet) and destroys all data in the
-- target database. Once real data exists, replace this with numbered,
-- additive migrations and never run it again against production.
--
-- ============================================================
-- Where things live
--   Supabase — auth, plus users.settings_json for notification toggles
--               and UI preferences. The frontend reads it directly.
--   Turso    — everything portfolio-shaped. Written by the API and the
--               nightly runner, read through app/database/turso.py.
--
-- The `users` table here is a MIRROR of Supabase auth, not a second source
-- of truth. Two writable copies of the same row is how drift bugs start.
--
-- NOTHING IN THIS SCHEMA IS REAL MONEY.
-- SLTP is a research platform: it holds no assets, executes no orders and
-- places no trades. Positions and snapshots are SIMULATED output derived
-- from strategy signals and the local parquet market data. They must never
-- be presented as brokerage, custody or transaction records.
--
-- How a position was created is recorded twice, on purpose:
--
--   source       'strategy' -> came from a strategy signal; strategy_id
--                              names the strategy that produced it
--                'manual'   -> the user opened it by hand after their own
--                              research, with no strategy involved
--                              (strategy_id is NULL)
--
-- Filter on `source`, not on whether strategy_id is NULL. strategy_id stays
-- nullable because SQLite treats NULLs as distinct in unique indexes, so the
-- uniqueness rules below need it to tell "no strategy" from "this strategy".
--
-- Both kinds live in one table so a user's whole book reads in one query.
-- ============================================================


-- ============================================================
-- Drop everything (destructive — see the warning at the top)
-- ============================================================
DROP TABLE IF EXISTS cash_flows;
DROP TABLE IF EXISTS watchlist_items;
DROP TABLE IF EXISTS portfolio_snapshots;
DROP TABLE IF EXISTS positions;
DROP TABLE IF EXISTS strategy_follows;
DROP TABLE IF EXISTS signals;
DROP TABLE IF EXISTS portfolios;
DROP TABLE IF EXISTS users;

-- Legacy tables from earlier iterations, in case an old database still has
-- them. No longer part of the design.
DROP TABLE IF EXISTS cash_flows_legacy;
DROP TABLE IF EXISTS portfolio_snapshots_legacy;
DROP TABLE IF EXISTS strategy_universes;
DROP TABLE IF EXISTS strategy_follows_legacy;
DROP TABLE IF EXISTS watchlist_items_legacy;


-- ============================================================
-- Core tables
-- ============================================================

-- -------- Users (mirror of Supabase auth) --------
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                 -- Supabase auth UID
  name TEXT,
  email TEXT,
  settings_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

-- -------- Portfolios (one per user; setup wizard answers) --------
CREATE TABLE IF NOT EXISTS portfolios (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,        -- Supabase auth UID
  name TEXT NOT NULL DEFAULT 'My Portfolio',
  base_currency TEXT NOT NULL DEFAULT 'USD',
  starting_cash REAL NOT NULL DEFAULT 10000,
  preferences_json TEXT,               -- setup wizard answers
  onboarded INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- -------- Signals (strategy outputs, shared across users) --------
-- Strategy level, not user level: the runner runs each followed strategy
-- once per session and every user following it reads the same rows.
CREATE TABLE IF NOT EXISTS signals (
  id TEXT PRIMARY KEY,
  strategy_id TEXT NOT NULL,           -- e.g. 'buy-and-hold'
  ticker TEXT NOT NULL,
  signal_type TEXT NOT NULL,           -- BUY | SELL | HOLD
  confidence REAL,                     -- 0..1
  price REAL,                          -- close price at signal time
  signal_date TEXT NOT NULL,           -- YYYY-MM-DD (trading date)
  created_at TEXT NOT NULL
);


-- ============================================================
-- Portfolio tables
-- ============================================================

-- -------- Strategy follows --------
-- Which strategies a user follows. This replaces the followedStrategies
-- array that used to live inside portfolios.preferences_json, which could
-- not be queried or indexed.
CREATE TABLE IF NOT EXISTS strategy_follows (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,               -- Supabase auth UID
  strategy_id TEXT NOT NULL,           -- e.g. 'buy-and-hold'
  created_at TEXT NOT NULL
);

-- -------- Positions (simulated holdings) --------
CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,               -- always the owner
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('strategy', 'manual')),
                                      -- the column to filter on
  strategy_id TEXT,                    -- set when source = 'strategy'
  ticker TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'  -- open | closed
    CHECK (status IN ('open', 'closed')),
  shares REAL NOT NULL,
  entry_price REAL NOT NULL,
  entry_date TEXT NOT NULL,            -- YYYY-MM-DD
  stop_loss REAL,
  take_profit REAL,
  exit_price REAL,
  exit_date TEXT,                      -- YYYY-MM-DD
  realized_return_pct REAL,
  transaction_cost REAL NOT NULL DEFAULT 0,
  signal_id TEXT,                      -- provenance for strategy rows
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- -------- Portfolio snapshots (simulated daily equity) --------
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('strategy', 'manual')),
  strategy_id TEXT,                    -- set when source = 'strategy'
  snapshot_date TEXT NOT NULL,         -- YYYY-MM-DD
  portfolio_value REAL NOT NULL,
  active_positions INTEGER NOT NULL DEFAULT 0,
  transaction_cost REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- -------- Watchlist --------
CREATE TABLE IF NOT EXISTS watchlist_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  ticker TEXT NOT NULL,
  note TEXT,
  added_at TEXT NOT NULL
);

-- -------- Cash flows (simulated deposits / withdrawals) --------
CREATE TABLE IF NOT EXISTS cash_flows (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  amount REAL NOT NULL,                -- always positive; kind gives direction
  kind TEXT NOT NULL DEFAULT 'deposit' -- deposit | withdrawal
    CHECK (kind IN ('deposit', 'withdrawal')),
  occurred_at TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);


-- ============================================================
-- Indexes
-- ============================================================

-- -------- Users / portfolios --------
CREATE INDEX IF NOT EXISTS idx_portfolios_user ON portfolios(user_id);

-- -------- Signals --------
CREATE INDEX IF NOT EXISTS idx_signals_strategy_date ON signals(strategy_id, signal_date);
CREATE INDEX IF NOT EXISTS idx_signals_ticker_date ON signals(ticker, signal_date);

-- -------- Follows --------
CREATE UNIQUE INDEX IF NOT EXISTS idx_follows_unique
  ON strategy_follows(user_id, strategy_id);
CREATE INDEX IF NOT EXISTS idx_follows_strategy
  ON strategy_follows(strategy_id);

-- -------- Positions --------
-- At most ONE open position per (user, source, strategy, ticker). Two
-- strategies may hold the same ticker, and a discretionary row coexists with
-- strategy rows for that ticker.
--
-- ifnull() is required: SQLite treats NULLs as distinct in unique indexes, so
-- a plain UNIQUE(user_id, strategy_id, ticker) would not constrain manual
-- rows at all and every hand-entered position would slip through.
CREATE UNIQUE INDEX IF NOT EXISTS idx_positions_one_open
  ON positions(user_id, source, ifnull(strategy_id, ''), ticker)
  WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_positions_user_status
  ON positions(user_id, status);
-- Supports "my manual entries" / "what the strategies did" without a scan.
CREATE INDEX IF NOT EXISTS idx_positions_user_source
  ON positions(user_id, source, status);
CREATE INDEX IF NOT EXISTS idx_positions_ticker
  ON positions(ticker);

-- -------- Snapshots --------
-- Same ifnull() reasoning: a manual series is a legitimate "whole book"
-- series and must stay unique per day alongside the per-strategy series.
CREATE UNIQUE INDEX IF NOT EXISTS idx_snapshots_unique
  ON portfolio_snapshots(user_id, source, ifnull(strategy_id, ''), snapshot_date);
CREATE INDEX IF NOT EXISTS idx_snapshots_user_date
  ON portfolio_snapshots(user_id, snapshot_date);

-- -------- Watchlist --------
CREATE UNIQUE INDEX IF NOT EXISTS idx_watchlist_unique
  ON watchlist_items(user_id, ticker);

-- -------- Cash flows --------
CREATE INDEX IF NOT EXISTS idx_cashflows_user_date
  ON cash_flows(user_id, occurred_at);
