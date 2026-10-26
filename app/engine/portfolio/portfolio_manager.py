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
from app.engine.utils.StockData import StockData
from app.engine.utils.StrategyDecision import StrategyDecision, Signal


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

    @property
    def get_available_universe(self) -> list[str]:
        return get_all_tickers()

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
        # Clean up blacklisted tickers whose positions have closed
        new_blacklist = set()
        for ticker in list(self.blacklisted_tickers):
            if not self.open_positions.get(ticker, False):
                if ticker in self.tickers:
                    self.tickers.remove(ticker)
                if ticker in self.histories:
                    del self.histories[ticker]
                new_blacklist.add(ticker)

        for ticker in new_blacklist:
            self.blacklisted_tickers.remove(ticker)

    def initialize_universe(self, current_date: str) -> bool:
        # Base method to initialize universe
        pass

    # -------- Trade Execution & Risk Management --------
    def check_exits(
                    self,
                    ticker: str,
                    current_open: float,
                    current_high: float,
                    current_low: float,
                    current_date: str,
                    signal: Signal | None = None,
                    signal_price: float | None = None,
                    ) -> None:
        """Apply an explicit EXIT first, otherwise today's directional stop/target."""
        if signal is not None and not isinstance(signal, Signal):
            raise TypeError("signal must be a Signal enum value or None")
        if self.active_positions == 0 or not self.open_positions.get(ticker, False):
            return

        trade_list = self.trades.get(ticker)
        if not trade_list or trade_list[-1].action not in ("BUY", "SHORT"):
            return
        active_trade = trade_list[-1]
        is_short = active_trade.action == "SHORT"

        # A strategy EXIT takes precedence over intraday risk triggers. Use the
        # active trade record for its original SL/TP values when writing the exit.
        if signal is Signal.EXIT:
            if signal_price is None or signal_price <= 0:
                raise ValueError("signal_price must be positive when signal is EXIT")
            exit_fill = (
                self._apply_cover_slippage(signal_price)
                if is_short
                else self._apply_exit_slippage(signal_price)
            )
            self._close_position(
                ticker,
                active_trade,
                round(exit_fill, 2),
                "EXIT",
                current_date,
            )
            return
        sl = active_trade.stop_loss
        tp = active_trade.take_profit
        exit_action: str | None = None
        exit_price: float | None = None

        # Stops take precedence if both levels are crossed in one bar.
        if is_short:
            if sl > 0 and current_high >= sl:
                fill_price = current_open if current_open > sl else sl
                exit_action = "STOP_LOSS"
                exit_price = round(self._apply_cover_slippage(fill_price), 2)
            elif tp > 0 and current_low <= tp:
                fill_price = min(current_open, tp)
                exit_action = "TAKE_PROFIT"
                exit_price = round(self._apply_cover_slippage(fill_price), 2)
        else:
            if sl > 0 and current_low <= sl:
                fill_price = current_open if current_open < sl else sl
                exit_action = "STOP_LOSS"
                exit_price = round(self._apply_exit_slippage(fill_price), 2)
            elif tp > 0 and current_high >= tp:
                fill_price = max(current_open, tp)
                exit_action = "TAKE_PROFIT"
                exit_price = round(self._apply_exit_slippage(fill_price), 2)

        if exit_action is not None and exit_price is not None:
            self._close_position(ticker, active_trade, exit_price, exit_action, current_date)
            return

    def _close_position(
        self,
        ticker: str,
        last_trade_record: TradeRecord,
        exit_price: float,
        exit_action: str,
        current_date: str,
    ) -> None:
        """Apply accounting and append an exit record for an open position."""
        entry_price = last_trade_record.entry_price
        if entry_price is None or entry_price <= 0 or not self.open_positions.get(ticker, False):
            return

        is_short = last_trade_record.action == "SHORT"
        direction = -1.0 if is_short else 1.0
        self.active_positions = max(0, self.active_positions - 1)
        self.open_positions[ticker] = False

        state = self.open_trade_state.pop(ticker, None)
        entry_portfolio_value = (
            state.get("entry_portfolio_value", self.portfolio_value)
            if state is not None else self.portfolio_value
        )

        exit_fee_ratio = exit_price * self.FEE_RATE / entry_price
        fee_index_impact = round(
            entry_portfolio_value * last_trade_record.allocation_size * exit_fee_ratio,
            4,
        )
        self.total_transactions_cost += fee_index_impact
        self.portfolio_value -= fee_index_impact

        pct_return = direction * (exit_price - entry_price) / entry_price
        already_marked_pct_return = 0.0
        if state is not None:
            already_marked_pct_return = direction * (state["last_close"] - entry_price) / entry_price

        incremental_pct_return = pct_return - already_marked_pct_return
        gained_value = entry_portfolio_value * last_trade_record.allocation_size * incremental_pct_return
        self.portfolio_value += round(gained_value, 4)

        exit_record = TradeRecord(
            ticker=ticker,
            action=exit_action,
            entry_date=last_trade_record.entry_date,
            allocation_size=last_trade_record.allocation_size,
            entry_price=entry_price,
            stop_loss=last_trade_record.stop_loss,
            take_profit=last_trade_record.take_profit,
            exit_price=exit_price,
            exit_date=current_date,
            transaction_cost=fee_index_impact,
            realized_return_pct=pct_return,
        )
        self.trades[ticker].append(exit_record)

        if pct_return > 0:
            self.ticker_wins.setdefault(ticker, []).append(pct_return)
        elif pct_return < 0:
            self.ticker_losses.setdefault(ticker, []).append(pct_return)

    def buy_order(
                  self,
                  ticker: str,
                  fill_price: float,
                  trade_record: TradeRecord,
                  current_date: str,
                  ) -> None:
        self._open_order(ticker, fill_price, trade_record, current_date, "BUY")

    def short_order(
                  self,
                  ticker: str,
                  fill_price: float,
                  trade_record: TradeRecord,
                  current_date: str,
                  ) -> None:
        self._open_order(ticker, fill_price, trade_record, current_date, "SHORT")

    def _open_order(
                  self,
                  ticker: str,
                  fill_price: float,
                  trade_record: TradeRecord,
                  current_date: str,
                  expected_action: str,
                  ) -> None:
        if trade_record.action != expected_action:
            raise ValueError(f"Expected {expected_action} trade record, got {trade_record.action}")
        if fill_price <= 0:
            return
        if self.open_positions.get(ticker, False):
            return
        if self.max_positions is not None and self.active_positions >= self.max_positions:
            return
        if ticker in self.blacklisted_tickers:
            return

        current_total_allocation = sum(
            trade_list[-1].allocation_size
            for open_ticker, trade_list in self.trades.items()
            if self.open_positions.get(open_ticker, False) and trade_list
        )
        remaining_allocation = 1.0 - current_total_allocation
        if remaining_allocation <= 0:
            return

        effective_allocation = min(trade_record.allocation_size, remaining_allocation)
        if effective_allocation < trade_record.allocation_size:
            trade_record = replace(trade_record, allocation_size=effective_allocation)

        # Entry slippage always moves against the position.
        entry_price = round(
            self._apply_entry_slippage(fill_price)
            if expected_action == "BUY"
            else fill_price * (1.0 - self.SLIPPAGE_PCT),
            2,
        )
        confirmed_record = replace(trade_record, entry_date=current_date, entry_price=entry_price)
        self.trades.setdefault(ticker, []).append(confirmed_record)
        self.active_positions += 1
        self.open_positions[ticker] = True

        entry_fee_index_impact = round(
            self.portfolio_value * confirmed_record.allocation_size * self.FEE_RATE,
            4,
        )
        self.total_transactions_cost += entry_fee_index_impact
        self.portfolio_value -= entry_fee_index_impact
        self.open_trade_state[ticker] = {
            "entry_price": entry_price,
            "allocation_size": confirmed_record.allocation_size,
            "last_close": entry_price,
            "entry_portfolio_value": self.portfolio_value,
        }

    def mark_to_market(self,
                       ticker: str,
                       current_close: float
                       ) -> None:
        # Cache dictionary lookup locally.
        if not self.open_positions.get(ticker, False):
            return

        trade_list = self.trades.get(ticker)
        if not trade_list:
            return

        last_trade_record = trade_list[-1]
        if last_trade_record.action not in ("BUY", "SHORT"):
            return

        state = self.open_trade_state.get(ticker)
        entry_price = last_trade_record.entry_price
        if entry_price is None or entry_price <= 0:
            return

        prev_marked_close = state["last_close"] if state is not None else entry_price
        entry_portfolio_value = (
            state.get("entry_portfolio_value", self.portfolio_value)
            if state is not None else self.portfolio_value
        )
        direction = -1.0 if last_trade_record.action == "SHORT" else 1.0
        incremental_pct_return = direction * (current_close - prev_marked_close) / entry_price
        gained_value = entry_portfolio_value * last_trade_record.allocation_size * incremental_pct_return
        self.portfolio_value += round(gained_value, 4)
        self.open_trade_state[ticker] = {
            "entry_price": entry_price,
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
        # Adjust long exit price downwards for sell slippage
        return price * (1.0 - self.SLIPPAGE_PCT)

    def _apply_cover_slippage(self, price: float) -> float:
        # Adjust short exit price upwards for buy-to-cover slippage
        return price * (1.0 + self.SLIPPAGE_PCT)
