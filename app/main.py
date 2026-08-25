from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from app.fetch import get_stock_history_json
import libsql_client
import os


# Load environment variables for cloud connection
load_dotenv()

TURSO_URL = os.getenv("TURSO_URL")
TURSO_AUTH_TOKEN = os.getenv("TURSO_AUTH_TOKEN")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/stock/history")
def read_stock_history(
        ticker: str = Query(..., description="Stock symbol, e.g. AAPL"),
        timeframe: str = Query("1y",
                               description="Timeframe options: 1y, 2y, 5y, all")
):
    try:
        return get_stock_history_json(ticker=ticker, timeframe=timeframe)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/stock/all-tickers")
def get_all_tickers():
    client = libsql_client.create_client_sync(url=TURSO_URL, auth_token=TURSO_AUTH_TOKEN)
    try:
        result = client.execute("SELECT name FROM symbols ORDER BY name ASC")
        rows = result.rows if result.rows else []
        return [row[0] for row in rows]
    except Exception as e:
        print(f"All tickers endpoint error: {e}")
        return []
    finally:
        client.close()