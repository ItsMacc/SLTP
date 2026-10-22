# portfolio_manager.py — Base portfolio manager: sizing, execution, accounting.
#
# Paired with a Strategy: the Strategy decides WHEN to buy, the Manager
# decides HOW MUCH (allocation), WHERE to cut losses (stop-loss / take-profit)
# and keeps the portfolio's books (fees, slippage, mark-to-market, equity).
# Subclasses implement on_signal(); initialize_universe() and on_rebalance()
# are optional. check_exits / buy_order / mark_to_market / _base_allocation
# are the engine's execution internals and are shared by all strategies.

# -------- Imports --------
from dataclasses import dataclass, replace
from enum import Enum
from dateutil.relativedelta import relativedelta
from app.database.fetch import get_stock_histories, get_all_tickers
from app.database.fetch import get_stock_history
from app.utils.StockData import StockData
from app.utils.StrategyDecision import StrategyDecision


# -------- Records, Risk and Rebalance Frequency Enumerations --------
@dataclass
class TradeRecord:
    ticker: str
    action: str
    entry_date: str | None
    allocation_size: float
    entry_price: float | None
    stop_loss: float
    take_profit: float
    exit_price: float | None = None
    exit_date: str | None = None
    transaction_cost: float = 0.0
    realized_return_pct: float | None = None
    signal_date: str | None = None



