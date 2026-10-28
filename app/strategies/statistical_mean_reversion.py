# statistical_mean_reversion.py — Statistical Mean Reversion (SMR) strategy.
#
# Long-only. Buys a name that is oversold and far below its 20-bar mean
# (RSI < 30 and z-score < -1.5). Stop and target sit 3 standard deviations
# from the entry close. Exits when RSI recovers, earlier the further the
# price has stretched from its mean.
#
# Universe: top 100 names by 252-bar trailing dollar volume, with up to 20
# ETF slots. Rebuilt yearly; held names stay in until they close.

# -------- Imports --------
import numpy as np
from app.engine.strategy.strategy import Strategy
from app.engine.utils.Order import Order
from app.engine.utils.PositionType import PositionType
from app.engine.utils.RebalanceFrequency import RebalanceFrequency
from app.engine.utils.StockData import StockData
from app.engine.utils.Trade import Trade


# -------- Statistical Mean Reversion Strategy --------
class StatisticalMeanReversionStrategy(Strategy):
    name: str = "Statistical Mean Reversion"
    description: str = (
        "Identifies oversold dislocations using RSI and Z-Scores with "
        "confidence-weighted sizing and dynamic volatility exits."
    )

    # Book policy
    MAX_POSITIONS = 25
    MAX_LOTS_PER_TICKER = 1
    REBALANCE_FREQUENCY = RebalanceFrequency.YEARLY

    # Universe
    UNIVERSE_SIZE = 100
    ETF_QUOTA = 20
    LIQUIDITY_BARS = 252

    # Signal parameters
    RSI_PERIOD = 25
    Z_SCORE_PERIOD = 20
    RSI_THRESHOLD = 30.0
    RSI_EXIT_THRESHOLD = 70.0
    Z_SCORE_THRESHOLD = 1.5
    STDEV_EXIT_MULTIPLE = 3.0
    MIN_BARS_REQUIRED = max(RSI_PERIOD, Z_SCORE_PERIOD) + 2

    # -------- Universe --------
    def initialize_universe(self, current_date: str) -> bool:
        self.tickers.clear()
        self.add_tickers(self._top_candidates(current_date))
        return bool(self.tickers)

    def on_rebalance(self, current_date: str) -> None:
        # Keep held names, drop the rest, then fill the vacancies
        for ticker in list(self.tickers):
            if not self.is_open(ticker):
                self.remove_ticker(ticker)

        vacancies = self.UNIVERSE_SIZE - len(self.tickers)
        if vacancies > 0:
            new = [t for t in self._top_candidates(current_date, vacancies)
                   if t not in self.tickers]
            self.add_tickers(new)

    def _top_candidates(self, current_date: str, n: int | None = None) -> list[str]:
        n = self.UNIVERSE_SIZE if n is None else n
        known_etfs = set(self.available_etfs)
        histories = self.get_histories(self.available_universe, end=current_date)

        scored_etfs: list[tuple[str, float]] = []
        scored_stocks: list[tuple[str, float]] = []
        for ticker, data in histories.items():
            if data is None or len(data.close_price) < self.LIQUIDITY_BARS:
                continue
            closes = data.close_price[-self.LIQUIDITY_BARS:]
            volumes = data.volume[-self.LIQUIDITY_BARS:]
            dollar_volume = float(np.sum(closes * volumes))
            (scored_etfs if ticker in known_etfs else scored_stocks).append((ticker, dollar_volume))

        scored_etfs.sort(key=lambda pair: pair[1], reverse=True)
        scored_stocks.sort(key=lambda pair: pair[1], reverse=True)

        etf_slots = min(self.ETF_QUOTA, n)
        picked_etfs = [t for t, _ in scored_etfs[:etf_slots]]
        picked_stocks = [t for t, _ in scored_stocks[:max(0, n - len(picked_etfs))]]
        return picked_etfs + picked_stocks

    # -------- Signals --------
    def on_signal(self, ticker: str, data: StockData) -> Order | None:
        if self.is_open(ticker):
            return None

        closes = data.close_price
        close = float(closes[-1])
        stdev = float(np.std(closes[-self.Z_SCORE_PERIOD:], ddof=1))
        if close <= 0 or stdev == 0:
            return None

        rsi = float(self._rsi(closes, self.RSI_PERIOD)[-1])
        sma = float(self._sma(closes, self.Z_SCORE_PERIOD)[-1])
        z_score = (close - sma) / stdev

        if not (rsi < self.RSI_THRESHOLD and z_score < -self.Z_SCORE_THRESHOLD):
            return None

        # Logistic confidence: deeper dislocation gives a larger share of the base
        k = 2.0
        confidence = 1.0 / (1.0 + np.exp(-k * (-self.Z_SCORE_THRESHOLD - z_score)))
        confidence = float(np.clip(confidence, 0.0, 1.0))

        base = 1.0 / self.MAX_POSITIONS
        weight = round(min(1.0, base * (1.0 + confidence)), 4)

        distance = self.STDEV_EXIT_MULTIPLE * stdev
        return Order(
            ticker=ticker,
            position_type=PositionType.LONG,
            weight=weight,
            order_date=str(data.dates[-1]),
            stop_loss=round(close - distance, 2),
            take_profit=round(close + distance, 2),
        )

    def should_exit(self, ticker: str, trade: Trade, data: StockData) -> bool:
        # Lower the RSI exit the further price has stretched from its mean
        closes = data.close_price
        stdev = float(np.std(closes[-self.Z_SCORE_PERIOD:], ddof=1))
        if stdev == 0:
            return False

        rsi = float(self._rsi(closes, self.RSI_PERIOD)[-1])
        sma = float(self._sma(closes, self.Z_SCORE_PERIOD)[-1])
        z_magnitude = abs((float(closes[-1]) - sma) / stdev)
        exit_threshold = self.RSI_EXIT_THRESHOLD - max(0.0, (z_magnitude - 1.0) * 3.0)
        return rsi >= exit_threshold
