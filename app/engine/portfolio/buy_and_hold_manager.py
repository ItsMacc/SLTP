# buy_and_hold_manager.py — Manager for the Buy & Hold benchmark strategy.
#
# Universe: every ticker available in the master database, loaded once at
# initialization. Buys are equal-weight (1 / number of positions) with no
# stop-loss and no take-profit, so positions are never sold once opened.

# -------- Imports --------
from app.engine.portfolio.portfolio_manager import (
    PortfolioManager, RebalanceFrequency, TradeRecord
)
from app.engine.utils.StrategyDecision import StrategyDecision, Signal
from app.database.fetch import get_stock_histories, get_all_tickers


# -------- Buy And Hold Manager Class --------
class BuyAndHoldManager(PortfolioManager):
    def __init__(self):
        super().__init__()

        # Configured for a benchmark passive strategy
        self.max_positions = len(self.get_available_universe)
        self.REBALANCE_FREQUENCY = RebalanceFrequency.NEVER
        self.WARM_UP_PERIOD = 30

    # -------- Lifecycle Hooks --------
    def on_signal(self, ticker: str, decision: StrategyDecision) -> TradeRecord | None:
        # Executes a single initial buy order with no stop-loss or take-profit limits
        # Ignore non-LONG signals or already open positions
        if decision.signal is not Signal.LONG or self.open_positions.get(ticker, False):
            return None

        current_close = decision.metrics.get("close_price", 0.0)
        if current_close <= 0:
            return None

        # Calculate equal weight allocation based on total target portfolio positions
        num_positions = self.max_positions if self.max_positions else len(self.tickers)
        allocation_size = round(1.0 / max(1, num_positions), 4)

        # Set bounds so check_exits never triggers a sell
        stop_loss = 0.0
        take_profit = float("inf")

        signal_date = decision.meta_data.get("signal_date", "")

        return TradeRecord(
            ticker=ticker,
            action="BUY",
            entry_date=None,
            allocation_size=allocation_size,
            entry_price=None,
            stop_loss=stop_loss,
            take_profit=take_profit,
            signal_date=signal_date,
        )

    def initialize_universe(self, current_date: str) -> bool:
        # Initializes all stocks in the universe at start date
        self.tickers.clear()
        self.histories.clear()

        # Load all tickers and batch-fetch stock histories up to current_date
        self.tickers = get_all_tickers()
        self.histories = get_stock_histories(self.tickers)

        return bool(self.tickers)