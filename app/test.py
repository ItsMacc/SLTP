from time import time
from datetime import datetime
from dateutil.relativedelta import relativedelta
from app.database.fetch import get_stock_histories
from app.database.db import load_symbols

all_symbols = load_symbols()
to_fetch = all_symbols

curr = datetime.now()
start_date = (curr - relativedelta(years=50)).strftime("%Y-%m-%d")

runs = 1
total_e1 = 0.0
total_e2 = 0.0

print(f"Running benchmark for {runs} iterations...")

for i in range(runs):
    # Run 1: With explicit start date
    t1 = time()
    _ = get_stock_histories(to_fetch, start=start_date)
    e1 = time() - t1
    total_e1 += e1

    # Run 2: Without start date (All history / cached check)
    t2 = time()
    _ = get_stock_histories(to_fetch)
    e2 = time() - t2
    total_e2 += e2

avg_e1 = total_e1 / runs
avg_e2 = total_e2 / runs

print(f"\nAverage Time over {runs} runs:")
print(f"With start_date: {avg_e1:.4f} seconds")
print(f"Without start_date (Cached): {avg_e2:.4f} seconds")