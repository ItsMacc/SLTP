# Backtest on GitHub Actions

The engine runs on a GitHub runner instead of a web server. A runner has 16 GB of
RAM, so the 678 MiB bar load and the ~1.35 GiB peak measured locally are irrelevant
there, and a backtest costs 10–20 s of compute.

What the site does instead of running the engine itself:

```
frontend  →  dispatch backtest.yml  →  runner: load data, run engine, write result.json
          ←  artifact, or a signed POST back to a callback URL
```

Realistic end-to-end latency is **60–180 s** (queue + checkout + pip + data copy).
It is a job queue, not a synchronous API.

## 1. Put the data somewhere the runner can download it

The bar files are not in git. Pack them into one release asset:

```bash
scripts/pack_market_data.sh --upload market-data-v1
```

That creates a GitHub release carrying `market-data.tar.gz` (~430 MB) with:

| File | Size |
| --- | --- |
| `market/market_data.parquet` | 407 MB |
| `market/market_data_recent.parquet` | 0.7 MB |
| `market/market_actions.parquet` | 1.2 MB |
| `symbol_data/symbols.parquet` | 278 KB |
| `symbol_data/symbol_status.parquet` | 372 KB |

Alternatives to a release asset, both supported by the workflow:

- **Repository variable `MARKET_DATA_URL`** — any direct download link (Cloudflare R2,
  S3, a signed URL). Set it under Settings → Secrets and variables → Actions → Variables.
- **Repository secret `MARKET_DATA_URL`** — same, for a link you don't want public.

**Repository variable `MARKET_DATA_RELEASE_TAG`** overrides the default release tag
(`market-data-v1`).

When you upload new bars, bump the `data_revision` input. Caches are immutable, so a
stale cache is only replaced by a new key.

## 2. Trigger a run

From the CLI:

```bash
gh workflow run backtest.yml --ref test -f strategy_id=momentum-20
gh run list --workflow=backtest.yml --limit 3
gh run watch
```

Or from the Actions tab → `backtest` → **Run workflow**.

Available ids come from the registry:

```bash
python scripts/run_backtest.py --list
```

Inputs: `strategy_id`, `start_date`, `end_date`, `data_revision`, `job_id`,
`callback_url`.

## 3. Get the result

The run uploads `backtest-result` (retention 7 days):

```bash
gh run download --name backtest-result
```

`result.json` has exactly the body `GET /api/backtest/run` returns, plus `job_id`,
`start_date`, `end_date`, `generated_at` and `elapsed_seconds`.

To push instead of pull, pass a `callback_url`. The workflow POSTs the same JSON with
an `X-Signature-256: sha256=<hmac>` header, keyed by the `CALLBACK_SECRET` repository
secret. Verify it before trusting the body:

```python
hmac.new(secret.encode(), body, hashlib.sha256).hexdigest() == signature.split("=", 1)[1]
```

## Running it locally

The same script works on any machine that has the bar files in place:

```bash
python scripts/run_backtest.py --strategy buy-and-hold --start 2024-01-01 --out /tmp/result.json
```

It imports the route function from `app.main` rather than re-implementing the
response, so the JSON shape cannot drift from the API.

## Things to know

- **Free minutes**: unlimited on a public repository, 2,000 min/month on a private
  one. At ~3 min per run that is roughly 660 backtests/month privately.
- **Never run untrusted code here.** The Lab's arbitrary Python stays off the runner:
  it would have `GITHUB_TOKEN` in its environment. Only strategies from `REGISTRY`.
- **TA-Lib** is imported by `app/engine/strategy/base_strategy.py`. `requirements.txt`
  pins `TA-Lib~=0.8.0`, whose wheels bundle the C library; if a future version stops
  doing that, add `sudo apt-get install -y libta-lib0` before the pip step.
- **One run at a time.** The `concurrency` group serialises runs so two dispatches
  cannot fight over the data cache.
