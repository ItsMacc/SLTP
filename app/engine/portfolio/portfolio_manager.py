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
from datetime import datetime
from dateutil.relativedelta import relativedelta
from app.engine.strategy.strategy import Strategy
from app.engine.utils.Event import Event
from app.engine.utils.EventType import EventType
from app.engine.utils.Order import Order
from app.engine.utils.PositionType import PositionType
from app.engine.utils.RebalanceFrequency import RebalanceFrequency
from app.engine.utils.Trade import Trade


# -------- Rebalance Arithmetic --------
# NEVER is checked in rebalance_due(), so it has no delta here.
REBALANCE_DELTAS: dict[RebalanceFrequency, relativedelta] = {
    RebalanceFrequency.DAILY: relativedelta(days=1),
    RebalanceFrequency.WEEKLY: relativedelta(weeks=1),
    RebalanceFrequency.MONTHLY: relativedelta(months=1),
    RebalanceFrequency.QUARTERLY: relativedelta(months=3),
    RebalanceFrequency.YEARLY: relativedelta(years=1),
}


# -------- Portfolio Manager --------
class PortfolioManager:
    """Owns the book: orders, fills, positions, costs and equity."""

    def __init__(self, strategy: Strategy) -> None:
        # The strategy this book belongs to
        self.strategy: Strategy = strategy

        # Trading costs, applied to every fill
        self.SLIPPAGE_PCT: float = 0.0005
        self.FEE_RATE: float = 0.001

        # Index accounting, starting at 100
        self.starting_equity: float = 100.00
        self.portfolio_value: float = 100.00
        self.realized_pnl: float = 0.0
        self.total_cost: float = 0.0

        # Records
        self.trades: list[Trade] = []
        self.open_trades: list[Trade] = []
        self.equity_curve: list[dict] = []
        self.rejected_orders: dict[str, int] = {}

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
        # Push the book to the strategy; called before every hook.
        self.strategy._open_trades = tuple(self.open_trades)
        self.strategy._equity = self.portfolio_value

    # -------- Read-only State --------
    @property
    def active_positions(self) -> int:
        # Distinct tickers with at least one open lot
        return len({trade.ticker for trade in self.open_trades})

    @property
    def open_tickers(self) -> set[str]:
        # Every ticker currently holding a lot
        return {trade.ticker for trade in self.open_trades}

    def lots(self, ticker: str) -> list[Trade]:
        # Open lots in one ticker, oldest first
        return [trade for trade in self.open_trades if trade.ticker == ticker]

    # -------- Submitting --------
    def submit(self, order: Order) -> None:
        # Queue an entry for the next open; it is validated at the fill.
        self.pending_orders.append(order)

    def queue_exit(self, trade_id: int) -> None:
        # Queue one lot to close at the next open, ignoring a duplicate request
        if trade_id not in self.pending_exits:
            self.pending_exits.append(trade_id)

    # -------- Filling --------
    def fill_pending(self, current_date: str, opens: dict[str, float]) -> None:
        """Fill every queued order and exit at today's open.

        ``opens`` maps a ticker to its open price today. A queued ticker with no
        bar is dropped and counted, never carried forward, so an order cannot
        fill on stale data days later.
        """
        for order in self.pending_orders:
            open_price = opens.get(order.ticker)
            if open_price is None or open_price <= 0:
                self._reject("no_bar")
                continue
            self._open(order, open_price, current_date)

        for trade_id in self.pending_exits:
            trade = self._find_trade(trade_id)
            if trade is None or not trade.is_open:
                continue
            open_price = opens.get(trade.ticker)
            if open_price is None or open_price <= 0:
                self._reject("no_bar")
                continue
            self._close(
                trade,
                open_price,
                current_date,
                EventType.SIGNAL,
            )

        self.pending_orders.clear()
        self.pending_exits.clear()

    # -------- Exits --------
    def check_exits(self,
                    ticker: str,
                    current_open: float,
                    current_high: float,
                    current_low: float,
                    current_date: str,
                    ) -> None:
        # Close lots whose stop or target was hit; stop wins if both were.
        for trade in self.lots(ticker):
            filled_price, event_type = self._triggered(
                trade, current_open, current_high, current_low,
            )
            if event_type is not None:
                self._close(trade, filled_price, current_date, event_type)

    def close_all(self, current_date: str, closes: dict[str, float]) -> None:
        # Flatten the book when a run ends with positions still open.
        for trade in list(self.open_trades):
            close_price = closes.get(trade.ticker)
            if close_price is None or close_price <= 0:
                close_price = self.last_prices.get(trade.ticker, trade.entry_price)
            self._close(trade, close_price, current_date, EventType.END_OF_BACKTEST)

    # -------- Marking --------
    def mark_to_market(self, prices: dict[str, float]) -> None:
        # Revalue at today's closes; a ticker without a price keeps its last mark.
        for ticker, price in prices.items():
            if price > 0:
                self.last_prices[ticker] = price

        # equity = starting + realized - costs + unrealized
        unrealized = 0.0
        for trade in self.open_trades:
            price = self.last_prices.get(trade.ticker, trade.entry_price)
            direction = -1.0 if trade.position_type is PositionType.SHORT else 1.0
            unrealized += (
                trade.equity_at_entry
                * trade.weight
                * direction
                * (price - trade.entry_price)
                / trade.entry_price
            )

        self.portfolio_value = (
            self.starting_equity + self.realized_pnl - self.total_cost + unrealized
        )

    def record_equity(self, current_date: str) -> None:
        # One point per trading day; key names match what the API already serves
        self.equity_curve.append({
            "date": current_date,
            "portfolio_value": round(self.portfolio_value, 2),
            "active_positions": self.active_positions,
            "total_transaction_cost": round(self.total_cost, 4),
        })

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

    # -------- Internals --------
    def _open(self, order: Order, open_price: float, current_date: str) -> None:
        # Validate against the book, then record one filled lot
        if open_price <= 0:
            self._reject("invalid_price")
            return
        if order.weight <= 0:
            self._reject("invalid_weight")
            return

        ticker_lots = self.lots(order.ticker)
        max_lots = self.strategy.MAX_LOTS_PER_TICKER
        if max_lots is not None and len(ticker_lots) >= max_lots:
            self._reject("max_lots")
            return

        max_positions = self.strategy.MAX_POSITIONS
        if (max_positions is not None
                and not ticker_lots
                and self.active_positions >= max_positions):
            self._reject("max_positions")
            return

        # Measure exposure in current equity; weights from different days don't add.
        self.mark_to_market({})
        ticker_weight = sum(
            trade.equity_at_entry * trade.weight for trade in ticker_lots
        ) / self.portfolio_value

        max_weight = self.strategy.MAX_WEIGHT_PER_TICKER
        if max_weight is not None and ticker_weight + order.weight > max_weight:
            self._reject("max_weight")
            return

        invested = sum(
            trade.equity_at_entry * trade.weight for trade in self.open_trades
        ) / self.portfolio_value
        if invested + order.weight > 1.0:
            self._reject("no_capital")
            return

        # Entry slippage always moves against the position
        if order.position_type is PositionType.LONG:
            entry_price = round(open_price * (1.0 + self.SLIPPAGE_PCT), 2)
        else:
            entry_price = round(open_price * (1.0 - self.SLIPPAGE_PCT), 2)

        equity_at_entry = self.portfolio_value
        entry_fee = round(equity_at_entry * order.weight * self.FEE_RATE, 4)

        trade = Trade(
            id=self._next_trade_id,
            ticker=order.ticker,
            position_type=order.position_type,
            entry_date=current_date,
            entry_price=entry_price,
            weight=order.weight,
            equity_at_entry=equity_at_entry,
            stop_loss=order.stop_loss,
            take_profit=order.take_profit,
            fees=entry_fee,
        )

        self._next_trade_id += 1
        self.trades.append(trade)
        self.open_trades.append(trade)
        self.last_prices[order.ticker] = entry_price
        self.total_cost += entry_fee

    def _close(self,
               trade: Trade,
               price: float,
               current_date: str,
               event_type: EventType,
               ) -> None:
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

        notional = trade.equity_at_entry * trade.weight
        pct_return = direction * (exit_price - trade.entry_price) / trade.entry_price
        exit_fee = round(notional * (exit_price / trade.entry_price) * self.FEE_RATE, 4)

        trade.fees = round(trade.fees + exit_fee, 4)
        trade.exit = Event(date=current_date, type=event_type, price=exit_price)

        self.realized_pnl += notional * pct_return
        self.total_cost += exit_fee
        self.last_prices[trade.ticker] = exit_price
        self.open_trades.remove(trade)

    def _triggered(self,
                   trade: Trade,
                   current_open: float,
                   current_high: float,
                   current_low: float,
                   ) -> tuple[float, EventType | None]:
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

    def _find_trade(self, trade_id: int) -> Trade | None:
        # Look up a lot by id across the whole log
        for trade in self.trades:
            if trade.id == trade_id:
                return trade
        return None

    def _reject(self, reason: str) -> None:
        # Count a refusal so a strategy can see why nothing happened
        self.rejected_orders[reason] = self.rejected_orders.get(reason, 0) + 1
