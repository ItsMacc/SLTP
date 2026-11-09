# Deploy runbook — backend on Cloud Run, data baked in

One-time setup (~20 min), then the nightly workflow owns refreshes.

## 0. The shape

```
R2 (source of truth, public, free)
  -> Docker Hub private repo `sltp-api` (1 free private repo, holds the image)
    -> Cloud Run service `sltp-api` in us-central1 (free tier)
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

## 2. Google Cloud (runner)

1. https://console.cloud.google.com -> New project, copy its **Project ID**.
2. APIs & Services -> Enable: **Cloud Run API**, **Secret Manager API**.
3. IAM & Admin -> Service Accounts -> Create (`github-deployer`):
   grant **Cloud Run Admin**, **Service Account User**,
   **Secret Manager Admin**.
4. On the account -> Keys -> Add key -> JSON. Download it.
5. GitHub Secrets: `GCP_SA_KEY` = the whole JSON file contents,
   `GCP_PROJECT_ID` = the project ID.

## 3. Backend secrets (you paste, I never see them)

I cannot read your `.env` (tooling blocks it, and secrets should never enter
chat). Copy these four values from it into GitHub Secrets yourself:

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE`,
`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`

The workflow passes them to Cloud Run as env vars on every deploy.

## 4. First deploy

Run the workflow manually once (Actions -> market-data-refresh ->
Run workflow). It builds, pushes, records the version, and deploys.

Then one console step, because the image is private: Cloud Run console ->
`sltp-api` -> Variables & Secrets -> Registry credentials -> add your
Docker Hub username + token so Cloud Run is allowed to pull. (Public images
skip this; private ones need it exactly once.)

## 5. Frontend

Set `VITE_API_BASE_URL` in Vercel to the Cloud Run service URL
(`https://sltp-api-<hash>-uc.a.run.app`). CORS is already `*`, no code change.

## 6. Day-to-day

- The cron runs 06:00 UTC; no-op nights exit in seconds.
- Market publishes new chunks -> next run rebuilds + redeploys by itself.
- Old image tags: keep `latest` + the newest dated tag; delete older dated
  tags on Docker Hub every few months (tags accumulate, layers do not).
- If a backtest 500s on wide ranges, the first knob is service memory
  (`--memory=2Gi` in the workflow); the second is code, not infra.
