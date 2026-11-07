// fills.tsx — Costs, the exit checks, sizing and refusals.
import { C } from '../Blocks';
import type { DocGroup } from '../types';

export const FILLS: DocGroup = {
  id: 'fills',
  title: 'Fills and risk',
  source: 'frontend/src/docs/pages/fills.tsx',
  pages: [
    {
      slug: 'costs',
      title: 'Slippage and fees',
      lead: 'Every fill pays 0.05% slippage and a 0.1% fee. Both costs are already inside the price the engine records.',
      source: 'app/engine/portfolio/portfolio_manager.py',
      blocks: [
        {
          kind: 'callout',
          tone: 'warning',
          title: 'Do not pad your levels for costs',
          text: <>Slippage is inside the fill. A 5% stop at <C>close * 0.95</C> is compared with that level as written. The engine adds nothing more. A buffer of your own pays the cost twice.</>,
        },
        {
          kind: 'table',
          head: ['Cost', 'Rate', 'Charged on'],
          rows: [
            ['Slippage', '0.05%', 'Every entry and every exit, against your direction.'],
            ['Fee', '0.1% of notional', 'Each side separately, entry and exit.'],
          ],
        },
        { kind: 'h2', id: 'fill-price', text: 'How the fill price is built' },
        {
          kind: 'table',
          head: ['Direction', 'Entry', 'Exit'],
          rows: [
            ['LONG', <C key="1">open × 1.0005</C>, <C key="2">price × 0.9995</C>],
            ['SHORT', <C key="3">open × 0.9995</C>, <C key="4">price × 1.0005</C>],
          ],
        },
        {
          kind: 'p',
          text: <>Both prices are rounded to two decimals. Slippage always moves against you. The engine never gives a better price than the market printed.</>,
        },
        { kind: 'h2', id: 'fees', text: 'How the fee is calculated' },
        {
          kind: 'ul',
          items: [
            <>Entry: <C>equity_at_entry × allocation × 0.001</C>, taken out of equity.</>,
            <>Exit: <C>notional × (exit_price ÷ entry_price) × 0.001</C>, taken out of the proceeds.</>,
            <><C>trade.fees</C> holds both, added together once the lot closes.</>,
          ],
        },
        {
          kind: 'p',
          text: <>A 10% allocation on a 100 book commits 10 index points. It pays 0.01 to get in and about the same to get out. On a 5% move that is a visible part of the result.</>,
        },
        { kind: 'h2', id: 'affordability', text: 'An order may be trimmed' },
        {
          kind: 'p',
          text: <>The manager prices every fill against the cash left after its own fee. An order whose resolved weight is larger than <C>cash ÷ equity</C> is refused. An order that fits is reduced by the fee at the fill, so <C>allocation=1.0</C> spends the book and borrows nothing.</>,
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'Everything is in index points',
          text: <>Equity starts at 100, so costs and P&amp;L are fractions of that book. A fee line of 0.05 is 0.05% of starting capital, not 0.05 currency units.</>,
        },
      ],
    },
    {
      slug: 'stops-and-targets',
      title: 'Stop-loss and take-profit rules',
      lead: 'A stop-loss closes a trade when price falls to a level you set. A take-profit closes it when price rises to one. Both are absolute prices, checked against each day bar.',
      source: 'app/engine/portfolio/portfolio_manager.py',
      blocks: [
        {
          kind: 'p',
          text: <>After signals and custom exits, the manager tests each open lot's levels against today's high and low. The check is pessimistic. If both levels sit inside one bar, the stop is the one that happened.</>,
        },
        {
          kind: 'tabs',
          tabs: [
            {
              label: 'LONG',
              blocks: [
                {
                  kind: 'code',
                  file: 'check_exit (long)',
                  code: `if stop > 0 and low <= stop:
    fill = min(open, stop)
    reason = STOP_LOSS
elif target > 0 and high >= target:
    fill = max(open, target)
    reason = TAKE_PROFIT
else:
    # no exit today`,
                },
              ],
            },
            {
              label: 'SHORT',
              blocks: [
                {
                  kind: 'code',
                  file: 'check_exit (short)',
                  code: `if stop > 0 and high >= stop:
    fill = max(open, stop)
    reason = STOP_LOSS
elif target > 0 and low <= target:
    fill = min(open, target)
    reason = TAKE_PROFIT
else:
    # no exit today`,
                },
              ],
            },
          ],
        },
        { kind: 'h2', id: 'stop-first', text: 'The stop wins' },
        {
          kind: 'p',
          text: <>A daily bar tells you a range was touched, not the order it was touched in. If a long's low pierced the stop and its high reached the target, either could be true. The engine assumes the worse one. That is why a strategy can show fewer wins than the chart suggests.</>,
        },
        { kind: 'h2', id: 'gaps', text: 'Gaps fill at the open' },
        {
          kind: 'p',
          text: <>A long that gaps below its stop fills at <C>min(open, stop)</C>. That is the open, which is worse than the level. A long that gaps above its target fills at <C>max(open, target)</C>, which is better. The level caps the loss, it does not promise the price.</>,
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'A stop can close the lot the same day',
          text: <>The entry fills at the open. Resting levels are then checked on that same bar. A name bought at 100 that trades down to 94 closes at 94 that session, and you pay two fees.</>,
        },
        { kind: 'h2', id: 'levels', text: 'Where the levels come from' },
        {
          kind: 'p',
          text: <>The manager copies them from the <C>Order</C> at the fill and never revises them. <C>0.0</C> turns either one off. If you compute them from the signal-day close, the entry is still the next open. The real stop distance is not the percentage you wrote.</>,
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'Resting, not trailing',
          text: <>These levels do not follow the price. For a trail, override <C>should_exit</C> and call <C>_trailing_stop</C>. That exit fills at the next open instead.</>,
        },
      ],
    },
    {
      slug: 'resting-vs-signal',
      title: 'Resting exits vs signal exits',
      lead: 'A trade can close two ways. A resting level fills inside the day bar, or a should_exit decision fills at the next open. Mixing the two up is the most common timing bug.',
      source: 'app/engine/portfolio/portfolio_manager.py',
      blocks: [
        {
          kind: 'table',
          head: ['', 'Resting exit', 'Signal exit'],
          rows: [
            ['Set by', <>The <C>Order</C>'s <C>stop_loss</C> / <C>take_profit</C></>, <>Returned True from <C>should_exit</C></>],
            ['Checked', 'Against today\'s high and low, after signals', 'Once per session, on today\'s completed bars'],
            ['Fills', 'Inside today\'s bar, at the level or the open', 'At the next open'],
            ['Event type', <><C>STOP_LOSS</C> / <C>TAKE_PROFIT</C></>, <><C>SIGNAL</C></>],
            ['Can fill past the level', 'No, except on a gap', 'Yes. The open can be anywhere'],
          ],
        },
        { kind: 'h2', id: 'choosing', text: 'Choosing between them' },
        {
          kind: 'ul',
          items: [
            <>Hard risk belongs in the order. A stop you promised yourself should not wait for tomorrow's open.</>,
            <>Signal logic belongs in <C>should_exit</C>: indicator reversals, time stops, trailing rules.</>,
            <>Both can be active. A lot with a resting stop and a <C>should_exit</C> rule exits on whichever fires first.</>,
          ],
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'A queued signal exit can gap',
          text: <>If price falls through your level overnight, the next open fills below it. The exit still happens, at a worse price. A resting stop would have filled during the day, which is why risk rules usually go there.</>,
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'No double exit',
          text: <>If a lot is queued for exit and then stopped out today, tomorrow's fill finds it closed and skips it. One exit event is recorded.</>,
        },
        {
          kind: 'code',
          file: 'mixed exits',
          code: `def on_signal(self, ticker, data):
    close = float(data.close_price[-1])
    return Order(
        ticker=ticker,
        position_type=PositionType.LONG,
        allocation=0.1,
        order_date=str(data.dates[-1]),
        stop_loss=round(close * 0.95, 2),   # resting: intrabar
        take_profit=0.0,
    )

def should_exit(self, ticker, trade, history=None):
    return self._time_stop_days(trade, 60)  # signal: next open`,
        },
      ],
    },
    {
      slug: 'position-sizing',
      title: 'Position sizing and constraints',
      lead: 'Order.allocation is read in the unit named by Order.sizing. EQUITY and AVAILABLE are fractions of current equity; FIXED is index points. The manager can reduce a fill. It never raises it.',
      source: 'app/engine/portfolio/portfolio_manager.py',
      blocks: [
        {
          kind: 'p',
          text: <>Under the default <C>EQUITY</C>, notional is <C>equity_at_entry × allocation</C>. <C>FIXED</C> treats allocation as index points, so notional is the allocation itself. <C>AVAILABLE</C> uses a fraction but caps it at <C>cash ÷ equity</C> before the order reaches the fill.</>,
        },
        {
          kind: 'table',
          head: ['Sizing', 'Allocation is', 'What the manager uses'],
          rows: [
            [<C key="1">EQUITY</C>, 'A fraction of current equity.', 'The fraction unchanged, then trimmed for the entry fee.'],
            [<C key="2">FIXED</C>, 'A cash value in index points.', <><C>allocation ÷ equity_at_entry</C>, then trimmed for the fee.</>],
            [<C key="3">AVAILABLE</C>, 'A fraction of equity, capped by cash.', <><C>min(allocation, cash ÷ equity)</C>, then trimmed for the fee.</>],
          ],
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'A zero AVAILABLE order is skipped',
          text: <>If cash is non-positive, <C>AVAILABLE</C> resolves to zero and the manager drops the order without counting a rejection. A zero <C>EQUITY</C> or <C>FIXED</C> allocation is still an invalid order.</>,
        },
        {
          kind: 'table',
          head: ['Constraint', 'Enforced at', 'Effect when exceeded'],
          rows: [
            [<C key="1">MAX_POSITIONS</C>, 'Fill', 'New tickers are refused. Adding to an existing ticker is still allowed.'],
            [<C key="2">MAX_LOTS_PER_TICKER</C>, 'Fill', 'Further entries in that name are refused.'],
            [<C key="3">MAX_ALLOCATION_PER_TICKER</C>, 'Fill', 'Existing notional plus the new order may not exceed the cap.'],
            ['Available cash', 'Fill', 'A long larger than cash after its fee is refused.'],
          ],
        },
        { kind: 'h2', id: 'scale-in', text: 'Scale-ins are new lots' },
        {
          kind: 'p',
          text: <>With <C>MAX_LOTS_PER_TICKER = 3</C>, three entries in one name make three trades. Each has its own entry price, stop, target and allocation. They exit on their own. Nothing averages the entry price.</>,
        },
        {
          kind: 'callout',
          tone: 'note',
          title: 'Allocation is per fill',
          text: <>Each new lot takes another fraction of equity. Three entries at <C>0.10</C> put about 30% of the book in that name, up to <C>MAX_ALLOCATION_PER_TICKER</C>.</>,
        },
        { kind: 'h2', id: 'shorts', text: 'Shorts and exposure' },
        {
          kind: 'p',
          text: <>Shorts are not funded from cash in this index model, but total invested notional may not exceed equity. The manager checks a short against remaining exposure, not against cash.</>,
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'Fees move equity between fills',
          text: <>When several orders fill at one open, each pays its fee before the next is sized. Earlier fees can leave the last order too big for the cash remaining. Size the whole book a little under 1.0.</>,
        },
      ],
    },
    {
      slug: 'rejections',
      title: 'Order rejections',
      lead: 'When the manager cannot fill an order it drops it and counts the reason in result["rejections"]. No exception is raised.',
      source: 'app/engine/portfolio/portfolio_manager.py',
      blocks: [
        {
          kind: 'p',
          text: <>Validation happens at the fill, not when the order is written. By then the session's open is known and the book is current. A refusal adds one to a counter and the run continues. Ten orders for AAPL at <C>MAX_LOTS_PER_TICKER = 1</C> give one fill and nine counts of "Maximum lots reached".</>,
        },
        {
          kind: 'table',
          head: ['Reason', 'Trigger'],
          rows: [
            [<C key="1">Invalid order allocation for ticker: X | allocation: N</C>, 'Resolved allocation of zero or less. A zero AVAILABLE order is skipped, not counted.'],
            [<C key="2">Maximum lots reached for ticker: X | lots: N</C>, 'Already at MAX_LOTS_PER_TICKER.'],
            [<C key="3">Strategy has filled maximum number of positions</C>, 'A new ticker at MAX_POSITIONS.'],
            [<C key="4">Max allocation exceeded for X: Total N% &gt; Limit N%</C>, 'The per-ticker cap would be breached.'],
            [<C key="5">Not enough equity to allocate X</C>, 'A long larger than available cash, or exposure above equity.'],
            [<C key="6">No valid bar for ticker: X</C>, 'The name did not trade that session.'],
            [<C key="7">Invalid open price for ticker: X | open: N</C>, 'An open price of zero or less.'],
            [<C key="8">invalid_price</C>, 'An exit could not be priced.'],
          ],
        },
        {
          kind: 'code',
          file: 'read the refusals',
          code: `for reason, count in result["rejections"].items():
    print(f"{count:>4}  {reason}")`,
        },
        {
          kind: 'callout',
          tone: 'warning',
          title: 'A refusal is silent inside the strategy',
          text: <>There is no return value and no callback. A strategy that assumes every order filled will drift out of step with the book. Keep your state in <C>self.open_tickers</C>, not a list you maintain.</>,
        },
        {
          kind: 'callout',
          tone: 'tip',
          title: 'Group by cause, not by key',
          text: <>Ticker-specific reasons embed the symbol, so one cause can produce many keys. Split on <C>" | "</C> or match the prefix for a total by cause.</>,
        },
      ],
    },
  ],
};
