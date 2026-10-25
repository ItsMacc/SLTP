// DocsPage.tsx — SLTP documentation for writing custom strategies and managers.
// QuantConnect-style: sticky sidebar TOC, reference viewers, worked recipes.
import { Fragment, useEffect, useState, type ReactNode } from 'react';
import {
  ArrowRight, Cog, Info, PenLine, FileCode2,
} from 'lucide-react';
import {
  BASE_STRATEGY_SOURCE,
  PORTFOLIO_MANAGER_SOURCE,
  BACKTESTER_SOURCE,
  STOCK_DATA_SOURCE,
  STRATEGY_DECISION_SOURCE,
} from '../../lib/docsSources';
import './DocsPage.css';

interface DocsPageProps {
  onNavigate?: (tab: string) => void;
}

// The sidebar is read in four short groups rather than one long list, so a
// reader can see where the tour starts and where the reference begins.
const SECTIONS = [
  { id: 'overview', label: 'Overview', num: '01', group: 'Start here' },
  { id: 'methods', label: 'The methods you override', num: '02', group: 'Write a strategy' },
  { id: 'setup', label: 'Setting up your classes', num: '03', group: 'Write a strategy' },
  { id: 'decision', label: 'Anatomy of a decision', num: '04', group: 'Write a strategy' },
  { id: 'recipe-sma', label: 'SMA crossover', num: '05', group: 'Recipes' },
  { id: 'recipe-rsi', label: 'RSI dip buyer', num: '06', group: 'Recipes' },
  { id: 'recipe-universe', label: 'Custom universe', num: '07', group: 'Recipes' },
  { id: 'reference', label: 'Engine source', num: '08', group: 'Reference' },
  { id: 'api', label: 'REST API', num: '09', group: 'Reference' },
  { id: 'gotchas', label: 'Pre-flight checklist', num: '10', group: 'Reference' },
];

// ---------- primitives ----------

function CodeBlock({ source, title, readOnly = true }: { source: string; title?: string; readOnly?: boolean }) {
  return (
    <div className="docs-code" data-readonly={readOnly || undefined}>
      <div className="docs-code-header">
        <span className="docs-code-title">{title ?? 'python'}</span>
        {readOnly && <span className="docs-code-badge">read-only</span>}
      </div>
      <pre className="docs-code-pre"><code>{source}</code></pre>
    </div>
  );
}

