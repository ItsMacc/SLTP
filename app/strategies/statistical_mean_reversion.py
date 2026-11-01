# -------- statistical_mean_reversion.py --------
# Statistical Mean Reversion (SMR): buys oversold names that sit far below their mean.
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

# Engine imports
from app.engine.strategy import Strategy
from app.engine.utils.Order import Order
from app.engine.utils.Trade import Trade
from app.engine.utils.StockData import StockData
from app.engine.utils.PositionType import PositionType
from app.engine.utils.RebalanceFrequency import RebalanceFrequency


# -------- Statistical Mean Reversion Strategy --------
class StatisticalMeanReversionStrategy(Strategy):
    # Set up the book policy, universe rules and signal parameters.
    def __init__(self):
        super().__init__()

        self.name: str = "Statistical Mean Reversion"
        self.description: str = "Identifies oversold dislocations using RSI and Z-Scores with confidence-weighted sizing and dynamic volatility exits."

        # Book policy
        self.MAX_POSITIONS: int = 20
        self.MAX_LOTS_PER_TICKER: int = 1
        self.REBALANCE_FREQUENCY: RebalanceFrequency = RebalanceFrequency.YEARLY

        # Universe
        self.UNIVERSE_SIZE: int = 100
        self.ETF_QUOTA: int = 20
        self.LIQUIDITY_BARS: int = 252

        # Signal parameters. Periods are ints: they are used as slice indices, and a float there raises.
        self.RSI_PERIOD: int = 25
        self.Z_SCORE_PERIOD: int = 20
        self.RSI_THRESHOLD: float = 30.0
        self.RSI_EXIT_THRESHOLD: float = 70.0
        self.Z_SCORE_THRESHOLD: float = 1.5
        self.STDEV_EXIT_MULTIPLE: float = 3.0
        self.MIN_BARS_REQUIRED: int = max(self.RSI_PERIOD, self.Z_SCORE_PERIOD) + 2

    # -------- Universe --------
    # Pick the first universe from the histories the manager hands over.
    def initialize_universe(self, current_date: str, histories: dict[str, StockData]) -> bool:
        self.tickers.clear()
        self.add_tickers(self._top_candidates(histories))
        return bool(self.tickers)

    # Keep held names, drop the rest, then fill the vacancies from today's ranking.
    def on_rebalance(self, current_date: str, histories: dict[str, StockData]) -> None:
        for ticker in list(self.tickers):
            if ticker not in self.open_tickers:
                self.remove_ticker(ticker)

        vacancies: int = self.UNIVERSE_SIZE - len(self.tickers)
        if vacancies > 0:
            new: list[str] = [t for t in self._top_candidates(histories, vacancies) if t not in self.tickers]
            self.add_tickers(new)

    # Rank candidates by trailing dollar volume, with a quota for ETFs.
    def _top_candidates(self, histories: dict[str, StockData], n: int | None = None) -> list[str]:
        n = self.UNIVERSE_SIZE if n is None else n
        known_etfs: set[str] = set(self.available_etfs)

        scored_etfs: list[tuple[str, float]] = []
        scored_stocks: list[tuple[str, float]] = []
        for ticker, history in histories.items():
            if history is None or len(history.close_price) < self.LIQUIDITY_BARS:
                continue
            closes = history.close_price[-self.LIQUIDITY_BARS:]
            volumes = history.volume[-self.LIQUIDITY_BARS:]
            dollar_volume: float = float(np.sum(closes * volumes))
            (scored_etfs if ticker in known_etfs else scored_stocks).append((ticker, dollar_volume))

        scored_etfs.sort(key=lambda pair: pair[1], reverse=True)
        scored_stocks.sort(key=lambda pair: pair[1], reverse=True)

        etf_slots: int = min(self.ETF_QUOTA, n)
        picked_etfs: list[str] = [t for t, _ in scored_etfs[:etf_slots]]
        picked_stocks: list[str] = [t for t, _ in scored_stocks[:max(0, n - len(picked_etfs))]]
        return picked_etfs + picked_stocks

    # -------- Signals --------
    # Buy one lot when RSI and the z-score both say the name is stretched down.
    def on_signal(self, ticker: str, data: StockData) -> Order | None:
        # Never stack a second lot on a name we already hold.
        if ticker in self.open_tickers:
            return None

        closes = data.close_price
        close: float = float(closes[-1])
        stdev: float = float(np.std(closes[-self.Z_SCORE_PERIOD:], ddof=1))
        if close <= 0 or stdev == 0:
            return None

        rsi: float = float(self._rsi(closes, self.RSI_PERIOD)[-1])
        sma: float = float(self._sma(closes, self.Z_SCORE_PERIOD)[-1])
        z_score: float = (close - sma) / stdev

        if not (rsi < self.RSI_THRESHOLD and z_score < -self.Z_SCORE_THRESHOLD):
            return None

        # Logistic confidence: a deeper dislocation earns a larger share of the base size.
        k: float = 2.0
        confidence: float = 1.0 / (1.0 + np.exp(-k * (-self.Z_SCORE_THRESHOLD - z_score)))
        confidence = float(np.clip(confidence, 0.0, 1.0))

        base: float = 1.0 / self.MAX_POSITIONS
        allocation: float = round(min(1.0, base * (1.0 + confidence)), 4)

        distance: float = self.STDEV_EXIT_MULTIPLE * stdev
        return Order(
            ticker=ticker,
            position_type=PositionType.LONG,
            allocation=allocation,
            order_date=str(data.dates[-1]),
            stop_loss=round(close - distance, 2),
            take_profit=round(close + distance, 2),
        )

    # Exit once RSI recovers, with a threshold that loosens as price stretches further out.
    def should_exit(self, ticker: str, trade: Trade, history: StockData | None = None) -> bool:
        closes = (history if history is not None else trade.history).close_price
        stdev: float = float(np.std(closes[-self.Z_SCORE_PERIOD:], ddof=1))
        if stdev == 0:
            return False

        rsi: float = float(self._rsi(closes, self.RSI_PERIOD)[-1])
        sma: float = float(self._sma(closes, self.Z_SCORE_PERIOD)[-1])
        z_magnitude: float = abs((float(closes[-1]) - sma) / stdev)

        # Square-root scaling: the farther from the mean, the lower the RSI needed to leave.
        excess_z: float = max(0.0, z_magnitude - 1.0)
        exit_threshold: float = self.RSI_EXIT_THRESHOLD - (np.sqrt(excess_z) * 2.0)

        return rsi >= exit_threshold
