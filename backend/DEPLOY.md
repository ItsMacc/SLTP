# Deploy runbook — backend on Cloud Run, data baked in

One-time setup (~20 min), then the nightly workflow owns refreshes.

## 0. The shape

```
R2 (source of truth, public, free)
  -> Docker Hub private repo `sltp-api` (1 free private repo, holds the image)
    -> Render free web service, Existing Image (free, $0, no Google needed)
      <- Vercel frontend via VITE_API_BASE_URL
```

The image carries the bar files inside it, so the host's ephemeral disk does
not matter. Secrets travel as env vars, never in the image (`.dockerignore`
blocks `.env`).

One honest note: a private image does not make the *data* private. The chunks
are public on R2 and the download URLs sit in this public repo's Dockerfile,
so anyone can fetch them anyway. The private repo gates the packaging, not
the data. If that bothers you, the fix is a private R2 bucket + build-time
credentials — a later project, not this one.

## 1. Docker Hub (image home)

1. Create an account, note your namespace (username).
2. Account Settings -> Personal Access Tokens -> Generate: Read & Write.
   Save the token somewhere safe; it is shown once.
3. GitHub repo -> Settings -> Secrets and variables -> Actions -> New secret:
   - `DOCKERHUB_USERNAME` = your namespace
   - `DOCKERHUB_TOKEN` = the token

## 2. Render (runner, $0, no Google involved)

1. Render dashboard -> New -> Web Service -> **Existing Image**:
   image `docker.io/ItsMaccc/sltp-api:latest`.
   Because the repo is private, enter your Docker Hub username + token as
   the pull credentials when Render asks.
2. Plan: **Free**. Region: nearest to your users (Oregon default is fine).
3. Environment variables: add the same four backend values from your `.env`
   (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE`,
   `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`).
4. In the service Settings, copy its **Deploy Hook** URL into a GitHub
   secret named `RENDER_DEPLOY_HOOK`. The workflow POSTs to it after each
   data rebuild so the host pulls the fresh image by itself. (Skip this and
   the service simply keeps serving the previous image until you hit Manual
   Deploy -> Deploy latest reference.)
5. Note the service URL (`https://sltp-api-xxxx.onrender.com`) for step 5.

## 3. Backend secrets (you paste, I never see them)

I cannot read your `.env` (tooling blocks it, and secrets should never enter
chat). Copy these four values from it into GitHub Secrets yourself:

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE`,
`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`

The workflow passes them to Cloud Run as env vars on every deploy.

## 4. First deploy

Run the workflow manually once (Actions -> market-data-refresh ->
Run workflow). It builds, pushes, and records the version. Then either wait
for the deploy hook to roll Render, or open the service and hit Manual
Deploy -> Deploy latest reference. Hit `/api/stock/history?symbol=AAPL`
and one `/api/backtest/run` to confirm warm, fast responses.

## 5. Frontend

Set `VITE_API_BASE_URL` in Vercel to the Render service URL from step 2
(`https://sltp-api-xxxx.onrender.com`). CORS is already `*`, no code change.

## 6. Day-to-day

- The cron runs 06:00 UTC; no-op nights exit in seconds.
- Market publishes new chunks -> next run rebuilds + redeploys by itself.
- Old image tags: keep `latest` + the newest dated tag; delete older dated
  tags on Docker Hub every few months (tags accumulate, layers do not).
- If a backtest 500s on wide ranges, the first knob is Render's instance
  memory (Free = 512MB; the paid Starter is the next step, not a redesign);
  the second is code, not infra.
