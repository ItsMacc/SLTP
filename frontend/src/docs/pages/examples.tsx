// examples.tsx — Five complete strategies, each showing one mechanism.
import { C, B } from '../Blocks';
import type { DocGroup } from '../types';

export const EXAMPLES: DocGroup = {
  id: 'examples',
  title: 'Examples',
  source: 'frontend/src/docs/pages/examples.tsx',
  pages: [
    {
      slug: 'example-hold',
      title: 'Buy and hold a fixed set',
      lead: 'HoldFive buys five names once and holds them to the last session.',
      source: 'app/strategies/benchmark.py',
      blocks: [
        {
          kind: 'code',
          file: 'hold_five.py',
          code: `from app.engine.backtesting import Backtester
from app.engine.strategy import Strategy
from app.engine.utils.Order import Order
from app.engine.utils.PositionType import PositionType


class HoldFive(Strategy):
    TICKERS = ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL"]

    def __init__(self):
        super().__init__()
        self.name = "Hold Five"
        self.description = "Equal-weight five names, bought once and held."
        self.MAX_POSITIONS = len(self.TICKERS)
        self.MAX_LOTS_PER_TICKER = 1
        self.MIN_BARS_REQUIRED = 1
        self.LIQUIDATE_ON_END = True

    def initialize_universe(self, current_date, histories):
        self.tickers.clear()
        self.add_tickers([ticker for ticker in self.TICKERS if ticker in histories])
        return bool(self.tickers)

    def on_signal(self, ticker, data):
        if ticker in self.open_tickers:
            return None
        return Order(
            ticker=ticker,
            position_type=PositionType.LONG,
            allocation=1.0 / len(self.TICKERS),
            order_date=str(data.dates[-1]),
            stop_loss=0.0,
            take_profit=0.0,
        )


result = Backtester(HoldFive(), "2015-01-01", "2024-12-31").run()`,
        },
        { kind: 'h2', id: 'why', text: 'Why it is written this way' },
        {
          kind: 'ul',
          items: [
            <>The universe is filtered against <C>histories</C>, so a symbol with no local data never enters the book.</>,
            <><C>MAX_POSITIONS</C> equals the list length, so every name can hold one lot.</>,
            <><C>MAX_LOTS_PER_TICKER</C> is spelled out even though 1 is the default. The line states the intent.</>,
            <><C>LIQUIDATE_ON_END</C> closes the lots at the final close, so the ending value is cash rather than a mark.</>,
          ],
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'This is the benchmark pattern',
          text: <>The engine's own benchmark holds SPY with one order and never sells, collecting its dividends along the way. A fixed set of five is the same idea with more names. It is a useful control: a strategy that cannot beat it has no edge to explain.</>,
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'Zeros are real statistics',
          text: <>Nothing sells, so there are no closed trades. Win rate, expectancy and average win are all zero. Judge this run on <C>cagr</C> and <C>max_drawdown</C>.</>,
        },
      ],
    },
    {
      slug: 'example-stops',
      title: 'Entries with 10% target and 5% stop',
      lead: 'FiveTen buys when the 20-day average sits above the 50-day average, with a 5% stop and a 10% target on every entry.',
      blocks: [
        {
          kind: 'code',
          file: 'five_ten.py',
          code: `import numpy as np

from app.engine.backtesting import Backtester
from app.engine.strategy import Strategy
from app.engine.utils.Order import Order
from app.engine.utils.PositionType import PositionType


class FiveTen(Strategy):
    ALLOCATION = 0.18
    STOP_PCT = 0.05
    TARGET_PCT = 0.10
    UNIVERSE_SIZE = 40

    def __init__(self):
        super().__init__()
        self.MAX_POSITIONS = 5
        self.MIN_BARS_REQUIRED = 60

    def initialize_universe(self, current_date, histories):
        ranked = []
        for ticker, history in histories.items():
            if len(history.close_price) < self.MIN_BARS_REQUIRED:
                continue
            dollar_volume = float(
                np.sum(history.close_price[-60:] * history.volume[-60:])
            )
            ranked.append((ticker, dollar_volume))

        ranked.sort(key=lambda pair: pair[1], reverse=True)
        self.tickers.clear()
        self.add_tickers([ticker for ticker, _ in ranked[: self.UNIVERSE_SIZE]])
        return bool(self.tickers)

    def on_signal(self, ticker, data):
        if ticker in self.open_tickers:
            return None

        close = float(data.close_price[-1])
        fast = float(self._sma(data.close_price, 20)[-1])
        slow = float(self._sma(data.close_price, 50)[-1])
        if np.isnan(fast) or np.isnan(slow) or close <= slow or fast <= slow:
            return None

        return Order(
            ticker=ticker,
            position_type=PositionType.LONG,
            allocation=self.ALLOCATION,
            order_date=str(data.dates[-1]),
            stop_loss=round(close * (1.0 - self.STOP_PCT), 2),
            take_profit=round(close * (1.0 + self.TARGET_PCT), 2),
        )


result = Backtester(FiveTen(), "2018-01-01", "2024-12-31").run()`,
        },
        { kind: 'h2', id: 'mechanics', text: 'What the manager does with these levels' },
        {
          kind: 'p',
          text: <>Both prices are resting levels on the resulting <C>Trade</C>. Each session, after signals, the manager checks the stop first and the target second against that session's low and high. A gap through either fills at the open.</>,
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'Five and ten needs better than one in three',
          text: <>A 5% loss against a 10% gain breaks even at a 33% win rate before costs. Slippage and two fees push the real threshold higher. A measured win rate near 35% is close to break-even, not an edge.</>,
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'The stop is measured from the signal close',
          text: <>The entry is the next open, with slippage added. A 5% stop on the signal close is a little tighter or looser than 5% from the real fill, depending on the overnight move.</>,
        },
      ],
    },
    {
      slug: 'example-custom-exit',
      title: 'Custom exits with should_exit',
      lead: 'Breakout enters when the close clears the last twenty sessions, and leaves on a time stop, a trail or an ATR stop.',
      blocks: [
        {
          kind: 'code',
          file: 'breakout.py',
          code: `import numpy as np

from app.engine.backtesting import Backtester
from app.engine.strategy import Strategy
from app.engine.utils.Order import Order
from app.engine.utils.PositionType import PositionType


class Breakout(Strategy):
    BREAKOUT_BARS = 20

    def __init__(self):
        super().__init__()
        self.MAX_POSITIONS = 8
        self.MIN_BARS_REQUIRED = 30

    def initialize_universe(self, current_date, histories):
        self.tickers.clear()
        self.add_tickers([
            ticker for ticker, history in histories.items()
            if len(history.close_price) >= self.MIN_BARS_REQUIRED
        ][:200])
        return bool(self.tickers)

    def on_signal(self, ticker, data):
        if ticker in self.open_tickers:
            return None

        close = float(data.close_price[-1])
        prior_high = float(np.max(data.high[-self.BREAKOUT_BARS - 1:-1]))
        if close <= prior_high:
            return None

        return Order(
            ticker=ticker,
            position_type=PositionType.LONG,
            allocation=1.0 / self.MAX_POSITIONS,
            order_date=str(data.dates[-1]),
            stop_loss=0.0,
            take_profit=0.0,
        )

    def should_exit(self, ticker, trade, history=None):
        if self._time_stop_days(trade, 40):
            return True
        if self._trailing_stop(trade, 0.10):
            return True
        return self._atr_stop(trade, 2.5, window=14)


result = Backtester(Breakout(), "2019-01-01", "2024-12-31").run()`,
        },
        { kind: 'h2', id: 'reading', text: 'Reading the exits' },
        {
          kind: 'ul',
          items: [
            <>The 40-day time stop is the backstop. A position that goes nowhere still frees its slot.</>,
            <>The 10% trail follows the highest high since entry and triggers on intrabar lows.</>,
            <>The ATR stop is measured from the entry bar, so it is a fixed distance rather than a trail.</>,
          ],
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'These fill at the next open',
          text: <>None of the helpers places a resting order. When one returns True, the exit is queued and fills tomorrow with slippage. On a fast move the realised loss can pass the level that triggered it. Put a <C>stop_loss</C> on the order as well if you need hard risk.</>,
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'trade.history is refreshed first',
          text: <>The engine sets <C>trade.history</C> to bars through today before calling <C>should_exit</C>. That is why the helpers read the latest low and the entry index from one object.</>,
        },
      ],
    },
    {
      slug: 'example-dynamic-universe',
      title: 'Dynamic universe with on_rebalance',
      lead: 'Rotation re-ranks the market by traded value each month and tops the universe back up to thirty names.',
      blocks: [
        {
          kind: 'code',
          file: 'rotation.py',
          code: `import numpy as np

from app.engine.backtesting import Backtester
from app.engine.strategy import Strategy
from app.engine.utils.Order import Order
from app.engine.utils.PositionType import PositionType
from app.engine.utils.RebalanceFrequency import RebalanceFrequency


class Rotation(Strategy):
    UNIVERSE_SIZE = 30
    LOOKBACK = 252

    def __init__(self):
        super().__init__()
        self.MAX_POSITIONS = 10
        self.MIN_BARS_REQUIRED = self.LOOKBACK
        self.REBALANCE_FREQUENCY = RebalanceFrequency.MONTHLY

    def _ranked(self, histories, limit):
        scored = []
        for ticker, history in histories.items():
            if len(history.close_price) < self.LOOKBACK:
                continue
            value = float(np.sum(
                history.close_price[-self.LOOKBACK:] * history.volume[-self.LOOKBACK:]
            ))
            scored.append((ticker, value))
        scored.sort(key=lambda pair: pair[1], reverse=True)
        return [ticker for ticker, _ in scored[:limit]]

    def initialize_universe(self, current_date, histories):
        ranked = self._ranked(histories, self.UNIVERSE_SIZE)
        if not ranked:
            return False
        self.tickers.clear()
        self.add_tickers(ranked)
        return True

    def on_rebalance(self, current_date, histories):
        for ticker in list(self.tickers):
            if ticker not in self.open_tickers:
                self.remove_ticker(ticker)

        vacancies = self.UNIVERSE_SIZE - len(self.tickers)
        if vacancies <= 0:
            return

        fresh = [
            ticker for ticker in self._ranked(histories, self.UNIVERSE_SIZE)
            if ticker not in self.tickers
        ]
        self.add_tickers(fresh[:vacancies])

    def on_signal(self, ticker, data):
        if ticker in self.open_tickers:
            return None
        if self.open_position_count >= self.MAX_POSITIONS:
            return None

        return Order(
            ticker=ticker,
            position_type=PositionType.LONG,
            allocation=1.0 / self.MAX_POSITIONS,
            order_date=str(data.dates[-1]),
            stop_loss=0.0,
            take_profit=0.0,
        )


result = Backtester(Rotation(), "2018-01-01", "2024-12-31").run()`,
        },
        { kind: 'h2', id: 'decisions', text: 'Three decisions in this code' },
        {
          kind: 'ul',
          items: [
            <><B>Return False while the data is short.</B> The engine probes forward until a year of history exists instead of starting with an empty universe.</>,
            <><B>Keep held names.</B> Dropping one leaves the lot in the book with no universe entry. The engine still polls it for exits, but the strategy stops watching it for signals.</>,
            <><B>Rank only the vacancies.</B> Re-ranking the whole book every month is legal but wasteful, and it makes dropping a fresh buy too easy.</>,
          ],
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'The first rebalance is a month in',
          text: <>The starting universe comes from <C>initialize_universe</C>. A monthly cadence does not fire on the first session, so the first month trades the list built at warmup.</>,
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'Signals see the new list immediately',
          text: <><C>on_rebalance</C> runs before <C>on_signal</C> in the same session. A name added this morning can be bought at tomorrow's open.</>,
        },
      ],
    },
    {
      slug: 'example-short',
      title: 'Short selling',
      lead: 'Breakdown shorts a name when it closes below its 20-day average, with the stop above the entry and the target below.',
      blocks: [
        {
          kind: 'code',
          file: 'breakdown.py',
          code: `import numpy as np

from app.engine.backtesting import Backtester
from app.engine.strategy import Strategy
from app.engine.utils.Order import Order
from app.engine.utils.PositionType import PositionType


class Breakdown(Strategy):
    ALLOCATION = 0.15
    STOP_PCT = 0.05
    TARGET_PCT = 0.10

    def __init__(self):
        super().__init__()
        self.MAX_POSITIONS = 5
        self.MIN_BARS_REQUIRED = 30

    def initialize_universe(self, current_date, histories):
        self.tickers.clear()
        self.add_tickers([
            ticker for ticker, history in histories.items()
            if len(history.close_price) >= self.MIN_BARS_REQUIRED
        ][:200])
        return bool(self.tickers)

    def on_signal(self, ticker, data):
        if ticker in self.open_tickers:
            return None

        close = float(data.close_price[-1])
        mean = float(self._sma(data.close_price, 20)[-1])
        if np.isnan(mean) or close >= mean:
            return None

        return Order(
            ticker=ticker,
            position_type=PositionType.SHORT,
            allocation=self.ALLOCATION,
            order_date=str(data.dates[-1]),
            stop_loss=round(close * (1.0 + self.STOP_PCT), 2),
            take_profit=round(close * (1.0 - self.TARGET_PCT), 2),
        )


result = Backtester(Breakdown(), "2019-01-01", "2024-12-31").run()`,
        },
        { kind: 'h2', id: 'differences', text: 'What changes for a short' },
        {
          kind: 'table',
          head: ['Rule', 'LONG', 'SHORT'],
          rows: [
            ['Fill price', 'open × 1.0005', 'open × 0.9995'],
            ['Stop touched when', 'low ≤ stop', 'high ≥ stop'],
            ['Stop gap fill', 'min(open, stop)', 'max(open, stop)'],
            ['Target touched when', 'high ≥ target', 'low ≤ target'],
            ['Target gap fill', 'max(open, target)', 'min(open, target)'],
          ],
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'Shorts are not cash-funded here',
          text: <>The model does not hand you proceeds to spend. A short is checked against remaining exposure, and total invested notional may not exceed equity. No borrow fee is charged, so these results are kinder to shorts than a real account.</>,
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'Losses are still bounded by the stop',
          text: <>A short has no natural ceiling on its loss, but the resting stop closes it at the level or at the open on a gap. Without a stop, a run can lose more than the notional committed. Carry one.</>,
        },
      ],
    },
  ],
};
