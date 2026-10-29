# portfolio_manager.py — Keeps the book: orders, fills, positions, costs and equity.
#
# Orders fill at the next open. Stops and targets are resting levels, so they
# fill inside the day's bar at the level, or at the open when the bar gapped
# through it. One entry is one lot, so adding to a position never averages the
# entry price.
#
# Equity is an index starting at 100:
#     starting + realized - costs + unrealized
# The strategy sees this book through refresh_view() and never changes it.

# -------- Imports --------
import numpy as np
from datetime import datetime
from dateutil.relativedelta import relativedelta
from app.engine.utils.Event import Event
from app.engine.utils.Order import Order
from app.engine.utils.Trade import Trade
from app.engine.utils.EventType import EventType
from app.engine.strategy.strategy import Strategy
from app.engine.utils.PositionType import PositionType
from app.engine.utils.RebalanceFrequency import RebalanceFrequency
from app.database.fetch import get_stock_history

# -------- Rebalance Arithmetic --------
REBALANCE_DELTAS: dict[RebalanceFrequency, relativedelta] = {
    RebalanceFrequency.DAILY: relativedelta(days=1),
    RebalanceFrequency.WEEKLY: relativedelta(weeks=1),
    RebalanceFrequency.MONTHLY: relativedelta(months=1),
    RebalanceFrequency.QUARTERLY: relativedelta(months=3),
    RebalanceFrequency.YEARLY: relativedelta(years=1),
    RebalanceFrequency.NEVER: None
}


