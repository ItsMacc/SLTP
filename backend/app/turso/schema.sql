-- Turso app-data schema (applied 2026-11-06 via the Hrana HTTP endpoint).
--
-- Supabase owns identity: auth.users, the public.users profile row and the
-- account_deletions churn log. Everything here is keyed by the Supabase auth
-- uid in a TEXT user_id column, so a row always traces to exactly one login.
-- These tables hold the bulky state Supabase's 1GB cap should not carry:
-- wizard answers, key hashes, watchlists, Lab source code and cached
-- backtest runs (equity curves and trade lists live here so a result can be
-- reopened without rerunning anything).

CREATE TABLE IF NOT EXISTS portfolios (
  user_id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'My Portfolio',
  starting_cash REAL NOT NULL DEFAULT 0,
  base_currency TEXT NOT NULL DEFAULT 'USD',
  preferences TEXT NOT NULL DEFAULT '{}',
  onboarded INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  tier TEXT NOT NULL DEFAULT 'free',
  created_at TEXT NOT NULL,
  last_used_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);

CREATE TABLE IF NOT EXISTS watchlists (
  user_id TEXT PRIMARY KEY,
  items TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS user_strategies (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_strategies_user ON user_strategies(user_id);

CREATE TABLE IF NOT EXISTS backtest_results (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  strategy_ref TEXT NOT NULL DEFAULT '',
  params TEXT NOT NULL DEFAULT '{}',
  metrics TEXT NOT NULL DEFAULT '{}',
  equity TEXT NOT NULL DEFAULT '[]',
  trades TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_results_user ON backtest_results(user_id);
