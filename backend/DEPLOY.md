# Deploy ($0 forever)

Accounts needed: **GitHub** (have it) + **Render** (one signup). Nothing else.
No Docker Hub, no Google, no GitHub Secrets, no CLI.

## 1. Create the service (10 minutes, once)

1. Render dashboard -> New -> **Blueprint** -> select `ItsMacc/SLTP`.
   It reads `render.yaml` at the repo root: Docker build, free plan,
   auto-deploy on.
2. When prompted, enter the 4 backend values (same ones as local `.env`):
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE`,
   `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`.
3. Create. The first build takes ~10 minutes: it downloads the 400MB of
   bars from R2 (public, free) and packs them **inside the image**
   (`backend/Dockerfile` + `backend/scripts/bake_market_data.py`).
   Nobody is waiting on this; it happens once per data version.

## 2. Point the frontend at it

Vercel -> `VITE_API_BASE_URL` = the Render service URL
(`https://sltp-api-xxxx.onrender.com`). CORS is already `*`.

## 3. Freshness (automatic, already committed)

`.github/workflows/market-data-refresh.yml` checks R2 once a day. New
chunks published -> it commits the new version number ->
Render auto-rebuilds with the new bars inside. You do nothing, ever.

## Why the bake solves it (the whole trick in 4 lines)

- Render free wipes the disk on every sleep/restart. Files you *download
  at runtime* vanish; files packed *inside the image* survive, because
  they arrive with the deploy instead of living on the disk.
- So cold starts boot straight into a warm cache: no 400MB fetch with
  a user waiting, no disk to manage, no persistence to pay for.
- The engine is untouched: it looks for bars at its default cache path
  and finds them already there. It cannot tell baked from downloaded.
- Runtime R2 use drops to one ~50ms version check per wake; when new
  data ships, the engine fetches only the small deltas by itself.

## If a backtest 500s

It is RAM, not data: one call passed >500 tickers (the engine then
loads the full universe) or two wide runs overlapped. Fix in our code
by batching universe reads into <=500-ticker calls, not with infra.
