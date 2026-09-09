from app.portfolio.portfolio_manager import (
    PortfolioManager, RebalanceFrequency, TradeRecord, UNIVERSE
)
from app.utils.StrategyDecision import StrategyDecision
from app.database.fetch import get_stock_histories, get_all_tickers


class BuyAndHoldManager(PortfolioManager):
    def __init__(self):
        super().__init__()

        # Configured for a benchmark passive strategy
        self.max_positions = len(UNIVERSE)
        self.REBALANCE_FREQUENCY = RebalanceFrequency.NEVER
        self.WARM_UP_PERIOD = 30

    def on_signal(self, ticker: str, decision: StrategyDecision) -> TradeRecord | None:
        """
        Executes a single initial buy order with no stop-loss or take-profit limits.
        """
        # Ignore non-BUY decisions or already open positions
        if decision.signal != "BUY" or self.open_positions.get(ticker, False):
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
        """
        Initializes all stocks in the universe at start date.
        """
        self.tickers.clear()
        self.histories.clear()

        # Load all tickers and batch-fetch stock histories up to current_date
        self.tickers = get_all_tickers()
        self.histories = get_stock_histories(self.tickers)

        return bool(self.tickers)