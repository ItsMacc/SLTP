# buy_and_hold.py — Passive benchmark strategy.
#
# Buys every ticker in the universe once at the start and holds it for the
# entire backtest. No stop-loss, no take-profit, no rotation. Serves as the
# baseline every active strategy is compared against.

# -------- Imports --------
from app.strategies.buy_and_hold_manager import BuyAndHoldManager
from app.engine.strategy.strategy import Strategy, StrategyDecision
from app.engine.utils.StrategyDecision import Signal
from app.engine.utils.StockData import StockData


# -------- Buy And Hold Strategy Class --------
class BuyAndHold(Strategy):
    def __init__(self):
        super().__init__()

        # Identity and paired manager
        self.name = "Buy & Hold"
        self.description = "Standard Buy and Hold benchmark strategy"
        self.manager = BuyAndHoldManager()

        self.MIN_BARS_REQUIRED = 1

    def generate_signal(self, ticker: str, history: StockData) -> StrategyDecision:
        # Check if stock has enough price history to calculate metrics
        if len(history.close_price) < self.MIN_BARS_REQUIRED:
            raise ValueError(f"{ticker} does not contain enough bars | required: {self.MIN_BARS_REQUIRED}")

        today_date = str(history.dates[-1])
        current_close = float(history.close_price[-1])

        # Check if the portfolio is already holding this ticker
        is_already_open = False
        if self.manager:
            is_already_open = self.manager.open_positions.get(ticker, False)

        # Buy once at the start, then hold indefinitely
        if not is_already_open:
            signal_type = Signal.LONG
            confidence = 1.0
        else:
            signal_type = Signal.HOLD
            confidence = 1.0

        metrics = {"close_price": current_close}
        meta_data = {"ticker": ticker, "signal_date": today_date}

        return StrategyDecision(
            signal=signal_type,
            confidence=confidence,
            metrics=metrics,
            meta_data=meta_data
        )
