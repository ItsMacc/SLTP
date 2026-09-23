-- ============================================================
-- SLTP — Minimal Turso schema
--
-- 3 tables:
--   users      — mirror of Supabase auth users (email + settings)
--   portfolios — one per user; setup wizard answers live in preferences_json
--   signals    — strategy-level BUY/SELL/HOLD outputs, written by the daily
--                runner. Shared across users (not per-user); the Invest tab
--                reads the strategies each user follows.
--
-- Everything else (watchlist, tracking, universes) will be rebuilt later.
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                 -- Supabase auth UID
  name TEXT,
  email TEXT,
  settings_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

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

CREATE TABLE IF NOT EXISTS signals (
  id TEXT PRIMARY KEY,
  strategy_id TEXT NOT NULL,           -- e.g. 'stock-health-filter'
  ticker TEXT NOT NULL,
  signal_type TEXT NOT NULL,           -- BUY | SELL | HOLD
  confidence REAL,                     -- 0..1
  price REAL,                          -- close price at signal time
  signal_date TEXT NOT NULL,           -- YYYY-MM-DD (trading date)
  created_at TEXT NOT NULL
);

-- ============================================================
-- Drop everything else
-- ============================================================
DROP TABLE IF EXISTS cash_flows;
DROP TABLE IF EXISTS positions;
DROP TABLE IF EXISTS portfolio_snapshots;
DROP TABLE IF EXISTS strategy_universes;
DROP TABLE IF EXISTS strategy_follows;
DROP TABLE IF EXISTS watchlist_items;

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_signals_strategy_date ON signals(strategy_id, signal_date);
CREATE INDEX IF NOT EXISTS idx_signals_ticker_date ON signals(ticker, signal_date);