# -------- Portfolio Manager --------
class PortfolioManager:
    # Owns the book: orders, fills, positions, costs and equity.

    def __init__(self, strategy: Strategy) -> None:
        # The strategy this book belongs to
        self.strategy: Strategy = strategy

        # Trading costs, applied to every fill
        self.SLIPPAGE_PCT: float = 0.0005
        self.FEE_RATE: float = 0.001

        # Index accounting, starting at 100
        self.starting_equity: float = 100.00
        self.portfolio_value: float = 100.00
        self.cash: float = 100.00
        self.realized_pnl: float = 0.0
        self.total_cost: float = 0.0

        # Records
        self.trades: list[Trade] = []
        self.open_trades: dict[int, Trade] = {}
        self._open_trades_by_ticker: dict[str, list[Trade]] = {}
        self._open_tickers: set[str] = set()
        self._invested_by_ticker: dict[str, float] = {}
        self._invested_notional: float = 0.0
        self._strategy_open_tickers: frozenset[str] = frozenset()
        self._strategy_open_trades: tuple[Trade, ...] = ()
        self._strategy_view_dirty: bool = True
        self._trade_by_id: dict[int, Trade] = {}
        self.rejected_orders: dict[str, int] = {}

        # Equity logs (stored as fast lists during execution, converted to NumPy vectors via property)
        self._dates_log: list[str] = []
        self._equity_log: list[float] = []
        self._cash_log: list[float] = []

        # Queues drained at the next open; ids of lots due to close
        self.pending_orders: list[Order] = []
        self.pending_exits: list[int] = []

        # Last traded price per ticker, so a suspended name keeps its mark
        self.last_prices: dict[str, float] = {}

        # Rebalance tracking
        self.last_rebalance_date: str | None = None

        self._next_trade_id: int = 1

        # Hand the strategy the opening book
        self.refresh_view()

    # -------- Strategy View --------
    def refresh_view(self) -> None:
        # Rebuild immutable snapshots once after book changes, not per fill.
        if self._strategy_view_dirty:
            self._strategy_open_trades = tuple(self.open_trades.values())
            self._strategy_open_tickers = frozenset(self._open_tickers)
            self._strategy_view_dirty = False
        self.strategy._open_trades = self._strategy_open_trades
        self.strategy._open_ticker_set = self._strategy_open_tickers
        self.strategy._equity = self.portfolio_value

    # -------- Read-only State --------
    @property
    def active_positions(self) -> int:
        # Distinct tickers with at least one open lot
        return len(self._open_tickers)

    @property
    def open_tickers(self) -> set[str]:
        # Every ticker currently holding a lot
        return set(self._open_tickers)

    @property
    def equity_curve(self) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        # Builds and returns the equity curve history as a vectorized NumPy tuple: (dates, equities, cash)
        return (
            np.array(self._dates_log, dtype=str),
            np.array(self._equity_log, dtype=np.float64),
            np.array(self._cash_log, dtype=np.float64),
        )

    def lots(self, ticker: str) -> list[Trade]:
        # Open lots in one ticker, oldest first
        return self._open_trades_by_ticker.get(ticker, []).copy()

    # -------- Order Management --------
    def submit_order(self, order: Order) -> None:
        # Queue an entry for the next open; it is validated at the fill.
        self.pending_orders.append(order)

    def queue_exit(self, trade_id: int) -> None:
        # Queue one lot to close at the next open, ignoring a duplicate request
        if trade_id not in self.pending_exits:
            self.pending_exits.append(trade_id)

    # -------- Filling --------
    def fill_pending_orders(self, current_date: str, opens: dict[str, float]) -> None:
        # Fill every queued order at today's open.
        for order in self.pending_orders:
            open_price = self._get_valid_open_price(order.ticker, opens)
            if open_price is not None:
                self._fill_order(order, open_price, current_date)

        self.pending_orders.clear()

    def fill_pending_exits(self, current_date: str, opens: dict[str, float]) -> None:
        # Fill every queued exit at today's open.
        for trade_id in self.pending_exits:
            trade = self._find_trade(trade_id)
            if trade is None or not trade.is_open:
                continue

            open_price = self._get_valid_open_price(trade.ticker, opens)
            if open_price is not None:
                self._fill_exit(trade, open_price, current_date, EventType.SIGNAL)

        self.pending_exits.clear()

    # -------- Exit --------
    def check_exits(self, ticker: str, current_date: str,
                    current_open, current_high, current_low):
        # Close lots whose stop or target was hit. Stop wins if both were.
        for trade in self.lots(ticker):
            filled_price, event_type = self._check_exit(
                trade, current_open, current_high, current_low,
            )
            if event_type is not None:
                self._fill_exit(trade, filled_price, current_date, event_type)

    def close_all(self, current_date: str, closes: dict[str, float]) -> None:
        # Liquidate all remaining open positions at the final bar's close
        for trade in list(self.open_trades.values()):
            close_price = closes.get(trade.ticker, trade.entry_price)
            if close_price is None or close_price <= 0:
                close_price = self.last_prices.get(trade.ticker, trade.entry_price)
            self._fill_exit(trade, close_price, current_date, EventType.END_OF_BACKTEST)

    # -------- Marking --------
    def update_daily_accounting(self, current_date: str, closes: dict[str, float]) -> None:
        # Mark open positions to market at today's close and log daily equity/cash.
        # Cache attribute lookups locally for optimization in tight loops
        last_prices = self.last_prices
        starting_equity = self.starting_equity
        realized_pnl = self.realized_pnl
        total_cost = self.total_cost

        # Update last known prices; a ticker without a price today keeps its last mark
        for ticker, price in closes.items():
            if price > 0:
                last_prices[ticker] = price

        unrealized = 0.0
        for trade in self.open_trades.values():
            price = last_prices.get(trade.ticker, trade.entry_price)
            direction = -1.0 if trade.position_type is PositionType.SHORT else 1.0

            notional = trade.equity_at_entry * trade.allocation
            pct_return = direction * (price - trade.entry_price) / trade.entry_price
            unrealized += notional * pct_return

        # Index accounting formula: starting + realized - costs + unrealized
        self.portfolio_value = (
            starting_equity
            + realized_pnl
            - total_cost
            + unrealized
        )

        # Append to high-performance primitive logs
        if self._dates_log and self._dates_log[-1] == current_date:
            self._equity_log[-1] = self.portfolio_value
            self._cash_log[-1] = self.cash
        else:
            self._dates_log.append(current_date)
            self._equity_log.append(self.portfolio_value)
            self._cash_log.append(self.cash)

        # Flag view dirty so the strategy sees updated equity tomorrow morning
        self._strategy_view_dirty = True

    # -------- Rebalancing --------
    def rebalance_due(self, current_date: str) -> bool:
        # True when the cadence has elapsed since the last rebuild.
        frequency = self.strategy.REBALANCE_FREQUENCY
        if frequency is RebalanceFrequency.NEVER:
            return False
        if self.last_rebalance_date is None:
            return True

        due_at = datetime.strptime(self.last_rebalance_date, "%Y-%m-%d")
        due_at += REBALANCE_DELTAS[frequency]
        return current_date >= due_at.strftime("%Y-%m-%d")

    def mark_rebalanced(self, current_date: str) -> None:
        # Remember when the universe was last rebuilt
        self.last_rebalance_date = current_date

    # -------- Helpers --------
    def _fill_order(self, order: Order, open_price: float, current_date: str) -> None:
        # Validate constraints, calculate execution price and fees, and record the trade.
        ticker = order.ticker
        ticker_lots = self.lots(ticker)

        # Validate price and strategy constraints via our helpers
        if open_price <= 0:
            self._reject(f"Invalid open price for ticker: {ticker} | open: {open_price}")
            return

        if not self._validate_order_constraints(order, ticker, ticker_lots):
            return

        # Entry slippage always moves against the position
        if order.position_type is PositionType.LONG:
            entry_price = round(open_price * (1.0 + self.SLIPPAGE_PCT), 2)
        else:
            entry_price = round(open_price * (1.0 - self.SLIPPAGE_PCT), 2)

        # Track equity & fees
        equity_at_entry = self.portfolio_value
        entry_fee = round(equity_at_entry * order.allocation * self.FEE_RATE, 4)

        trade = Trade(
            id=self._next_trade_id,
            ticker=ticker,
            history=get_stock_history(ticker, end=current_date),
            position_type=order.position_type,
            entry_date=current_date,
            entry_price=entry_price,
            allocation=order.allocation,
            equity_at_entry=equity_at_entry,
            stop_loss=order.stop_loss,
            take_profit=order.take_profit,
            fees=entry_fee,
        )

        self._next_trade_id += 1
        self._trade_by_id[trade.id] = trade
        self.trades.append(trade)
        self.open_trades[trade.id] = trade
        self._open_trades_by_ticker.setdefault(ticker, []).append(trade)
        self._open_tickers.add(ticker)

        notional = trade.equity_at_entry * trade.allocation
        self._invested_by_ticker[ticker] = self._invested_by_ticker.get(ticker, 0.0) + notional
        self._invested_notional += notional
        self._strategy_view_dirty = True
        self.last_prices[ticker] = entry_price
        self.total_cost += entry_fee
        self.cash -= (notional + entry_fee)

        # Keep later fills in this batch using equity net of earlier entry fees.
        self.portfolio_value -= entry_fee

    def _fill_exit(self, trade: Trade, price: float, current_date: str, event_type: EventType) -> None:
        # Realize one lot: exit slippage, fee, event, realized profit
        if price <= 0:
            self._reject("invalid_price")
            return

        if trade.position_type is PositionType.LONG:
            exit_price = round(price * (1.0 - self.SLIPPAGE_PCT), 2)
            direction = 1.0
        else:
            exit_price = round(price * (1.0 + self.SLIPPAGE_PCT), 2)
            direction = -1.0

        notional = trade.equity_at_entry * trade.allocation
        self._invested_notional -= notional
        ticker_notional = self._invested_by_ticker[trade.ticker] - notional
        if ticker_notional > 1e-12:
            self._invested_by_ticker[trade.ticker] = ticker_notional
        else:
            del self._invested_by_ticker[trade.ticker]
        pct_return = direction * (exit_price - trade.entry_price) / trade.entry_price
        exit_fee = round(notional * (exit_price / trade.entry_price) * self.FEE_RATE, 4)

        trade.fees = round(trade.fees + exit_fee, 4)
        trade.exit = Event(date=current_date, type=event_type, price=exit_price)

        realized_profit = notional * pct_return
        self.cash += (notional + realized_profit - exit_fee)
        self.realized_pnl += realized_profit
        self.total_cost += exit_fee
        self.last_prices[trade.ticker] = exit_price
        del self.open_trades[trade.id]
        ticker_lots = self._open_trades_by_ticker[trade.ticker]
        ticker_lots.remove(trade)
        if not ticker_lots:
            del self._open_trades_by_ticker[trade.ticker]
            self._open_tickers.remove(trade.ticker)
        self._strategy_view_dirty = True

    def _get_valid_open_price(self, ticker: str, opens: dict[str, float]) -> float | None:
        # Validates and returns the opening price for a ticker, or rejects if missing/invalid.
        open_price = opens.get(ticker)
        if open_price is None or open_price <= 0:
            self._reject(f"No valid bar for ticker: {ticker}")
            return None
        return open_price

    def _validate_order_constraints(self, order: Order, ticker: str, ticker_lots: list[Trade]) -> bool:
        # Checks all strategy constraints (lots, positions, max allocation, equity).
        if order.allocation <= 0:
            self._reject(f"Invalid allocation percent for ticker: {ticker} | allocation: {order.allocation}")
            return False

        # Check maximum lots per ticker
        max_lots = self.strategy.MAX_LOTS_PER_TICKER
        if max_lots is not None and len(ticker_lots) >= max_lots:
            self._reject(f"Maximum lots reached for ticker: {ticker} | lots: {max_lots}")
            return False

        # Check maximum overall positions
        max_positions = self.strategy.MAX_POSITIONS
        if (max_positions is not None
                and not ticker_lots
                and self.active_positions >= max_positions):
            self._reject("Strategy has filled maximum number of positions")
            return False

        # Check maximum allocation per ticker
        ticker_allocation = round(self._invested_by_ticker.get(ticker, 0.0) / self.portfolio_value, 2)
        max_allocation = self.strategy.MAX_ALLOCATION_PER_TICKER
        if max_allocation is not None and ticker_allocation + order.allocation > max_allocation:
            self._reject(
                f"Max allocation exceeded for {ticker}: "
                f"Total {ticker_allocation + order.allocation:.2%} > Limit {max_allocation:.2%}"
            )
            return False

        # Check available equity
        invested = self._invested_notional / self.portfolio_value
        if invested + order.allocation > 1.0:
            self._reject(f"Not enough equity to allocate {ticker}")
            return False

        return True

    def _find_trade(self, trade_id: int) -> Trade | None:
        return self._trade_by_id.get(trade_id)

    def _reject(self, reason: str) -> None:
        # Count a refusal so a strategy can see why nothing happened
        self.rejected_orders[reason] = self.rejected_orders.get(reason, 0) + 1

    def get_equity_curve_dicts(self) -> list[dict]:
        # Manually constructs and returns the equity curve history as a list of dictionaries.
        dates, equities, cashes = self.equity_curve
        return [
            {"date": d, "equity": float(eq), "cash": float(c)}
            for d, eq, c in zip(dates, equities, cashes)
        ]

    @staticmethod
    def _check_exit(trade: Trade, current_open: float, current_high: float, current_low: float) -> tuple[float, EventType | None]:
        # Which resting level, if any, today's bar touched, and at what price
        stop = trade.stop_loss
        target = trade.take_profit

        if trade.position_type is PositionType.LONG:
            if stop > 0 and current_low <= stop:
                return min(current_open, stop), EventType.STOP_LOSS
            if target > 0 and current_high >= target:
                return max(current_open, target), EventType.TAKE_PROFIT
        else:
            if stop > 0 and current_high >= stop:
                return max(current_open, stop), EventType.STOP_LOSS
            if target > 0 and current_low <= target:
                return min(current_open, target), EventType.TAKE_PROFIT

        return 0.0, None
