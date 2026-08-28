# -------- Imports --------
from dataclasses import dataclass
from enum import Enum
from app.database.fetch import get_stock_histories
from app.database.fetch import get_stock_history
from app.utils.StockData import StockData
from app.utils.StrategyDecision import StrategyDecision


# -------- Records and Risk Enumerations --------
@dataclass
class TradeRecord:
    ticker: str
    action: str
    entry_date: str
    allocation_size: float
    entry_price: float
    stop_loss: float
    take_profit: float
    exit_price: float | None = None
    exit_date: str | None = None
    transaction_cost: float = 0.0
    realized_return_pct: float | None = None
    signal_date: str | None = None


class RiskProfile(Enum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"


RISK_SETTINGS: dict[RiskProfile, tuple[float, float]] = {
    RiskProfile.LOW: (0.10, 0.02),
    RiskProfile.MODERATE: (0.15, 0.03),
    RiskProfile.HIGH: (0.25, 0.04),
}
MIN_TRADES_FOR_KELLY = 20


# -------- Portfolio Manager --------
class PortfolioManager:
    def __init__(self,
                 risk: RiskProfile = RiskProfile.MODERATE,
                 max_positions: int | None = 10
                 ) -> None:
        # Constants
        self.SLIPPAGE_PCT = 0.0005
        self.FEE_RATE = 0.001

        # Risk settings
        self.risk_profile = risk
        self.max_positions = max_positions

        # Universe
        self.tickers: list[str] = []
        self.histories: dict[str, StockData] = {}

        # Portfolio tracking
        self.active_positions: int = 0
        self.open_positions: dict[str, bool] = {}
        self.trades: dict[str, list[TradeRecord]] = {}
        self.portfolio_index: float = 100.00

        # State management
        self.pending_entries: dict[str, TradeRecord] = {}
        self.open_trade_state: dict[str, dict] = {}

    def add_ticker(self,
                   ticker: str,
                   start_date: str | None = None,
                   end_date: str | None = None
                   ) -> None:
        # Fetch and store stock history for the single ticker
        self.histories[ticker] = get_stock_history(ticker, start_date, end_date)
        self.tickers.append(ticker)

    def add_tickers(self,
                    tickers: list[str],
                    start_date: str | None = None,
                    end_date: str | None = None
                    ) -> None:
        # Fetch and store stock histories for multiple tickers
        self.histories.update(get_stock_histories(tickers, start_date, end_date))
        self.tickers.extend(tickers)

    # -------- Custom Methods (Implemented in Subclasses) --------
    def on_signal(self,
                  ticker: str,
                  decision: StrategyDecision
                  ) -> TradeRecord:
        # Base method placeholder enforcing implementation in subclasses
        raise ValueError("PortfolioManager subclasses must implement on_signal()")

    # -------- Trade Execution & Risk Management --------
    def check_exits(self,
                    ticker: str,
                    current_date: str,
                    current_high: float,
                    current_low: float
                    ) -> None:
        # If no positions are open, return
        if self.active_positions == 0:
            return

        # If no positions are open for the ticker, return
        if not self.open_positions.get(ticker, False):
            return

        # If ticker does not have any BUY signals, return
        if ticker not in self.trades or not self.trades[ticker]:
            return

        if self.open_positions.get(ticker):
            # Fetch the last record, since it will always be a BUY record
            last_trade_record = self.trades[ticker][-1]

            sl = last_trade_record.stop_loss
            tp = last_trade_record.take_profit

            exit_triggered = False
            sell_trade_record = None

            # Check for exit
            if current_high >= tp:
                exit_price = round(self.apply_exit_slippage(tp), 2)
                sell_trade_record = TradeRecord(
                    ticker=ticker,
                    action="TAKE_PROFIT",
                    entry_date=last_trade_record.entry_date,
                    allocation_size=last_trade_record.allocation_size,
                    entry_price=last_trade_record.entry_price,
                    stop_loss=sl,
                    take_profit=tp,
                    exit_price=exit_price,
                    exit_date=current_date,
                    transaction_cost=0.0
                )
                exit_triggered = True
            elif current_low <= sl:
                exit_price = round(self.apply_exit_slippage(sl), 2)
                sell_trade_record = TradeRecord(
                    ticker=ticker,
                    action="STOP_LOSS",
                    entry_date=last_trade_record.entry_date,
                    allocation_size=last_trade_record.allocation_size,
                    entry_price=last_trade_record.entry_price,
                    stop_loss=sl,
                    take_profit=tp,
                    exit_price=exit_price,
                    exit_date=current_date,
                    transaction_cost=0.0
                )
                exit_triggered = True

            # If exit conditions are met, close the position and manage portfolio
            if exit_triggered:
                self.active_positions = max(0, self.active_positions - 1)
                self.open_positions[ticker] = False

                # Transaction costs
                entry_fee_cost = last_trade_record.entry_price * self.FEE_RATE
                exit_fee_cost = sell_trade_record.exit_price * self.FEE_RATE
                total_fee_pct = (entry_fee_cost + exit_fee_cost) / last_trade_record.entry_price
                sell_trade_record.transaction_cost = round(total_fee_pct * 100, 4)

                # Returns
                net_entry = last_trade_record.entry_price * (1.0 + self.FEE_RATE)
                net_exit = sell_trade_record.exit_price * (1.0 - self.FEE_RATE)
                pct_return = (net_exit - net_entry) / net_entry

                # State management
                state = self.open_trade_state.pop(ticker, None)
                already_marked_pct_return = 0.0
                if state is not None:
                    last_close = state["last_close"]
                    already_marked_pct_return = (last_close - net_entry) / net_entry

                # Portfolio management
                incremental_pct_return = pct_return - already_marked_pct_return
                gained_value = self.portfolio_index * last_trade_record.allocation_size * incremental_pct_return
                self.portfolio_index += round(gained_value, 4)

                sell_trade_record.realized_return_pct = pct_return
                self.trades[ticker].append(sell_trade_record)

    def execute_trade(self,
                      pending_record: TradeRecord,
                      fill_price: float,
                      date: str
                      ) -> None:
        ticker = pending_record.ticker

        # If position is already open, return
        if self.open_positions.get(ticker, False):
            return

        # If maximum position limit is reached, return
        if self.max_positions is not None and self.active_positions >= self.max_positions:
            return

        # Apply slippage to the fill price
        entry_price = round(self.apply_entry_slippage(fill_price), 2)

        # Update pending record details into a confirmed BUY trade
        pending_record.action = "BUY"
        pending_record.entry_date = date
        pending_record.entry_price = entry_price

        # Initialize trade list if ticker is new
        if ticker not in self.trades:
            self.trades[ticker] = []

        # Record trade and update active position tracking
        self.trades[ticker].append(pending_record)
        self.active_positions += 1
        self.open_positions[ticker] = True

    def mark_to_market(self,
                       ticker: str,
                       current_close: float
                       ) -> None:
        # If no positions are open for the ticker, return
        if not self.open_positions.get(ticker, False):
            return

        # If ticker does not have any trades, return
        if ticker not in self.trades or not self.trades[ticker]:
            return

        # Retrieve the last trade record and ensure it is an active BUY
        last_trade_record = self.trades[ticker][-1]
        if last_trade_record.action != "BUY":
            return

        # Calculate net entry price including transaction fees
        net_entry = last_trade_record.entry_price * (1.0 + self.FEE_RATE)

        # Retrieve previous mark-to-market state or default to net entry
        state = self.open_trade_state.get(ticker)
        prev_marked_close = state["last_close"] if state is not None else net_entry

        # Calculate incremental return and portfolio value adjustment
        incremental_pct_return = (current_close - prev_marked_close) / net_entry
        gained_value = self.portfolio_index * last_trade_record.allocation_size * incremental_pct_return
        self.portfolio_index += round(gained_value, 4)

        # Update the open trade state with the current close price
        self.open_trade_state[ticker] = {
            "entry_price": last_trade_record.entry_price,
            "allocation_size": last_trade_record.allocation_size,
            "last_close": current_close,
        }

    def process_pending_entries(self,
                                ticker: str,
                                fill_price: float,
                                fill_date: str
                                ) -> None:
        # If no pending entry exists for the ticker, return
        pending_record = self.pending_entries.pop(ticker, None)
        if pending_record is None:
            return

        # If a position is already open, return
        if self.open_positions.get(ticker, False):
            return

        # If maximum position limit is reached, return
        if self.max_positions is not None and self.active_positions >= self.max_positions:
            return

        # Execute the pending trade
        self.execute_trade(pending_record, fill_price, fill_date)

        # Set up initial trade state for mark-to-market calculations
        self.open_trade_state[ticker] = {
            "entry_price": pending_record.entry_price,
            "allocation_size": pending_record.allocation_size,
            "last_close": pending_record.entry_price * (1.0 + self.FEE_RATE),
        }

    def compute_allocation_size(self) -> float:
        # Retrieve risk settings based on current risk profile
        kelly_fraction, fallback = RISK_SETTINGS[self.risk_profile]

        # Gather historical returns across all trades
        returns = [r.realized_return_pct for trades in self.trades.values()
                   for r in trades if r.realized_return_pct is not None]
        wins = [r for r in returns if r >= 0]
        losses = [-r for r in returns if r < 0]

        # Fallback to default allocation if trade sample size is insufficient
        if len(returns) < MIN_TRADES_FOR_KELLY or not losses:
            return fallback

        # Calculate Kelly Criterion position size
        win_rate = len(wins) / len(returns)
        payoff_ratio = (sum(wins) / len(wins)) / (sum(losses) / len(losses))
        edge = max(0.0, win_rate - (1 - win_rate) / payoff_ratio)

        return edge * kelly_fraction

    def apply_entry_slippage(self, price: float) -> float:
        # Adjust entry price upwards for buy slippage
        return price * (1.0 + self.SLIPPAGE_PCT)

    def apply_exit_slippage(self, price: float) -> float:
        # Adjust exit price downwards for sell slippage
        return price * (1.0 - self.SLIPPAGE_PCT)