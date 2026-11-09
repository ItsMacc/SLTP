import yfinance as yf

data =yf.download('AAPL', interval="1m", start="2026-11-04", end="2026-11-06")
print(data)