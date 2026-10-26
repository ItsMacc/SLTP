from __future__ import annotations

# lab_templates.py — Starter source for new Lab projects.
#
# Every project has the same two-part shape:
#
#   core/       the read-only engine, mirrored from the repo by lab_core.py
#   workspace/  the files the student edits
#
# A template is therefore a pair of files in workspace/: a Strategy and the
# PortfolioManager it hands its decisions to. Both import the engine through
# its stable `core.*` paths, so the code in the editor is the code that runs:
#
#   from core.strategy.strategy import Strategy
#   from core.portfolio.portfolio_manager import PortfolioManager, TradeRecord
#   from core.utils.StockData import StockData
#   from core.utils.StrategyDecision import StrategyDecision
#
# The manager lives in its own module, so the strategy imports it as
# `from workspace.<manager_module> import <ManagerClass>`.

BLANK_ID = "blank"

_STRATEGY_HEADER = """from core.strategy.strategy import Strategy
from core.utils.StockData import StockData
from core.utils.StrategyDecision import StrategyDecision, Signal
from workspace.{manager_module} import {manager_class}
"""

_MANAGER_HEADER = """from core.portfolio.portfolio_manager import PortfolioManager, TradeRecord
from core.utils.StrategyDecision import StrategyDecision, Signal
"""


BLANK_SOURCES = {
    "workspace/custom_strategy.py": _STRATEGY_HEADER.format(
        manager_module="custom_manager",
        manager_class="CustomManager",
    )
    + '''

class CustomStrategy(Strategy):
    def __init__(self):
        super().__init__()
        self.name = "Custom Strategy"
        self.description = "Describe what this strategy does."
        self.manager = CustomManager()
        self.MIN_BARS_REQUIRED = 1

    def generate_signal(self, ticker, history: StockData) -> StrategyDecision:
        # history.close_price, history.high, history.low and history.volume
        # hold the daily bars, oldest first. The last one is today.
        return StrategyDecision(
            signal=Signal.HOLD,
            confidence=0.0,
            metrics={"close_price": float(history.close_price[-1])},
            meta_data={"ticker": ticker, "signal_date": str(history.dates[-1])},
        )
''',
    "workspace/custom_manager.py": _MANAGER_HEADER
    + '''

class CustomManager(PortfolioManager):
    def __init__(self):
        super().__init__(max_positions=10)

    def on_signal(self, ticker: str, decision: StrategyDecision) -> TradeRecord | None:
        # Return None to skip the trade. For a LONG signal, build a TradeRecord with
        # allocation_size, stop_loss and take_profit from decision.metrics.
        return None
''',
}


EMA_CROSSOVER_SOURCES = {
    "workspace/ema_crossover_strategy.py": _STRATEGY_HEADER.format(
        manager_module="ema_crossover_manager",
        manager_class="EmaCrossoverManager",
    )
    + '''

class EmaCrossover(Strategy):
    def __init__(self):
        super().__init__()
        self.name = "EMA crossover"
        self.description = "Buy when the 12-day EMA crosses above the 26-day EMA"
        self.manager = EmaCrossoverManager()
        self.MIN_BARS_REQUIRED = 30

    def generate_signal(self, ticker, history: StockData) -> StrategyDecision:
        if len(history.close_price) < self.MIN_BARS_REQUIRED:
            raise ValueError(f"{ticker} does not contain enough bars | required: {self.MIN_BARS_REQUIRED}")

        fast = self._ema(history.close_price, 12)
        slow = self._ema(history.close_price, 26)

        close = float(history.close_price[-1])
        today = str(history.dates[-1])

        # A cross happened today: yesterday the fast EMA was at or below the slow one
        crossed_up = fast[-2] <= slow[-2] and fast[-1] > slow[-1]

        return StrategyDecision(
            signal=Signal.LONG if crossed_up else Signal.HOLD,
            confidence=1.0 if crossed_up else 0.0,
            metrics={"close_price": close, "fast_ema": float(fast[-1]), "slow_ema": float(slow[-1])},
            meta_data={"ticker": ticker, "signal_date": today},
        )
''',
    "workspace/ema_crossover_manager.py": _MANAGER_HEADER
    + '''

class EmaCrossoverManager(PortfolioManager):
    def __init__(self):
        super().__init__(max_positions=10)

    def on_signal(self, ticker: str, decision: StrategyDecision) -> TradeRecord | None:
        # Only a LONG signal opens a position, and only one per ticker
        if decision.signal is not Signal.LONG or self.open_positions.get(ticker, False):
            return None

        close = decision.metrics.get("close_price", 0.0)
        if close <= 0:
            return None

        # Stop 8% below the entry and take profit 16% above it (a 2:1 target)
        return TradeRecord(
            ticker=ticker,
            action="BUY",
            entry_date=None,
            allocation_size=round(self._base_allocation(), 2),
            entry_price=None,
            stop_loss=round(close * 0.92, 2),
            take_profit=round(close * 1.16, 2),
            signal_date=decision.meta_data.get("signal_date", ""),
        )
''',
}


