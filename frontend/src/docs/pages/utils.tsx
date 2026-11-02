// utils.tsx — The vocabulary: enums, records, dates and price data.
import { C } from '../Blocks';
import type { DocGroup } from '../types';

export const UTILS: DocGroup = {
  id: 'utils',
  title: 'Utils',
  source: 'frontend/src/docs/pages/utils.tsx',
  pages: [
    {
      slug: 'position-type',
      title: 'PositionType',
      lead: 'PositionType says which way a position is held: LONG or SHORT. Neither value means buy or sell.',
      source: 'app/engine/utils/PositionType.py',
      blocks: [
        {
          kind: 'params',
          rows: [
            { name: 'LONG', type: 'PositionType', description: 'A long profits when the price rises.' },
            { name: 'SHORT', type: 'PositionType', description: 'A short profits when the price falls.' },
          ],
        },
        {
          kind: 'code',
          file: 'order.py',
          code: `from app.engine.utils.Order import Order
from app.engine.utils.PositionType import PositionType

order = Order(
    ticker="AAPL",
    position_type=PositionType.LONG,
    allocation=0.1,
    order_date="2024-03-01",
    stop_loss=0.0,
    take_profit=0.0,
)`,
        },
        { kind: 'h2', id: 'not-an-action', text: 'Direction is not an action' },
        {
          kind: 'p',
          text: <>A buy can open a long or cover a short. A sell can close a long or open a short. One word cannot cover both jobs, so the engine stores direction and nothing else. If you buy 100 shares of AAPL and hold them, the position is LONG.</>,
        },
        {
          kind: 'p',
          text: <>The value travels with the trade. You set it on the <C>Order</C> and the manager copies it to the <C>Trade</C> at the fill. The exit maths flips sign on it, so a short profits when the price falls. Nothing else in the engine reads it.</>,
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'There is no BUY or SELL value',
          text: <>Only <C>LONG</C> and <C>SHORT</C> exist. The trading view prints BUY or SHORT for display. That label comes from the API layer, not from this type.</>,
        },
      ],
    },
    {
      slug: 'rebalance-frequency',
      title: 'RebalanceFrequency',
      lead: 'RebalanceFrequency says how often the engine asks your strategy to rebuild its universe.',
      source: 'app/engine/utils/RebalanceFrequency.py',
      blocks: [
        {
          kind: 'params',
          rows: [
            { name: 'DAILY', type: 'RebalanceFrequency', description: 'Once the next calendar day is reached.' },
            { name: 'WEEKLY', type: 'RebalanceFrequency', description: 'Seven calendar days after the last rebuild.' },
            { name: 'MONTHLY', type: 'RebalanceFrequency', description: 'The same day of the next calendar month.' },
            { name: 'QUARTERLY', type: 'RebalanceFrequency', description: 'Three calendar months later.' },
            { name: 'YEARLY', type: 'RebalanceFrequency', description: 'One calendar year later.' },
            { name: 'NEVER', type: 'RebalanceFrequency', description: 'Only the universe built at the start of the run.' },
          ],
        },
        {
          kind: 'p',
          text: <>The base class defaults to <C>NEVER</C>. A strategy that never sets the attribute keeps the universe <C>initialize_universe</C> built.</>,
        },
        { kind: 'h2', id: 'usage', text: 'Setting a cadence' },
        {
          kind: 'code',
          file: 'strategy.py',
          code: `from app.engine.utils.RebalanceFrequency import RebalanceFrequency

class Rotator(Strategy):
    def __init__(self):
        super().__init__()
        self.REBALANCE_FREQUENCY = RebalanceFrequency.MONTHLY

    def on_rebalance(self, current_date, histories):
        # Rebuild self.tickers here; see the dynamic universe example.
        ...`,
        },
        { kind: 'h2', id: 'when-it-fires', text: 'When it actually fires' },
        {
          kind: 'p',
          text: <>The first session of the run counts as the last rebalance. A monthly strategy does not rebalance on day one. It rebalances on the first session at least one calendar month later.</>,
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'Cadence, not date arithmetic in your strategy',
          text: <>Do not track rebalance dates in <C>run_daily</C>. The manager owns the trading calendar. It calls <C>on_rebalance</C> only on a session that exists.</>,
        },
      ],
    },
    {
      slug: 'event-type',
      title: 'EventType and Event',
      lead: 'EventType says why a trade closed. Event pairs that reason with a date and a price.',
      source: 'app/engine/utils/EventType.py',
      blocks: [
        {
          kind: 'params',
          rows: [
            { name: 'STOP_LOSS', type: 'EventType', description: 'The stop was touched during the day. The lot closed at the level or at the open.' },
            { name: 'TAKE_PROFIT', type: 'EventType', description: 'The target was touched during the day. The lot closed at the level or at the open.' },
            { name: 'SIGNAL', type: 'EventType', description: <>A queued exit from <C>should_exit</C> filled at the next open.</> },
            { name: 'END_OF_BACKTEST', type: 'EventType', description: <>The book was liquidated at the final close because <C>LIQUIDATE_ON_END</C> is on.</> },
          ],
        },
        { kind: 'h2', id: 'event', text: 'The Event record' },
        {
          kind: 'params',
          rows: [
            { name: 'date', type: 'str', description: 'The session the exit filled.' },
            { name: 'type', type: 'EventType', description: 'One of the four reasons above.' },
            { name: 'price', type: 'float', description: 'The exit price after slippage.' },
          ],
        },
        {
          kind: 'p',
          text: <>An <C>Event</C> is frozen. It records something that already happened, so nothing in the engine can change it later.</>,
        },
        {
          kind: 'code',
          file: 'inspect a closed trade',
          code: `for trade in result["trades"]:
    if trade.exit is not None:
        print(trade.ticker, trade.exit.date, trade.exit.type, trade.exit.price)`,
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'Exits only',
          text: <>The list holds exit reasons only. A future feature that needs other events gets its own type, not another value here.</>,
        },
      ],
    },
    {
      slug: 'order',
      title: 'Order',
      lead: 'Order is the request on_signal returns to open one position. It fills at the next open, or the manager refuses it.',
      source: 'app/engine/utils/Order.py',
      blocks: [
        {
          kind: 'params',
          rows: [
            { name: 'ticker', type: 'str', description: 'Symbol to trade. It needs local bars on the fill date.' },
            { name: 'position_type', type: 'PositionType', description: <><C>LONG</C> or <C>SHORT</C>.</> },
            { name: 'allocation', type: 'float', description: <>Fraction of equity at fill time. <C>0.10</C> is ten percent. The manager trims it to what cash can cover after the fee.</> },
            { name: 'order_date', type: 'str', description: 'The date the signal was made. The engine records it; the fill uses the session it actually fills on.' },
            { name: 'stop_loss', type: 'float', description: <>Absolute price. <C>0.0</C> turns it off.</> },
            { name: 'take_profit', type: 'float', description: <>Absolute price. <C>0.0</C> turns it off.</> },
            { name: 'meta_data', type: 'dict | None', fallback: 'None', description: 'Anything you want to carry along. The engine does not read it.' },
          ],
        },
        { kind: 'h2', id: 'allocation', text: 'Allocation is not a percentage' },
        {
          kind: 'p',
          text: <>Pass <C>0.25</C> for a quarter of the book, not <C>25</C>. Fractions are fine: with <C>MAX_POSITIONS = 20</C>, <C>allocation=1/20</C> spreads the book evenly.</>,
        },
        { kind: 'h2', id: 'levels', text: 'Levels are prices, not percentages' },
        {
          kind: 'p',
          text: <>A 5% stop on a stock trading at 80 is <C>stop_loss=76.0</C>. The engine compares that price to the bar's low. It does not compute a percentage from the entry.</>,
        },
        {
          kind: 'code',
          file: 'levels from the signal close',
          code: `close = float(data.close_price[-1])

return Order(
    ticker=ticker,
    position_type=PositionType.LONG,
    allocation=0.1,
    order_date=str(data.dates[-1]),
    stop_loss=round(close * 0.95, 2),
    take_profit=round(close * 1.10, 2),
)`,
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'The fill is not the close you measured from',
          text: <>Levels come from today's close, but the entry is the next open plus slippage. A 5% stop on the signal close is not exactly 5% below the real entry. See <C>Stops and targets</C>.</>,
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'Frozen',
          text: <>An order cannot be edited after it is queued. Set the fields before you return it, or return a different order.</>,
        },
      ],
    },
    {
      slug: 'dates',
      title: 'Dates and Calendar',
      lead: 'Dates are stored as int32 day numbers. That keeps a full universe small, and the values still read as YYYY-MM-DD strings.',
      source: 'app/engine/utils/Dates.py',
      blocks: [
        {
          kind: 'p',
          text: <>A date is the number of days since 1970-01-01. Each bar costs four bytes instead of forty. The numbers sort exactly like their labels, so a date search stays an integer search.</>,
        },
        {
          kind: 'table',
          head: ['Name', 'Signature', 'What it does'],
          rows: [
            [<C key="1">to_code</C>, <C key="2">(value: str) → np.int32</C>, 'One "YYYY-MM-DD" label to its day number.'],
            [<C key="3">label</C>, <C key="4">(code: int) → str</C>, 'One day number back to "YYYY-MM-DD".'],
            [<C key="5">label_array</C>, <C key="6">(codes) → np.ndarray</C>, <>A whole column to a <C>"&lt;U10"</C> string array.</>],
            [<C key="7">register</C>, <C key="8">(labels) → np.ndarray</C>, 'Add labels to the shared calendar and return their codes.'],
            [<C key="9">CALENDAR</C>, <C key="10">Calendar</C>, <>The process-wide label table. <C>CALENDAR.label(code)</C> is the same as <C>label(code)</C>.</>],
          ],
        },
        { kind: 'h2', id: 'views', text: 'Reading dates from data' },
        {
          kind: 'p',
          text: <><C>StockData.dates</C> is a <C>DateLabels</C> view over the codes. It reads like the string array older strategies used: <C>len(data.dates)</C>, <C>data.dates[-1]</C> and slicing all work. Comparisons stay on the integer path.</>,
        },
        {
          kind: 'code',
          file: 'date views',
          code: `latest = data.dates[-1]          # "2024-03-01"
last_ten = data.dates[-10:]      # DateLabels view, still decodes on read
grid = data.labels               # numpy array of "<U10" strings

order = Order(..., order_date=str(latest), ...)`,
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'A label must be registered',
          text: <>The calendar knows only the dates in data that has been read. Decoding a code for a loaded date is fine. Decoding one that was never loaded raises <C>KeyError</C>.</>,
        },
        {
          kind: 'callout',
          tone: 'tip',
          title: 'Compare codes, not strings',
          text: <>For date arithmetic inside a strategy, use <C>to_code</C> on both sides. String comparison works for ISO dates, but every bar goes through a decode.</>,
        },
      ],
    },
    {
      slug: 'stock-data',
      title: 'StockData',
      lead: "StockData holds one ticker's daily bars as parallel read-only arrays.",
      source: 'app/engine/utils/StockData.py',
      blocks: [
        {
          kind: 'params',
          rows: [
            { name: 'ticker', type: 'str', description: 'The symbol these bars belong to.' },
            { name: 'date_codes', type: 'np.ndarray[int32]', description: <>One day number per bar. The legacy keyword <C>dates</C> is still accepted.</> },
            { name: 'open_price', type: 'np.ndarray', description: 'Session open.' },
            { name: 'high', type: 'np.ndarray', description: 'Session high.' },
            { name: 'low', type: 'np.ndarray', description: 'Session low.' },
            { name: 'close_price', type: 'np.ndarray', description: 'Session close. The field most strategies read.' },
            { name: 'volume', type: 'np.ndarray', description: 'Shares traded.' },
          ],
        },
        { kind: 'h2', id: 'no-lookahead', text: 'The slice is the contract' },
        {
          kind: 'p',
          text: <>The engine copies a history up to the current session before it calls a hook. Every array ends on the bar you may act on. <C>close_price[-1]</C> is today's close, and no index exists for tomorrow.</>,
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'Do not keep a StockData across days',
          text: <>Each session hands you a new slice. Keeping yesterday's object to compare with today puts stale values in your signal. Read the number you need and store that.</>,
        },
        { kind: 'h2', id: 'read-only', text: 'The arrays are read-only' },
        {
          kind: 'p',
          text: <>Every array is marked non-writeable when the object is built. <C>data.close_price[-1] = 5</C> raises <C>ValueError: assignment destination is read-only</C>. Compute into a new array instead.</>,
        },
        {
          kind: 'code',
          file: 'reading a history',
          code: `import numpy as np

close = float(data.close_price[-1])
window = data.close_price[-20:]
average = float(np.mean(window))

if close < average:
    ...`,
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'Bars, not calendar days',
          text: <>A 20-bar window is 20 trading sessions, about a month. Weekends and holidays are not in the data. A period is never a number of calendar days.</>,
        },
      ],
    },
    {
      slug: 'trade',
      title: 'Trade',
      lead: 'Trade is one filled lot, from entry to exit.',
      source: 'app/engine/utils/Trade.py',
      blocks: [
        {
          kind: 'params',
          rows: [
            { name: 'id', type: 'int', description: 'Unique within the run. Assigned at fill.' },
            { name: 'ticker', type: 'str', description: 'The symbol.' },
            { name: 'history', type: 'StockData', description: <>The bars as of entry. The engine refreshes it to the current session before calling <C>should_exit</C>.</> },
            { name: 'position_type', type: 'PositionType', description: 'LONG or SHORT.' },
            { name: 'entry_date', type: 'str', description: 'The session the order filled.' },
            { name: 'entry_price', type: 'float', description: 'The fill after slippage, rounded to two decimals.' },
            { name: 'allocation', type: 'float', description: 'Fraction of equity committed, after the manager trimmed it.' },
            { name: 'equity_at_entry', type: 'float', description: 'The index value the fraction was measured against.' },
            { name: 'stop_loss', type: 'float', description: 'Absolute stop price copied from the order. 0 means none.' },
            { name: 'take_profit', type: 'float', description: 'Absolute target price copied from the order. 0 means none.' },
            { name: 'fees', type: 'float', description: 'Entry fee, plus the exit fee once closed.' },
            { name: 'exit', type: 'Event | None', fallback: 'None', description: 'The exit that closed the lot. None while it is open.' },
          ],
        },
        { kind: 'h2', id: 'one-lot', text: 'One trade is one lot' },
        {
          kind: 'p',
          text: <>If your strategy buys the same ticker twice, the manager records two trades. Each keeps its own entry price, stop and target. Adding to a position never rewrites the risk already committed.</>,
        },
        {
          kind: 'code',
          file: 'sizing from the record',
          code: `notional = trade.equity_at_entry * trade.allocation
direction = -1.0 if trade.position_type is PositionType.SHORT else 1.0

gross = notional * direction * (exit_price - trade.entry_price) / trade.entry_price
net = gross - trade.fees`,
        },
        { kind: 'h2', id: 'is-open', text: 'is_open' },
        {
          kind: 'p',
          text: <><C>trade.is_open</C> is derived from <C>exit is None</C>. It is not stored, so it cannot disagree with the event that closed the trade.</>,
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'Entry price already includes slippage',
          text: <><C>entry_price</C> already includes entry slippage. Do not subtract it again when you reconcile a fill.</>,
        },
      ],
    },
  ],
};
