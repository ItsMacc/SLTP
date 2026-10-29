// DocsPage.tsx — Documentation for the current SLTP strategy engine and API.
// The established page layout, reference cards and code viewers are retained.
import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, Cog, Info, PenLine, FileCode2 } from 'lucide-react';
import {
  BASE_STRATEGY_SOURCE,
  PORTFOLIO_MANAGER_SOURCE,
  BACKTESTER_SOURCE,
  STOCK_DATA_SOURCE,
  ORDER_SOURCE,
  TRADE_SOURCE,
  EVENT_SOURCE,
} from '../../lib/docsSources';
import './DocsPage.css';

interface DocsPageProps {
  onNavigate?: (tab: string) => void;
}

const SECTIONS = [
  { id: 'overview', label: 'Overview', num: '01', group: 'Getting started' },
  { id: 'quick-start', label: 'Quick start', num: '02', group: 'Getting started' },
  { id: 'strategy', label: 'Strategy class', num: '03', group: 'Write a strategy' },
  { id: 'universes', label: 'Universes', num: '04', group: 'Write a strategy' },
  { id: 'indicators', label: 'Indicators and exits', num: '05', group: 'Tools' },
  { id: 'execution', label: 'Portfolio and execution', num: '06', group: 'Tools' },
  { id: 'structures', label: 'Data structures', num: '07', group: 'Reference' },
  { id: 'recipe-smr', label: 'Mean reversion recipe', num: '08', group: 'Reference' },
  { id: 'api', label: 'API endpoints', num: '09', group: 'Reference' },
];

