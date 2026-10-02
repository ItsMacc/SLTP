# db.py — Market data ingestion into the local Parquet master file.
#
# Builds the tradable symbol universe from Wikipedia (S&P 500, TSX 60,
# ETFs, gold) and keeps the master market_data.parquet fresh: tickers
# missing from the file get full history, existing ones get a 5-day top-up.
# One row per (Symbol, Date) with OHLCV columns.

# -------- Imports --------
import os
import re
import bs4 as bs
import pandas as pd
import requests
import yfinance as yf
from datetime import datetime, timedelta
from app.database.db_client import get_parquet_dir


# -------- Helper Soup Function --------
def _fetch_soup(url: str, timeout: int = 10) -> bs.BeautifulSoup | None:
    # Set headers to mimic a web browser request
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML,"
            " like Gecko) Chrome/115.0.0.0 Safari/537.36"
        )
    }
    # Attempt to fetch the target web page safely
    try:
        response = requests.get(url, headers=headers, timeout=timeout)
        response.raise_for_status()
    except requests.RequestException as e:
        print(f"Failed to fetch URL {url}: {e}")
        return None

    # Parse and return the HTML response content using BeautifulSoup
    return bs.BeautifulSoup(response.text, "lxml")


# -------- Symbol Lists --------
def load_sp500() -> list:
    url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
    soup = _fetch_soup(url)
    if soup is None:
        return []

    table = soup.find("table", {"id": "constituents"})
    if table is None:
        return []

    # Extract ticker symbols from the table rows
    symbols = []
    for row in table.find_all("tr")[1:]:
        cells = row.find_all("td")
        if not cells:
            continue
        ticker = cells[0].text.strip().replace(".", "-")
        symbols.append(ticker)

    return symbols


def load_tsx60() -> list:
    url = "https://en.wikipedia.org/wiki/S%26P/TSX_60"
    soup = _fetch_soup(url)
    if soup is None:
        return []

    # Find the constituents table on the TSX 60 Wikipedia page
    table = soup.find("table", {"id": "constituents"})
    if table is None:
        tables = soup.find_all("table", {"class": "wikitable"})
        table = tables[0] if tables else None

    if table is None:
        return []

    symbols = []
    for row in table.find_all("tr")[1:]:
        cells = row.find_all("td")
        if not cells:
            continue
        ticker_text = cells[0].text.strip().replace(".", "-")
        if not ticker_text.endswith(".TO") and len(ticker_text) <= 5:
            ticker_text = f"{ticker_text}.TO"
        symbols.append(ticker_text)

    return symbols


def load_etfs() -> list:
    # Fetch and parse American exchange-traded funds from Wikipedia dynamically
    url = "https://en.wikipedia.org/wiki/List_of_American_exchange-traded_funds"
    soup = _fetch_soup(url)

    etfs = []
    if soup is not None:
        for li in soup.find_all("li"):
            text = li.get_text()
            matches = re.findall(
                r"(?:NYSE\s*(?:Arca)?|NASDAQ|AMEX)[:\s]+([A-Z\-]+)", text
            )
            for ticker in matches:
                etfs.append(ticker.strip().replace(".", "-"))

    canadian_etfs = [
        "XEQT.TO", "VEQT.TO", "VFV.TO", "VDY.TO", "XEI.TO", "XIU.TO", "XIC.TO",
        "VAB.TO", "XBB.TO", "CASH.TO", "PSA.TO"
    ]

    return list(set(etfs + canadian_etfs))


def load_gold() -> list:
    # Return commodity fund symbols for gold tracking
    return ["GLD"]


def load_symbols() -> list:
    # Combine and deduplicate all loaded US and Canadian symbol groups into a single list
    return list(set(load_sp500() + load_tsx60() + load_etfs() + load_gold()))


# -------- Parquet Database Operations --------
def init_db() -> None:
    # Ensure local parquet directory exists
    parquet_dir = get_parquet_dir()
    os.makedirs(parquet_dir, exist_ok=True)
    print(f"Local Parquet storage initialized at: {parquet_dir}")


def _validate_tickers(tickers: list) -> list:
    """
    Confirms each symbol still resolves to a real listing before we spend time
    downloading it.

    The universe is scraped from Wikipedia index/ETF tables, which keep rows
    for companies and funds that have since been delisted, merged away or
    renamed. yfinance then returns nothing for those, so they silently consume
    a slot in every download batch while never contributing data. Checking up
    front means the delisted names are dropped explicitly and reported, rather
    than being discovered implicitly (or not at all) during ingestion.
    """
    if not tickers:
        return []

    valid: list = []
    invalid: list = []

    for ticker in tickers:
        try:
            ticker_info = yf.Ticker(ticker)
            # history() is the same call the bulk download uses, so a symbol
            # that passes here is one that will actually return bars.
            probe = ticker_info.history(period="5d", auto_adjust=False)
            if probe is None or probe.empty:
                invalid.append(ticker)
            else:
                valid.append(ticker)
        except Exception:
            invalid.append(ticker)

    if invalid:
        print(
            f"-> Skipping {len(invalid)} delisted/unresolvable symbol(s): "
            f"{', '.join(invalid[:20])}{' ...' if len(invalid) > 20 else ''}"
        )

    return valid


