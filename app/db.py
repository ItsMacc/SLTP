from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
import bs4 as bs
import os
import yfinance as yf
import libsql_client
import pandas as pd
import requests

# Turso Cloud Credentials
load_dotenv()

TURSO_URL = os.getenv("TURSO_URL")
TURSO_AUTH_TOKEN = os.getenv("TURSO_AUTH_TOKEN")


# Ticker normalization
def normalize_ticker(ticker):
    return ticker.removesuffix(".TO")


# Load S&P 500 symbols
def load_sp500():
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML,"
            " like Gecko) Chrome/115.0.0.0 Safari/537.36"
        )
    }
    url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"

    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
    except requests.RequestException as e:
        print(f"Failed to fetch S&P 500 list: {e}")
        return []

    soup = bs.BeautifulSoup(response.text, "lxml")
    table = soup.find("table", {"id": "constituents"})

    if table is None:
        return []

    symbols = []
    for row in table.find_all("tr")[1:]:
        cells = row.find_all("td")
        if not cells:
            continue
        ticker = cells[0].text.strip().replace(".", "-")
        symbols.append(ticker)

    return symbols


# Load Custom Stocks
def load_custom_stocks():
    return [
        # Canadian Big Banks & Financials
        "RY.TO",
        "TD.TO",
        "BNS.TO",
        "BMO.TO",
        "CM.TO",
        "NA.TO",
        # Canadian Energy & Utilities
        "ENB.TO",
        "TRP.TO",
        "CNQ.TO",
        "SU.TO",
        "EMA.TO",
        "FTS.TO",
        # Canadian Industrials & Telecom
        "CP.TO",
        "CNR.TO",
        "BCE.TO",
        "T.TO",
        "WN.TO",
        "SHOP.TO",
        # US Mega-Cap Tech & Growth
        "AAPL",
        "MSFT",
        "GOOGL",
        "AMZN",
        "NVDA",
        "META",
        "TSLA",
        # US Healthcare & Consumer Staples
        "JNJ",
        "UNH",
        "PFE",
        "PG",
        "KO",
        "WMT",
        "COST",
        # US Industrials & Financials
        "BRK-B",
        "JPM",
        "V",
        "MA",
        "DIS",
        "CAT",
        "XOM",
    ]


# Load ETFs
def load_etfs():
    return [
        # Canadian Broad Market & Dividend ETFs
        "XEQT.TO",
        "VEQT.TO",
        "VFV.TO",
        "VDY.TO",
        "XEI.TO",
        "XIU.TO",
        "XIC.TO",
        # Canadian Fixed Income & Cash ETFs
        "VAB.TO",
        "XBB.TO",
        "CASH.TO",
        "PSA.TO",
        # US Broad Market ETFs
        "SPY",
        "QQQ",
        "VTI",
        "VOO",
        "DIA",
        # US Sector & Dividend ETFs
        "XLK",
        "XLF",
        "XLE",
        "VYM",
        "SCHD",
    ]


# Load gold
def load_gold():
    return ["GLD"]


# Load all symbols combined
def load_symbols():
    return list(
        set(load_sp500() + load_custom_stocks() + load_etfs() + load_gold())
    )


# Database setup
def init_db(client):
    client.execute("""
        CREATE TABLE IF NOT EXISTS symbols (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            updated_at TEXT
        );
    """)

    client.execute("""
        CREATE TABLE IF NOT EXISTS bars (
            symbol_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            open REAL,
            high REAL,
            low REAL,
            close REAL,
            volume REAL,
            PRIMARY KEY (symbol_id, date),
            FOREIGN KEY (symbol_id) REFERENCES symbols(id)
        );
    """)

    client.execute("""
        CREATE INDEX IF NOT EXISTS idx_bars_symbol_date
        ON bars (symbol_id, date);
    """)


# Database symbol insertion
def upsert_symbol(client, ticker, updated_at):
    db_ticker = normalize_ticker(ticker)
    result = client.execute(
        """
          INSERT INTO symbols (name, updated_at)
          VALUES (?, ?)
          ON CONFLICT(name)
          DO UPDATE SET updated_at = excluded.updated_at
          RETURNING id;
          """,
        (db_ticker, updated_at),
    )
    return result.rows[0][0]