RSI_PULLBACK_SOURCES = {
    "workspace/rsi_pullback_strategy.py": _STRATEGY_HEADER.format(
        manager_module="rsi_pullback_manager",
        manager_class="RsiPullbackManager",
    )
    + '''

class RsiPullback(Strategy):
    def __init__(self):
        super().__init__()
        self.name = "RSI pullback"
        self.description = "Buy an oversold dip while the close is still above its 50-day average"
        self.manager = RsiPullbackManager()
        self.MIN_BARS_REQUIRED = 60

    def generate_signal(self, ticker, history: StockData) -> StrategyDecision:
        if len(history.close_price) < self.MIN_BARS_REQUIRED:
            raise ValueError(f"{ticker} does not contain enough bars | required: {self.MIN_BARS_REQUIRED}")

        rsi = self._rsi(history.close_price, 14)
        trend = self._sma(history.close_price, 50)

        close = float(history.close_price[-1])
        today = str(history.dates[-1])

        # Oversold dip inside an uptrend
        oversold = rsi[-1] < 30
        uptrend = close > trend[-1]

        return StrategyDecision(
            signal=Signal.LONG if oversold and uptrend else Signal.HOLD,
            confidence=1.0 if oversold and uptrend else 0.0,
            metrics={"close_price": close, "rsi": float(rsi[-1])},
            meta_data={"ticker": ticker, "signal_date": today},
        )
''',
    "workspace/rsi_pullback_manager.py": _MANAGER_HEADER
    + '''

class RsiPullbackManager(PortfolioManager):
    def __init__(self):
        super().__init__(max_positions=8)

    def on_signal(self, ticker: str, decision: StrategyDecision) -> TradeRecord | None:
        # Only a LONG signal opens a position, and only one per ticker
        if decision.signal is not Signal.LONG or self.open_positions.get(ticker, False):
            return None

        close = decision.metrics.get("close_price", 0.0)
        if close <= 0:
            return None

        # Stop 6% below the entry and take profit 12% above it
        return TradeRecord(
            ticker=ticker,
            action="BUY",
            entry_date=None,
            allocation_size=round(self._base_allocation(), 2),
            entry_price=None,
            stop_loss=round(close * 0.94, 2),
            take_profit=round(close * 1.12, 2),
            signal_date=decision.meta_data.get("signal_date", ""),
        )
''',
}


PARABOLIC_SAR_SOURCES = {
    "workspace/parabolic_sar_strategy.py": _STRATEGY_HEADER.format(
        manager_module="parabolic_sar_manager",
        manager_class="ParabolicSarManager",
    )
    + '''

class ParabolicSarTrend(Strategy):
    def __init__(self):
        super().__init__()
        self.name = "Parabolic SAR trend"
        self.description = "Buy when price flips above the Parabolic SAR, and use the SAR as the stop"
        self.manager = ParabolicSarManager()
        self.MIN_BARS_REQUIRED = 20

    def generate_signal(self, ticker, history: StockData) -> StrategyDecision:
        if len(history.close_price) < self.MIN_BARS_REQUIRED:
            raise ValueError(f"{ticker} does not contain enough bars | required: {self.MIN_BARS_REQUIRED}")

        sar = self._parabolic_sar(history.high, history.low)
        close = history.close_price

        close_now = float(close[-1])
        today = str(history.dates[-1])

        # The trend flipped up today: yesterday price was at or below the SAR, today it is above
        flipped_up = close[-2] <= sar[-2] and close[-1] > sar[-1]

        return StrategyDecision(
            signal=Signal.LONG if flipped_up else Signal.HOLD,
            confidence=1.0 if flipped_up else 0.0,
            metrics={"close_price": close_now, "sar": float(sar[-1])},
            meta_data={"ticker": ticker, "signal_date": today},
        )
''',
    "workspace/parabolic_sar_manager.py": _MANAGER_HEADER
    + '''

class ParabolicSarManager(PortfolioManager):
    def __init__(self):
        super().__init__(max_positions=10)

    def on_signal(self, ticker: str, decision: StrategyDecision) -> TradeRecord | None:
        # Only a LONG signal opens a position, and only one per ticker
        if decision.signal is not Signal.LONG or self.open_positions.get(ticker, False):
            return None

        close = decision.metrics.get("close_price", 0.0)
        sar = decision.metrics.get("sar", 0.0)
        # The SAR sits below price while the trend is up. Use it as the stop.
        if close <= 0 or sar <= 0 or sar >= close:
            return None

        return TradeRecord(
            ticker=ticker,
            action="BUY",
            entry_date=None,
            allocation_size=round(self._base_allocation(), 2),
            entry_price=None,
            stop_loss=round(sar, 2),
            take_profit=round(close * 1.25, 2),
            signal_date=decision.meta_data.get("signal_date", ""),
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
