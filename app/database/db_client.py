# db_client.py — Local Parquet storage path configuration.
#
# Single source of truth for where market data lives on disk, shared by
# the ingestion (db.py) and query (fetch.py) layers.

# -------- Imports --------
import os

# -------- Path Setup --------
PARQUET_DIR = os.path.join(os.path.dirname(__file__), "stock_data")
os.makedirs(PARQUET_DIR, exist_ok=True)

def get_parquet_dir() -> str:
    """Returns the absolute path to the local Parquet data storage directory."""
    return PARQUET_DIR