# SLTP frontend

React 19 + TypeScript + Vite 8. Research charts, the strategy library,
portfolio onboarding, settings, and the Lab page — all served by the
FastAPI backend over HTTP. Nothing heavy runs in the browser.

## Run

```bash
npm ci && npm run dev     # :5173
```

The app talks to `http://localhost:8000` by default; set
`VITE_API_BASE_URL` to point it elsewhere. `npm run build` type-checks
(`tsc -b`) and emits `dist/`; `npm run lint` runs oxlint; `npm run
check-docs` lints the in-app docs prose (banned wording, sentence length).

## Layout

- `src/pages` — one component per tab (Research, Strategies, Portfolio,
  Lab, Settings, auth, onboarding).
- `src/components`, `src/ui` — shared pieces and design-token primitives.
- `src/engine/sltpClient.ts` — the backend HTTP client (history,
  ticker directory, backtest runs).
- `lib/` — API helpers, the Supabase auth client, session, settings.
- `src/index.css` — design tokens; `scripts/check-docs.mjs` — docs checker.

Backend endpoints are listed in the root README. The Lab's code
workspaces stay disabled (`LAB_CODE_ENABLED` in `src/pages/LabPage.tsx`)
until the server file APIs exist.
