# SLTP — Stock-Loss Take-Profit

A full-stack platform for exploring, backtesting, and deploying algorithmic trading strategies with risk management and zero setup.

> **Project status:** Working dev build. The UI is complete and wired to Supabase/Turso. The Python API is functional. A local dev build can run on any machine with Python + Node. The git history has been cleaned of oversized data files so the repo can be pushed to GitHub.

---

## Quickstart — local dev

### 1. Install Python dependencies

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Create a `.env` file at repo root

```env
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxeXFma3J6d2lteHV6dWd5dWl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNzg2OTMsImV4cCI6MjEwMjY1NDY5M30.y51b5p_W5hhba94182apC7hlJTnDrA3GoaIZw1moYd4
TURSO_DATABASE_URL=libsql://<your-turso-database>.turso.io
TURSO_AUTH_TOKEN=<your-turso-auth-token>
```

> Get these from the Supabase dashboard (Settings → API) and the Turso dashboard (Database → Connect).

### 3. Initialize the Turso schema

```bash
python3 -m app.database.db
```

This runs `app/database/db.py` once, which:
- Creates the `app/database/market_data.parquet` file from yfinance data
- Seeds the initial market data
- Leaves `market_data.parquet` in `app/database/` (gitignored in the new history)

### 4. Install Node deps and build the frontend

```bash
cd frontend
npm ci   # or: npm install
npm run build   # produces dist/ — served by any static host
```

### 5. Start the backend and frontend together

From repo root (two terminals, or use `concurrently`):

```bash
# Terminal A — backend
cd app
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Terminal B — frontend dev server
cd frontend
npm run dev   # Vite dev server at http://localhost:5173
```

Visit <http://localhost:5173> — the app loads, checks Supabase auth, and the API serves at `http://localhost:8000`.

---

## Directory layout

```
app/              — FastAPI backend (API routes, DB access, backtester)
frontend/         — Vite + React 19 frontend (UI, pages, components)
migrations/       — SQL schema (create-only; run once on fresh Turso DB)
migrations/migrations.sql
requirements.txt  — pip install this
README.md         — you are here
```

---

## Backend API

| Endpoint | Description |
|---|---|
| `GET /api/strategies` | Followable strategy catalog |
| `GET /api/backtest/run` | Full backtest simulation (metrics + equity + trades) |
| `POST /api/settings` | Sync user settings from Supabase to Turso (daily runner) |
| `GET /api/users/me` | Return the mirrored user row from Turso |

See `app/main.py` and `app/auth/auth.py` for full route documentation.

---

## Frontend notes

- The app assumes `VITE_API_BASE_URL` is set at build time (default `http://localhost:8000`).
- `VITE_SUPABASE_ANON_KEY` is read from `import.meta.env`; the key is public by design — row-level security in Supabase protects the data.
- All secrets (`SUPABASE_SERVICE_ROLE`, `TURSO_AUTH_TOKEN`) live in `.env` only; `.env` is gitignored.
- The interactive tour (SiteGuide) waits for a sign-in on gated pages, then opens the Lab once its file list has loaded.

---

## Deployment checklist

| Item | What to do |
|---|---|
| **Backend host** | Any platform that runs FastAPI/uvicorn (Render, Railway, Fly.io, Railway, etc.). Set the four env vars above as secrets. |
| **Frontend host** | Any static host (Netlify, Vercel, Cloudflare Pages). Build with `npm run build`; the output is `dist/`. |
| **Supabase** | Enable RLS on `users` and `portfolios` tables. The anon key + RLS is the security boundary. |
| **Turso** | The database URL + auth token must be reachable from the backend host. No firewall changes needed if both are cloud-hosted. |
| **Market data** | `python -m app.database.db` creates `market_data.parquet` once. The backend reads it from `app/database/` on every start. Keep that file in your deployment volume. |
| **Daily runner** | `python -m app.notification.daily_runner` — runs nightly, syncs settings from Supabase into Turso and can refresh market data. |
| **CI/CD** | If you push to GitHub, add a GitHub Actions workflow that runs `pip install -r requirements.txt`, `npm ci`, `npm run build`, and `python -m app.database.db` on a fresh runner. |

---

## Getting a job-ready demo today

If you just want to show something working today:

1. **Create a free Supabase project** and a free Turso database.
2. **Set the four env vars** in a local `.env` file and run `python -m app.database.db` to create the parquet.
3. **Run the dev build** with `uvicorn main:app --reload` + `npm run dev`.
4. **Navigate** and confirm the UI works, the lab opens, and the tour functions.
5. **Push the repo to GitHub** — the history is now clean (no 517 MB blobs), and the `README.md` + `requirements.txt` make it easy for a reviewer to spin it up locally.

The code is structurally complete: the Lab page, the nav-page UI rewrite, the interactive tour, the design-token migration, and the API models are all in the current `main` commit. What remains is infra (hosting, env vars, a Turso database) rather than code.

---

## Credits

- Built with FastAPI, Vite, React 19, Supabase, and Turso.
- UI design tokens and theme conventions follow the existing design system.
- Migrations are create-only and safe for new databases only.