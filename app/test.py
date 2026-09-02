from time import time
from datetime import datetime
from dateutil.relativedelta import relativedelta
from app.database.fetch import get_stock_histories
from app.database.db import load_symbols
from app.backtester import backtest_strategy, backtest_results
from app.strategies.stock_health_filter import StockHealthFilterStrategy

st = StockHealthFilterStrategy()
backtest_strategy(st, 2)

print(backtest_results(st))