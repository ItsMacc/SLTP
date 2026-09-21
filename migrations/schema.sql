-- ============================================================
-- SLTP — Minimal Turso schema
--
-- 2 tables only:
--   users      — mirror of Supabase auth users (email + settings)
--   portfolios — one per user; setup wizard answers live in preferences_json
--
-- Everything else (watchlist, strategies, signals, tracking) was removed —
-- it will be rebuilt from scratch.
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

-- ============================================================
-- Drop everything else
-- ============================================================
DROP TABLE IF EXISTS cash_flows;
DROP TABLE IF EXISTS positions;
DROP TABLE IF EXISTS portfolio_snapshots;
DROP TABLE IF EXISTS strategy_universes;
DROP TABLE IF EXISTS signals;
DROP TABLE IF EXISTS strategy_follows;
DROP TABLE IF EXISTS watchlist_items;
