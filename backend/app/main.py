# main.py — SLTP backend: thin HTTP over `pip install sltp`, plus accounts.
#
# Two halves:
#   market  no engine code lives here; bars and backtests come from the
#           published sltp package mapped onto JSON the webpage reads.
#   users   Supabase-only accounts: JWT auth, profile settings, portfolios,
#           API keys, login devices, full erasure. One store, no mirror.
#
# Run it with:  uvicorn app.main:app --reload   (from backend/)
# Then open http://127.0.0.1:8000/docs to try every endpoint.
#
# Market data: the engine reads local bars when it finds them, otherwise it
# fetches the missing chunks from the public R2 bucket into ~/.sltp/cache on
# first use. The first history/backtest call is slow; later ones are local.
#
# Database: paste backend/schema.sql ONCE into the Supabase SQL editor. Reads
# degrade to empty until then; writes need the tables.

import sys
from datetime import date
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.auth.security import router as security_router
from app.lab.projects import router as lab_projects_router
from app.lab.strategies import router as lab_strategies_router
from app.registry import STRATEGIES, strategy_by_id
from app.users.store import MissingTable
from app.users.account import router as account_router
from app.users.api_keys import router as api_keys_router
from app.users.portfolio import router as portfolio_router
from app.users.provision import router as provision_router
from app.users.results import router as results_router
from app.users.settings import router as settings_router
from app.users.watchlist import router as watchlist_router

app = FastAPI(title="SLTP engine API", version="0.2.0")
app.include_router(provision_router)
app.include_router(settings_router)
app.include_router(portfolio_router)
app.include_router(account_router)
app.include_router(api_keys_router)
app.include_router(watchlist_router)
app.include_router(results_router)
app.include_router(lab_projects_router)
app.include_router(lab_strategies_router)
app.include_router(security_router)

# CORS for the frontend (browser path calls this API from the site origin).
@app.exception_handler(MissingTable)
async def _missing_table_handler(request, exc):
    return JSONResponse(
        status_code=503,
        content={"detail": f"Database table missing: {exc}. Paste backend/schema.sql into the Supabase SQL editor."},
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------- Helpers --------


def _clean(value):
    # NaN and Infinity are valid Python floats but not valid JSON: the docs
    # page would show them and a browser JSON.parse would throw. Null instead.
    if isinstance(value, float) and (value != value or value in (float("inf"), float("-inf"))):
        return None
    if isinstance(value, dict):
        return {str(key): _clean(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_clean(item) for item in value]
    return value


def _timeframe_range(timeframe: str, latest: str) -> tuple[str | None, str]:
    if timeframe == "all":
        return None, latest
    years = {"1y": 1, "2y": 2, "5y": 5}.get(timeframe)
    if years is None:
        raise HTTPException(400, f"unknown timeframe: {timeframe}")
    year, month, day = (int(part) for part in latest.split("-"))
    return date(year - years, month, day).isoformat(), latest


def _trade_to_record(trade: dict) -> dict:
    exit = trade.get("exit") or {}
    return {
        "id": trade.get("id"),
        "ticker": trade.get("ticker"),
        "action": "SHORT" if trade.get("position_type") == "short" else "BUY",
        "position_type": trade.get("position_type"),
        "entry_date": trade.get("entry_date"),
        "signal_date": trade.get("entry_date"),
        "entry_price": trade.get("entry_price"),
        "allocation_size": trade.get("allocation"),
        "stop_loss": trade.get("stop_loss"),
        "take_profit": trade.get("take_profit"),
        "exit_date": exit.get("date"),
        "exit_price": exit.get("price"),
        "transaction_cost": trade.get("fees"),
    }


# -------- Root --------


@app.get("/")
def root() -> dict:
    return {"service": "sltp-backend", "docs": "/docs"}


# -------- Strategies --------


@app.get("/api/strategies")
def list_strategies() -> list[dict]:
    return [
        {"id": entry["id"], "name": entry["name"], "description": entry["description"],
         "type": entry["type"]}
        for entry in STRATEGIES
    ]


# -------- Market data --------


@app.get("/api/stock/ticker-details")
def ticker_details() -> list[dict]:
    from sltp.data.market_data_service import get_tradable_ticker_directory

    return [{"ticker": row["ticker"], "name": row["name"]} for row in get_tradable_ticker_directory()]


@app.get("/api/stock/all-tickers")
def all_tickers() -> list[str]:
    from sltp.data.market_data_service import get_tradable_ticker_directory

    return sorted(row["ticker"] for row in get_tradable_ticker_directory())


@app.get("/api/stock/history")
def stock_history(ticker: str, timeframe: str = "1y") -> dict:
    from sltp.data.market_data_service import (
        get_latest_trading_date,
        get_stock_history,
        get_stock_name,
    )

    symbol = ticker.upper().strip()
    try:
        latest = get_latest_trading_date()
        start, end = _timeframe_range(timeframe, latest)
        history = get_stock_history(symbol, start, end)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(404, f"No history found for {symbol}") from exc
    dates = [str(day) for day in history.dates]
    bars = [
        {
            "date": dates[i],
            "open": float(history.open_price[i]),
            "high": float(history.high[i]),
            "low": float(history.low[i]),
            "close": float(history.close_price[i]),
            "volume": float(history.volume[i]),
        }
        for i in range(len(dates))
    ]
    return {
        "ticker": symbol,
        "name": get_stock_name(symbol),
        "timeframe": timeframe,
        "total_bars": len(bars),
        "data": _clean(bars),
    }


# -------- Backtests --------


@app.get("/api/backtest/run")
def backtest_run(strategy_id: str, start_date: str, end_date: str | None = None) -> dict:
    from sltp.web import run

    entry = strategy_by_id(strategy_id)
    if entry is None:
        raise HTTPException(404, f"unknown strategy: {strategy_id}")
    try:
        payload = run(entry["cls"](), start_date, end_date or None)
    except Exception as exc:
        raise HTTPException(400, f"backtest failed: {exc}") from exc
    return _clean(
        {
            "strategy_id": strategy_id,
            "strategy_name": entry["name"],
            "metrics": payload.get("stats") or {},
            "chart_data": [
                {"date": point["date"], "portfolio_value": point["value"]}
                for point in payload.get("equity") or []
            ],
            "trades": [_trade_to_record(trade) for trade in payload.get("trades") or []],
        }
    )