def process_and_save_bars(download_list: list,
                          df: pd.DataFrame) -> None:
    # Return early if dataframe or download list is empty
    if df is None or df.empty or not download_list:
        return

    parquet_dir = get_parquet_dir()
    master_file_path = os.path.join(parquet_dir, "market_data.parquet")
    print(f"Processing bar data for {len(download_list)} tickers...")

    new_rows_list = []
    written_tickers = set()

    for ticker in download_list:
        safe_ticker = ticker.replace(".", "-")

        stock_df = None
        try:
            if isinstance(df.columns, pd.MultiIndex):
                if ticker in df.columns.get_level_values(1):
                    stock_df = df.xs(ticker, level=1, axis=1).dropna(how="all").reset_index()
                elif ticker in df.columns.get_level_values(0):
                    stock_df = df[ticker].dropna(how="all").reset_index()
                elif safe_ticker in df.columns.get_level_values(1):
                    stock_df = df.xs(safe_ticker, level=1, axis=1).dropna(how="all").reset_index()
                elif safe_ticker in df.columns.get_level_values(0):
                    stock_df = df[safe_ticker].dropna(how="all").reset_index()
            else:
                stock_df = df.dropna(how="all").reset_index()
        except Exception:
            continue

        if stock_df is None or stock_df.empty:
            continue

        # Capitalize column headers and ensure date column exists
        stock_df.columns = [str(c).capitalize() for c in stock_df.columns]
        if "Date" not in stock_df.columns:
            stock_df.rename(columns={stock_df.columns[0]: "Date"}, inplace=True)

        # Standardize date format to string representation
        stock_df["Date"] = pd.to_datetime(stock_df["Date"]).dt.strftime("%Y-%m-%d")

        required_cols = ["Date", "Open", "High", "Low", "Close", "Volume"]
        for col in required_cols:
            if col not in stock_df.columns:
                stock_df[col] = None

        # Clean and filter valid rows
        valid_rows = stock_df.dropna(subset=["Date", "Close"])[required_cols].copy()
        if valid_rows.empty:
            continue

        # Insert Symbol column to distinguish tickers inside the single master file
        valid_rows.insert(0, "Symbol", ticker)
        new_rows_list.append(valid_rows)
        written_tickers.add(ticker)

    if not new_rows_list:
        print("No valid new bars to save.")
        return

    incoming_df = pd.concat(new_rows_list, ignore_index=True)

    unwritten = [t for t in download_list if t not in written_tickers]
    if unwritten:
        print(
            f"-> {len(unwritten)} requested symbol(s) returned no usable bars "
            f"and were not written: {', '.join(unwritten[:20])}"
            f"{' ...' if len(unwritten) > 20 else ''}"
        )

    # Merge incoming data with the master Parquet file to preserve historical records safely
    if os.path.exists(master_file_path):
        try:
            existing_df = pd.read_parquet(master_file_path)
            combined_df = pd.concat([existing_df, incoming_df]).drop_duplicates(subset=["Symbol", "Date"]).sort_values(["Symbol", "Date"])
            combined_df.to_parquet(master_file_path, compression="snappy", index=False)
            print(f"Successfully updated master Parquet file: {master_file_path}")
        except Exception as e:
            print(f"Error updating master parquet file, overwriting: {e}")
            incoming_df.to_parquet(master_file_path, compression="snappy", index=False)
    else:
        incoming_df.to_parquet(master_file_path, compression="snappy", index=False)
        print(f"Successfully created master Parquet file: {master_file_path}")


def insert_or_update_data() -> None:
    init_db()
    raw_tickers = load_symbols()

    # Drop delisted/renamed symbols before any download work happens, so they
    # never reach market_data.parquet in the first place.
    all_tickers = _validate_tickers(raw_tickers)
    print(f"-> Universe: {len(raw_tickers)} scraped, {len(all_tickers)} tradable")

    if not all_tickers:
        print("No tradable symbols resolved — aborting without touching the master file.")
        return

    download_all_data = []
    download_previous_data = []

    today = datetime.now().date()
    offset = 0

    # Adjust date offset for weekend days
    if today.weekday() == 5:
        offset = 1
    elif today.weekday() == 6:
        offset = 2

    yesterday_str = (today - timedelta(days=offset)).strftime("%Y-%m-%d")
    parquet_dir = get_parquet_dir()
    master_file_path = os.path.join(parquet_dir, "market_data.parquet")

    print("Analyzing local master Parquet ticker states...")

    existing_symbols_map = {}
    if os.path.exists(master_file_path):
        try:
            existing_df = pd.read_parquet(master_file_path)
            if not existing_df.empty and "Symbol" in existing_df.columns and "Date" in existing_df.columns:
                # Map each successfully saved symbol to its latest available date
                existing_symbols_map = existing_df.groupby("Symbol")["Date"].max().to_dict()
        except Exception as e:
            print(f"Error reading master parquet for state analysis: {e}")

    # Categorize tickers based on presence in the master file and last update date
    for ticker in all_tickers:
        last_date = existing_symbols_map.get(ticker)
        if not last_date:
            download_all_data.append(ticker)
        elif last_date < yesterday_str:
            download_previous_data.append(ticker)

    print(f"-> Full history download required for: {len(download_all_data)} tickers")
    print(f"-> Recent update (5-day) required for: {len(download_previous_data)} tickers")

    if download_all_data:
        print("Downloading MAX history data in bulk...")
        try:
            df_max = yf.download(
                tickers=download_all_data,
                period="max",
                interval="1d",
                group_by="ticker",
                auto_adjust=False,
                progress=False,
            )
            process_and_save_bars(download_all_data, df_max)
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
                auto_adjust=False,
                progress=False,
            )
            process_and_save_bars(download_previous_data, df_5d)
        except Exception as e:
            print(f"Batch 5d download error: {e}")

    print("Local Parquet database sync completed successfully.")


# -------- Entry Point --------
if __name__ == "__main__":
    init_db()
    insert_or_update_data()