function RefTabs({ tabs }: { tabs: { label: string; source: string }[] }) {
  const [active, setActive] = useState(0);
  const tab = tabs[active];
  return (
    <div className="docs-reftabs">
      <div className="docs-reftabs-bar" role="tablist">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            role="tab"
            aria-selected={i === active}
            className={`docs-reftab ${i === active ? 'is-active' : ''}`}
            onClick={() => setActive(i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <CodeBlock source={tab.source} title={tab.label} />
    </div>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <div className="docs-step">
      <div className="docs-step-marker">
        <span className="docs-step-num">{n}</span>
        <h4 className="docs-step-title">{title}</h4>
      </div>
      <div className="docs-step-body">{children}</div>
    </div>
  );
}

/** Section opener: the group and number as a mono eyebrow, then a serif title. */
function SectionHead({
  num,
  group,
  title,
  lead,
}: {
  num: string;
  group: string;
  title: string;
  lead?: ReactNode;
}) {
  return (
    <header className="docs-section-heading">
      <span className="docs-section-eyebrow">{num} / {group}</span>
      <h2>{title}</h2>
      {lead && <p className="docs-section-lead">{lead}</p>}
    </header>
  );
}

/** One method, described the way a reference card reads: what calls it, what it
 *  gets, what it hands back, and the trap that goes with it. */
function Signature({
  signature,
  required,
  rows,
}: {
  signature: string;
  required?: boolean;
  rows: { label: string; value: ReactNode }[];
}) {
  return (
    <article className="docs-signature">
      <header className="docs-signature-head">
        <code>{signature}</code>
        <span className={`docs-field-tag ${required ? 'is-required' : ''}`}>
          {required ? 'required' : 'optional'}
        </span>
      </header>
      <dl className="docs-signature-rows">
        {rows.map((row) => (
          <div className="docs-signature-row" key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

/** A field reference: name on the left, what it holds on the right. */
function FieldTable({
  title,
  fields,
}: {
  title: string;
  fields: { name: string; contents: ReactNode }[];
}) {
  return (
    <div className="docs-table">
      <div className="docs-table-head" aria-hidden="true">
        <span>{title}</span>
        <span>Contents</span>
      </div>
      {fields.map((field) => (
        <div className="docs-table-row" key={field.name}>
          <code>{field.name}</code>
          <p>{field.contents}</p>
        </div>
      ))}
    </div>
  );
}

/** One short aside with a title, for the tip that saves a reader a wrong turn. */
function Callout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="docs-callout">
      <Info size={18} aria-hidden="true" />
      <div>
        <p className="docs-callout-title">{title}</p>
        <p className="docs-callout-body">{children}</p>
      </div>
    </div>
  );
}

// ---------- page ----------

export default function DocsPage(_props: DocsPageProps) {
  const [activeSection, setActiveSection] = useState('overview');

  // Track scroll position for sidebar highlighting
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        }
      },
      { rootMargin: '-20% 0px -70% 0px' },
    );
    for (const { id } of SECTIONS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  const jump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="docs-page">
      <div className="docs-hero-wrapper page-hero-band is-full-bleed is-dot-grid">
        <div className="docs-hero-inner page-hero-inner">
          <div className="docs-hero-copy">
            <span className="page-hero-eyebrow">Documentation</span>
            <h1 className="page-hero-title">Strategy Engine and How It Works</h1>
            <p className="page-hero-description">
              Read the following to get an understanding of how SLTP implements its strategies and
              handles execution logic.
            </p>
          </div>
        </div>
      </div>

      <div className="docs-layout">
        {/* Sidebar TOC */}
        <aside className="docs-toc" aria-label="On this page">
          {SECTIONS.map((s, i) => (
            <Fragment key={s.id}>
              {(i === 0 || SECTIONS[i - 1].group !== s.group) && (
                <p className="docs-toc-heading">{s.group}</p>
              )}
              <button
                type="button"
                className={`docs-toc-link ${activeSection === s.id ? 'is-active' : ''}`}
                onClick={() => jump(s.id)}
              >
                <span className="docs-toc-num">{s.num}</span>
                <span className="docs-toc-label">{s.label}</span>
              </button>
            </Fragment>
          ))}
        </aside>

        {/* Content */}
        <div className="docs-content">

          {/* 01 Overview */}
          <section id="overview" className="docs-section">
            <SectionHead
              num="01"
              group="Start here"
              title="Two classes, one daily loop"
              lead={
                <>
                  A strategy is two classes that each answer one question. The{' '}
                  <strong>Strategy</strong> asks whether a ticker looks like a buy today. The{' '}
                  <strong>Manager</strong> takes a yes and decides how big to go, and where to get
                  out.
                </>
              }
            />

            <div className="docs-duo">
              <article className="docs-duo-card">
                <span className="docs-duo-label">Strategy</span>
                <h3 className="docs-duo-title">Does this ticker look like a buy today?</h3>
                <div className="docs-duo-sig">
                  <code>generate_signal(ticker, history)</code>
                  <span className="docs-field-tag is-required">required</span>
                </div>
                <p className="docs-duo-note">
                  Returns a <code>StrategyDecision</code>, and nothing else.
                </p>
              </article>

              <article className="docs-duo-card">
                <span className="docs-duo-label">Manager</span>
                <h3 className="docs-duo-title">If yes, how big, and where do I get out?</h3>
                <div className="docs-duo-sig">
                  <code>on_signal(ticker, decision)</code>
                  <span className="docs-field-tag is-required">required</span>
                </div>
                <div className="docs-duo-sig">
                  <code>initialize_universe(date)</code>
                  <span className="docs-field-tag">optional</span>
                </div>
                <div className="docs-duo-sig">
                  <code>on_rebalance(date)</code>
                  <span className="docs-field-tag">optional</span>
                </div>
                <p className="docs-duo-note">
                  Returns a <code>TradeRecord</code>, or <code>None</code> to skip the trade.
                </p>
              </article>
            </div>

            <p>
              You never write order execution, fees, slippage or portfolio bookkeeping. The engine
              handles all of that, so each of your files stays short enough to read in one sitting.
            </p>

            <p>Every trading day, the engine runs the same three steps for every ticker you trade.</p>

            <div className="docs-flow" aria-label="What happens each trading day">
              <div className="docs-flow-card">
                <span className="docs-flow-icon">
                  <FileCode2 size={18} aria-hidden="true" />
                </span>
                <span className="docs-flow-label">1 · Strategy decides</span>
                <p>
                  Returns a <code>StrategyDecision</code>: BUY, SELL or HOLD, plus a confidence
                  score.
                </p>
              </div>
              <ArrowRight className="docs-flow-arrow" size={16} aria-hidden="true" />
              <div className="docs-flow-card">
                <span className="docs-flow-icon">
                  <PenLine size={18} aria-hidden="true" />
                </span>
                <span className="docs-flow-label">2 · Manager sizes</span>
                <p>
                  Turns each BUY into a <code>TradeRecord</code> with size, stop-loss and
                  take-profit — or skips it.
                </p>
              </div>
              <ArrowRight className="docs-flow-arrow" size={16} aria-hidden="true" />
              <div className="docs-flow-card">
                <span className="docs-flow-icon">
                  <Cog size={18} aria-hidden="true" />
                </span>
                <span className="docs-flow-label">3 · Engine fills</span>
                <p>
                  Fills at the next day's open, then closes at the stop or the target.
                </p>
              </div>
            </div>

            <Callout title="Fastest way to start">
              Copy the{' '}
              <button type="button" className="docs-inline-link" onClick={() => jump('recipe-sma')}>
                SMA crossover recipe
              </button>{' '}
              into <code>workspace/</code>, run a backtest, then change one thing at a time.
            </Callout>
          </section>

          {/* 02 Methods */}
          <section id="methods" className="docs-section">
            <SectionHead
              num="02"
              group="Write a strategy"
              title="The methods you override"
              lead="One method in each class is required. The rest are there when you want them, and the engine behaves sensibly if you never touch them."
            />

            <Signature
              signature="Strategy.generate_signal(ticker, history) → StrategyDecision"
              required
              rows={[
                { label: 'Called', value: 'Once per trading day, for every ticker in the universe.' },
                {
                  label: 'Receives',
                  value: (
                    <>
                      <code>history</code>, a <code>StockData</code> holding prices up to and
                      including today. The last element of every array is today's value.
                    </>
                  ),
                },
                {
                  label: 'Returns',
                  value: (
                    <>
                      A <code>StrategyDecision</code> saying BUY, SELL or HOLD, with a confidence
                      score the Manager can size from.
                    </>
                  ),
                },
                {
                  label: 'Too little data',
                  value: (
                    <>
                      Raise <code>ValueError</code>. The backtester catches it, skips that ticker
                      for the day, and moves on.
                    </>
                  ),
                },
                {
                  label: 'Keep in mind',
                  value:
                    'Avoid side effects. Each call should depend only on the prices it is given, so the same history always gives the same answer.',
                },
              ]}
            />

            <FieldTable
              title="StockData field"
              fields={[
                { name: 'ticker', contents: 'The symbol, as a string.' },
                { name: 'dates', contents: 'Trading dates, oldest first. The last one is today.' },
                { name: 'open_price / high / low', contents: 'Daily open, high and low, as arrays.' },
                {
                  name: 'close_price',
                  contents: "Each day's closing price — what most signals actually read.",
                },
                { name: 'volume', contents: 'Shares traded that day, as an array.' },
              ]}
            />

            <Signature
              signature="Manager.on_signal(ticker, decision) → TradeRecord | None"
              required
              rows={[
                { label: 'Called', value: 'Whenever your Strategy returns a BUY.' },
                {
                  label: 'Receives',
                  value: (
                    <>
                      The ticker, and the <code>StrategyDecision</code> behind the signal.
                    </>
                  ),
                },
                {
                  label: 'Returns',
                  value: (
                    <>
                      A <code>TradeRecord</code> with <code>allocation_size</code> (a fraction of
                      the portfolio), a <code>stop_loss</code> and a <code>take_profit</code> — or{' '}
                      <code>None</code> to skip the trade.
                    </>
                  ),
                },
                {
                  label: 'When it fills',
                  value:
                    "Not on the spot. The engine fills at the next trading day's open, with slippage and fees.",
                },
                {
                  label: 'Keep in mind',
                  value: (
                    <>
                      Open allocations cannot add up to more than 100% of the portfolio.{' '}
                      <code>buy_order</code> quietly trims yours to whatever is left.
                    </>
                  ),
                },
              ]}
            />

            <Signature
              signature="Manager.initialize_universe(current_date) → bool"
              rows={[
                {
                  label: 'Called',
                  value: 'At the start of the run, then once a day until you say the list is ready.',
                },
                {
                  label: 'Returns',
                  value: (
                    <>
                      <code>True</code> once your tickers are in place. <code>False</code> means
                      "not yet" — the engine asks again tomorrow, for up to 60 days.
                    </>
                  ),
                },
                {
                  label: 'Skip it',
                  value: 'You trade the whole tradable universe, which is a fine default.',
                },
                {
                  label: 'Keep in mind',
                  value: (
                    <>
                      Fill in <code>self.histories</code> for every ticker you add, or the engine has
                      no prices to read.
                    </>
                  ),
                },
              ]}
            />

            <Signature
              signature="Manager.on_rebalance(current_date) → None"
              rows={[
                {
                  label: 'Called',
                  value: (
                    <>
                      On the schedule you set in <code>REBALANCE_FREQUENCY</code> — weekly, monthly,
                      quarterly, or never.
                    </>
                  ),
                },
                {
                  label: 'Use it for',
                  value: 'Dropping the weak names in your universe and bringing in new ones.',
                },
                {
                  label: 'Keep in mind',
                  value: (
                    <>
                      If you drop a ticker you still hold, add it to{' '}
                      <code>blacklisted_tickers</code>. The engine removes it once that position
                      closes, so you never sell it by accident.
                    </>
                  ),
                },
              ]}
            />
          </section>

          {/* 03 Setup / initialization */}
          <section id="setup" className="docs-section">
            <SectionHead
              num="03"
              group="Write a strategy"
              title="Setting up your classes"
              lead={
                <>
                  Two folders. <code>core/</code> is the engine and the base classes, and you leave
                  it alone. <code>workspace/</code> is yours: both of your files live there and
                  import from <code>core.*</code>.
                </>
              }
            />
            <CodeBlock source={`core/
├── portfolio/portfolio_manager.py
├── strategy/strategy.py
└── utils/
    ├── StockData.py
    └── StrategyDecision.py

workspace/
├── custom_strategy.py
└── custom_manager.py`} title="project layout" readOnly={false} />
            <p>
              Both classes set themselves up in <code>__init__</code>. That's where you name the
              strategy, pick its settings and say how much history it needs.
            </p>

            <Step n="1" title="Set up the Strategy">
              <p>
                Give it a name and description, attach your Manager, and put your settings in plain
                attributes. <code>MIN_BARS_REQUIRED</code> is how many days of prices your logic
                needs. Set it to your longest lookback plus a small margin. The engine skips a ticker
                until it has that much history.
              </p>
              <CodeBlock source={`def __init__(self):
    super().__init__()
    self.name = "My Strategy"
    self.description = "One line explaining the idea."
    self.manager = MyStrategyManager()      # your Manager subclass

    # Your tunable parameters, plain attributes
    self.FAST = 20
    self.SLOW = 50

    # Longest lookback window + a small buffer
    self.MIN_BARS_REQUIRED = self.SLOW + 2`} title="strategy __init__" readOnly={false} />
            </Step>

            <Step n="2" title="Set up the Manager">
              <p>
                Set the position limit and the rebalance schedule. These three settings matter most:
              </p>
              <CodeBlock source={`def __init__(self):
    super().__init__()
    self.max_positions = 10                                  # concurrent positions
    self.REBALANCE_FREQUENCY = RebalanceFrequency.MONTHLY    # or WEEKLY, QUARTERLY, NEVER...
    self.WARM_UP_PERIOD = 60                                 # bars of history your selection needs

    # Costs are already configured for you:
    #   self.SLIPPAGE_PCT = 0.0005   (0.05% per fill)
    #   self.FEE_RATE     = 0.001    (0.1% per fill)
    #   self.portfolio_value = 100.0 (the portfolio starts as an index at 100)`} title="manager __init__" readOnly={false} />
            </Step>
          </section>

          {/* 04 Decision anatomy */}
          <section id="decision" className="docs-section">
            <SectionHead
              num="04"
              group="Write a strategy"
              title="Anatomy of a decision"
              lead="Your Strategy always hands back one object. Four keys are fixed; anything else you add is stored with the trade and helps you explain it later."
            />

            <FieldTable
              title="Decision key"
              fields={[
                {
                  name: 'signal',
                  contents: (
                    <>
                      <code>"BUY"</code>, <code>"SELL"</code> or <code>"HOLD"</code>. Only BUY ever
                      reaches the Manager.
                    </>
                  ),
                },
                {
                  name: 'confidence',
                  contents: 'A number from 0.0 to 1.0. Higher means a stronger setup, and the Manager sizes from it.',
                },
                {
                  name: 'metrics.close_price',
                  contents: (
                    <>
                      Today's close, as <code>float(close_price[-1])</code>. The Manager needs it to
                      set the stop and the target.
                    </>
                  ),
                },
                {
                  name: 'metrics (anything else)',
                  contents: 'The indicator values behind the call — rsi, fast_sma, whatever you actually used.',
                },
                {
                  name: 'meta_data.signal_date',
                  contents: (
                    <>
                      <code>str(history.dates[-1])</code>, kept on the trade so you can trace it later.
                    </>
                  ),
                },
                { name: 'meta_data.ticker', contents: 'The ticker the decision is about.' },
              ]}
            />

            <CodeBlock source={STRATEGY_DECISION_SOURCE} title="StrategyDecision.py" />
          </section>

          {/* 05 SMA crossover */}
          <section id="recipe-sma" className="docs-section">
            <SectionHead
              num="05"
              group="Recipes"
              title="SMA crossover"
              lead="A trend-following entry. It buys when the fast moving average crosses above the slow one, and every trade leaves at a fixed stop and target. The two files below make one complete strategy."
            />

            <Step n="1" title="The Strategy (workspace/sma_crossover.py)">
              <CodeBlock source={`# workspace/sma_crossover.py
import numpy as np
from workspace.sma_crossover_manager import SMACrossoverManager
from core.strategy.strategy import Strategy
from core.utils.StockData import StockData
from core.utils.StrategyDecision import StrategyDecision


class SMACrossoverStrategy(Strategy):
    def __init__(self):
        super().__init__()
        self.name = "SMA Crossover"
        self.description = "Buys when the fast SMA crosses above the slow SMA, filtered by a long-term trend check."
        self.manager = SMACrossoverManager()

        # Tunable parameters
        self.FAST = 20
        self.SLOW = 50
        self.MIN_BARS_REQUIRED = self.SLOW + 2

    def generate_signal(self, ticker: str, history: StockData) -> StrategyDecision:
        close = history.close_price
        if len(close) < self.MIN_BARS_REQUIRED:
            raise ValueError(f"{ticker} needs at least {self.MIN_BARS_REQUIRED} bars")

        today = str(history.dates[-1])

        # Fast and slow averages, today and yesterday
        fast = self._sma(close, self.FAST)
        slow = self._sma(close, self.SLOW)

        fast_now, slow_now = fast[-1], slow[-1]
        fast_prev, slow_prev = fast[-2], slow[-2]

        # Cross detection: fast was below (or equal), now above
        crossed_up = fast_prev <= slow_prev and fast_now > slow_now

        # Extra filter: only trade with the long-term trend
        trending_up = close[-1] > slow_now

        buy = crossed_up and trending_up
        signal = "BUY" if buy else "HOLD"

        # Confidence grows with how decisively fast is above slow
        separation = (fast_now - slow_now) / slow_now if slow_now else 0.0
        confidence = round(min(1.0, max(0.3, separation * 20)), 2)

        return StrategyDecision(
            signal=signal,
            confidence=confidence,
            metrics={
                "fast_sma": round(float(fast_now), 2),
                "slow_sma": round(float(slow_now), 2),
                "close_price": float(close[-1]),
            },
            meta_data={"ticker": ticker, "signal_date": today},
        )`} title="workspace/sma_crossover.py" readOnly={false} />
            </Step>

            <Step n="2" title="The Manager (workspace/sma_crossover_manager.py)">
              <CodeBlock source={`# workspace/sma_crossover_manager.py
from core.portfolio.portfolio_manager import (
    PortfolioManager, RebalanceFrequency, TradeRecord, UNIVERSE,
)
from core.utils.StrategyDecision import StrategyDecision


class SMACrossoverManager(PortfolioManager):
    def __init__(self):
        super().__init__()
        self.max_positions = 10
        # Crossover strategies do not need rotation; the universe is static
        self.REBALANCE_FREQUENCY = RebalanceFrequency.NEVER

    def initialize_universe(self, current_date: str) -> bool:
        # Static universe: trade the whole tradable list.
        # Swap this for a filtered set if you want fewer names.
        self.add_tickers(UNIVERSE)
        return len(self.tickers) > 0

    def on_signal(self, ticker: str, decision: StrategyDecision) -> TradeRecord | None:
        # Only fresh BUYs, and never double up on an open position
        if decision.signal != "BUY" or self.open_positions.get(ticker, False):
            return None
        if ticker in self.blacklisted_tickers:
            return None

        entry = decision.metrics.get("close_price", 0.0)
        if entry <= 0:
            return None

        # Fixed 8% stop and 16% target (2:1 reward-to-risk)
        stop_loss = round(entry * 0.92, 2)
        take_profit = round(entry * 1.16, 2)

        # Equal-weight sizing: 1 / max_positions, scaled by confidence
        base = self._base_allocation()
        allocation = round(min(1.0, base * max(0.3, decision.confidence)), 2)

        return TradeRecord(
            ticker=ticker,
            action="BUY",
            entry_date=None,
            allocation_size=allocation,
            entry_price=None,
            stop_loss=stop_loss,
            take_profit=take_profit,
            signal_date=decision.meta_data.get("signal_date", ""),
        )`} title="workspace/sma_crossover_manager.py" readOnly={false} />
            </Step>
          </section>

          {/* 06 RSI dip buyer */}
          <section id="recipe-rsi" className="docs-section">
            <SectionHead
              num="06"
              group="Recipes"
              title="RSI dip buyer"
              lead={
                <>
                  A mean-reversion entry. It buys when RSI drops below 30 while the price is still
                  above its 200-day average. The deeper the dip, the bigger the position. It uses
                  the <code>_rsi</code> helper from the base class.
                </>
              }
            />

            <Step n="1" title="The Strategy (workspace/rsi_dip_buyer.py)">
              <CodeBlock source={`# workspace/rsi_dip_buyer.py
import numpy as np
from workspace.rsi_dip_buyer_manager import RSIDipBuyerManager
from core.strategy.strategy import Strategy
from core.utils.StockData import StockData
from core.utils.StrategyDecision import StrategyDecision


class RSIDipBuyerStrategy(Strategy):
    def __init__(self):
        super().__init__()
        self.name = "RSI Dip Buyer"
        self.description = "Buys oversold conditions in uptrends, with confidence scaled by dip depth."
        self.manager = RSIDipBuyerManager()

        self.RSI_WINDOW = 14
        self.RSI_OVERSOLD = 30
        self.MIN_BARS_REQUIRED = self.RSI_WINDOW + 2

    def generate_signal(self, ticker: str, history: StockData) -> StrategyDecision:
        close = history.close_price
        if len(close) < self.MIN_BARS_REQUIRED:
            raise ValueError(f"{ticker} needs more bars")

        today = str(history.dates[-1])
        rsi = self._rsi(close, self.RSI_WINDOW)      # helper from the base class
        current_rsi = float(rsi[-1])

        if np.isnan(current_rsi):
            raise ValueError(f"{ticker}: RSI not ready")

        # Dip condition: oversold but not in free-fall (still above its 200 SMA)
        oversold = current_rsi <= self.RSI_OVERSOLD
        long_term_ok = close[-1] >= float(self._sma(close, 200)[-1])

        # Confidence: deeper dips are better entries, mapped to 0.3 - 1.0
        depth = (self.RSI_OVERSOLD - current_rsi) / self.RSI_OVERSOLD
        confidence = round(min(1.0, 0.3 + depth), 2) if oversold else 1.0

        return StrategyDecision(
            signal="BUY" if (oversold and long_term_ok) else "HOLD",
            confidence=confidence,
            metrics={"rsi": round(current_rsi, 2), "close_price": float(close[-1])},
            meta_data={"ticker": ticker, "signal_date": today},
        )`} title="workspace/rsi_dip_buyer.py" readOnly={false} />
            </Step>

            <Step n="2" title="The Manager (workspace/rsi_dip_buyer_manager.py)">
              <CodeBlock source={`# workspace/rsi_dip_buyer_manager.py
from core.portfolio.portfolio_manager import PortfolioManager, RebalanceFrequency, TradeRecord
from core.utils.StrategyDecision import StrategyDecision


class RSIDipBuyerManager(PortfolioManager):
    def __init__(self):
        super().__init__()
        self.max_positions = 8
        self.REBALANCE_FREQUENCY = RebalanceFrequency.NEVER

    def on_signal(self, ticker: str, decision: StrategyDecision) -> TradeRecord | None:
        if decision.signal != "BUY" or self.open_positions.get(ticker, False):
            return None
        if ticker in self.blacklisted_tickers:
            return None

        entry = decision.metrics.get("close_price", 0.0)
        rsi_value = decision.metrics.get("rsi", 50.0)
        if entry <= 0:
            return None

        # RSI-scaled sizing: the deeper the dip, the bigger the bet.
        # rsi 30 -> ~0.06 of the portfolio, rsi 20 -> ~0.10
        dip_strength = max(0.0, (self.RSI_OVERSOLD - rsi_value) / self.RSI_OVERSOLD)
        allocation = round(min(0.10, 0.06 + dip_strength * 0.10), 2)

        # Wide stop, because mean reversion needs room to breathe
        stop_loss = round(entry * 0.90, 2)        # -10%
        take_profit = round(entry * 1.05, 2)      # +5%

        return TradeRecord(
            ticker=ticker,
            action="BUY",
            entry_date=None,
            allocation_size=allocation,
            entry_price=None,
            stop_loss=stop_loss,
            take_profit=take_profit,
            signal_date=decision.meta_data.get("signal_date", ""),
        )`} title="workspace/rsi_dip_buyer_manager.py" readOnly={false} />
            </Step>
          </section>

          {/* 07 Custom universe */}
          <section id="recipe-universe" className="docs-section">
            <SectionHead
              num="07"
              group="Recipes"
              title="Custom universe"
              lead={
                <>
                  If your strategy picks its own tickers, this is how{' '}
                  <code>initialize_universe</code> and <code>on_rebalance</code> fit together.
                  Return <code>False</code> while the data is not ready and the engine simply tries
                  again the next day, for up to 60 days.
                </>
              }
            />
            <CodeBlock source={`# The market-data helpers are engine-side. The project reaches them
# through the backend path, the same way the core package does.
from app.database.fetch import get_all_tickers, get_stock_history, get_stock_histories

def initialize_universe(self, current_date: str) -> bool:
    # Example: top 30 names by trailing dollar volume
    n = 30
    candidates = []
    for ticker, h in get_stock_histories(get_all_tickers(),
                                         start=three_months_before(current_date),
                                         end=current_date).items():
        if h is None or len(h.volume) < 40:
            continue
        dollar_vol = float(np.mean(h.volume[-40:] * h.close_price[-40:]))
        candidates.append((ticker, dollar_vol))

    if len(candidates) < n:
        return False                      # backtester retries the next day

    candidates.sort(key=lambda x: x[1], reverse=True)
    self.tickers = [t for t, _ in candidates[:n]]
    for t in self.tickers:
        self.histories[t] = get_stock_history(t)
    return True

def on_rebalance(self, current_date: str) -> None:
    # Quarterly pruning: remove losers. If a loser still has an open
    # position, blacklist it so it is dropped once the position closes.
    for ticker in list(self.tickers):
        wins = sum(self.ticker_wins.get(ticker, []))
        losses = sum(self.ticker_losses.get(ticker, []))
        if wins + losses < 0:
            if self.open_positions.get(ticker, False):
                self.blacklisted_tickers.add(ticker)
            else:
                self.tickers.remove(ticker)
                self.histories.pop(ticker, None)`} title="universe selection + rotation" readOnly={false} />
          </section>

          {/* 08 Reference */}
          <section id="reference" className="docs-section">
            <SectionHead
              num="08"
              group="Reference"
              title="Engine source"
              lead="The classes you extend, read-only. The Strategy base class carries about 25 indicators, so you rarely need to import a technical-analysis library at all."
            />

            <div className="docs-ref-notes">
              <div className="docs-ref-note">
                <h5>Override these (Manager)</h5>
                <ul>
                  <li><code>on_signal(ticker, decision) → TradeRecord | None</code> — required</li>
                  <li><code>initialize_universe(date) → bool</code> — optional</li>
                  <li><code>on_rebalance(date)</code> — optional</li>
                </ul>
              </div>
              <div className="docs-ref-note">
                <h5>Leave alone (Manager)</h5>
                <ul>
                  <li><code>check_exits</code> — checks stop-loss and take-profit, including gaps</li>
                  <li><code>buy_order</code> — fills, slippage, fees and allocation caps</li>
                  <li><code>mark_to_market</code> — daily portfolio value</li>
                  <li><code>_base_allocation</code> — default sizing (quarter-Kelly)</li>
                </ul>
              </div>
            </div>

            <RefTabs
              tabs={[
                { label: 'core/strategy/strategy.py', source: BASE_STRATEGY_SOURCE },
                { label: 'core/portfolio/portfolio_manager.py', source: PORTFOLIO_MANAGER_SOURCE },
                { label: 'backtester.py', source: BACKTESTER_SOURCE },
                { label: 'core/utils/StockData.py', source: STOCK_DATA_SOURCE },
                { label: 'core/utils/StrategyDecision.py', source: STRATEGY_DECISION_SOURCE },
              ]}
            />
          </section>

          {/* 09 API */}
          <section id="api" className="docs-section">
            <SectionHead
              num="09"
              group="Reference"
              title="REST API"
              lead="Anything you can do on the site, you can also do from a script. Three endpoints cover it."
            />

            <div className="docs-api-item">
              <div className="docs-api-route"><span className="docs-api-method">GET</span><code>/api/stock/history?ticker=AAPL&timeframe=1y</code></div>
              <p>Daily prices for one ticker. <code>timeframe</code> can be <code>1y</code>, <code>2y</code>, <code>5y</code> or <code>all</code>.</p>
              <CodeBlock source={`[
  { "date": "2026-09-22", "open": 171.2, "high": 173.8,
    "low": 170.6, "close": 173.1, "volume": 54120300 },
  ...
]`} title="response" readOnly={false} />
            </div>

            <div className="docs-api-item">
              <div className="docs-api-route"><span className="docs-api-method">GET</span><code>/api/stock/all-tickers</code></div>
              <p>The full tradable universe, sorted.</p>
              <CodeBlock source={`["AAPL", "ABBV", "ABT", "ADBE", ...]`} title="response" readOnly={false} />
            </div>

            <div className="docs-api-item">
              <div className="docs-api-route"><span className="docs-api-method">GET</span><code>/api/backtest/run?strategy_id=sma-crossover&start_date=2023-01-01</code></div>
              <p>Runs a full backtest. Returns the metrics, the equity curve and every trade.</p>
              <CodeBlock source={`{
  "strategy_id": "sma-crossover",
  "strategy_name": "SMA Crossover",
  "metrics": {
    "starting_value": 100.0,
    "ending_value": 143.52,
    "cagr": 12.86,
    "sharpe": 0.9412,
    "psr": 0.8217,
    "sortino": 1.3355,
    "expectancy": 0.0121,
    "win_rate": 54.35,
    "loss_rate": 45.65,
    "average_win": 6.02,
    "average_loss": -3.11,
    "max_drawdown": 9.87,
    "drawdown_recovery": 42,
    "unrealized_profit": 1.24
  },
  "chart_data": [
    { "date": "2023-01-04", "portfolio_value": 100.0,
      "active_positions": 0, "transaction_cost": 0.0 },
    ...
  ],
  "trades": { "AAPL": [ { "action": "BUY", "entry_price": 172.4, ... } ] }
}`} title="response (trimmed)" readOnly={false} />
            </div>
          </section>

          {/* 10 Gotchas */}
          <section id="gotchas" className="docs-section">
            <SectionHead
              num="10"
              group="Reference"
              title="Pre-flight checklist"
              lead="Everything that trips people up on their first strategy, in the order it usually happens."
            />
            <ul className="docs-checklist">
              <li>Set <code>MIN_BARS_REQUIRED</code> to the real number of bars you need, and raise <code>ValueError</code> when you have less. The backtester skips that ticker for the day.</li>
              <li>You can't see the future. <code>history</code> stops at today, so the last element of every array is today's value.</li>
              <li>Orders don't fill on the day of the signal. A buy fills at the <strong>next day's open</strong>, with slippage and fees.</li>
              <li>If a bar hits both stop-loss and take-profit, the stop-loss wins. A gap fills at the open price, not at your level.</li>
              <li><code>allocation_size</code> is a share of the portfolio. Open allocations can't add up to more than 100%, so <code>buy_order</code> trims yours to what's left.</li>
              <li><code>_base_allocation</code> uses <code>1 / max_positions</code> until you've closed about 10 trades. After that it switches to Kelly sizing.</li>
              <li>Returning <code>False</code> from <code>initialize_universe</code> is fine. The engine tries again the next day.</li>
              <li>A blacklisted ticker can't be bought again until its open position closes. Clean the list up in <code>on_rebalance</code>.</li>
              <li>Portfolio value starts at <strong>100.0</strong>, an index. Scale the results however you like.</li>
            </ul>
          </section>

        </div>
      </div>
    </div>
  );
}
