from __future__ import annotations

# lab_templates.py — Starter source for Lab projects using the current engine.
# Students implement Strategy hooks and return an Order; PortfolioManager is
# owned by the backtester and is available as read-only core reference.

BLANK_ID = "blank"

BLANK_SOURCES = {
    "workspace/custom_strategy.py": '''from core.strategy.base_strategy import Strategy
from core.utils.Order import Order
from core.utils.PositionType import PositionType
from core.utils.StockData import StockData


class CustomStrategy(Strategy):
    def __init__(self):
        super().__init__()
        self.name = "Custom Strategy"
        self.description = "Describe what this strategy does."
        self.MAX_POSITIONS = 10
        self.MIN_BARS_REQUIRED = 1

    def initialize_universe(self, current_date: str) -> bool:
        # The available universe reads the cached symbol catalog.
        self.add_tickers(self.available_universe[:10])
        return bool(self.tickers)

    def on_signal(self, ticker: str, data: StockData) -> Order | None:
        # Return None when there is no entry signal; otherwise return an Order.
        return None
''',
}

EMA_CROSSOVER_SOURCES = {
    "workspace/ema_crossover_strategy.py": '''from core.strategy.base_strategy import Strategy
from core.utils.Order import Order
from core.utils.PositionType import PositionType
from core.utils.StockData import StockData


class EmaCrossover(Strategy):
    def __init__(self):
        super().__init__()
        self.name = "EMA crossover"
        self.description = "Buy when the 12-day EMA crosses above the 26-day EMA."
        self.MAX_POSITIONS = 10
        self.MIN_BARS_REQUIRED = 30

    def initialize_universe(self, current_date: str) -> bool:
        self.add_tickers(self.available_stocks[:100])
        return bool(self.tickers)

    def on_signal(self, ticker: str, data: StockData) -> Order | None:
        fast = self._ema(data.close_price, 12)
        slow = self._ema(data.close_price, 26)
        crossed_up = fast[-2] <= slow[-2] and fast[-1] > slow[-1]
        if not crossed_up:
            return None

        close = float(data.close_price[-1])
        return Order(
            ticker=ticker,
            position_type=PositionType.LONG,
            allocation=0.10,
            order_date=str(data.dates[-1]),
            stop_loss=round(close * 0.92, 2),
            take_profit=round(close * 1.16, 2),
        )
''',
}

RSI_PULLBACK_SOURCES = {
    "workspace/rsi_pullback_strategy.py": '''from core.strategy.base_strategy import Strategy
from core.utils.Order import Order
from core.utils.PositionType import PositionType
from core.utils.StockData import StockData


class RsiPullback(Strategy):
    def __init__(self):
        super().__init__()
        self.name = "RSI pullback"
        self.description = "Buy an oversold dip while price remains above its 50-day average."
        self.MAX_POSITIONS = 8
        self.MIN_BARS_REQUIRED = 60

    def initialize_universe(self, current_date: str) -> bool:
        self.add_tickers(self.available_stocks[:100])
        return bool(self.tickers)

    def on_signal(self, ticker: str, data: StockData) -> Order | None:
        rsi = self._rsi(data.close_price, 14)
        trend = self._sma(data.close_price, 50)
        close = float(data.close_price[-1])
        if not (rsi[-1] < 30 and close > trend[-1]):
            return None

        return Order(
            ticker=ticker,
            position_type=PositionType.LONG,
            allocation=0.10,
            order_date=str(data.dates[-1]),
            stop_loss=round(close * 0.94, 2),
            take_profit=round(close * 1.12, 2),
        )
''',
}

PARABOLIC_SAR_SOURCES = {
    "workspace/parabolic_sar_strategy.py": '''from core.strategy.base_strategy import Strategy
from core.utils.Order import Order
from core.utils.PositionType import PositionType
from core.utils.StockData import StockData


class ParabolicSarTrend(Strategy):
    def __init__(self):
        super().__init__()
        self.name = "Parabolic SAR trend"
        self.description = "Buy when price flips above the Parabolic SAR."
        self.MAX_POSITIONS = 10
        self.MIN_BARS_REQUIRED = 20

    def initialize_universe(self, current_date: str) -> bool:
        self.add_tickers(self.available_stocks[:100])
        return bool(self.tickers)

    def on_signal(self, ticker: str, data: StockData) -> Order | None:
        sar = self._parabolic_sar(data.high, data.low)
        close = data.close_price
        flipped_up = close[-2] <= sar[-2] and close[-1] > sar[-1]
        if not flipped_up or sar[-1] <= 0 or sar[-1] >= close[-1]:
            return None

        close_now = float(close[-1])
        return Order(
            ticker=ticker,
            position_type=PositionType.LONG,
            allocation=0.10,
            order_date=str(data.dates[-1]),
            stop_loss=round(float(sar[-1]), 2),
            take_profit=round(close_now * 1.25, 2),
        )
''',
}

TEMPLATE_SOURCES: dict[str, dict[str, str]] = {
    "ema-crossover": EMA_CROSSOVER_SOURCES,
    "rsi-pullback": RSI_PULLBACK_SOURCES,
    "parabolic-sar": PARABOLIC_SAR_SOURCES,
}


def source_for(template_id: str | None) -> dict[str, str] | None:
    """Starter files for a template id. Returns None for an unknown id."""
    if not template_id or template_id == BLANK_ID:
        return dict(BLANK_SOURCES)
    if template_id not in TEMPLATE_SOURCES:
        return None
    return dict(TEMPLATE_SOURCES[template_id])
