# main.py — FastAPI application entry point.
#
# Exposes the public REST API:
#   GET /api/strategies        -> followable strategy catalog
#   GET /api/backtest/run      -> full simulation (metrics + equity + trades)
#   GET /api/stock/history     -> daily candles for one ticker
#   GET /api/stock/all-tickers -> the tradable universe
# Routers: provisioning (users), portfolio (setup wizard), security (login
# device checks). Strategies are registered in app/strategies/REGISTRY.

# -------- Imports --------
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any, List

# Core Backtester & Strategy Imports
from app.engine.backtesting import Backtester
from app.strategies import REGISTRY

# Database Imports
from app.database.fetch import (
    get_stock_history,
    get_all_tickers as fetch_all_tickers,
    get_all_ticker_details,
    get_stock_name,
)
from app.api.services.market_data import calculate_start_date, serialize_stock_history
from app.engine.utils.EventType import EventType
from app.engine.utils.PositionType import PositionType
from app.database.provision import router as provision_router
from app.database.portfolio_api import router as portfolio_router
from app.database.account_delete import router as account_delete_router
from app.database.lab_api import router as lab_router
from app.database.api_keys import router as api_keys_router
from app.auth.security import router as security_router

# -------- App Setup --------
app = FastAPI(title="Stocker Backtesting & Analytics API")
app.include_router(provision_router)
app.include_router(portfolio_router)
app.include_router(security_router)
app.include_router(account_delete_router)
app.include_router(lab_router)
app.include_router(api_keys_router)

# Configure CORS for React/Vite Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------- Endpoints --------
@app.get("/api/strategies")
def get_available_strategies() -> List[Dict[str, str]]:
    """Returns followable strategies (id, name, description, type) for the frontend."""
    strategy_list = []
    for key, (strategy_cls, stype) in REGISTRY.items():
        instance = strategy_cls()
        strategy_list.append({
            "id": key,
            "name": instance.name,
            "description": instance.description,
            "type": stype,
        })
    return strategy_list


@app.get("/api/backtest/run")
def run_backtest(
    strategy_id: str = Query("", description="ID of the strategy to run"),
    start_date: str = Query("2023-01-01", description="Start date in YYYY-MM-DD format"),
    end_date: str | None = Query(None, description="End date in YYYY-MM-DD format (optional)")
) -> Dict[str, Any]:
    """
    Runs the backtest for a given strategy and date range.
    Returns:
      1. 'metrics': Dictionary containing all performance stats (Sharpe, CAGR, Win Rate, etc.)
      2. 'chart_data': Formatted portfolio index history over time for line/bar charts.
    """
    if strategy_id not in REGISTRY:
        raise HTTPException(
            status_code=404,
            detail=f"Strategy '{strategy_id}' not found. Available strategies: {list(REGISTRY.keys())}"
        )

    try:
        # Instantiate the requested strategy
        strategy_cls, _ = REGISTRY[strategy_id]
        strategy_instance = strategy_cls()

        # Initialize and run backtest
        backtester = Backtester(
            strategy=strategy_instance,
            start_date=start_date,
            end_date=end_date
        )
        result = backtester.run()
        raw_metrics = dict(result["metrics"])
        raw_metrics.pop("equity", None)
        equity_curve = result["equity"]

        if not equity_curve:
            raise HTTPException(status_code=400, detail="Backtest completed with no equity curve data.")

        # Keep the established frontend contract; only adapt the engine records here.
        chart_data = [
            {
                "date": point["date"],
                "portfolio_value": point["portfolio_value"],
                "active_positions": point["active_positions"],
                "transaction_cost": point["total_transaction_cost"],
            }
            for point in equity_curve
        ]
        trades = []
        for trade in result["trades"]:
            exit_event = trade.exit
            direction = -1.0 if trade.position_type is PositionType.SHORT else 1.0
            realized_return_pct = None
            if exit_event is not None and trade.entry_price > 0:
                notional = trade.equity_at_entry * trade.allocation
                gross_pnl = notional * direction * (exit_event.price - trade.entry_price) / trade.entry_price
                realized_return_pct = (gross_pnl - trade.fees) / notional * 100.0 if notional > 0 else 0.0
            exit_reason = {
                EventType.TAKE_PROFIT: "TAKE_PROFIT",
                EventType.STOP_LOSS: "STOP_LOSS",
                EventType.SIGNAL: "EXIT",
                EventType.END_OF_BACKTEST: "EXIT",
            }.get(exit_event.type, "EXIT") if exit_event is not None else None
            trades.append({
                "id": trade.id,
                "ticker": trade.ticker,
                # Keep action as the entry direction; the close cause is a separate field.
                "action": "SHORT" if trade.position_type is PositionType.SHORT else "BUY",
                "position_type": trade.position_type.value,
                "exit_reason": exit_reason,
                "entry_date": trade.entry_date,
                "allocation_size": trade.allocation,
                "entry_price": trade.entry_price,
                "stop_loss": trade.stop_loss,
                "take_profit": trade.take_profit,
                "exit_price": exit_event.price if exit_event is not None else None,
                "exit_date": exit_event.date if exit_event is not None else None,
                "transaction_cost": trade.fees,
                "realized_return_pct": realized_return_pct,
            })

        return {
            "strategy_id": strategy_id,
            "strategy_name": strategy_instance.name,
            "metrics": raw_metrics,
            "chart_data": chart_data,
            "trades": trades,
            "rejections": result["rejections"],
        }

    except HTTPException:
        raise
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal backtest error: {str(e)}")


@app.get("/api/stock/history")
def read_stock_history(
    ticker: str = Query(..., description="Stock symbol, e.g. AAPL"),
    timeframe: str = Query("1y", description="Timeframe options: 1y, 2y, 5y, all")
):
    """Fetch historical price candles for individual stock tickers."""
    try:
        normalized_ticker = ticker.strip().upper()
        stock_data = get_stock_history(
            ticker=normalized_ticker,
            start=calculate_start_date(timeframe),
        )
        response = serialize_stock_history(stock_data, normalized_ticker, timeframe)
        response["name"] = get_stock_name(normalized_ticker)
        return response
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/stock/ticker-details")
def get_ticker_details():
    """Retrieve available symbols with their company/fund display names."""
    try:
        return get_all_ticker_details()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Ticker details are temporarily unavailable: {e}") from e


@app.get("/api/stock/all-tickers")
def get_all_tickers():
    """Retrieve a sorted list of all available stock symbols."""
    try:
        tickers = fetch_all_tickers()
        return sorted(tickers)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Ticker symbols are temporarily unavailable: {e}") from e
