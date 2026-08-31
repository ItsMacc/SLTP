import numpy as np
from app.portfolio.portfolio_manager import PortfolioManager, TradeRecord, RiskProfile
from app.utils.StrategyDecision import StrategyDecision


class StockHealthFilterManager(PortfolioManager):
    def __init__(self):
        super().__init__()

        # Initial Configurations
        self.max_positions = 10
        self.risk_profile = RiskProfile.MODERATE

    def on_signal(self,
                  ticker: str,
                  decision: StrategyDecision
                  ) -> None:
        # Ignore signal if the action is not a BUY order
        if decision.signal != "BUY":
            return

        # Ignore signal if an open position already exists for the ticker
        if self.open_positions.get(ticker, False):
            return

        # Retrieve stock history and ensure sufficient data points are available for ATR calculation
        history = self.histories.get(ticker)
        if not history or len(history.close_price) < 15:
            return

        # Extract current close price from decision metrics
        metrics = decision.metrics
        current_close = metrics.get('close_price', 0.0)
        if current_close <= 0:
            return

        # Compute Average True Range (ATR) over the last 14 periods
        high, low, close = history.high, history.low, history.close_price
        tr = np.maximum(high[1:] - low[1:], np.maximum(abs(high[1:] - close[:-1]), abs(low[1:] - close[:-1])))
        atr = float(np.mean(tr[-14:]))

        k_multiplier = 2.0
        rrr = 2.0

        # Calculate stop loss and take profit price levels based on ATR
        sl_distance = k_multiplier * atr
        stop_loss = round(current_close - sl_distance, 2)
        take_profit = round(current_close + (sl_distance * rrr), 2)

        # Compute adjusted allocation size using base allocation and confidence score
        base_allocation = self.compute_allocation_size()
        confidence = max(0.0, min(1.0, decision.confidence))

        allocation_size = round(min(1.0, base_allocation * (1.0 + confidence)), 4)

        # Create a pending trade record using signal metadata
        signal_date = decision.meta_data.get("signal_date", "")
        pending_record = TradeRecord(
            ticker=ticker,
            action="PENDING_BUY",
            entry_date="",
            allocation_size=allocation_size,
            entry_price=current_close,
            stop_loss=stop_loss,
            take_profit=take_profit,
            signal_date=signal_date,
        )

        # Store pending entry record if not already present for the ticker
        if ticker not in self.pending_entries:
            self.pending_entries[ticker] = pending_record