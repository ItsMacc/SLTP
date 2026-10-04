-- ============================================================
-- SLTP — Turso schema (bootstrap)
--
-- ONE file, built for a fresh database. Only two tables exist now:
--
--   users      — mirror of Supabase auth (name, email, settings_json)
--   portfolios — setup wizard answers (onboarding)
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
--   Turso    — users + portfolios only. Written by the API and the
--               nightly runner, read through app/database/turso.py.
--
-- The `users` table here is a MIRROR of Supabase auth, not a second source
-- of truth. Two writable copies of the same row is how drift bugs start.
--
-- Previous iterations also stored signals, strategy_follows, positions,
-- portfolio_snapshots, watchlist_items and cash_flows here. All of that is
-- gone: the DROP statements below clean the old tables off an existing
-- database so nothing lingers.
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


-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_portfolios_user ON portfolios(user_id);
