// DocsPage.tsx — SLTP documentation for writing custom strategies and managers.
// QuantConnect-style: sticky sidebar TOC, reference viewers, worked recipes.
import { useEffect, useState, type ReactNode } from 'react';
import {
  Cog, PenLine, FileCode2,
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

const SECTIONS = [
  { id: 'overview', label: 'Overview', num: '01' },
  { id: 'methods', label: 'The methods you override', num: '02' },
  { id: 'setup', label: 'Setting up your classes', num: '03' },
  { id: 'decision', label: 'Anatomy of a decision', num: '04' },
  { id: 'recipe-sma', label: 'Recipe: SMA crossover', num: '05' },
  { id: 'recipe-rsi', label: 'Recipe: RSI dip buyer', num: '06' },
  { id: 'recipe-universe', label: 'Recipe: custom universe', num: '07' },
  { id: 'reference', label: 'Engine reference', num: '08' },
  { id: 'api', label: 'API usage', num: '09' },
  { id: 'gotchas', label: 'Gotchas & checklist', num: '10' },
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

function Field({ name, required, children }: { name: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="docs-field">
      <div className="docs-field-head">
        <code>{name}</code>
        <span className={`docs-field-tag ${required ? 'is-required' : ''}`}>{required ? 'required' : 'optional'}</span>
      </div>
      <p>{children}</p>
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
      <div className="docs-hero page-hero-band is-full-bleed is-dot-grid">
        <div className="page-hero-inner">
        <p className="docs-kicker">Documentation</p>
        <h1 className="docs-title">Write your own strategy.</h1>
        <p className="docs-sub">
          SLTP strategies are just two Python classes. You decide when to buy,
          the engine handles sizing, fills, fees, stop-losses and simulation.
          Implement two files and everything else is handled for you.
        </p>
        </div>
      </div>

      <div className="docs-layout">
        {/* Sidebar TOC */}
        <aside className="docs-toc">
          <p className="docs-toc-heading">On this page</p>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`docs-toc-link ${activeSection === s.id ? 'is-active' : ''}`}
              onClick={() => jump(s.id)}
            >
              <span className="docs-toc-num">{s.num}</span>
              {s.label}
            </button>
          ))}
        </aside>

        {/* Content */}
        <div className="docs-content">

          {/* 01 Overview */}
          <section id="overview" className="docs-section">
            <div className="docs-section-heading">
              <span className="docs-section-num">01</span>
              <h2>Overview</h2>
            </div>
            <p>
              A strategy on SLTP is a pair of classes that answer two different questions.
              The <strong>Strategy</strong> answers <em>"is now a good time to buy this ticker?"</em>.
              The <strong>Manager</strong> answers <em>"if I buy, how much do I bet, and where do I cut losses?"</em>.
            </p>
            <p>
              You never touch order execution, fees, slippage, portfolio accounting or
              the simulation loop. The engine handles all of it. Your job is purely
              the decision-making, which keeps your code small and easy to reason about.
            </p>
            <p>Concretely, you override one method per class:</p>
            <div className="docs-ref-notes">
              <div className="docs-ref-note">
                <h5>Strategy — decide</h5>
                <ul>
                  <li><code>generate_signal(ticker, history)</code> — required</li>
                </ul>
              </div>
              <div className="docs-ref-note">
                <h5>Manager — size and execute</h5>
                <ul>
                  <li><code>on_signal(ticker, decision)</code> — required</li>
                  <li><code>initialize_universe(date)</code> — optional</li>
                  <li><code>on_rebalance(date)</code> — optional</li>
                </ul>
              </div>
            </div>
          </section>

          {/* 02 Methods, in english */}
          <section id="methods" className="docs-section">
            <div className="docs-section-heading">
              <span className="docs-section-num">02</span>
              <h2>The methods you override</h2>
            </div>
            <p>
              Here is what each one actually does, in plain terms, assuming you have
              written some Python but never built a trading system.
            </p>

            <div className="docs-method-card">
              <div className="docs-method-head">
                <FileCode2 size={16} />
                <div>
                  <code>Strategy.generate_signal(ticker, history)</code>
                  <span className="docs-field-tag is-required">required</span>
                </div>
              </div>
              <p>
                <code>generate_signal</code> is invoked once per trading day for each ticker
                in the universe. It receives <code>history</code>, a table of daily prices
                ending at the current date, and must return a decision object describing
                whether to buy, sell, or hold. Strategies declare the minimum amount of
                history they require through <code>MIN_BARS_REQUIRED</code>, and raise a
                <code> ValueError</code> when the input is shorter; the engine interprets
                this as "not yet tradable" and continues. The function is expected to be
                stateless and side-effect free: each call is an independent evaluation of
                the chart up to that day.
              </p>
            </div>

            <div className="docs-method-card">
              <div className="docs-method-head">
                <PenLine size={16} />
                <div>
                  <code>Manager.on_signal(ticker, decision)</code>
                  <span className="docs-field-tag is-required">required</span>
                </div>
              </div>
              <p>
                <code>on_signal</code> acts as the risk-management layer between signal
                generation and execution. The Strategy proposes an entry; the Manager
                validates it against the portfolio state (existing positions, blacklisted
                tickers, position limits) and, if accepted, converts it into a trade order.
                The order specifies <code>allocation_size</code>, the fraction of portfolio
                value to commit, along with <code>stop_loss</code> and <code>take_profit</code>
                price levels. Returning a <code>TradeRecord</code> queues the buy; returning
                <code> None</code> declines it. Orders are never executed inline: the engine
                fills queued buys at the next trading day's open.
              </p>
            </div>

            <div className="docs-method-card">
              <div className="docs-method-head">
                <Cog size={16} />
                <div>
                  <code>Manager.initialize_universe(current_date)</code>
                  <span className="docs-field-tag">optional</span>
                </div>
              </div>
              <p>
                Most strategies operate on a selected subset of the market rather than the
                full ticker list. <code>initialize_universe</code> performs that selection
                once at the start of the run: screen tickers against whatever criteria the
                strategy defines (liquidity, trend, sector) and load daily data for the
                tickers that pass. If the underlying data is unavailable for the given
                date, return <code>False</code> and the engine retries on the following
                calendar day. Strategies that trade the full tradable list may omit this
                method entirely.
              </p>
            </div>

            <div className="docs-method-card">
              <div className="docs-method-head">
                <Cog size={16} />
                <div>
                  <code>Manager.on_rebalance(current_date)</code>
                  <span className="docs-field-tag">optional</span>
                </div>
              </div>
              <p>
                <code>on_rebalance</code> runs on the schedule configured through
                <code> REBALANCE_FREQUENCY</code> (weekly, monthly, quarterly, and so on)
                and is the point at which the universe is refreshed: underperforming
                tickers are removed and fresh candidates are brought in. The engine
                assists with one detail: a losing ticker that still holds an open position
                can be added to <code>blacklisted_tickers</code>, and the engine removes it
                from the universe automatically once that position closes.
              </p>
            </div>
          </section>

          {/* 03 Setup / initialization */}
          <section id="setup" className="docs-section">
            <div className="docs-section-heading">
              <span className="docs-section-num">03</span>
              <h2>Setting up your classes</h2>
            </div>
            <p>
              Every project has two packages. <code>core/</code> is the engine, read-only:
              the base classes and helpers you build on. <code>workspace/</code> is yours:
              the files you write. You reach the engine through its <code>core.*</code> paths.
            </p>
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
              Before any of those methods run, both classes need a short
              <code> __init__</code>. This is where you declare what your strategy is and
              how it should behave.
            </p>

            <Step n="1" title="Initialize the Strategy">
              <p>
                Set a <code>name</code> and <code>description</code>, attach the Manager,
                define your strategy's tunable parameters as plain attributes, and set
                <code> MIN_BARS_REQUIRED</code>: the minimum number of daily bars your logic
                needs before it can produce a real signal. The engine skips any ticker with
                less history than that, so set it to your longest lookback window plus a small buffer.
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

            <Step n="2" title="Initialize the Manager">
              <p>
                Call <code>super().__init__()</code> and set the position limits and the
                schedule. The three settings that matter:
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
            <div className="docs-section-heading">
              <span className="docs-section-num">04</span>
              <h2>Anatomy of a decision</h2>
            </div>
            <p>
              <code>StrategyDecision</code> is the only thing your Strategy ever returns,
              so it is worth knowing exactly what belongs in it. Every decision must include
              the following. Anything else you add is up to you: these dicts exist precisely
              so you can debug and track whatever you find useful.
            </p>

            <div className="docs-field-group">
              <p className="docs-field-group-title">signal</p>
              <Field name="signal" required>
                {'A string: '}
                <code>"BUY"</code>
                {', '}
                <code>"SELL"</code>
                {' or '}
                <code>"HOLD"</code>
                {'. Only BUY signals reach the Manager\'s '}
                <code>on_signal</code>.
              </Field>
              <Field name="confidence" required>
                {'A float from 0.0 to 1.0. The Manager receives it and may scale the position size by it, so it should be derived from how strongly the entry conditions are met.'}
              </Field>
            </div>

            <div className="docs-field-group">
              <p className="docs-field-group-title">metrics</p>
              <Field name="close_price" required>
                {'The current close of the ticker, as '}
                <code>{'float(close_price[-1])'}</code>
                {'. The Manager typically needs it to compute stop-loss and take-profit levels from price.'}
              </Field>
              <Field name="...anything else">
                {'Every indicator that drove the decision: '}
                <code>rsi</code>
                {', '}
                <code>fast_sma</code>
                {', and so on. There are no other required keys. Values must be floats, and they are what make a signal explainable after the fact.'}
              </Field>
            </div>

            <div className="docs-field-group">
              <p className="docs-field-group-title">meta_data</p>
              <Field name="signal_date" required>
                {'The date the signal was generated, as '}
                <code>{'str(history.dates[-1])'}</code>
                {'. The Manager uses it to locate the signal day in history (for ATR-style stops), and the trade record carries it for auditability.'}
              </Field>
              <Field name="ticker" required>
                {'The ticker the decision is for. This keeps decisions self-contained wherever they get logged or stored.'}
              </Field>
              <Field name="...anything else">
                {'Parameter dumps, regime flags, or any other annotations. '}
                <code>meta_data</code>
                {' accepts arbitrary values, not just floats.'}
              </Field>
            </div>

            <CodeBlock source={STRATEGY_DECISION_SOURCE} title="StrategyDecision.py" />
          </section>

          {/* 05 SMA crossover */}
          <section id="recipe-sma" className="docs-section">
            <div className="docs-section-heading">
              <span className="docs-section-num">05</span>
              <h2>Recipe: SMA crossover</h2>
            </div>
            <p>
              The classic trend-following entry: buy when the fast moving average crosses
              above the slow one, exit via a fixed-percentage stop and target. This is a
              complete, runnable strategy, both files.
            </p>

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
            <div className="docs-section-heading">
              <span className="docs-section-num">06</span>
              <h2>Recipe: RSI dip buyer</h2>
            </div>
            <p>
              A mean-reversion pattern: buy oversold conditions with confidence scaled
              by how deep the dip is. This one shows the <code>_rsi</code> helper and
              how to derive confidence from indicator extremes. Both files, with the
              Strategy first.
            </p>

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
            <div className="docs-section-heading">
              <span className="docs-section-num">07</span>
              <h2>Recipe: custom universe</h2>
            </div>
            <p>
              If your strategy selects its own tickers instead of trading everything,
              this is the pattern for <code>initialize_universe</code> and
              <code> on_rebalance</code>. Return <code>False</code> from
              <code> initialize_universe</code> if data is not ready; the engine walks
              forward day by day and retries (up to two months).
            </p>
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
            <div className="docs-section-heading">
              <span className="docs-section-num">08</span>
              <h2>Engine reference</h2>
            </div>
            <p>
              Read-only views of the classes you are extending. The Strategy base gives you
              ~25 technical indicators as one-line helpers, so you rarely need TA-Lib directly.
            </p>

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
                  <li><code>check_exits</code> — SL/TP engine with gap handling</li>
                  <li><code>buy_order</code> — fills, slippage, fees, allocation caps</li>
                  <li><code>mark_to_market</code> — daily equity accounting</li>
                  <li><code>_base_allocation</code> — quarter-Kelly sizing</li>
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
            <div className="docs-section-heading">
              <span className="docs-section-num">09</span>
              <h2>API usage</h2>
            </div>
            <p>Everything the site does, you can do over the REST API.</p>

            <div className="docs-api-item">
              <div className="docs-api-route"><span className="docs-api-method">GET</span><code>/api/stock/history?ticker=AAPL&timeframe=1y</code></div>
              <p>Daily candles for one ticker. <code>timeframe</code> accepts <code>1y</code>, <code>2y</code>, <code>5y</code>, <code>all</code>.</p>
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
              <p>Runs a full simulation and returns metrics, the equity curve and every trade.</p>
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
            <div className="docs-section-heading">
              <span className="docs-section-num">10</span>
              <h2>Gotchas &amp; checklist</h2>
            </div>
            <ul className="docs-checklist">
              <li>Set <code>MIN_BARS_REQUIRED</code> honestly and raise <code>ValueError</code> when history is shorter. The engine treats that as "not yet tradable" and moves on.</li>
              <li>You can never look ahead: <code>history</code> is sliced up to today before your code runs. The last element of every array is today.</li>
              <li>Signals do not fill immediately. Buys queue and fill at the <strong>next trading day's open</strong>, with slippage and fees applied.</li>
              <li>Stop-loss is checked before take-profit on the same bar (pessimistic priority), and gaps fill at the open, not at your exact level.</li>
              <li><code>allocation_size</code> is a fraction of portfolio value. Total open allocation is capped at 100%; <code>buy_order</code> trims your allocation to whatever remains.</li>
              <li><code>_base_allocation</code> needs about 10 closed trades before the Kelly sizing kicks in; before that it returns <code>1 / max_positions</code>.</li>
              <li>Returning <code>False</code> from <code>initialize_universe</code> is normal: the engine retries the next calendar day.</li>
              <li>Blacklisted tickers cannot re-enter until their position closes, <code>on_rebalance</code> is where that cleanup usually lives.</li>
              <li>Portfolio value starts at <strong>100.0</strong> (an index). Scale results to any dollar amount you like.</li>
            </ul>
          </section>

        </div>
      </div>
    </div>
  );
}
