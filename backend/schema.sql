-- ============================================================
-- SLTP — Supabase schema (app tables)
-- ============================================================
-- Paste this ONCE into the Supabase dashboard: SQL Editor -> New query.
-- Everything is IF NOT EXISTS, so re-running it is safe.
--
-- The users table already exists (Supabase Auth profile mirror with a
-- settings jsonb column). This file adds the three tables the API needs:
--
--   portfolios        one row per user: wizard answers, onboarded flag
--   api_keys          personal keys: only the SHA-256 hash is stored
--   account_deletions churn log: the only trace left after erasure
--
-- Row Level Security is enabled with owner-only policies. The backend uses
-- the service role (which bypasses RLS); the policies below are for any
-- future frontend-direct reads and default-deny everything else.
-- ============================================================


-- -------- Portfolios (one per user; setup wizard answers) --------
CREATE TABLE IF NOT EXISTS portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'My Portfolio',
  base_currency text NOT NULL DEFAULT 'USD',
  starting_cash double precision NOT NULL DEFAULT 10000,
  preferences jsonb NOT NULL DEFAULT '{}',
  onboarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portfolios_user ON portfolios(user_id);


-- -------- API keys (personal keys; hashes only) --------
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);


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
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_deletions ENABLE ROW LEVEL SECURITY;

-- Owners read and write their own rows; nobody else reads anything.
DROP POLICY IF EXISTS "owners manage own portfolio" ON portfolios;
CREATE POLICY "owners manage own portfolio" ON portfolios
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "owners manage own api keys" ON api_keys;
CREATE POLICY "owners manage own api keys" ON api_keys
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- The churn log is backend-only: no client access at all.
