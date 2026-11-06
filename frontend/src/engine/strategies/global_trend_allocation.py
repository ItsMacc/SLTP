# -------- global_trend_allocation.py --------
# GTA: Global Trend Allocation Strategy
#

# -------- Imports --------
from collections import deque

import numpy as np

# Engine imports
from sltp import Strategy
from sltp import Order, OrderSizing
from sltp import StockData
from sltp import Trade
from sltp import PositionType
from sltp import RebalanceFrequency


# -------- Global Trend Allocation Strategy --------
class GlobalTrendAllocation(Strategy):
    def __init__(self):
        super().__init__()

        self.name: str = "Global Trend Allocation"
        self.description: str = "Systematic trend allocation across liquid ETFs leveraging momentum, correlation isolation, and market filters."

        # Book policy
        self.MAX_POSITIONS: int = 5
        self.MAX_LOTS_PER_TICKER: int = 1
        self.MAX_ALLOCATION_PER_TICKER = 0.199
        self.REBALANCE_FREQUENCY: RebalanceFrequency = RebalanceFrequency.MONTHLY
        self.MIN_BARS_REQUIRED: int = 252
        self.LIQUIDATE_ON_END: bool = False

        # ETF picks
        self.FIRST_PICK: str = None
        self.SECOND_PICK: str = None
        self.THIRD_PICK: str = None
        self.FOURTH_PICK: str = None
        self.FIFTH_PICK: str = None

        self.ETF_UNIVERSE: tuple[str, ...] | None = (
            "SPY", "QQQ", "IWM", "EFA", "EEM", "VNQ", "DBC",
            "GLD", "TLT", "IEF", "LQD", "HYG", "AGG", "UUP",
        )

        # PARAMS
        self.TEN_MONTHS = 210  # Roughly 10 months of trading bars
        self.ONE_YEAR = 252  # Roughly 1 year of trading bars
        self.ABSOLUTE_CORRELATION_THRESHOLD = 0.2

        # Rolling 10-month SMA state for exits
        self._sma_windows: dict[str, deque[float]] = {}
        self._sma_sums: dict[str, float] = {}
        self._sma_last_code: dict[str, int] = {}


    # -------- Universe Management --------
    def initialize_universe(self, current_date: str, histories: dict[str, StockData]) -> bool:
        self.tickers.clear()
        active_targets = self._execute_selection_matrix(histories)
        self.tickers = active_targets

        return bool(self.tickers)

    def on_rebalance(self, current_date: str, histories: dict[str, StockData]) -> None:
        active_targets = self._execute_selection_matrix(histories)
        self.tickers = active_targets

    def run_daily(self, current_date: str) -> None:
        # Maintain the rolling window from the latest history published on each open lot.
        for trade in self.open_positions:
            self._update_rolling_sma(trade.ticker, trade.history)

    # -------- Signals --------
    def on_signal(self, ticker: str, data: StockData) -> Order | None:
        if ticker in self.open_tickers:
            return None

        return Order(
            ticker=ticker,
            position_type=PositionType.LONG,
            allocation=self.MAX_ALLOCATION_PER_TICKER,
            sizing=OrderSizing.EQUITY,
            order_date=str(data.dates[-1]),
            stop_loss=round(0.0),
            take_profit=round(0.0),
        )

    def should_exit(self, ticker: str, trade: Trade, history: StockData | None = None) -> bool:
        # A name dropped by the monthly matrix is sold. A name still in the matrix
        # is sold as soon as its close breaks the 10-month SMA, before the next
        # scheduled rebalance.
        if ticker not in self.tickers:
            return True
        if history is None or len(history.close_price) == 0:
            return False

        self._update_rolling_sma(ticker, history)
        sma = self._rolling_sma(ticker)
        if sma is None or float(history.close_price[-1]) > sma:
            return False

        # Remove it now as well as queueing the exit.
        if ticker in self.tickers:
            self.tickers.remove(ticker)
        return True

    # -------- Helper Methods --------
    def _update_rolling_sma(self, ticker: str, history: StockData) -> None:
        closes = history.close_price
        codes = history.date_codes
        if len(closes) == 0:
            return

        window = self._sma_windows.setdefault(ticker, deque(maxlen=self.TEN_MONTHS))
        total = self._sma_sums.get(ticker, 0.0)
        last_code = self._sma_last_code.get(ticker)
        start = 0 if last_code is None else int(np.searchsorted(codes, last_code, side="right"))

        for index in range(start, len(codes)):
            if len(window) == self.TEN_MONTHS:
                total -= window[0]
            value = float(closes[index])
            window.append(value)
            total += value

        if start < len(codes):
            self._sma_last_code[ticker] = int(codes[-1])
            self._sma_sums[ticker] = total

    def _rolling_sma(self, ticker: str) -> float | None:
        window = self._sma_windows.get(ticker)
        if window is None or len(window) < self.TEN_MONTHS:
            return None
        return self._sma_sums.get(ticker, 0.0) / self.TEN_MONTHS

    def _execute_selection_matrix(self, histories: dict[str, StockData]) -> list[str]:
        # Calculates all 5 structural allocations sequentially using historic data snapshots.
        # This is a global ETF book: rank the ETF universe, not every listed company.
        etf_universe = set(self.available_etfs)
        if self.ETF_UNIVERSE is not None:
            etf_universe &= set(self.ETF_UNIVERSE)
        histories = {ticker: data for ticker, data in histories.items() if ticker in etf_universe}
        sorted_etfs = self._sort_universe(histories)
        if not sorted_etfs:
            return []

        # Reset target allocations for fresh structural lookups
        self.FIRST_PICK = None
        self.SECOND_PICK = None
        self.THIRD_PICK = None
        self.FOURTH_PICK = None
        self.FIFTH_PICK = None

        # PICK 1: High Liquidity Trend Anchor
        for etf in sorted_etfs:
            closes = histories[etf].close_price
            if len(closes) < self.TEN_MONTHS:
                continue
            if closes[-1] > self._sma(closes, self.TEN_MONTHS)[-1]:
                self.FIRST_PICK = etf
                break

        # PICK 2: Non-Correlated Asset Cluster
        if self.FIRST_PICK:
            p1_closes = np.array(histories[self.FIRST_PICK].close_price)
            if len(p1_closes) >= self.TEN_MONTHS:
                corr_lookback = min(self.ONE_YEAR, len(p1_closes))
                # Percentage daily returns
                p1_returns = np.diff(p1_closes[-corr_lookback:]) / p1_closes[-corr_lookback:-1]

                for etf in sorted_etfs:
                    if etf == self.FIRST_PICK:
                        continue

                    closes = np.array(histories[etf].close_price)
                    if len(closes) < max(self.TEN_MONTHS, corr_lookback):
                        continue

                    etf_returns = np.diff(closes[-corr_lookback:]) / closes[-corr_lookback:-1]
                    corr_matrix = np.corrcoef(p1_returns, etf_returns)

                    if np.isnan(corr_matrix[0, 1]):
                        continue

                    correlation = corr_matrix[0, 1]
                    if -self.ABSOLUTE_CORRELATION_THRESHOLD <= correlation <= self.ABSOLUTE_CORRELATION_THRESHOLD:
                        if closes[-1] > self._sma(closes, self.TEN_MONTHS)[-1]:
                            self.SECOND_PICK = etf
                            break

        # PICK 3: Primary 1-Year Momentum Winner
        momentum_map_1y = {}
        for etf in sorted_etfs:
            if etf in [self.FIRST_PICK, self.SECOND_PICK]:
                continue

            closes = np.array(histories[etf].close_price)
            if len(closes) < max(self.ONE_YEAR, self.TEN_MONTHS):
                continue
            if closes[-1] <= self._sma(closes, self.TEN_MONTHS)[-1]:
                continue

            price_1y_ago = closes[-self.ONE_YEAR]
            if price_1y_ago > 0:
                momentum_map_1y[etf] = (closes[-1] - price_1y_ago) / price_1y_ago

        if momentum_map_1y:
            ranked_1y = sorted(momentum_map_1y.items(), key=lambda x: x[1], reverse=True)
            self.THIRD_PICK = ranked_1y[0][0]

        # PICK 4: Secondary 1-Year Momentum Winner (Runner Up)
        momentum_map_p4 = {}
        for etf in sorted_etfs:
            if etf in [self.FIRST_PICK, self.SECOND_PICK, self.THIRD_PICK]:
                continue

            closes = np.array(histories[etf].close_price)
            if len(closes) < max(self.ONE_YEAR, self.TEN_MONTHS):
                continue
            if closes[-1] <= self._sma(closes, self.TEN_MONTHS)[-1]:
                continue

            price_1y_ago = closes[-self.ONE_YEAR]
            if price_1y_ago > 0:
                momentum_map_p4[etf] = (closes[-1] - price_1y_ago) / price_1y_ago

        if momentum_map_p4:
            ranked_p4 = sorted(momentum_map_p4.items(), key=lambda x: x[1], reverse=True)
            self.FOURTH_PICK = ranked_p4[0][0]

        # PICK 5: Tactical Safe Haven (Gold vs. Treasuries)
        haven_map = {}
        for etf in ["GLD", "TLT"]:
            if etf not in histories:
                continue
            if etf in [self.FIRST_PICK, self.SECOND_PICK, self.THIRD_PICK, self.FOURTH_PICK]:
                continue

            closes = np.array(histories[etf].close_price)
            if len(closes) < max(63, self.TEN_MONTHS):  # 63 bars = ~3 months
                continue
            if closes[-1] <= self._sma(closes, self.TEN_MONTHS)[-1]:
                continue

            price_3m_ago = closes[-63]
            if price_3m_ago > 0:
                haven_map[etf] = (closes[-1] - price_3m_ago) / price_3m_ago

        if haven_map:
            ranked_havens = sorted(haven_map.items(), key=lambda x: x[1], reverse=True)
            self.FIFTH_PICK = ranked_havens[0][0]

        # Collect valid allocations to hand off to the portfolio engine lists
        active_targets = []
        for target in [self.FIRST_PICK, self.SECOND_PICK, self.THIRD_PICK, self.FOURTH_PICK, self.FIFTH_PICK]:
            if target and target not in active_targets:
                active_targets.append(target)
        return active_targets

    @staticmethod
    def _sort_universe(histories: dict[str, StockData]) -> list[str]:
        # Sorts all active available assets inside historical memory by median dollar volume
        volume_map = {}
        for ticker, data in histories.items():
            closes = data.close_price
            volumes = data.volume
            if len(closes) < 30 or len(volumes) < 30:
                continue

            # Dollar Volume calculation = Price * Volume over past 30 periods
            dollar_vol = np.array(closes[-30:]) * np.array(volumes[-30:])
            volume_map[ticker] = np.median(dollar_vol)

        return [ticker for ticker, _ in sorted(volume_map.items(), key=lambda item: item[1], reverse=True)]