class RebalanceFrequency(Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"
    NEVER = "never"


# -------- Constants --------
REBALANCE_SETTINGS: dict[RebalanceFrequency, relativedelta] = {
    RebalanceFrequency.DAILY: relativedelta(days=1),
    RebalanceFrequency.WEEKLY: relativedelta(weeks=1),
    RebalanceFrequency.MONTHLY: relativedelta(months=1),
    RebalanceFrequency.QUARTERLY: relativedelta(months=3),
    RebalanceFrequency.YEARLY: relativedelta(years=1),
    RebalanceFrequency.NEVER: relativedelta(years=999_999),
}

MIN_KELLY_TRADES: int = 10
UNIVERSE = get_all_tickers()


# -------- Portfolio Manager --------
class PortfolioManager:
    def __init__(self,
                 max_positions: int | None = 10
                 ) -> None:
        # Trading Costs & Configuration
        self.SLIPPAGE_PCT: float = 0.0005
        self.FEE_RATE: float = 0.001
        self.max_positions: int | None = max_positions

        # Universe & Market Data Storage
        self.tickers: list[str] = []
        self.histories: dict[str, StockData] = {}

        # Portfolio Tracking & State
        self.portfolio_value: float = 100.00
        self.active_positions: int = 0
        self.open_positions: dict[str, bool] = {}
        self.trades: dict[str, list[TradeRecord]] = {}

        # Execution & Marking States
        self.blacklisted_tickers: set[str] = set()
        self.open_trade_state: dict[str, dict] = {}

        # Performance & Analytics Cache
        self.equity_curve: list[dict] = []
        self.ticker_wins: dict[str, list[float]] = {}
        self.ticker_losses: dict[str, list[float]] = {}
        self.total_transactions_cost: float = 0.0

        # Rebalancing Tracking
        self.LAST_REBALANCE_DATE: str | None = None
        self.REBALANCE_FREQUENCY: RebalanceFrequency = RebalanceFrequency.NEVER
        self.WARM_UP_PERIOD: int = 0

    # -------- Data Management --------
    def add_ticker(self,
                   ticker: str,
                   start_date: str | None = None,
                   end_date: str | None = None
                   ) -> None:
        # Fetch and cache individual stock history
        self.histories[ticker] = get_stock_history(ticker, start_date, end_date)
        if ticker not in self.tickers:
            self.tickers.append(ticker)

    def add_tickers(self,
                    tickers: list[str],
                    start_date: str | None = None,
                    end_date: str | None = None
                    ) -> None:
        # Fetch and cache batch stock histories
        self.histories.update(get_stock_histories(tickers, start_date, end_date))
        for ticker in tickers:
            if ticker not in self.tickers:
                self.tickers.append(ticker)

    # -------- Lifecycle Hooks --------
    def on_signal(self,
                  ticker: str,
                  decision: StrategyDecision
                  ) -> TradeRecord | None:
        # Returning None means "no trade for this signal", which the backtester and runner handle
        # Base method placeholder enforcing implementation in subclasses
        raise NotImplementedError("PortfolioManager subclasses must implement on_signal()")

    def on_rebalance(self, current_date: str) -> None:
        # Base method allowing users to create custom rebalancing
        pass

    def initialize_universe(self, current_date: str) -> bool:
        # Base method to initialize universe
        pass

    # -------- Trade Execution & Risk Management --------
    def check_exits(self,
                    ticker: str,
                    current_open: float,
                    current_high: float,
                    current_low: float,
                    current_date: str
                    ) -> None:
        # If no positions are open, return
        if self.active_positions == 0:
            return

        # If ticker has no open positions, return
        is_open: bool = self.open_positions.get(ticker, False)
        if not is_open:
            return

        # If ticker does not have any BUY signals, return
        if ticker not in self.trades or not self.trades[ticker]:
            return

        # Fetch the last record, since it will always be a BUY record
        last_trade_record: TradeRecord = self.trades[ticker][-1]

        sl: float = last_trade_record.stop_loss
        tp: float = last_trade_record.take_profit

        exit_triggered: bool = False

        # Check for exit using pessimistic priority (Stop-Loss before Take-Profit)
        if current_low <= sl:
            # If the stock gapped open below our stop loss, we get filled at the open price instead
            effective_sl_price = current_open if current_open < sl else sl
            exit_price: float = round(self._apply_exit_slippage(effective_sl_price), 2)
            exit_action: str = "STOP_LOSS"
            exit_triggered = True
        elif current_high >= tp:
            # If the stock gapped up past our take profit, we capture the higher open price
            effective_tp_price = max(current_open, tp)
            exit_price: float = round(self._apply_exit_slippage(effective_tp_price), 2)
            exit_action: str = "TAKE_PROFIT"
            exit_triggered = True

        if exit_triggered:
            # Close the position and manage portfolio state tracking
            self.active_positions = max(0, self.active_positions - 1)
            self.open_positions[ticker] = False

            # Account for any intermediate mark-to-market updates to prevent double-counting
            state = self.open_trade_state.pop(ticker, None)
            entry_portfolio_value = state.get("entry_portfolio_value", self.portfolio_value) if state is not None else self.portfolio_value

            # Calculate exit transaction fee impact relative to entry price and entry portfolio value
            exit_fee_ratio = exit_price * self.FEE_RATE / last_trade_record.entry_price
            fee_index_impact = round(entry_portfolio_value * last_trade_record.allocation_size * exit_fee_ratio, 4)

            # Accumulate to global total transaction cost tracker (index points lost)
            self.total_transactions_cost += fee_index_impact

            # Actually deduct the fee from tradable equity (previously only tracked, never applied)
            self.portfolio_value -= fee_index_impact

            # Calculate returns based on execution prices
            entry_price = last_trade_record.entry_price
            pct_return = (exit_price - entry_price) / entry_price

            already_marked_pct_return = 0.0
            if state is not None:
                last_close = state["last_close"]
                already_marked_pct_return = (last_close - entry_price) / entry_price

            # Update portfolio index based on incremental final return using entry portfolio value
            incremental_pct_return = pct_return - already_marked_pct_return
            gained_value = entry_portfolio_value * last_trade_record.allocation_size * incremental_pct_return
            self.portfolio_value += round(gained_value, 4)

            # Build the final sell trade record
            sell_trade_record = TradeRecord(
                ticker=ticker,
                action=exit_action,
                entry_date=last_trade_record.entry_date,
                allocation_size=last_trade_record.allocation_size,
                entry_price=last_trade_record.entry_price,
                stop_loss=sl,
                take_profit=tp,
                exit_price=exit_price,
                exit_date=current_date,
                transaction_cost=fee_index_impact,
                realized_return_pct=pct_return
            )

            # Save trade history
            self.trades[ticker].append(sell_trade_record)

            # Track realized return per ticker into wins/losses caches
            if ticker not in self.ticker_wins:
                self.ticker_wins[ticker] = []
            if ticker not in self.ticker_losses:
                self.ticker_losses[ticker] = []

            if pct_return > 0:
                self.ticker_wins[ticker].append(pct_return)
            elif pct_return < 0:
                self.ticker_losses[ticker].append(pct_return)

    def buy_order(self,
                  ticker: str,
                  fill_price: float,
                  trade_record: TradeRecord,
                  current_date: str
                  ) -> None:
        # If position is already open, return
        if self.open_positions.get(ticker, False):
            return

        # If maximum position limit is reached, return
        if self.max_positions is not None and self.active_positions >= self.max_positions:
            return

        # If ticker is blacklisted, return
        if ticker in self.blacklisted_tickers:
            return

        # Check total cumulative allocation across all open positions
        current_total_allocation = sum(
            t[-1].allocation_size
            for t_ticker, t in self.trades.items()
            if self.open_positions.get(t_ticker, False)
        )

        MAX_TOTAL_ALLOCATION = 1.0
        remaining_allocation = MAX_TOTAL_ALLOCATION - current_total_allocation

        # If no portfolio allocation room is left at all, return
        if remaining_allocation <= 0:
            return

        # Dynamically fit the allocation to whatever percent is left
        effective_allocation = min(trade_record.allocation_size, remaining_allocation)
        if effective_allocation < trade_record.allocation_size:
            trade_record = replace(trade_record, allocation_size=effective_allocation)

        # Apply slippage to the fill price
        entry_price: float = round(self._apply_entry_slippage(fill_price), 2)
        last_close: float = entry_price

        # Instantiate the confirmed BUY trade record using dataclasses.replace
        confirmed_record = replace(
            trade_record,
            entry_date=current_date,
            entry_price=entry_price
        )

        # Initialize trade list if ticker is new
        if ticker not in self.trades:
            self.trades[ticker] = []

        # Record trade and update active position tracking
        self.trades[ticker].append(confirmed_record)
        self.active_positions += 1
        self.open_positions[ticker] = True

        # Track entry transaction cost impact on index points
        entry_fee_index_impact = round(self.portfolio_value * confirmed_record.allocation_size * self.FEE_RATE, 4)
        self.total_transactions_cost += entry_fee_index_impact

        # Actually deduct the fee from tradable equity (previously only tracked, never applied)
        self.portfolio_value -= entry_fee_index_impact

        # Initialize mark-to-market open trade state with anchored entry portfolio value
        self.open_trade_state[ticker] = {
            "entry_price": entry_price,
            "allocation_size": confirmed_record.allocation_size,
            "last_close": last_close,
            "entry_portfolio_value": self.portfolio_value,
        }

    def mark_to_market(self,
                       ticker: str,
                       current_close: float
                       ) -> None:
        # Cache dictionary lookup locally
        if not self.open_positions.get(ticker, False):
            return

        # If ticker does not have any trades, return
        if ticker not in self.trades or not self.trades[ticker]:
            return

        # Retrieve the last trade record and ensure it is an active BUY
        last_trade_record = self.trades[ticker][-1]
        if last_trade_record.action != "BUY":
            return

        # Retrieve previous mark-to-market state or default to entry price.
        state = self.open_trade_state.get(ticker)
        entry_price = last_trade_record.entry_price
        prev_marked_close = state["last_close"] if state is not None else entry_price
        entry_portfolio_value = state.get("entry_portfolio_value", self.portfolio_value) if state is not None else self.portfolio_value

        # Calculate incremental return and portfolio value adjustment using fixed entry portfolio value
        incremental_pct_return = (current_close - prev_marked_close) / entry_price
        gained_value = entry_portfolio_value * last_trade_record.allocation_size * incremental_pct_return
        self.portfolio_value += round(gained_value, 4)

        # Update the open trade state with the current close price
        self.open_trade_state[ticker] = {
            "entry_price": last_trade_record.entry_price,
            "allocation_size": last_trade_record.allocation_size,
            "last_close": current_close,
            "entry_portfolio_value": entry_portfolio_value,
        }

    def _base_allocation(self) -> float:
        """
        Calculates position base allocation size using the Kelly Criterion across
        all closed portfolio trades, adjusted by the portfolio's risk profile.
        """
        default_allocation = (1.0 / self.max_positions) if (self.max_positions and self.max_positions > 0) else 0.1

        # Aggregate all realized closed trade returns across all tickers in the portfolio
        all_closed_returns = [
            trade.realized_return_pct
            for trade_list in self.trades.values()
            for trade in trade_list
            if trade.realized_return_pct is not None
        ]

        total_trades = len(all_closed_returns)
        wins = [r for r in all_closed_returns if r > 0]
        losses = [r for r in all_closed_returns if r < 0]

        # Requires sufficient trades AND at least one win and one loss globally
        if total_trades < MIN_KELLY_TRADES or not wins or not losses:
            return default_allocation

        win_rate = len(wins) / total_trades
        avg_win = sum(wins) / len(wins)
        avg_loss = abs(sum(losses) / len(losses))

        # Absolute mathematical check: avg_loss must be non-zero to avoid division by zero
        if avg_loss == 0.0:
            return default_allocation

        # Payoff ratio (b) = average win size / average loss size
        win_loss_ratio = avg_win / avg_loss

        # Pure Kelly Criterion Formula: f* = p - ((1 - p) / b)
        kelly_fraction = win_rate - ((1.0 - win_rate) / win_loss_ratio)

        # If Kelly yields negative expectation, do not allocate capital (return default floor)
        if kelly_fraction <= 0.0:
            return default_allocation

        # Apply fractional Kelly scaling based on low risk profile
        adjusted_kelly = kelly_fraction * 0.25

        # Bound allocation strictly between minimum and maximum allocation
        min_allocation = 0.01
        max_allocation = default_allocation * 2
        final_allocation = max(min_allocation, min(max_allocation, round(adjusted_kelly, 4)))

        return final_allocation

    def _apply_entry_slippage(self, price: float) -> float:
        # Adjust entry price upwards for buy slippage
        return price * (1.0 + self.SLIPPAGE_PCT)

    def _apply_exit_slippage(self, price: float) -> float:
        # Adjust exit price downwards for sell slippage
        return price * (1.0 - self.SLIPPAGE_PCT)
