// docsSources.ts — Concise, current-engine excerpts shown by the Docs page.
// These examples mirror the public contracts in app/engine, including its backtesting package.
export const BASE_STRATEGY_SOURCE = `# core/strategy/base_strategy.py
from core.utils.Order import Order
from core.utils.StockData import StockData
from core.utils.Trade import Trade
from core.utils.RebalanceFrequency import RebalanceFrequency


class Strategy:
    def __init__(self):
        self.name = "Base Strategy"
        self.description = "Base Strategy Interface"
        self.MAX_POSITIONS = 10
        self.MAX_ALLOCATION_PER_TICKER = None
        self.MAX_LOTS_PER_TICKER = 1
        self.REBALANCE_FREQUENCY = RebalanceFrequency.NEVER
        self.MIN_BARS_REQUIRED = 0
        self.LIQUIDATE_ON_END = False
        self.tickers = []

    def initialize_universe(self, current_date: str) -> bool:
        return bool(self.tickers)

    def run_daily(self, current_date: str) -> None:
        pass

    def on_rebalance(self, current_date: str) -> None:
        pass

    def on_signal(self, ticker: str, data: StockData) -> Order | None:
        raise NotImplementedError

    def should_exit(self, ticker: str, trade: Trade) -> bool:
        return False`;

export const PORTFOLIO_MANAGER_SOURCE = `# core/portfolio/portfolio_manager.py
class PortfolioManager:
    """Created and owned by Backtester. Strategies do not subclass it."""

    SLIPPAGE_PCT = 0.0005  # 0.05% per fill
    FEE_RATE = 0.001       # 0.1% per fill
    starting_equity = 100.0

    def submit_order(self, order: Order) -> None:
        # Queue an entry for the next available open.
        ...

    def queue_exit(self, trade_id: int) -> None:
        # Queue a custom exit for the next available open.
        ...

    def update_daily_accounting(self, current_date, closes) -> None:
        # Mark open positions and record one equity point for the date.
        ...`;

export const BACKTESTER_SOURCE = `# backtester.py — simplified daily sequence
for current_date in trading_calendar:
    strategy.run_daily(current_date)
    fill_queued_exits_and_entries_at_today_open()

    if rebalance_is_due:
        strategy.on_rebalance(current_date)

    for ticker in strategy.tickers:
        data = stock_data_through_today(ticker, current_date)
        if len(data.dates) >= strategy.MIN_BARS_REQUIRED:
            order = strategy.on_signal(ticker, data)
            if order is not None:
                manager.submit_order(order)

    for open_trade in manager.open_trades:
        open_trade.history = stock_data_through_today(open_trade.ticker, current_date)
        if strategy.should_exit(open_trade.ticker, open_trade):
            manager.queue_exit(open_trade.id)

    check_resting_stop_and_target_levels()
    if is_final_day and strategy.LIQUIDATE_ON_END:
        manager.close_all_at_final_close()
    manager.update_daily_accounting(current_date, closes)`;

export const STOCK_DATA_SOURCE = `# core/utils/StockData.py
@dataclass(frozen=True)
class StockData:
    ticker: str
    dates: np.ndarray
    open_price: np.ndarray
    high: np.ndarray
    low: np.ndarray
    close_price: np.ndarray
    volume: np.ndarray

# Arrays are read-only. For callbacks, the final item is the current session.
# Future bars are not included.`;

export const ORDER_SOURCE = `# core/utils/Order.py
@dataclass(frozen=True)
class Order:
    ticker: str
    position_type: PositionType  # LONG or SHORT
    allocation: float            # fraction of equity, e.g. 0.10 = 10%
    order_date: str
    stop_loss: float             # absolute price; <= 0 disables this level
    take_profit: float           # absolute price; <= 0 disables this level
    meta_data: dict | None = None`;

export const TRADE_SOURCE = `# core/utils/Trade.py
@dataclass
class Trade:
    id: int
    ticker: str
    history: StockData
    position_type: PositionType
    entry_date: str
    entry_price: float
    allocation: float
    equity_at_entry: float
    stop_loss: float
    take_profit: float
    fees: float
    exit: Event | None = None

    @property
    def is_open(self) -> bool:
        return self.exit is None`;

export const EVENT_SOURCE = `# core/utils/Event.py
@dataclass(frozen=True)
class Event:
    date: str
    type: EventType  # STOP_LOSS, TAKE_PROFIT, SIGNAL, END_OF_BACKTEST
    price: float`;