function CodeBlock({ source, title, readOnly = true }: { source: string; title?: string; readOnly?: boolean }) {
  return (
    <div className="docs-code" data-readonly={readOnly || undefined}>
      <div className="docs-code-header">
        <span className="docs-code-title">{title ?? 'python'}</span>
        {readOnly && <span className="docs-code-badge">reference</span>}
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
      <div className="docs-reftabs-bar" role="tablist" aria-label="Engine source excerpts">
        {tabs.map((item, index) => (
          <button
            key={item.label}
            type="button"
            role="tab"
            aria-selected={index === active}
            className={`docs-reftab ${index === active ? 'is-active' : ''}`}
            onClick={() => setActive(index)}
          >
            {item.label}
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

function SectionHead({ num, group, title, lead }: { num: string; group: string; title: string; lead?: ReactNode }) {
  return (
    <header className="docs-section-heading">
      <span className="docs-section-eyebrow">{num} / {group}</span>
      <h2>{title}</h2>
      {lead && <p className="docs-section-lead">{lead}</p>}
    </header>
  );
}

function Signature({ signature, required, rows }: {
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

function FieldTable({ title, fields }: { title: string; fields: { name: string; contents: ReactNode }[] }) {
  return (
    <div className="docs-table">
      <div className="docs-table-head" aria-hidden="true"><span>{title}</span><span>Contents</span></div>
      {fields.map((field) => (
        <div className="docs-table-row" key={field.name}>
          <code>{field.name}</code><p>{field.contents}</p>
        </div>
      ))}
    </div>
  );
}

function Callout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="docs-callout">
      <Info size={18} aria-hidden="true" />
      <div><p className="docs-callout-title">{title}</p><p className="docs-callout-body">{children}</p></div>
    </div>
  );
}

export default function DocsPage(_props: DocsPageProps) {
  const [activeSection, setActiveSection] = useState('overview');

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) setActiveSection(entry.target.id);
    }, { rootMargin: '-20% 0px -70% 0px' });
    for (const section of SECTIONS) {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, []);

  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="docs-page">
      <div className="docs-hero-wrapper page-hero-band is-full-bleed is-dot-grid">
        <div className="docs-hero-inner page-hero-inner">
          <div className="docs-hero-copy">
            <span className="page-hero-eyebrow">Documentation</span>
            <h1 className="page-hero-title">SLTP Strategy Engine</h1>
            <p className="page-hero-description">A practical guide to writing strategies, understanding execution, and using the SLTP API.</p>
          </div>
        </div>
      </div>

      <div className="docs-layout">
        <aside className="docs-toc" aria-label="On this page">
          {SECTIONS.map((section, index) => (
            <Fragment key={section.id}>
              {(index === 0 || SECTIONS[index - 1].group !== section.group) && <p className="docs-toc-heading">{section.group}</p>}
              <button type="button" className={`docs-toc-link ${activeSection === section.id ? 'is-active' : ''}`} onClick={() => jump(section.id)}>
                <span className="docs-toc-num">{section.num}</span><span className="docs-toc-label">{section.label}</span>
              </button>
            </Fragment>
          ))}
        </aside>

        <div className="docs-content">
          <section id="overview" className="docs-section">
            <SectionHead num="01" group="Getting started" title="A strategy decides. The engine keeps the book." lead="SLTP separates trading decisions from portfolio accounting. Your Strategy defines a universe, evaluates data, and returns Orders. The Backtester owns the PortfolioManager, which handles fills, position limits, costs, exits, cash, and equity." />
            <div className="docs-duo">
              <article className="docs-duo-card">
                <span className="docs-duo-label">Strategy</span><h3 className="docs-duo-title">Define the rules</h3>
                <div className="docs-duo-sig"><code>on_signal(ticker, data) → Order | None</code><span className="docs-field-tag is-required">required</span></div>
                <p className="docs-duo-note">A Strategy does not create or mutate a portfolio book. It returns an immutable Order when its entry conditions are met, or None otherwise.</p>
              </article>
              <article className="docs-duo-card">
                <span className="docs-duo-label">Backtester and PortfolioManager</span><h3 className="docs-duo-title">Apply the rules consistently</h3>
                <div className="docs-duo-sig"><code>PortfolioManager(strategy)</code><span className="docs-field-tag">engine-owned</span></div>
                <p className="docs-duo-note">The manager validates and fills orders, charges costs, tracks each lot, checks exits, and records the equity curve.</p>
              </article>
            </div>
            <p>Each strategy callback receives a frozen <code>StockData</code> object whose NumPy arrays are read-only. The backtester slices every history through the current session before a signal or exit callback, so later bars are not available to your logic.</p>
            <div className="docs-flow" aria-label="Daily engine sequence">
              <div className="docs-flow-card"><span className="docs-flow-icon"><FileCode2 size={18} aria-hidden="true" /></span><span className="docs-flow-label">1 · Prepare the session</span><p>Run daily hooks, fill queued exits and entries at today's open, then apply a due universe rebalance.</p></div>
              <ArrowRight className="docs-flow-arrow" size={16} aria-hidden="true" />
              <div className="docs-flow-card"><span className="docs-flow-icon"><PenLine size={18} aria-hidden="true" /></span><span className="docs-flow-label">2 · Evaluate and manage</span><p>Pass as-of-today history to entry and custom-exit rules. New orders and custom exits queue for the next available open.</p></div>
              <ArrowRight className="docs-flow-arrow" size={16} aria-hidden="true" />
              <div className="docs-flow-card"><span className="docs-flow-icon"><Cog size={18} aria-hidden="true" /></span><span className="docs-flow-label">3 · Mark the portfolio</span><p>Check resting stops and targets against the day's bar, then mark equity once at the close.</p></div>
            </div>
            <Callout title="No signal means no order work">Return <code>None</code> when no entry is warranted. It is the normal way to say “do nothing,” not an error.</Callout>
          </section>

          <section id="quick-start" className="docs-section">
            <SectionHead num="02" group="Getting started" title="Quick start" lead="Create one Strategy subclass, add its ticker universe, and return an Order only when your rules produce an entry." />
            <Step n="1" title="Create a strategy file">
              <p>In the Lab, add a Python file under <code>workspace/</code>. The engine lives under the read-only <code>core/</code> package. Set a descriptive name and the minimum history your indicators need.</p>
              <CodeBlock title="workspace/my_strategy.py" readOnly={false} source={`from core.strategy.base_strategy import Strategy
from core.utils.Order import Order
from core.utils.PositionType import PositionType
from core.utils.StockData import StockData

class MyStrategy(Strategy):
    def __init__(self):
        super().__init__()
        self.name = "My Strategy"
        self.description = "A short explanation of the rules."
        self.tickers = ["AAPL"]
        self.MIN_BARS_REQUIRED = 21

    def on_signal(self, ticker: str, data: StockData) -> Order | None:
        close = data.close_price
        average = self._sma(close, 20)
        if close[-1] <= average[-1]:
            return None
        return Order(
            ticker=ticker,
            position_type=PositionType.LONG,
            allocation=0.10,
            order_date=str(data.dates[-1]),
            stop_loss=float(close[-1] * 0.92),
            take_profit=float(close[-1] * 1.16),
        )`}/>
            </Step>
            <Step n="2" title="Set risk and history requirements">
              <p>Configure constraints on the Strategy in <code>__init__</code>. Position limits are enforced by the PortfolioManager when an order fills. Set <code>MIN_BARS_REQUIRED</code> high enough for the longest indicator lookback and any prior-bar comparison.</p>
              <CodeBlock title="strategy settings" readOnly={false} source={`self.MAX_POSITIONS = 10
self.MAX_ALLOCATION_PER_TICKER = 0.25  # None means no separate ticker cap
self.MAX_LOTS_PER_TICKER = 1
self.REBALANCE_FREQUENCY = RebalanceFrequency.NEVER
self.MIN_BARS_REQUIRED = 21
self.LIQUIDATE_ON_END = False`}/>
            </Step>
            <Step n="3" title="Run a backtest">
              <p>Choose a registered strategy and date range in the Performance page. The server constructs a new Backtester for each run. The API form is shown in the reference section below.</p>
            </Step>
          </section>

          <section id="strategy" className="docs-section">
            <SectionHead num="03" group="Writing algorithms" title="The Strategy class" lead="The Strategy is the policy layer. It declares constraints and a universe, responds to lifecycle hooks, and returns entry orders. It does not store or update the portfolio book." />
            <FieldTable title="Safety setting" fields={[
              { name: 'MAX_POSITIONS', contents: 'Maximum number of distinct tickers held at once. None disables this cap.' },
              { name: 'MAX_ALLOCATION_PER_TICKER', contents: 'Maximum combined notional allocation for one ticker as an equity fraction. None disables this cap.' },
              { name: 'MAX_LOTS_PER_TICKER', contents: 'Maximum separately tracked entries in a ticker. Each filled Order creates its own Trade lot.' },
              { name: 'MIN_BARS_REQUIRED', contents: 'The minimum history length required before on_signal and custom-exit evaluation.' },
              { name: 'LIQUIDATE_ON_END', contents: 'When true, open lots are closed at the last session close. Otherwise they remain open and are marked to market.' },
              { name: 'REBALANCE_FREQUENCY', contents: 'A RebalanceFrequency cadence: DAILY, WEEKLY, MONTHLY, QUARTERLY, YEARLY, or NEVER.' },
            ]}/>
            <Signature signature="initialize_universe(current_date: str) → bool" rows={[
              { label: 'Purpose', value: 'Build or prepare the initial self.tickers list. The default accepts a non-empty list already set in __init__.' },
              { label: 'Return value', value: 'Return True when ready. False asks the backtester to try later, for up to 60 calendar dates.' },
              { label: 'Date safety', value: 'Use current_date as the information cutoff for historical universe selection. Do not rank candidates using later bars. The current SMR universe selector does not yet enforce this cutoff; see the universe note below.' }
            ]}/>
            <Signature signature="run_daily(current_date: str) → None" rows={[
              { label: 'When called', value: 'Once per simulated session before fills and per-ticker signal evaluation.' },
              { label: 'Use it for', value: 'Daily state updates or logging. Keep trading decisions in on_signal and avoid reading future data.' },
            ]}/>
            <Signature signature="on_rebalance(current_date: str) → None" rows={[
              { label: 'When called', value: 'When REBALANCE_FREQUENCY is due, after the session open fills and before entry signals.' },
              { label: 'Use it for', value: 'Rebuild self.tickers or maintain a periodically selected universe. The backtester loads newly selected histories.' },
            ]}/>
            <Signature signature="on_signal(ticker: str, data: StockData) → Order | None" required rows={[
              { label: 'Input', value: 'The ticker and its read-only OHLCV history through the current completed bar.' },
              { label: 'Order result', value: 'Return an Order with direction, equity allocation fraction, order date, and absolute stop/target prices.' },
              { label: 'No trade', value: 'Return None. The backtester does not submit an entry for that ticker.' },
              { label: 'Fill timing', value: 'The signal is evaluated after the close. A returned order is queued and normally fills at the next available session open.' },
            ]}/>
            <Signature signature="should_exit(ticker: str, trade: Trade) → bool" rows={[
              { label: 'When called', value: 'For open positions when the strategy overrides this hook. trade.history is updated to the current as-of history.' },
              { label: 'Return True', value: 'Queues an exit for the next available open. A false result keeps the lot open unless a resting stop or target is hit.' },
              { label: 'Trade access', value: 'Use trade.id, entry facts, and the history available through today. Do not mutate the manager or future bars.' },
            ]}/>
            <Callout title="Custom exit signature">The current base method is <code>should_exit(ticker, trade)</code>. The backtester also passes an optional third history argument to overrides that declare it, but the documented base interface uses two arguments.</Callout>
          </section>

          <section id="universes" className="docs-section">
            <SectionHead num="04" group="Universes" title="Choose and maintain a universe" lead="A universe is the list of tickers eligible for new signals. The backtester loads histories for declared tickers and keeps held names available even after they leave the active list. The engine does not automatically apply a liquidity screen; each strategy defines its own selection rules." />
            <FieldTable title="Universe property" fields={[
              { name: 'self.available_universe', contents: 'Symbols with local market history.' },
              { name: 'self.available_etfs', contents: 'Available symbols identified as ETFs by the engine universe catalog.' },
              { name: 'self.available_stocks', contents: 'Available company symbols from the configured stock universes.' },
              { name: 'self.available_gold', contents: 'Available gold proxy symbols.' },
            ]}/>
            <FieldTable title="Universe method" fields={[
              { name: 'self.add_ticker(ticker)', contents: 'Add a single symbol if it is not already in self.tickers.' },
              { name: 'self.add_tickers(tickers)', contents: 'Add multiple symbols while preserving their order and ignoring duplicates.' },
              { name: 'self.remove_ticker(ticker)', contents: 'Remove a symbol from the active list. Existing open lots are still tracked by the manager.' },
            ]}/>
            <CodeBlock title="basic universe" readOnly={false} source={`from core.strategy.base_strategy import Strategy

class SmallUniverse(Strategy):
    def __init__(self):
        super().__init__()
        self.REBALANCE_FREQUENCY = RebalanceFrequency.NEVER

    def initialize_universe(self, current_date: str) -> bool:
        self.add_tickers(self.available_stocks[:30])
        return bool(self.tickers)`}/>
            <p>For a dynamic selection, calculate each candidate's trailing dollar volume from bars on or before <code>current_date</code>, rank those values, and replace the active list on the chosen rebalance date.</p>
            <Callout title="Historical-universe lookahead in the current SMR example">The current <code>StatisticalMeanReversionStrategy._top_candidates()</code> reads full cached histories and ranks their latest bars; its <code>current_date</code> argument is not used to truncate that data. As a result, its historical universe selection can include future information. Treat the production SMR universe ranking as a reference for its selection logic, not as a no-lookahead example, until that data cutoff is corrected.</Callout>
          </section>

          <section id="indicators" className="docs-section">
            <SectionHead num="05" group="Indicators and helpers" title="Indicators and exits" lead="Indicator wrappers are methods on Strategy and return TA-Lib NumPy arrays. Their leading values may be NaN during warm-up, so set MIN_BARS_REQUIRED and validate the values your rules consume." />
            <FieldTable title="Indicator helpers" fields={[
              { name: '_sma(values, window)', contents: 'Simple moving average.' },
              { name: '_ema(values, window)', contents: 'Exponential moving average.' },
              { name: '_dema(values, window) · _tema(values, window)', contents: 'Double and triple exponential moving averages.' },
              { name: '_rsi(values, window)', contents: 'Relative Strength Index.' },
              { name: '_macd(values, fast_period, slow_period, signal_period)', contents: 'MACD line, signal line, and histogram.' },
              { name: '_bollinger_bands(values, window, deviations)', contents: 'Upper, middle, and lower Bollinger bands.' },
              { name: '_atr(high, low, close, window) · _adx(...)', contents: 'Average True Range and Average Directional Index.' },
              { name: '_stochastic(high, low, close, ...)', contents: 'Slow stochastic %K and %D.' },
              { name: '_williams_r(high, low, close, window) · _cci(...)', contents: 'Williams %R and Commodity Channel Index.' },
              { name: '_roc(values, window) · _momentum(...)', contents: 'Rate of change and absolute momentum.' },
              { name: '_obv(close, volume) · _mfi(...) · _ad(...)', contents: 'On-Balance Volume, Money Flow Index, and Accumulation/Distribution.' },
              { name: '_trix(values, window) · _parabolic_sar(high, low, ...)', contents: 'TRIX and Parabolic SAR.' },
              { name: '_stochastic_rsi(values, window, fast_k, fast_d)', contents: 'Stochastic RSI %K and %D.' },
            ]}/>
            <FieldTable title="Exit helper" fields={[
              { name: '_trailing_stop(trade, pct)', contents: 'Checks a long against its highest high since entry, or a short against its lowest low, using the percentage trail.' },
              { name: '_atr_stop(trade, multiplier, window=14)', contents: 'Checks the current bar against an entry-based ATR stop.' },
              { name: '_time_stop_days(trade, days)', contents: 'Returns true once the trade history reaches the calendar-day deadline.' },
            ]}/>
            <p>Call these from <code>should_exit</code>. A true result queues a close at the next available open; built-in stop-loss and take-profit levels are checked against daily OHLC independently.</p>
          </section>

          <section id="execution" className="docs-section">
            <SectionHead num="06" group="Portfolio and execution" title="Orders, fills, and equity" lead="An Order is an entry request, not a fill. The manager applies it on the next available open, validates the portfolio constraints, and creates a distinct Trade for each accepted lot." />
            <FieldTable title="Execution rule" fields={[
              { name: 'allocation', contents: 'A fraction of equity at fill time. For example, 0.10 is 10%, not 10 shares or $10.' },
              { name: 'stop_loss / take_profit', contents: 'Absolute prices, not percentages. A value at or below zero disables that resting level.' },
              { name: 'SLIPPAGE_PCT', contents: '0.0005, or 0.05% per fill. Entry and exit slippage move against the position.' },
              { name: 'FEE_RATE', contents: '0.001, or 0.1% of notional per fill.' },
              { name: 'Position limits', contents: 'The manager checks max positions, lots per ticker, allocation per ticker, and available cash/equity at fill.' },
              { name: 'Stop and target same bar', contents: 'The stop is checked first. If a level is crossed by a gap, the open price is used when it is worse than the level.' },
              { name: 'Cash', contents: 'Long entries debit notional plus fees. Exits return principal adjusted for P&L and exit fees.' },
            ]}/>
            <p>The portfolio begins at an index value of <strong>100.00</strong>. The manager records daily equity as starting equity plus realized P&amp;L, minus costs, plus unrealized P&amp;L. The cash balance is tracked separately from marked equity.</p>
            <CodeBlock title="order and passive risk levels" readOnly={false} source={`Order(
    ticker="AAPL",
    position_type=PositionType.LONG,
    allocation=0.10,
    order_date=str(data.dates[-1]),
    stop_loss=0.0,     # disabled
    take_profit=0.0,  # disabled
)`}/>
            <Callout title="End of backtest">With <code>LIQUIDATE_ON_END = False</code>, remaining trades stay open and the final equity includes their mark-to-market value. When enabled, open trades close at the final close and receive an END_OF_BACKTEST event.</Callout>
          </section>

          <section id="structures" className="docs-section">
            <SectionHead num="07" group="Reference" title="Core data structures" lead="The engine uses small records with clear ownership: StockData is immutable market input, Order is a queued request, Trade is one filled lot, and Event records how that lot closed." />
            <RefTabs tabs={[
              { label: 'StockData', source: STOCK_DATA_SOURCE },
              { label: 'Order', source: ORDER_SOURCE },
              { label: 'Trade', source: TRADE_SOURCE },
              { label: 'Event', source: EVENT_SOURCE },
              { label: 'Strategy', source: BASE_STRATEGY_SOURCE },
              { label: 'PortfolioManager', source: PORTFOLIO_MANAGER_SOURCE },
              { label: 'Backtester sequence', source: BACKTESTER_SOURCE },
            ]}/>
            <p>Enums are defined in <code>core.utils.PositionType</code>, <code>core.utils.EventType</code>, and <code>core.utils.RebalanceFrequency</code>. An EventType is one of STOP_LOSS, TAKE_PROFIT, SIGNAL, or END_OF_BACKTEST.</p>
          </section>

          <section id="recipe-smr" className="docs-section">
            <SectionHead num="08" group="Reference and recipes" title="Recipe: Statistical Mean Reversion" lead="The registered SMR strategy combines an oversold RSI reading with a negative price Z-score, sizes positions by dislocation confidence, and uses a dynamic RSI recovery threshold for custom exits." />
            <Step n="1" title="Build the signal">
              <p>SMR measures the current close against the 20-bar mean and standard deviation, and requires RSI below its configured threshold. It returns <code>None</code> unless both the RSI and Z-score conditions pass.</p>
              <CodeBlock title="signal logic from the production strategy" source={`closes = data.close_price
close = float(closes[-1])
stdev = float(np.std(closes[-Z_SCORE_PERIOD:], ddof=1))
if close <= 0 or stdev == 0:
    return None

rsi = float(self._rsi(closes, RSI_PERIOD)[-1])
sma = float(self._sma(closes, Z_SCORE_PERIOD)[-1])
z_score = (close - sma) / stdev
if not (rsi < RSI_THRESHOLD and z_score < -Z_SCORE_THRESHOLD):
    return None

confidence = 1 / (1 + np.exp(-2 * (-Z_SCORE_THRESHOLD - z_score)))
allocation = min(1.0, (1 / self.MAX_POSITIONS) * (1 + confidence))
distance = STDEV_EXIT_MULTIPLE * stdev
return Order(
    ticker=ticker, position_type=PositionType.LONG,
    allocation=round(allocation, 4), order_date=str(data.dates[-1]),
    stop_loss=round(close - distance, 2),
    take_profit=round(close + distance, 2),
)`}/>
            </Step>
            <Step n="2" title="Apply the custom RSI exit">
              <p>Once a position is open, SMR measures the current Z-score magnitude. The allowed RSI exit threshold falls as the move becomes more extreme, using square-root scaling.</p>
              <CodeBlock title="dynamic exit rule" source={`z_magnitude = abs((float(closes[-1]) - sma) / stdev)
excess_z = max(0.0, z_magnitude - 1.0)
exit_threshold = RSI_EXIT_THRESHOLD - (np.sqrt(excess_z) * 2.0)
return rsi >= exit_threshold`}/>
            </Step>
            <p>The production defaults use a 25-bar RSI, 20-bar Z-score window, a maximum of 25 positions, and a yearly rebalance. The candidate universe is ranked by trailing 252-bar dollar volume, with up to 20 ETF slots. The exact implementation is in <code>app/strategies/statistical_mean_reversion.py</code>.</p>
          </section>

          <section id="api" className="docs-section">
            <SectionHead num="09" group="Other things" title="API endpoints" lead="The FastAPI service exposes public market and backtest reads, plus authenticated account, portfolio, and Lab operations." />
            <div className="docs-api-item">
              <div className="docs-api-route"><span className="docs-api-method">GET</span><code>/api/strategies</code></div>
              <p>Returns each registered strategy's id, name, description, and category.</p>
            </div>
            <div className="docs-api-item">
              <div className="docs-api-route"><span className="docs-api-method">GET</span><code>/api/backtest/run?strategy_id=statistical-mean-reversion&amp;start_date=2023-01-01&amp;end_date=2026-01-01</code></div>
              <p>Runs the selected registered strategy and returns metrics, chart points, filled trades, and rejected-order counts. The end date is optional.</p>
              <CodeBlock title="response shape" source={`{
  "strategy_id": "statistical-mean-reversion",
  "strategy_name": "Statistical Mean Reversion",
  "metrics": { "starting_value": 100.0, "ending_value": 112.4, "sharpe": 0.8 },
  "chart_data": [
    { "date": "2025-01-02", "portfolio_value": 100.0,
      "active_positions": 0, "transaction_cost": 0.0 }
  ],
  "trades": [
    { "ticker": "AAPL", "action": "BUY", "position_type": "long",
      "allocation_size": 0.04, "entry_date": "2025-01-03",
      "entry_price": 185.2, "exit_date": null, "exit_price": null }
  ],
  "rejections": {}
}`}/>
            </div>
            <div className="docs-api-item">
              <div className="docs-api-route"><span className="docs-api-method">GET</span><code>/api/stock/history?ticker=AAPL&amp;timeframe=1y</code></div>
              <p>Returns ticker, timeframe, total_bars, daily OHLCV data, and the display name. Timeframes are 1y, 2y, 5y, or all.</p>
            </div>
            <div className="docs-api-item">
              <div className="docs-api-route"><span className="docs-api-method">GET</span><code>/api/stock/ticker-details</code></div>
              <p>Returns symbol and company/fund name pairs for the Performance page search.</p>
            </div>
            <div className="docs-api-item">
              <div className="docs-api-route"><span className="docs-api-method">GET</span><code>/api/stock/all-tickers</code></div>
              <p>Returns the sorted list of symbols with local market data.</p>
            </div>
            <FieldTable title="Authenticated API groups" fields={[
              { name: '/api/user/*', contents: 'Account provisioning, settings sync, login events, API-key management, and account deletion.' },
              { name: '/api/portfolio/*', contents: 'Read portfolio status and save completed onboarding settings.' },
              { name: '/api/lab/*', contents: 'Manage workspaces, projects, and Python files; import, rename, save, delete, and type-check files.' },
            ]}/>
            <p>Authenticated routes require a valid user session. See the route definitions in <code>app/database/portfolio_api.py</code>, <code>app/database/lab_api.py</code>, <code>app/database/provision.py</code>, <code>app/database/api_keys.py</code>, and <code>app/auth/security.py</code> for request schemas and authorization details.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
