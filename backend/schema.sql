-- ============================================================
-- SLTP — Supabase schema (app tables)
-- ============================================================
-- Paste this ONCE into the Supabase dashboard: SQL Editor -> New query.
-- Everything is IF NOT EXISTS, so re-running it is safe.
--
-- The users table already exists (Supabase Auth profile mirror with a
-- settings jsonb column). This file adds the ONE table the API keeps in
-- Supabase:
--
--   account_deletions churn log: the only trace left after erasure
--
-- Portfolios, API keys and everything bulky live in Turso
-- (backend/app/turso/schema.sql), keyed by the Supabase uid. There are
-- deliberately no portfolios or api_keys tables here: an older revision
-- of this file created them, and keeping them invites writing user data
-- to the wrong store. If your project still has those empty tables from
-- the old version, leaving them is harmless — nothing reads them.
--
-- Row Level Security is enabled with default-deny. The backend uses the
-- service role (which bypasses RLS).
-- ============================================================


-- -------- Account deletions (churn log; insert-only) --------
CREATE TABLE IF NOT EXISTS account_deletions (
  user_id uuid NOT NULL PRIMARY KEY,
  email text,
  name text,
  deleted_at timestamptz NOT NULL DEFAULT now()
);


-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE account_deletions ENABLE ROW LEVEL SECURITY;

-- The churn log is backend-only: no client access at all.
