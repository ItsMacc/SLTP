from datetime import datetime, timezone, timedelta
import bs4 as bs
import pandas as pd
import requests
import yfinance as yf
from app.database.db_client import get_db_client


# --- Symbol Lists ---

def normalize_ticker(ticker):
    return ticker.removesuffix(".TO")


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


def load_custom_stocks():
    return [
        "RY.TO", "TD.TO", "BNS.TO", "BMO.TO", "CM.TO", "NA.TO", "ENB.TO", "TRP.TO",
        "CNQ.TO", "SU.TO", "EMA.TO", "FTS.TO", "CP.TO", "CNR.TO", "BCE.TO", "T.TO",
        "WN.TO", "SHOP.TO", "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA",
        "JNJ", "UNH", "PFE", "PG", "KO", "WMT", "COST", "BRK-B", "JPM", "V", "MA",
        "DIS", "CAT", "XOM",
    ]


def load_etfs():
    return [
        "XEQT.TO", "VEQT.TO", "VFV.TO", "VDY.TO", "XEI.TO", "XIU.TO", "XIC.TO",
        "VAB.TO", "XBB.TO", "CASH.TO", "PSA.TO", "SPY", "QQQ", "VTI", "VOO", "DIA",
        "XLK", "XLF", "XLE", "VYM", "SCHD",
    ]


def load_gold():
    return ["GLD"]


def load_symbols():
    return list(set(load_sp500() + load_custom_stocks() + load_etfs() + load_gold()))


# --- Database Operations ---

def init_db(client=None):
    if client is None:
        client = get_db_client()

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
            CREATE INDEX IF NOT EXISTS idx_symbols_name
            ON symbols (name);
        """)

    client.execute("""
        CREATE INDEX IF NOT EXISTS idx_bars_symbol_date
        ON bars (symbol_id, date);
    """)


def process_and_batch_bars(download_list, df, symbol_map, client=None):
    if df is None or df.empty or not download_list:
        return

    if client is None:
        client = get_db_client()

    print(f"Preparing bar statements for {len(download_list)} tickers...")
    bar_statements = []

    for ticker in download_list:
        db_ticker = normalize_ticker(ticker)
        symbol_id = symbol_map.get(db_ticker)

        if symbol_id is None:
            continue

        stock_df = None
        try:
            if isinstance(df.columns, pd.MultiIndex):
                if ticker in df.columns.get_level_values(1):
                    stock_df = df.xs(ticker, level=1, axis=1).dropna(how="all").reset_index()
                elif ticker in df.columns.get_level_values(0):
                    stock_df = df[ticker].dropna(how="all").reset_index()
                elif db_ticker in df.columns.get_level_values(1):
                    stock_df = df.xs(db_ticker, level=1, axis=1).dropna(how="all").reset_index()
                elif db_ticker in df.columns.get_level_values(0):
                    stock_df = df[db_ticker].dropna(how="all").reset_index()
            else:
                stock_df = df.dropna(how="all").reset_index()
        except Exception:
            continue

        if stock_df is None or stock_df.empty:
            continue

        stock_df.columns = [str(c).capitalize() for c in stock_df.columns]
        if "Date" not in stock_df.columns:
            stock_df.rename(columns={stock_df.columns[0]: "Date"}, inplace=True)

        stock_df["Date"] = pd.to_datetime(stock_df["Date"]).dt.strftime("%Y-%m-%d")

        required_cols = ["Date", "Open", "High", "Low", "Close", "Volume"]
        for col in required_cols:
            if col not in stock_df.columns:
                stock_df[col] = None

        valid_rows = stock_df.dropna(subset=["Date", "Close"])
        for _, row in valid_rows.iterrows():
            bar_statements.append((
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
                (
                    symbol_id,
                    str(row["Date"]),
                    float(row["Open"]) if pd.notnull(row["Open"]) else None,
                    float(row["High"]) if pd.notnull(row["High"]) else None,
                    float(row["Low"]) if pd.notnull(row["Low"]) else None,
                    float(row["Close"]) if pd.notnull(row["Close"]) else None,
                    float(row["Volume"]) if pd.notnull(row["Volume"]) else None,
                ),
            ))

    if not bar_statements:
        print("No valid bars to insert.")
        return

    print(f"Flushing {len(bar_statements)} bars to Turso in batches...")
    chunk_size = 500
    for i in range(0, len(bar_statements), chunk_size):
        client.batch(bar_statements[i:i + chunk_size])


def insert_or_update_data(client=None):
    if client is None:
        client = get_db_client()

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

    print(f"-> Full history download required for: {len(download_all_data)} tickers")
    print(f"-> Recent update (5-day) required for: {len(download_previous_data)} tickers")

    target_tickers = list(set(download_all_data + download_previous_data))
    if target_tickers:
        print("Upserting symbols...")
        sym_statements = [
            (
                """
                INSERT INTO symbols (name, updated_at)
                VALUES (?, ?)
                ON CONFLICT(name)
                DO UPDATE SET updated_at = excluded.updated_at;
                """,
                (normalize_ticker(t), updated_at),
            )
            for t in target_tickers
        ]
        client.batch(sym_statements)

        res_symbols = client.execute("SELECT name, id FROM symbols")
        symbol_map = {row[0]: row[1] for row in res_symbols.rows}

    if download_all_data:
        print("Downloading MAX history data in bulk...")
        try:
            df_max = yf.download(
                tickers=download_all_data,
                period="max",
                interval="1d",
                group_by="ticker",
                auto_adjust=True,
                progress=False,
            )
            process_and_batch_bars(download_all_data, df_max, symbol_map, client=client)
        except Exception as e:
            print(f"Batch max download error: {e}")

    if download_previous_data:
        print("Downloading recent 5-day data in bulk...")
        try:
            df_5d = yf.download(
                tickers=download_previous_data,
                period="5d",
                interval="1d",
                group_by="ticker",
                auto_adjust=True,
                progress=False,
            )
            process_and_batch_bars(download_previous_data, df_5d, symbol_map, client=client)
        except Exception as e:
            print(f"Batch 5d download error: {e}")

    print("Database sync completed successfully.")


if __name__ == "__main__":
    init_db()
    insert_or_update_data()