# Insert market bars safely handling single/multi-ticker dataframes
def insert_bars_for_ticker(client, symbol_id, ticker, df):
    if df is None or df.empty:
        return

    stock_df = None
    try:
        if isinstance(df.columns, pd.MultiIndex):
            if ticker in df.columns.get_level_values(1):
                stock_df = (
                    df.xs(ticker, level=1, axis=1).dropna(
                        how="all").reset_index()
                )
            elif ticker in df.columns.get_level_values(0):
                stock_df = df[ticker].dropna(how="all").reset_index()
        else:
            stock_df = df.dropna(how="all").reset_index()
    except Exception:
        stock_df = df.dropna(how="all").reset_index()

    if stock_df is None or stock_df.empty:
        return

    stock_df.columns = [str(c).capitalize() for c in stock_df.columns]
    if "Date" not in stock_df.columns:
        stock_df.rename(columns={stock_df.columns[0]: "Date"}, inplace=True)

    stock_df["Date"] = pd.to_datetime(stock_df["Date"]).dt.strftime("%Y-%m-%d")
    stock_df["symbol_id"] = symbol_id

    required_cols = ["symbol_id", "Date", "Open", "High", "Low", "Close",
                     "Volume"]
    for col in required_cols:
        if col not in stock_df.columns:
            stock_df[col] = None

    records = (
        stock_df[required_cols]
        .dropna(subset=["Date", "Close"])
        .to_records(index=False)
    )

    if len(records) > 0:
        statements = [
            (
                """ INSERT INTO bars 
                    (symbol_id, date, open, high, low, close, volume) 
                    VALUES (?, ?, ?, ?, ?, ?, ?) 
                    ON CONFLICT(symbol_id, date) 
                    DO UPDATE SET 
                    open = excluded.open, 
                    high = excluded.high, 
                    low = excluded.low, 
                    close = excluded.close, 
                    volume = excluded.volume """,
                row,
            )
            for row in records.tolist()
        ]
        client.batch(statements)


# Single unified method to categorize and update data (Optimized with Bulk Pre-fetch)
def insert_or_update_data(client):
    updated_at = datetime.now(timezone.utc).isoformat()
    all_tickers = load_symbols()

    download_all_data = []
    download_previous_data = []

    today = datetime.now().date()
    offset = 0

    if today.weekday() == 5:
        offset = 1
    elif today.weekday() == 6:
        offset = 2

    yesterday_str = (today - timedelta(days=offset)).strftime("%Y-%m-%d")

    print("Analyzing database ticker states...")

    symbol_map = {}
    res_symbols = client.execute("SELECT id, name FROM symbols")
    if res_symbols.rows:
        for row in res_symbols.rows:
            symbol_map[row[1]] = row[0]

    max_dates_map = {}
    if symbol_map:
        res_dates = client.execute("""
      SELECT symbol_id, MAX(date) 
      FROM bars 
      GROUP BY symbol_id
    """)
        if res_dates.rows:
            for row in res_dates.rows:
                max_dates_map[row[0]] = row[1]

    for ticker in all_tickers:
        db_ticker = normalize_ticker(ticker)
        symbol_id = symbol_map.get(db_ticker)

        if not symbol_id:
            download_all_data.append(ticker)
        else:
            last_date = max_dates_map.get(symbol_id)
            if not last_date:
                download_all_data.append(ticker)
            elif last_date < yesterday_str:
                download_previous_data.append(ticker)

    print(
        f"-> Full history download required for: {len(download_all_data)} tickers"
    )
    print(
        f"-> Recent update (5-day) required for: {len(download_previous_data)}"
        " tickers"
    )

    if download_all_data:
        print("Downloading MAX history data...")
        try:
            df_max = yf.download(
                tickers=download_all_data,
                period="max",
                interval="1d",
                group_by="ticker",
                auto_adjust=True,
                progress=False,
            )
            total_max = len(download_all_data)
            for idx, ticker in enumerate(download_all_data, 1):
                print(f"[ {idx} / {total_max} ] Loading MAX history for: {ticker}")
                symbol_id = upsert_symbol(client, ticker, updated_at)
                insert_bars_for_ticker(client, symbol_id, ticker, df_max)
        except Exception as e:
            print(f"Batch max download error: {e}")

    if download_previous_data:
        print("Downloading recent 5-day data...")
        try:
            df_5d = yf.download(
                tickers=download_previous_data,
                period="5d",
                interval="1d",
                group_by="ticker",
                auto_adjust=True,
                progress=False,
            )
            total_5d = len(download_previous_data)
            for idx, ticker in enumerate(download_previous_data, 1):
                print(f"[ {idx} / {total_5d} ] Loading 5-day update for: {ticker}")
                symbol_id = upsert_symbol(client, ticker, updated_at)
                insert_bars_for_ticker(client, symbol_id, ticker, df_5d)
        except Exception as e:
            print(f"Batch 5d download error: {e}")

    print("Database sync completed successfully.")


# ---------- Main ----------
if __name__ == "__main__":
    client = libsql_client.create_client_sync(url=TURSO_URL, auth_token=TURSO_AUTH_TOKEN)

    init_db(client)
    insert_or_update_data(client)

    client.close()