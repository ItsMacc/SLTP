// engine.tsx — How a run executes. Behaviour in prose, short snippets only where a rule needs it.
import { C } from '../Blocks';
import type { DocGroup } from '../types';

export const ENGINE: DocGroup = {
  id: 'engine',
  title: 'Engine',
  source: 'frontend/src/docs/pages/engine.tsx',
  pages: [
    {
      slug: 'backtester',
      title: 'Backtester overview',
      lead: 'Backtester runs one strategy between two dates and returns the metrics, the equity curve, the trades and the rejections.',
      source: 'app/engine/backtesting/backtester.py',
      blocks: [
        {
          kind: 'params',
          rows: [
            { name: 'strategy', type: 'Strategy', description: 'Your strategy instance, not the class. Its limits are read at fill time.' },
            { name: 'start_date', type: 'str', description: 'Requested first session, "YYYY-MM-DD". Warmup can move it forward.' },
            { name: 'end_date', type: 'str | None', fallback: 'None', description: 'Inclusive last session. None uses the last bar in the loaded data.' },
            { name: 'include_dividends', type: 'bool', fallback: 'True', description: 'Pay cash dividends on their ex-date. Turn it off to reproduce a price-only run.' },
          ],
        },
        {
          kind: 'code',
          file: 'run.py',
          code: `from app.engine.backtesting import Backtester

backtester = Backtester(strategy=MyStrategy(), start_date="2020-01-01", end_date="2024-12-31")
result = backtester.run()`,
        },
        { kind: 'h2', id: 'one-run', text: 'A Backtester runs once' },
        {
          kind: 'p',
          text: <>The object collects state while it runs: cursors, the book, the equity log. A second <C>run()</C> call raises <C>RuntimeError</C>. Build a new <C>Backtester</C>, with a new strategy instance, for each simulation.</>,
        },
        { kind: 'h2', id: 'what-it-loads', text: 'What it loads' },
        {
          kind: 'ul',
          items: [
            <>The trading calendar comes from the date column of the stored data, not from the tickers your strategy picks.</>,
            <>Bars for every universe ticker and every open lot. They are cached once and advanced with a cursor.</>,
            <>Tickers with no local data get no bars. They go into a skipped set and are never polled.</>,
            <>Dividend events for every loaded ticker. They are paid on the ex-date, before that session's fills.</>,
          ],
        },
        { kind: 'h2', id: 'actual-start', text: 'The actual start date' },
        {
          kind: 'p',
          text: <>The run begins on the first session the universe hook could build at or after <C>start_date</C>. That date can be later than you asked for when the strategy needs history it does not have. The first record in the equity curve shows the real start.</>,
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'An exception ends the run',
          text: <>Nothing in the daily loop catches errors from your hooks. An <C>IndexError</C> on a short array aborts the simulation, often minutes in. Guard the first bars.</>,
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'End date is inclusive',
          text: <>The final session is traded and marked. If <C>LIQUIDATE_ON_END</C> is on, positions close at that session's close before the final mark.</>,
        },
      ],
    },
    {
      slug: 'daily-loop',
      title: 'The daily loop',
      lead: 'Each trading day runs the same eleven steps in the same order. Read this page when a fill happens on a day you did not expect.',
      source: 'app/engine/backtesting/backtester.py',
      blocks: [
        {
          kind: 'table',
          head: ['#', 'Step', 'What happens'],
          rows: [
            ['1', 'Refresh the view', <>The manager publishes <C>open_tickers</C>, <C>open_positions</C> and <C>equity</C> to the strategy.</>],
            ['2', <>Run <C>run_daily</C></>, 'Your once-per-session callback, before anything trades.'],
            ['3', 'Check the cadence', <>If enough time has passed, the session is marked as a rebalance day.</>],
            ['4', 'Pay dividends', 'Lots held from the previous close receive today\'s ex-date cash before any fill.'],
            ['5', 'Fill exits', <>Lots queued by <C>should_exit</C> fill at today's open, tagged <C>SIGNAL</C>.</>],
            ['6', 'Fill entries', <>Orders returned yesterday fill at today's open. They pay slippage and the fee.</>],
            ['7', <>Run <C>on_rebalance</C></>, 'If due, rebuild the universe here. Signals see the new list immediately.'],
            ['8', <>Run <C>on_signal</C></>, 'For each eligible ticker, queue an order for the next open.'],
            ['9', <>Run <C>should_exit</C></>, 'For each open lot, queue an exit for the next open.'],
            ['10', 'Check resting exits', 'Stop and target levels are tested against today\'s high and low.'],
            ['11', 'Mark and log', <>On the final day, record unrealized P&L and liquidate if asked. Then mark the book at the close and append equity.</>],
          ],
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'Entries fill before the rebalance',
          text: <>Orders queued yesterday used yesterday's universe. A rebalance does not cancel them. It changes what step 8 may buy.</>,
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'A lot filled today can stop out today',
          text: <>Resting exits run after the fills, against the same bar. A name that opened at your entry and traded through your stop closes that session. You pay both fees.</>,
        },
        { kind: 'h2', id: 'last-day', text: 'The last day' },
        {
          kind: 'p',
          text: <>Unrealized P&amp;L is recorded before any liquidation. If <C>LIQUIDATE_ON_END</C> is on, every open lot closes at the final close with <C>END_OF_BACKTEST</C>. The last equity point includes those exits and their costs.</>,
        },
      ],
    },
    {
      slug: 'universe-warmup',
      title: 'Universe initialization and warmup',
      lead: 'A strategy that needs 200 bars cannot start on the date you asked for. The engine finds the first date it can.',
      source: 'app/engine/backtesting/backtester.py',
      blocks: [
        {
          kind: 'p',
          text: <>Before the calendar is built, the engine calls <C>initialize_universe</C> for the requested start date. If it returns <C>True</C> with tickers, that is the start. If not, the engine walks forward until the hook succeeds.</>,
        },
        { kind: 'h2', id: 'search', text: 'How far it looks' },
        {
          kind: 'ol',
          items: [
            'Probe the start date. If it succeeds, stop.',
            'Otherwise double the offset: 1, 2, 4, 8, 16 days, up to 1826 calendar days (about five years).',
            'Once a probe succeeds, binary search between the last failure and that success.',
            'Run the successful call once more, last, so the universe it built is the one the run keeps.',
          ],
        },
        {
          kind: 'p',
          text: <>A year of warmup costs about twenty calls instead of 252. If no probe within 1826 days succeeds, the run raises <C>ValueError</C> naming the start date.</>,
        },
        {
          kind: 'callout',
          tone: 'danger',
          title: 'The hook runs many times',
          text: <>Each probe rebuilds <C>self.tickers</C> from scratch. The hook receives the whole market as of that date. Keep it a pure function of its arguments. A counter or a list mutated inside it leaves the wrong universe behind.</>,
        },
        { kind: 'h2', id: 'requires-history', text: 'Declaring the requirement' },
        {
          kind: 'p',
          text: <>Return <C>False</C> while the histories are too short. The engine retries on a later date. It does not need to know your period.</>,
        },
        {
          kind: 'code',
          file: 'warmup.py',
          code: `def initialize_universe(self, current_date, histories):
    leaders = [
        ticker for ticker, history in histories.items()
        if len(history.close_price) >= self.LIQUIDITY_BARS
    ]
    if not leaders:
        return False

    self.tickers.clear()
    self.add_tickers(leaders[: self.UNIVERSE_SIZE])
    return True`,
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'This is not a lookahead',
          text: <>Warmup only decides when the run starts. Once it starts, every callback sees bars through the current session. It shows enough history to compute an indicator, never the future.</>,
        },
      ],
    },
    {
      slug: 'portfolio-manager',
      title: 'PortfolioManager and bookkeeping',
      lead: 'PortfolioManager keeps the book. It fills orders, pays dividends, charges costs, and tracks your cash, lots and equity.',
      source: 'app/engine/portfolio/portfolio_manager.py',
      blocks: [
        {
          kind: 'p',
          text: <>Every order becomes a lot here, and every exit is recorded here. The manager is the only place that knows the fill price, the fees and the resulting equity.</>,
        },
        { kind: 'h2', id: 'equity', text: 'Equity is an index' },
        {
          kind: 'code',
          file: 'accounting',
          code: `# Starting value
equity = 100.00

# After each close
equity = 100.00 + realized_pnl + dividend_income - total_cost + unrealized_pnl`,
        },
        {
          kind: 'p',
          text: <>Starting at 100 makes one run comparable to another, whatever capital it used. Every P&amp;L figure is in index points, not currency. A cost of 0.05 is 0.05% of the starting book.</>,
        },
        { kind: 'h2', id: 'book', text: 'What the book holds' },
        {
          kind: 'table',
          head: ['Internal state', 'Purpose'],
          rows: [
            ['Open lots', <>One <C>Trade</C> per entry, indexed by id and grouped by ticker.</>],
            ['Pending orders', 'Entries queued for the next open. Cleared after the fill attempt.'],
            ['Pending exits', 'Lot ids queued for the next open. A duplicate request is ignored.'],
            ['Cash', 'Running cash after entries, exits, fees and dividends. It limits long entries only.'],
            ['Last prices', 'The most recent close per ticker. A suspended name keeps its mark.'],
            ['Total cost', 'Every entry and exit fee so far.'],
            ['Dividend income', 'Cash paid to open lots on their ex-dates.'],
            ['Rejected orders', 'Refusals counted by reason. Nothing is raised.'],
          ],
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'Cash is not the short constraint',
          text: <>Long entries are limited by available cash. Short entries are checked against total exposure instead, because the index model does not fund them from cash. Do not read buying power from <C>cash</C> in a short strategy.</>,
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'refresh_view is the handover',
          text: <>Once per session the manager publishes a frozen snapshot to the strategy. That is why <C>open_tickers</C> cannot be edited into a different book.</>,
        },
      ],
    },
    {
      slug: 'rebalancing',
      title: 'Rebalancing',
      lead: 'Rebalancing calls on_rebalance on a schedule. Dropping a name from the universe does not close it.',
      source: 'app/engine/utils/RebalanceFrequency.py',
      blocks: [
        {
          kind: 'p',
          text: <>Set <C>REBALANCE_FREQUENCY</C> and implement <C>on_rebalance</C>. The manager measures the interval from the last rebuild in calendar units. It calls the hook on the first session at or after that date.</>,
        },
        {
          kind: 'code',
          file: 'rotate.py',
          code: `def on_rebalance(self, current_date, histories):
    # Keep what you still hold, so exits do not lose their universe entry.
    for ticker in list(self.tickers):
        if ticker not in self.open_tickers:
            self.remove_ticker(ticker)

    vacancies = self.UNIVERSE_SIZE - len(self.tickers)
    if vacancies <= 0:
        return

    ranked = sorted(
        histories.items(),
        key=lambda pair: float(np.sum(pair[1].close_price[-252:])),
        reverse=True,
    )
    fresh = [ticker for ticker, _ in ranked if ticker not in self.tickers]
    self.add_tickers(fresh[:vacancies])`,
        },
        { kind: 'h2', id: 'timing', text: 'Where it sits in the session' },
        {
          kind: 'p',
          text: <>The hook runs after today's exits and entries fill, and before <C>on_signal</C>. A name added during the rebalance can be bought in that session's signal pass. The order still fills tomorrow.</>,
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'Removing a ticker does not sell it',
          text: <>The engine keeps polling held names for exits after they leave the universe. If you want the position gone, queue the exit yourself. Otherwise it sits in the book until a level or signal closes it.</>,
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'The first session counts as rebuilt',
          text: <><C>initialize_universe</C> already built the starting list, so the run marks the first session as the last rebalance. Even <C>DAILY</C> first rebalances on the second session.</>,
        },
      ],
    },
  ],
};
