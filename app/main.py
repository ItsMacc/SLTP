# main.py — FastAPI application entry point.
#
# Exposes the public REST API:
#   GET /api/strategies        -> followable strategy catalog
#   GET /api/backtest/run      -> full simulation (metrics + equity + trades)
#   GET /api/stock/history     -> daily candles for one ticker
#   GET /api/stock/all-tickers -> the tradable universe
# Routers: provisioning (users), portfolio (setup wizard), security (login
# device checks). Strategies are registered in STRATEGIES / STRATEGY_CATALOG.

# -------- Imports --------
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any, List

# Core Backtester & Strategy Imports
from app.backtester import Backtester
from app.strategies.buy_and_hold import BuyAndHold
from app.strategies.stock_health_filter import StockHealthFilterStrategy

# Database Imports
from app.database.fetch import get_stock_history_json, get_all_tickers as fetch_all_tickers
from app.database.provision import router as provision_router
from app.database.portfolio_api import router as portfolio_router
from app.database.account_delete import router as account_delete_router
from app.database.lab_api import router as lab_router
from app.security import router as security_router

# -------- App Setup --------
app = FastAPI(title="Stocker Backtesting & Analytics API")
app.include_router(provision_router)
app.include_router(portfolio_router)
app.include_router(security_router)
app.include_router(account_delete_router)
app.include_router(lab_router)

# Configure CORS for React/Vite Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------- Strategy Registry --------
# Registry for user-followable strategies.
STRATEGIES = {
    "buy-and-hold": (BuyAndHold, "investing"),
    "stock-health-filter": (StockHealthFilterStrategy, "trading"),
}

# Strategy catalog for the onboarding wizard. To surface a new strategy on the
# onboarding page, just add an entry here with its type — the frontend filters
# the list by the user's selected intent (invest / trade / both).
STRATEGY_CATALOG = {
    "buy-and-hold": {"name": "Buy & Hold", "type": "investing"},
    "stock-health-filter": {"name": "Stock Health Filter", "type": "trading"},
}


# -------- Endpoints --------
@app.get("/api/strategies")
def get_available_strategies() -> List[Dict[str, str]]:
    """Returns followable strategies (id, name, description, type) for the frontend."""
    strategy_list = []
    for key, (strategy_cls, stype) in STRATEGIES.items():
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
    if strategy_id not in STRATEGIES:
        raise HTTPException(
            status_code=404,
            detail=f"Strategy '{strategy_id}' not found. Available strategies: {list(STRATEGIES.keys())}"
        )

    try:
        # Instantiate the requested strategy
        strategy_cls, _ = STRATEGIES[strategy_id]
        strategy_instance = strategy_cls()

        # Initialize and run backtest
        backtester = Backtester(
            strategy=strategy_instance,
            start_date=start_date,
            end_date=end_date
        )
        backtester.run()

        # Compute metrics dictionary from backtester
        raw_metrics = backtester.performance_metrics()

        if not raw_metrics:
            raise HTTPException(status_code=400, detail="Backtest completed with no equity curve data.")

        # Extract equity curve for chart formatting and pop equity array out of the raw metrics dict
        equity_curve = raw_metrics.pop("equity", [])

        # Format chart points for simple Recharts/Chart.js frontend consumption
        chart_data = [
            {
                "date": point["date"],
                "portfolio_value": point["portfolio_value"],
                "active_positions": point["active_positions"],
                "transaction_cost": point["total_transaction_cost"]
            }
            for point in equity_curve
        ]

        return {
            "strategy_id": strategy_id,
            "strategy_name": strategy_instance.name,
            "metrics": raw_metrics,
            "chart_data": chart_data,
            "trades": strategy_instance.manager.trades
        }

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
        return get_stock_history_json(ticker=ticker, timeframe=timeframe)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/stock/all-tickers")
def get_all_tickers():
    """Retrieve a sorted list of all available stock symbols."""
    try:
        tickers = fetch_all_tickers()
        return sorted(tickers)
    except Exception as e:
        print(f"All tickers endpoint error: {e}")
        return []