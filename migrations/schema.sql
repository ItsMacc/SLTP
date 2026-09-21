-- ============================================================
-- SLTP — Simplified Turso schema
--
-- 6 tables:
--   users              — mirror of Supabase auth users (email + settings)
--   portfolios         — one per user; wizard answers live in preferences_json
--   watchlist_items    — the user's tickers (universe + personal adds)
--   strategy_follows   — strategies the user follows
--   strategy_universes — per user+strategy universe state (init date, rebalance schedule)
--   signals            — daily runner output
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

CREATE TABLE IF NOT EXISTS watchlist_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  ticker TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS strategy_follows (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  strategy_name TEXT,
  notify_email INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS strategy_universes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  tickers_json TEXT NOT NULL DEFAULT '[]',  -- strategy's OWN universe
  initialized_date TEXT NOT NULL,           -- YYYY-MM-DD the universe was computed on
  rebalance_frequency TEXT NOT NULL,        -- daily | weekly | monthly | quarterly | yearly | never
  last_rebalance_date TEXT,                 -- YYYY-MM-DD, NULL until first rebalance
  next_rebalance_date TEXT,                 -- YYYY-MM-DD, precomputed for the runner
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS signals (
  id TEXT PRIMARY KEY,
  strategy_id TEXT NOT NULL,
  ticker TEXT NOT NULL,
  signal_type TEXT NOT NULL,           -- BUY | SELL | HOLD
  confidence REAL,
  price REAL,
  signal_date TEXT NOT NULL,           -- YYYY-MM-DD
  created_at TEXT NOT NULL
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS uq_watchlist_user_ticker ON watchlist_items(user_id, ticker);
CREATE UNIQUE INDEX IF NOT EXISTS uq_follows_user_strategy ON strategy_follows(user_id, strategy_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_universe_user_strategy ON strategy_universes(user_id, strategy_id);
CREATE INDEX IF NOT EXISTS idx_signals_strategy_date ON signals(strategy_id, signal_date);
