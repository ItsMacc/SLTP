// strategy.tsx — The base class: constraints, hooks, universe access, indicators, exits.
import { C, B } from '../Blocks';
import type { DocGroup } from '../types';

export const STRATEGY: DocGroup = {
  id: 'strategy',
  title: 'Strategy base class',
  source: 'frontend/src/docs/pages/strategy.tsx',
  pages: [
    {
      slug: 'strategy-overview',
      title: 'Overview and constraints',
      lead: 'Subclass Strategy, set your limits, and implement on_signal. The other hooks are optional.',
      source: 'app/engine/strategy/base_strategy.py',
      blocks: [
        {
          kind: 'p',
          text: <>A strategy holds no book of its own. It reads a snapshot the manager publishes and returns decisions. That is why you can test a strategy without a portfolio. It is also why the book cannot drift from the trade list.</>,
        },
        {
          kind: 'code',
          file: 'strategy.py',
          code: `from sltp import Strategy

class MyStrategy(Strategy):
    def __init__(self):
        super().__init__()
        self.name = "My Strategy"
        self.MAX_POSITIONS = 10

    def initialize_universe(self, current_date, histories):
        self.add_tickers(["AAPL", "MSFT"])
        return True

    def on_signal(self, ticker, data):
        return None  # no orders yet`,
        },
        { kind: 'h2', id: 'constraints', text: 'Constraint attributes' },
        {
          kind: 'params',
          rows: [
            { name: 'MAX_POSITIONS', type: 'int | None', fallback: '10', description: 'Tickers that may hold a lot at the same time. None means no limit.' },
            { name: 'MAX_ALLOCATION_PER_TICKER', type: 'float | None', fallback: 'None', description: 'Ceiling on the share of equity one ticker may occupy. None means no ceiling.' },
            { name: 'MAX_LOTS_PER_TICKER', type: 'int', fallback: '1', description: 'Separate entries one ticker may hold at once.' },
            { name: 'REBALANCE_FREQUENCY', type: 'RebalanceFrequency', fallback: 'NEVER', description: <>How often the manager calls <C>on_rebalance</C>.</> },
            { name: 'MIN_BARS_REQUIRED', type: 'int', fallback: '0', description: <>Sessions a ticker needs before <C>on_signal</C> and <C>should_exit</C> run for it.</> },
            { name: 'LIQUIDATE_ON_END', type: 'bool', fallback: 'False', description: 'Close every open lot at the final close. No position is left marked to market.' },
            { name: 'name', type: 'str', fallback: '"Base Strategy"', description: 'Shown by the API and the strategy registry.' },
            { name: 'description', type: 'str', fallback: '"Base Strategy Interface"', description: 'One line describing the idea.' },
          ],
        },
        { kind: 'h2', id: 'required', text: 'Only one method is required' },
        {
          kind: 'p',
          text: <><C>on_signal</C> is the only hook without a default. Every other hook does nothing until you override it.</>,
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'MIN_BARS_REQUIRED is a gate, not a warmup',
          text: <>It does not extend the run or fetch earlier data. It waits until that many bars exist for the ticker. If the data before your start date is too short, warmup moves the run's start forward. See <C>Universe initialization and warmup</C>.</>,
        },
      ],
    },
    {
      slug: 'lifecycle-hooks',
      title: 'Lifecycle hooks',
      lead: 'The engine calls five methods on your strategy in a fixed order each session. Knowing the order explains most timing surprises.',
      source: 'app/engine/strategy/base_strategy.py',
      blocks: [
        {
          kind: 'params',
          rows: [
            { name: 'initialize_universe', type: '(current_date, histories) → bool', description: 'Builds the starting universe. Runs before the loop, and again during warmup until it returns True.' },
            { name: 'run_daily', type: 'None', description: 'Runs once per session, before any fill or signal. Use it for per-day state.' },
            { name: 'on_rebalance', type: 'None', description: 'Runs after fills and before signals, only when the cadence is due.' },
            { name: 'on_signal', type: '(ticker, data) → Order | None', description: 'Runs for each eligible ticker after fills. Return an order to queue an entry for the next open.' },
            { name: 'should_exit', type: '(ticker, trade, history) → bool', description: 'Runs for each open lot after signals. True queues an exit for the next open.' },
          ],
        },
        { kind: 'h2', id: 'order', text: 'Order within one session' },
        {
          kind: 'ol',
          items: [
            <><C>run_daily(current_date)</C> runs first</>,
            <>pending exits fill at the open</>,
            <>pending entries fill at the open</>,
            <><C>on_rebalance</C>, if due</>,
            <><C>on_signal</C> for each eligible ticker</>,
            <><C>should_exit</C> for each open lot</>,
            <>stop and target checks against today's bar</>,
            <>final-day liquidation, then mark and log</>,
          ],
        },
        {
          kind: 'p',
          text: <>The first two fills are why a signal on Monday's close buys at Tuesday's open. The stop check is why a level can close a lot on the day it was filled.</>,
        },
        { kind: 'h2', id: 'universe-hook', text: 'initialize_universe' },
        {
          kind: 'p',
          text: <>Return <C>True</C> only after you add tickers. The engine calls this before the run. If it returns <C>False</C>, the engine probes forward for a date your strategy can start on. It must eventually return <C>True</C> and leave <C>self.tickers</C> non-empty.</>,
        },
        {
          kind: 'callout',
          tone: 'danger',
          title: 'True with no tickers aborts the run',
          text: <>Returning <C>True</C> with an empty <C>self.tickers</C> raises <C>ValueError</C>. The message names the start date, not your strategy. Check this first when a run refuses to start.</>,
        },
        { kind: 'h2', id: 'signal-hook', text: 'on_signal eligibility' },
        {
          kind: 'p',
          text: <>The engine polls a ticker only when it is in the universe and has a bar today. It also needs room for another lot, room under <C>MAX_POSITIONS</C>, and at least <C>MIN_BARS_REQUIRED</C> bars.</>,
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'on_signal is not called once',
          text: <>It runs every session for every eligible name. Without a guard on <C>open_tickers</C>, a condition that stays true for a month asks for about 21 entries, not one.</>,
        },
      ],
    },
    {
      slug: 'universe-api',
      title: 'Universe API',
      lead: 'The universe is the list of tickers your strategy may enter. The base class gives you helpers to read what data exists and to edit that list.',
      source: 'app/engine/strategy/base_strategy.py',
      blocks: [
        {
          kind: 'params',
          rows: [
            { name: 'tickers', type: 'list[str]', description: 'The list the engine walks. You own it.' },
            { name: 'add_ticker', type: '(ticker: str) → None', description: 'Add one symbol. A duplicate is ignored.' },
            { name: 'add_tickers', type: '(tickers: list[str]) → None', description: 'Add several symbols, keeping their order.' },
            { name: 'remove_ticker', type: '(ticker: str) → None', description: 'Remove one symbol if it is there.' },
          ],
        },
        { kind: 'h2', id: 'available', text: 'What has local data' },
        {
          kind: 'table',
          head: ['Property', 'Returns'],
          rows: [
            [<C key="1">available_universe</C>, 'Every ticker with local price data.'],
            [<C key="2">available_etfs</C>, 'Exchange-traded funds only.'],
            [<C key="3">available_stocks</C>, 'Individual companies only.'],
            [<C key="4">available_gold</C>, 'Gold proxies only.'],
          ],
        },
        {
          kind: 'p',
          text: <>These read the local market store, not a live feed. They answer one question: what can this run actually trade? The list is smaller than the symbols that exist.</>,
        },
        {
          kind: 'code',
          file: 'ranking a universe',
          code: `def initialize_universe(self, current_date, histories):
    ranked = []
    for ticker, history in histories.items():
        if ticker in self.available_etfs:
            continue
        if len(history.close_price) < self.LIQUIDITY_BARS:
            continue
        dollar_volume = float(
            np.sum(history.close_price[-252:] * history.volume[-252:])
        )
        ranked.append((ticker, dollar_volume))

    ranked.sort(key=lambda pair: pair[1], reverse=True)
    self.add_tickers([ticker for ticker, _ in ranked[:100]])
    return bool(self.tickers)`,
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'A missing ticker is skipped silently',
          text: <>You may add a symbol with no local bars. It never raises. The engine records it as skipped and the run continues. Check the fill count, not the universe length.</>,
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'Held names outside the universe still run',
          text: <>If a rebalance drops a name you still hold, the engine keeps polling it for exits. Removing a ticker does not abandon the position.</>,
        },
      ],
    },
    {
      slug: 'portfolio-view',
      title: 'Read-only portfolio view',
      lead: 'Your strategy reads the book through four properties. None of them can change it.',
      source: 'app/engine/strategy/base_strategy.py',
      blocks: [
        {
          kind: 'params',
          rows: [
            { name: 'open_tickers', type: 'frozenset[str]', description: 'Tickers with at least one open lot. Membership tests are the usual guard.' },
            { name: 'open_positions', type: 'tuple[Trade, ...]', description: 'Every open lot, in fill order.' },
            { name: 'open_position_count', type: 'int', description: 'How many tickers are held.' },
            { name: 'equity', type: 'float', description: 'Current index value, starting at 100. Updated after each close.' },
          ],
        },
        {
          kind: 'code',
          file: 'guarding an entry',
          code: `def on_signal(self, ticker, data):
    if ticker in self.open_tickers:
        return None
    if self.open_position_count >= 5:
        return None
    ...
`,
        },
        {
          kind: 'p',
          text: <>Read it inside <C>on_signal</C> and it tells you what the book held this morning. Suppose an order for MSFT fills at Tuesday's open. From the next refresh on, <C>"MSFT" in self.open_tickers</C> is True, and the guard returns <C>None</C> until that lot closes.</>,
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'The view is a snapshot',
          text: <>The manager refreshes it once per session, before your hooks run. A lot you queue today is not in <C>open_tickers</C> until it fills. A lot you queue for exit is still there until the next open.</>,
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'You cannot close a position directly',
          text: <>There is no <C>position()</C> and no close method. Queue the exit by returning <C>True</C> from <C>should_exit</C>. The manager fills it at the next open.</>,
        },
      ],
    },
    {
      slug: 'indicators',
      title: 'Indicators',
      lead: 'The base class wraps twenty built-in indicators. They take the arrays from StockData and return arrays of the same length.',
      source: 'app/engine/strategy/base_strategy.py',
      blocks: [
        {
          kind: 'p',
          text: <>Every helper is computed in-process from the arrays you pass in, so there is no native library to install. You do not cast anything.</>,
        },
        { kind: 'h2', id: 'trend', text: 'Trend' },
        {
          kind: 'table',
          head: ['Helper', 'Signature', 'Returns'],
          rows: [
            [<C key="1">_sma</C>, <C key="2">(values, window)</C>, 'Simple moving average.'],
            [<C key="3">_ema</C>, <C key="4">(values, window)</C>, 'Exponential moving average.'],
            [<C key="5">_dema</C>, <C key="6">(values, window)</C>, 'Double exponential moving average.'],
            [<C key="7">_tema</C>, <C key="8">(values, window)</C>, 'Triple exponential moving average.'],
            [<C key="9">_trix</C>, <C key="10">(values, window)</C>, 'Rate of change of a triple EMA.'],
            [<C key="11">_adx</C>, <C key="12">(high, low, close, window)</C>, 'Trend strength, 0 to 100.'],
            [<C key="13">_parabolic_sar</C>, <C key="14">(high, low, acceleration=0.02, maximum=0.2)</C>, 'Trailing reversal points.'],
          ],
        },
        { kind: 'h2', id: 'momentum', text: 'Momentum' },
        {
          kind: 'table',
          head: ['Helper', 'Signature', 'Returns'],
          rows: [
            [<C key="1">_rsi</C>, <C key="2">(values, window)</C>, 'Relative strength, 0 to 100.'],
            [<C key="3">_macd</C>, <C key="4">(values, fast_period=12, slow_period=26, signal_period=9)</C>, <>Tuple: <C>(macd, signal, histogram)</C>.</>],
            [<C key="5">_stochastic</C>, <C key="6">(high, low, close, fast_k=5, slow_k=3, slow_d=3)</C>, <>Tuple: <C>(slowk, slowd)</C>.</>],
            [<C key="7">_stochastic_rsi</C>, <C key="8">(values, window, fast_k=5, fast_d=3)</C>, <>Tuple: <C>(fastk, fastd)</C>.</>],
            [<C key="9">_williams_r</C>, <C key="10">(high, low, close, window)</C>, 'Close relative to the recent range, -100 to 0.'],
            [<C key="11">_cci</C>, <C key="12">(high, low, close, window)</C>, 'Price against its statistical average.'],
            [<C key="13">_roc</C>, <C key="14">(values, window)</C>, 'Percentage change over the window.'],
            [<C key="15">_momentum</C>, <C key="16">(values, window)</C>, 'Absolute change over the window.'],
          ],
        },
        { kind: 'h2', id: 'volatility-volume', text: 'Volatility and volume' },
        {
          kind: 'table',
          head: ['Helper', 'Signature', 'Returns'],
          rows: [
            [<C key="1">_atr</C>, <C key="2">(high, low, close, window)</C>, 'Average true range.'],
            [<C key="3">_bollinger_bands</C>, <C key="4">(values, window, deviations=2)</C>, <>Tuple: <C>(upper, middle, lower)</C>.</>],
            [<C key="5">_obv</C>, <C key="6">(close, volume)</C>, 'On-balance volume.'],
            [<C key="7">_mfi</C>, <C key="8">(high, low, close, volume, window)</C>, 'Money flow index, 0 to 100.'],
            [<C key="9">_ad</C>, <C key="10">(high, low, close, volume)</C>, 'Accumulation / distribution line.'],
          ],
        },
        {
          kind: 'code',
          file: 'reading the last value',
          code: `rsi = float(self._rsi(data.close_price, 14)[-1])
upper, middle, lower = self._bollinger_bands(data.close_price, 20, 2)

if rsi < 30 and float(data.close_price[-1]) < float(lower[-1]):
    ...`,
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'The head of every array is NaN',
          text: <>An indicator needs its window before it has a value. With 10 bars and a 20-day average, <C>sma[-1]</C> is NaN and every comparison with NaN is False. Set <C>MIN_BARS_REQUIRED</C> to your longest window plus one, or check <C>np.isnan</C>.</>,
        },
      ],
    },
    {
      slug: 'exit-helpers',
      title: 'Exit helpers',
      lead: 'Three checks for should_exit: time in the trade, pullback from the high, and distance in ATR.',
      source: 'app/engine/strategy/base_strategy.py',
      blocks: [
        {
          kind: 'params',
          rows: [
            { name: '_time_stop_days', type: '(trade, days) → bool', description: 'True once the lot has been held that many calendar days.' },
            { name: '_trailing_stop', type: '(trade, pct) → bool', description: 'True when price has pulled back that fraction from its best level since entry.' },
            { name: '_atr_stop', type: '(trade, multiplier, window=14) → bool', description: 'True when price has moved that many ATRs against the entry, measured at the entry bar.' },
          ],
        },
        {
          kind: 'code',
          file: 'should_exit.py',
          code: `def should_exit(self, ticker, trade, history=None):
    if self._time_stop_days(trade, 30):
        return True
    if self._trailing_stop(trade, 0.08):
        return True
    return self._atr_stop(trade, 2.0, window=14)`,
        },
        { kind: 'h2', id: 'semantics', text: 'What each one measures' },
        {
          kind: 'ul',
          items: [
            <><B>Time</B> compares the last date in <C>trade.history</C> with the entry date plus the calendar days. Weekends count.</>,
            <><B>Trailing</B> takes the highest high since entry for a long. It stops when today's low falls a fraction below that high. It uses intrabar extremes, not closes.</>,
            <><B>ATR</B> measures average true range at the entry bar. It puts the stop one multiplier away from the entry price. It does not trail.</>,
          ],
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'These return a decision; the fill is tomorrow',
          text: <>A helper returning <C>True</C> queues an exit that fills at the next open with slippage. It does not close at the level that triggered it. Resting stops in the order are the intrabar choice.</>,
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'trade.history is current',
          text: <>Before calling <C>should_exit</C>, the engine replaces <C>trade.history</C> with bars through today. The helpers read the same data you do.</>,
        },
      ],
    },
  ],
};
