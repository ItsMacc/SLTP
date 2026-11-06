# Turso holds the bulky per-user app data: portfolios, API keys, watchlists,
# Lab strategies and cached backtest results. Everything is keyed by the
# Supabase auth uid (a TEXT column), so the two stores always agree on who
# a row belongs to. Supabase keeps auth, the small profile row and the churn
# log; Turso keeps everything big.
