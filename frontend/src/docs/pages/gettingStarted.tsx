// gettingStarted.tsx — Introduction, reading order and quickstart.
import { C, B } from '../Blocks';
import type { DocGroup } from '../types';

export const GETTING_STARTED: DocGroup = {
  id: 'getting-started',
  title: 'Getting started',
  source: 'frontend/src/docs/pages/gettingStarted.tsx',
  pages: [
    {
      slug: 'introduction',
      title: 'Introduction',
      lead: 'SLTP is a daily-bar backtesting engine. You write a Strategy, and the engine replays history one trading day at a time and reports what would have happened.',
      blocks: [
        {
          kind: 'p',
          text: <>A strategy is a subclass of <C>Strategy</C>. It looks at price history and returns an <C>Order</C>, or nothing. It never touches cash or positions. The portfolio manager keeps the book: it fills orders, charges costs, and tracks what you hold.</>,
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'The engine is open source',
          text: <>Every run on this site is the same code you can read yourself: <a className="docs-repo-link" href="https://github.com/ItsMacc/SLTP-Engine" target="_blank" rel="noreferrer">github.com/ItsMacc/SLTP-Engine</a>. Clone it, run a backtest locally, or open an issue when something looks wrong.</>,
        },
        { kind: 'h2', id: 'what-it-does', text: 'What it does' },
        {
          kind: 'p',
          text: <>The engine reads market data once and slices it per day. Each session it credits dividends to lots held from the previous close, fills yesterday's orders at today's open. Then it asks your strategy for new orders. After that it checks stop and target levels against today's bar, marks the book at the close and logs equity. A signal on Monday's close fills at Tuesday's open.</>,
        },
        { kind: 'h2', id: 'what-a-run-gives-you', text: 'What a run gives you' },
        {
          kind: 'table',
          head: ['Key', 'Contents'],
          rows: [
            [<C key="m">metrics</C>, 'Returns, risk, drawdown and trade statistics.'],
            [<C key="e">equity</C>, 'One record per trading day: date, index value, open positions and costs so far.'],
            [<C key="t">trades</C>, <>Every lot: its entry, its exit <C>Event</C>, the dividends it collected and the fees it paid.</>],
            [<C key="r">rejections</C>, 'Orders the manager refused, counted by reason.'],
          ],
        },
        { kind: 'h2', id: 'rules', text: 'The model in five rules' },
        {
          kind: 'ol',
          items: [
            <><B>No lookahead.</B> Every hook gets arrays sliced so the last bar is today.</>,
            <><B>Orders fill at the next open.</B> A signal on Monday's close fills on Tuesday.</>,
            <><B>One entry is one lot.</B> Two entries in a name are two trades. Each lot keeps its own levels.</>,
            <><B>Equity is an index.</B> It starts at 100, not at a dollar amount.</>,
            <><B>Allocation is a fraction of equity.</B> <C>0.10</C> is ten percent.</>,
          ],
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'Costs are already applied',
          text: <>Every entry and exit pays 0.05% slippage against your direction and 0.1% of notional in fees. Do not pad your price levels for either. You would pay twice.</>,
        },
        { kind: 'h2', id: 'limits', text: 'What it does not model' },
        {
          kind: 'ul',
          items: [
            'Intraday prices. Decisions and exits use daily bars only.',
            'Partial fills. An order fills whole or not at all.',
            'Market impact beyond the fixed slippage rate.',
            'Borrow fees on shorts, or interest on cash.',
            'Splits and other corporate actions beyond cash dividends. The bars are already split-adjusted, and dividends are the only action the engine pays.',
          ],
        },
        {
          kind: 'callout',
          tone: 'note',
          text: <>A backtest tests an idea against the past. It is not a forecast. The engine keeps the costs, timing and data honest. The idea is yours.</>,
        },
      ],
    },
    {
      slug: 'reading-order',
      title: 'How these docs are organized',
      lead: 'Eight parts cover the engine, in the order it uses them. Read the first four before you write a strategy. Examples and Help sit at the end for reference.',
      blocks: [
        {
          kind: 'p',
          text: <>The docs follow the source modules, not a feature list. If you know which file you are working in, open the page with the same name.</>,
        },
        { kind: 'h2', id: 'parts', text: 'The eight parts' },
        {
          kind: 'cards',
          items: [
            { badge: '1', title: 'Getting started', text: 'What the engine is, and a first run.' },
            { badge: '2', title: 'Utils', text: <>The small records every other page uses: <C>Order</C>, <C>Trade</C>, <C>StockData</C>, dates and enums.</> },
            { badge: '3', title: 'Strategy base class', text: 'The class you subclass: limits, hooks, universe helpers, indicators and exit helpers.' },
            { badge: '4', title: 'Engine', text: 'How a run executes: the daily loop, warmup, the book and rebalancing.' },
            { badge: '5', title: 'Fills and risk', text: 'What a fill costs, how big it can be, and when the manager refuses one.' },
            { badge: '6', title: 'Results', text: 'The return object, every metric, the equity curve and trades.' },
            { badge: '7', title: 'Examples', text: 'Five complete strategies, from hold-only to short selling.' },
            { badge: '8', title: 'Help', text: 'Gotchas, FAQ, glossary and changelog.' },
          ],
        },
        { kind: 'h2', id: 'conventions', text: 'Conventions on these pages' },
        {
          kind: 'table',
          head: ['You see', 'It means'],
          rows: [
            [<C key="1">monospace</C>, 'An exact name from the source. Spelling and capitalisation matter.'],
            ['Parameter tables', <>Arguments in order, with the default the engine uses when you pass nothing. A dash means you must pass it.</>],
            ['Warning', 'A rule you can break without an exception, and what it costs you.'],
            ['LONG / SHORT tabs', 'The same rule in both directions. They are not symmetrical in code.'],
          ],
        },
        {
          kind: 'callout',
          tone: 'tip',
          title: 'Read the warnings',
          text: <>Most first-strategy bugs are not syntax errors. They are a level based on the wrong bar, a refusal you did not see, or an exit you expected today that fills tomorrow.</>,
        },
      ],
    },
    {
      slug: 'quickstart',
      title: 'Quickstart',
      lead: 'This strategy buys three names on the first session and holds them to the end of the data.',
      blocks: [
        {
          kind: 'p',
          text: <>The class adds three tickers during universe setup and returns one order per name the first time the engine polls it. The guard on <C>open_tickers</C> matters. <C>on_signal</C> runs every session, not once.</>,
        },
        {
          kind: 'code',
          file: 'hold_three.py',
          code: `from sltp import Order, PositionType, Strategy
from sltp.backtesting import Backtester


class HoldThree(Strategy):
    def __init__(self):
        super().__init__()
        self.name = "Hold Three"
        self.MAX_POSITIONS = 3
        self.MIN_BARS_REQUIRED = 1

    def initialize_universe(self, current_date, histories):
        self.add_tickers(["AAPL", "MSFT", "NVDA"])
        return True

    def on_signal(self, ticker, data):
        if ticker in self.open_tickers:
            return None
        return Order(
            ticker=ticker,
            position_type=PositionType.LONG,
            allocation=1.0 / 3.0,
            order_date=str(data.dates[-1]),
            stop_loss=0.0,
            take_profit=0.0,
        )


result = Backtester(HoldThree(), "2020-01-01", "2024-12-31").run()
print(result["metrics"]["cagr"], result["metrics"]["max_drawdown"])`,
        },
        { kind: 'h2', id: 'run-it', text: 'Run it' },
        {
          kind: 'code',
          language: 'bash',
          file: 'terminal',
          code: `pip install sltp
python hold_three.py`,
        },
        {
          kind: 'p',
          text: <>Use <C>python3</C> if your shell has no <C>python</C> alias. The first run downloads the market data it needs into <C>~/.sltp/cache</C>, so it takes longer than the rest.</>,
        },
        { kind: 'h2', id: 'what-happened', text: 'What happened' },
        {
          kind: 'ol',
          items: [
            <>The universe hook added three tickers and returned <C>True</C>. The run starts on the first session on or after 2020-01-01.</>,
            <>That session each name returned an order for a third of equity. The orders waited for the next open.</>,
            <>At the next open the manager paid slippage and the fee, then held. From then on the guard returns <C>None</C>.</>,
            <>The run ended with three lots open, marked at the final close. Nothing was sold: <C>LIQUIDATE_ON_END</C> is off and no exit was queued.</>,
          ],
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'A ticker with no local data is skipped',
          text: <>The run does not raise. The name never appears in <C>result["trades"]</C>, and your book is smaller than you asked for. Check the trade list before you read the metrics.</>,
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'Next: the records',
          text: <>The rest of the docs assume you know what an <C>Order</C> and a <C>Trade</C> hold. The Utils pages are short, and every later page refers back to them.</>,
        },
      ],
    },
  ],
};
