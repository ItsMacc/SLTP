// results.tsx — The return object, every metric, the curve and the trade records.
import { C, B } from '../Blocks';
import type { DocGroup } from '../types';

export const RESULTS: DocGroup = {
  id: 'results',
  title: 'Results',
  source: 'frontend/src/docs/pages/results.tsx',
  pages: [
    {
      slug: 'return-object',
      title: 'The return object',
      lead: 'run() returns a dict with four keys. Everything the engine knows about the run is in it.',
      source: 'app/engine/backtesting/backtester.py',
      blocks: [
        {
          kind: 'table',
          head: ['Key', 'Type', 'Contents'],
          rows: [
            [<C key="1">metrics</C>, <C key="2">dict</C>, 'The statistics. See Metrics reference.'],
            [<C key="3">equity</C>, <C key="4">list[dict]</C>, 'One record per trading session, marked at the close.'],
            [<C key="5">trades</C>, <C key="6">list[Trade]</C>, 'Every lot, open and closed, in fill order.'],
            [<C key="7">rejections</C>, <C key="8">dict[str, int]</C>, 'Order refusals counted by reason.'],
          ],
        },
        {
          kind: 'code',
          file: 'inspect.py',
          code: `result = Backtester(strategy, "2020-01-01", "2024-12-31").run()

print(result["metrics"]["cagr"])
print(len(result["equity"]), "sessions")
print(sum(1 for trade in result["trades"] if trade.exit is None), "still open")
print(result["rejections"])`,
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'metrics carries a second copy of equity',
          text: <>The metrics dict also holds an <C>equity</C> key with the same list. The HTTP layer removes it so the payload does not send the curve twice. In Python, use the top-level one.</>,
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'Trades are objects, not dicts',
          text: <>The engine returns <C>Trade</C> objects. JSON responses turn them into flat records with a few computed fields. A saved response and a live run are two different shapes.</>,
        },
      ],
    },
    {
      slug: 'metrics',
      title: 'Metrics reference',
      lead: 'The metrics dict holds the sixteen numbers below. All of them come from the daily equity curve and the closed trades.',
      source: 'app/engine/backtesting/backtester.py',
      blocks: [
        {
          kind: 'table',
          head: ['Metric', 'Unit', 'What it measures'],
          rows: [
            [<C key="1">starting_value</C>, 'Index points', 'The first equity value logged, normally 100.'],
            [<C key="2">ending_value</C>, 'Index points', 'The last equity value logged.'],
            [<C key="3">cagr</C>, 'Percent / year', 'Compounded annual growth from the first to the last value.'],
            [<C key="4">sharpe</C>, 'Ratio', 'Mean daily return divided by its standard deviation. Annualised by √252. Risk-free rate is 0.'],
            [<C key="5">psr</C>, 'Probability, 0–1', 'Odds that the true Sharpe beats 1.0 a year, adjusted for skew, fat tails and sample size.'],
            [<C key="6">sortino</C>, 'Ratio', 'Mean daily return divided by the deviation of losing days. Annualised.'],
            [<C key="7">expectancy</C>, 'Fraction per trade', 'Average result of one closed trade. 0.012 means 1.2%.'],
            [<C key="8">win_rate</C>, 'Percent', 'Closed trades with a positive return.'],
            [<C key="9">loss_rate</C>, 'Percent', 'The rest of the closed trades. Flat trades count here.'],
            [<C key="10">average_win</C>, 'Percent', 'Mean return of the winning trades.'],
            [<C key="11">average_loss</C>, 'Percent', 'Mean return of the losing trades. A negative number.'],
            [<C key="12">max_drawdown</C>, 'Percent', 'Largest fall from a peak in the equity index.'],
            [<C key="13">drawdown_recovery</C>, 'Sessions', 'Longest run of sessions below a previous peak.'],
            [<C key="14">unrealized_profit</C>, 'Index points', 'Open P&L at the final close, before any liquidation.'],
            [<C key="15">dividend_income</C>, 'Index points', 'Cash dividends credited to lots held across an ex-date.'],
            [<C key="16">rejected_orders</C>, 'Dict', 'Refusals by reason. The same counts as the top-level key.'],
          ],
        },
        { kind: 'h2', id: 'cagr', text: 'CAGR floors at one year' },
        {
          kind: 'p',
          text: <>The annualisation divides by <C>max(1, days) / 365.25</C>. A three-month run that gains 4% reports near 4%, not 17%. Anything shorter than a year is treated as a year. Read <C>ending_value</C> beside it for short tests.</>,
        },
        { kind: 'h2', id: 'psr', text: 'Why PSR and Sharpe disagree' },
        {
          kind: 'p',
          text: <>Sharpe is one estimate. PSR asks how much evidence supports it. With few trades or a fat left tail, the same Sharpe earns a much lower probability. A 2.0 Sharpe over six months can have a PSR under 0.6.</>,
        },
        { kind: 'h2', id: 'drawdown', text: 'drawdown_recovery is a duration' },
        {
          kind: 'p',
          text: <>It counts sessions, not calendar days. It is the longest run under a running peak. It is not the time to recover. A final drawdown that never recovers is counted in full.</>,
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'Trade statistics exclude open lots',
          text: <>Only closed trades enter win rate, average win, average loss and expectancy. Their returns include dividends collected while open. A buy-and-hold run that never sells reports zeros, even though its equity curve moved.</>,
        },
      ],
    },
    {
      slug: 'equity-curve',
      title: 'Equity curve',
      lead: 'result["equity"] has one record per session, written after the close. It starts where the run actually began.',
      source: 'app/engine/backtesting/backtester.py',
      blocks: [
        {
          kind: 'params',
          rows: [
            { name: 'date', type: 'str', description: 'The session, "YYYY-MM-DD".' },
            { name: 'portfolio_value', type: 'float', description: 'The index value after the close.' },
            { name: 'active_positions', type: 'int', description: 'Tickers holding at least one lot.' },
            { name: 'total_transaction_cost', type: 'float', description: 'Fees paid since the start, in index points.' },
          ],
        },
        {
          kind: 'code',
          file: 'equity.py',
          code: `curve = result["equity"]

first = curve[0]
last = curve[-1]

values = [point["portfolio_value"] for point in curve]
daily = [b / a - 1.0 for a, b in zip(values, values[1:])]`,
        },
        { kind: 'h2', id: 'marking', text: 'How the value is marked' },
        {
          kind: 'p',
          text: <>Each session the manager updates its last known price per ticker. It then values every open lot at that price. A suspended name keeps its previous mark instead of dropping out. Equity is <C>100 + realized + dividends − costs + unrealized</C>.</>,
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'The curve is not a trade log',
          text: <>Equity moves on marks, so it changes on days with no orders. To explain a move, read <C>active_positions</C> and <C>total_transaction_cost</C> with the trades.</>,
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'Do not assume the first date is your start date',
          text: <>Warmup can push the run forward, and the data may not cover the requested date. <C>curve[0]["date"]</C> is the only reliable statement about when the run began.</>,
        },
      ],
    },
    {
      slug: 'trades-and-events',
      title: 'Trades and events',
      lead: 'A lot starts as an Order, becomes a Trade at the fill, and closes with one Event.',
      source: 'app/engine/portfolio/portfolio_manager.py',
      blocks: [
        {
          kind: 'ol',
          items: [
            <><B>Queued.</B> <C>on_signal</C> returns an <C>Order</C>. It waits for the next open.</>,
            <><B>Filled or refused.</B> At the open the manager checks limits, applies slippage, charges the fee and creates a <C>Trade</C>.</>,
            <><B>Held.</B> The lot is marked daily. <C>should_exit</C> may queue it for exit.</>,
            <><B>Closed.</B> A resting level, a queued signal exit or final liquidation attaches an <C>Event</C>.</>,
          ],
        },
        { kind: 'h2', id: 'exit-types', text: 'Exit event types' },
        {
          kind: 'table',
          head: ['Type', 'Caused by', 'Filled at'],
          rows: [
            [<C key="1">STOP_LOSS</C>, "Today's low or high reaching the stop", 'The level, or the open on a gap'],
            [<C key="2">TAKE_PROFIT</C>, "Today's high or low reaching the target", 'The level, or the open on a gap'],
            [<C key="3">SIGNAL</C>, <><C>should_exit</C> returned True</>, 'The next open'],
            [<C key="4">END_OF_BACKTEST</C>, <><C>LIQUIDATE_ON_END</C> is on</>, 'The final close'],
          ],
        },
        { kind: 'h2', id: 'http-shape', text: 'What the API returns' },
        {
          kind: 'p',
          text: <>The engine returns objects. The HTTP layer flattens each trade into the fields the frontend uses. That includes the exit reason and a realized return.</>,
        },
        {
          kind: 'table',
          head: ['Field', 'Meaning'],
          rows: [
            ['id', 'Lot id within the run.'],
            ['ticker', 'The symbol.'],
            ['action', <>Display label: <C>BUY</C> for a long, <C>SHORT</C> for a short. Not a <C>PositionType</C>.</>],
            ['position_type', <><C>long</C> or <C>short</C>.</>],
            ['exit_reason', <><C>TAKE_PROFIT</C>, <C>STOP_LOSS</C> or <C>EXIT</C>.</>],
            ['allocation_size', 'The fraction actually committed.'],
            ['entry_price / exit_price', 'The fill price after slippage, on the split-adjusted series the chart draws for that date. A fund that reverse-split reads large in its early years.'],
            ['stop_loss / take_profit', 'The absolute levels the lot carried, on the same split-adjusted series.'],
            ['transaction_cost', 'Fees for the round trip.'],
            ['dividend_income', 'Cash dividends paid to the lot while it was open. Negative on a short.'],
            ['realized_return_pct', 'Percent, net of fees and including dividends. Null while the lot is open.'],
          ],
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'Open lots have no exit',
          text: <><C>exit_price</C>, <C>exit_date</C> and <C>realized_return_pct</C> are null or missing until the lot closes. Filter on that before you average returns.</>,
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'Open lots still count in equity',
          text: <>Open lots are marked at the final close, so ending equity includes them. They are not in the win-rate statistics. That gap between the curve and the trade table is expected.</>,
        },
      ],
    },
  ],
};
