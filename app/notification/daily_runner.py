# daily_runner.py — The nightly pipeline, run after market close.
#
# Sequence:
#   1. Update the parquet market data (yfinance -> master parquet).
#   2. Refresh the Turso users cache from Supabase.
#   3. Determine the latest trading date from liquid reference tickers.
#   4. For each followed strategy (across ALL users), run it over its
#      universe at that date and collect signals. Strategies are run once
#      per day and shared by every user that follows them.
#   5. Per user: send ONE signals digest email with all of today's signals
#      (only if they want notifications AND there is at least one signal).
#
# Notification booleans come from users.settings (Supabase mirror);
# followed strategies come from portfolios.preferences_json.

# -------- Imports --------