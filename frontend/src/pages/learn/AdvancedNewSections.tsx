// AdvancedNewSections.tsx — the four new Advanced lessons: reading strategy
// code, writing one, reading company statements, and valuation.
//
// Code samples are the real Lab templates (core.strategy.base_strategy), so the
// method names and structure match what the engine runs. No code is executed in
// the browser; each block is copyable and the lessons point at the Lab.

import { useState } from 'react';
import { ArrowRight, Code, FileText, Tag } from 'lucide-react';
import Button from '../../ui/Button';
import { GlossaryText } from '../../components/GlossaryText';
import { LEARN_GLOSSARY } from '../../learn/learnGlossary';
import { Narrator, Objective, Recap } from './parts';


const GText = ({ children }: { children: string }) => (
  <GlossaryText text={children} glossary={LEARN_GLOSSARY} />
);

/** A copyable monospace block; scrolls sideways on narrow screens. */
function CodeBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="learn-code">
      <div className="learn-code-head">
        <span className="learn-code-label">{label}</span>
        <Button
          variant="link"
          size="sm"
          onClick={() => {
            void navigator.clipboard?.writeText(code).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre className="learn-code-pre"><code>{code}</code></pre>
    </div>
  );
}

/* ============================================================
   Reading a strategy in code
   ============================================================ */

const RSI_PULLBACK = `from core.strategy.base_strategy import Strategy
from core.utils.Order import Order
from core.utils.PositionType import PositionType
from core.utils.StockData import StockData


class RsiPullback(Strategy):
    def __init__(self):
        super().__init__()
        self.name = "RSI pullback"
        self.description = "Buy an oversold dip while price remains above its 50-day average."
        self.MAX_POSITIONS = 8
        self.MIN_BARS_REQUIRED = 60

    def initialize_universe(self, current_date: str) -> bool:
        self.add_tickers(self.available_stocks[:100])
        return bool(self.tickers)

    def on_signal(self, ticker: str, data: StockData) -> Order | None:
        rsi = self._rsi(data.close_price, 14)
        trend = self._sma(data.close_price, 50)
        close = float(data.close_price[-1])
        if not (rsi[-1] < 30 and close > trend[-1]):
            return None

        return Order(
            ticker=ticker,
            position_type=PositionType.LONG,
            allocation=0.10,
            order_date=str(data.dates[-1]),
            stop_loss=round(close * 0.94, 2),
            take_profit=round(close * 1.12, 2),
        )`;

const CODE_LEGEND = [
  { label: 'Imports', plain: 'The tools this file needs: the base Strategy class, an Order, the long/short setting, and the price data type.' },
  { label: 'class RsiPullback(Strategy)', plain: 'A new strategy that inherits the engine’s behaviour, then overrides the parts it cares about.' },
  { label: 'def __init__', plain: 'Setup: the name, how many names it may hold, and how many bars of history it needs before it may trade.' },
  { label: 'initialize_universe', plain: 'Which stocks it may choose from. Here, the first 100 available company names.' },
  { label: 'rsi = self._rsi(^, 14)', plain: 'Ask the engine for a 14-bar RSI series. Returns one number per day.' },
  { label: 'trend = self._sma(^, 50)', plain: 'The 50-bar simple moving average, used as a trend filter.' },
  { label: 'if not (^ and ^): return None', plain: 'Both conditions must hold: RSI below 30 and price above the average. Otherwise, no trade.' },
  { label: 'return Order(^)', plain: 'The trade itself: what to buy, how much of the book, a 6% stop and a 12% target.' },
];

const PYTHON_BASICS = [
  { term: 'variable', plain: 'A name holding a value: rsi = ... stores the series under the name rsi.' },
  { term: 'function', plain: 'A named block of code that does one job, like _rsi(). You call it and get a result.' },
  { term: 'method', plain: 'A function that belongs to a class. on_signal is a method of the strategy.' },
  { term: 'comparison', plain: 'A test that is either true or false: rsi[-1] < 30.' },
  { term: 'if', plain: 'Run the following lines only when the test is true.' },
  { term: 'list', plain: 'An ordered collection. data.close_price is a list of every day’s close.' },
  { term: '[-1]', plain: 'The last item in a list, so close_price[-1] is the latest close.' },
];

const PREDICT = {
  code: `rsi = self._rsi(data.close_price, 14)
if rsi[-1] < 30:
    return None`,
  options: [
    'The strategy buys when RSI is below 30',
    'The strategy skips the trade when RSI is below 30',
    'The strategy buys every day',
  ],
  answer: 1,
  explain: 'return None means “no trade”. This snippet is an exit-style filter: it refuses to act while RSI is low.',
};

export function CodeReadingSection() {
  const [prePick, setPrePick] = useState<number | null>(null);

  return (
    <div>
      <Objective>
        Read a strategy line by line, even with no programming background: what each part asks,
        and which idea it implements.
      </Objective>

      <p>
        A strategy is a small file. It sets a few numbers, says which stocks it may pick from,
        and then answers one question per stock per day: is there a trade here?
      </p>

      <div className="learn-cards">
        {PYTHON_BASICS.map((b) => (
          <div className="learn-card" key={b.term}>
            <p className="learn-card-term">{b.term}</p>
            <p>{b.plain}</p>
          </div>
        ))}
      </div>

      <p>
        Here is SLTP&apos;s Lab starter strategy <strong>RSI pullback</strong>, exactly as the Lab
        creates it. Read it once without worrying about the syntax, then use the legend.
      </p>

      <CodeBlock code={RSI_PULLBACK} label="rsi_pullback_strategy.py" />

      <div className="learn-rules">
        {CODE_LEGEND.map((row, i) => (
          <div className="learn-rule" key={row.label}>
            <span className="learn-rule-num">{i + 1}</span>
            <p>
              <strong>{row.label}</strong> {row.plain}
            </p>
          </div>
        ))}
      </div>

      <Narrator icon={Code}>
        The code maps one-to-one onto the vocabulary: the signal is the RSI test, the entry rule
        is the <code>if</code>, the risk limit is the stop and the allocation.
      </Narrator>

      <div className="learn-fin">
        <p className="learn-fin-title">Predict what happens</p>
        <p className="learn-fin-hint">Read the two lines, then choose.</p>
        <pre className="learn-code-pre learn-code-inline"><code>{PREDICT.code}</code></pre>
        <div className="learn-ordertypes">
          {PREDICT.options.map((opt, i) => (
            <Button
              key={opt}
              variant="chip"
              className={`learn-ordertype ${prePick === i ? 'is-active' : ''}`}
              onClick={() => setPrePick(i)}
            >
              {opt}
            </Button>
          ))}
        </div>
        {prePick !== null && (
          <p className={`learn-caption learn-caption-strong ${prePick === PREDICT.answer ? 'learn-positive' : 'learn-negative'}`}>
            {prePick === PREDICT.answer ? 'Correct. ' : 'Not quite. '}
            {PREDICT.explain}
          </p>
        )}
      </div>

      <Recap points={[
        <>A strategy sets a few numbers, picks a universe, and answers one question per stock.</>,
        <>on_signal returns an Order to trade, or None for no trade.</>,
        <>Every part of the code maps to a named idea: signal, entry, size, stop, target.</>,
      ]} />
    </div>
  );
}

/* ============================================================
   Writing your first strategy
   ============================================================ */

const BUILD_STEPS = [
  {
    title: 'Step 1: the file and its universe',
    adds: 'A class, the book limits, and which stocks it may hold. Nothing trades yet.',
    mistake: 'Leaving MIN_BARS_REQUIRED at 1 means the indicators are still warming up when the rule reads them.',
    code: `from core.strategy.base_strategy import Strategy
from core.utils.Order import Order
from core.utils.PositionType import PositionType
from core.utils.StockData import StockData


class FiveDayDrop(Strategy):
    def __init__(self):
        super().__init__()
        self.name = "Five-day drop"
        self.description = "Buy after a sharp one-week fall while price stays above its 200-day average."
        self.MAX_POSITIONS = 10
        self.MIN_BARS_REQUIRED = 210

    def initialize_universe(self, current_date: str) -> bool:
        self.add_tickers(self.available_stocks[:100])
        return bool(self.tickers)`,
  },
  {
    title: 'Step 2: the signal',
    adds: 'The measurable condition: the 5-day return, and a trend filter so the bet is only taken in an uptrend.',
    mistake: 'Comparing today with yesterday gives a 1-day return, not a 5-day one. Index carefully.',
    code: `from core.strategy.base_strategy import Strategy
from core.utils.Order import Order
from core.utils.PositionType import PositionType
from core.utils.StockData import StockData


class FiveDayDrop(Strategy):
    def __init__(self):
        super().__init__()
        self.name = "Five-day drop"
        self.description = "Buy after a sharp one-week fall while price stays above its 200-day average."
        self.MAX_POSITIONS = 10
        self.MIN_BARS_REQUIRED = 210

    def initialize_universe(self, current_date: str) -> bool:
        self.add_tickers(self.available_stocks[:100])
        return bool(self.tickers)

    def on_signal(self, ticker: str, data: StockData) -> Order | None:
        closes = data.close_price
        five_day_return = float(closes[-1] / closes[-6] - 1)
        trend = self._sma(closes, 200)
        close = float(closes[-1])

        if five_day_return >= -0.10 or close <= trend[-1]:
            return None`,
  },
  {
    title: 'Step 3: the order',
    adds: 'Turning the signal into a trade: a size, a stop and a target. The engine handles the fill.',
    mistake: 'A stop at the entry price gets knocked out by the first ordinary dip.',
    code: `from core.strategy.base_strategy import Strategy
from core.utils.Order import Order
from core.utils.PositionType import PositionType
from core.utils.StockData import StockData


class FiveDayDrop(Strategy):
    def __init__(self):
        super().__init__()
        self.name = "Five-day drop"
        self.description = "Buy after a sharp one-week fall while price stays above its 200-day average."
        self.MAX_POSITIONS = 10
        self.MIN_BARS_REQUIRED = 210

    def initialize_universe(self, current_date: str) -> bool:
        self.add_tickers(self.available_stocks[:100])
        return bool(self.tickers)

    def on_signal(self, ticker: str, data: StockData) -> Order | None:
        closes = data.close_price
        five_day_return = float(closes[-1] / closes[-6] - 1)
        trend = self._sma(closes, 200)
        close = float(closes[-1])

        if five_day_return >= -0.10 or close <= trend[-1]:
            return None

        return Order(
            ticker=ticker,
            position_type=PositionType.LONG,
            allocation=0.10,
            order_date=str(data.dates[-1]),
            stop_loss=round(close * 0.94, 2),
            take_profit=round(close * 1.13, 2),
        )`,
  },
  {
    title: 'Step 4: an exit that does not wait for the stop',
    adds: 'A time exit: after ten trading days the idea has either worked or not, so the position closes.',
    mistake: 'Exiting on a fixed target alone leaves a losing trade open indefinitely.',
    code: `from core.strategy.base_strategy import Strategy
from core.utils.Order import Order
from core.utils.PositionType import PositionType
from core.utils.StockData import StockData
from core.utils.Trade import Trade


class FiveDayDrop(Strategy):
    def __init__(self):
        super().__init__()
        self.name = "Five-day drop"
        self.description = "Buy after a sharp one-week fall while price stays above its 200-day average."
        self.MAX_POSITIONS = 10
        self.MIN_BARS_REQUIRED = 210

    def initialize_universe(self, current_date: str) -> bool:
        self.add_tickers(self.available_stocks[:100])
        return bool(self.tickers)

    def on_signal(self, ticker: str, data: StockData) -> Order | None:
        closes = data.close_price
        five_day_return = float(closes[-1] / closes[-6] - 1)
        trend = self._sma(closes, 200)
        close = float(closes[-1])

        if five_day_return >= -0.10 or close <= trend[-1]:
            return None

        return Order(
            ticker=ticker,
            position_type=PositionType.LONG,
            allocation=0.10,
            order_date=str(data.dates[-1]),
            stop_loss=round(close * 0.94, 2),
            take_profit=round(close * 1.13, 2),
        )

    def should_exit(self, ticker: str, trade: Trade, history: StockData | None = None) -> bool:
        return self._time_stop_days(trade, 10)`,
  },
];

export function CodeWritingSection({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const [step, setStep] = useState(0);
  const s = BUILD_STEPS[step];

  return (
    <div>
      <Objective>
        Turn one hypothesis into a working strategy, a few lines at a time, in the Lab.
      </Objective>

      <p>
        The hypothesis comes from the Intermediate level: a sharp one-week fall tends to be
        followed by a recovery. Below it becomes rules, then code, in four steps.
      </p>

      <div className="learn-ordertypes">
        {BUILD_STEPS.map((item, i) => (
          <Button
            key={item.title}
            variant="chip"
            className={`learn-ordertype ${i === step ? 'is-active' : ''}`}
            onClick={() => setStep(i)}
          >
            Step {i + 1}
          </Button>
        ))}
      </div>

      <p className="learn-substep-title">{s.title}</p>
      <p><strong>What this adds:</strong> {s.adds}</p>
      <p><strong>Common mistake:</strong> {s.mistake}</p>

      <CodeBlock code={s.code} label="five_day_drop.py" />

      <p>
        The whole file is shown at every step, so the shape stays visible while it grows. Copy it
        into a new Lab project, or start from the built-in template and add the signal.
      </p>

      <div className="learn-fin">
        <p className="learn-fin-title">What to change next</p>
        <p className="learn-fin-hint">Three experiments, framed as questions rather than settings to optimise.</p>
        <ul className="learn-movelist">
          <li>Does a 10% fall mean the same thing for a sleepy utility and a volatile tech stock?</li>
          <li>If you drop the 200-day trend filter, what kind of trade are you now taking?</li>
          <li>Does the result survive if the stop is 8% instead of 6%?</li>
        </ul>
        <p className="learn-caption">
          Changing settings until the result looks best is the overfitting trap. Change one thing,
          decide why before you look, and check on a period you did not tune on.
        </p>
      </div>

      <div className="learn-ordertypes">
        <Button variant="outline" size="sm" onClick={() => onNavigate?.('lab')}>
          Open the Lab <ArrowRight size={15} />
        </Button>
        <Button variant="outline" size="sm" onClick={() => onNavigate?.('docs')}>
          API reference <ArrowRight size={15} />
        </Button>
      </div>

      <Recap points={[
        <>Build outward: universe, then signal, then order, then exits.</>,
        <>MIN_BARS_REQUIRED must cover the longest window an indicator reads.</>,
        <>Change one setting at a time, and check on data you did not tune on.</>,
      ]} />
    </div>
  );
}

/* ============================================================
   Reading a company's numbers
   ============================================================ */

// Illustrative figures, explicitly not a real filing. They are internally
// consistent so every ratio on the page can be checked by hand.
const STATEMENT_ROWS = [
  { statement: 'Income', label: 'Revenue', value: '$1,000m', note: 'Money from sales before any costs, over the year.' },
  { statement: 'Income', label: 'Costs', value: '$800m', note: 'What it cost to make and sell the product.' },
  { statement: 'Income', label: 'Net income', value: '$120m', note: 'What is left after costs, interest and tax: the bottom line.' },
  { statement: 'Balance', label: 'Assets', value: '$1,400m', note: 'Everything the company owns: cash, equipment, buildings.' },
  { statement: 'Balance', label: 'Liabilities', value: '$600m', note: 'Everything it owes: debt, unpaid bills, obligations.' },
  { statement: 'Balance', label: 'Equity', value: '$800m', note: 'Assets minus liabilities: the owners’ stake.' },
  { statement: 'Cash flow', label: 'Operating cash', value: '$180m', note: 'Cash generated by trading, which can differ from profit.' },
  { statement: 'Cash flow', label: 'Capital spending', value: '$80m', note: 'Money spent on equipment and other long-lived assets.' },
  { statement: 'Cash flow', label: 'Free cash flow', value: '$100m', note: 'Operating cash minus capital spending: cash the business generated.' },
];

const STATEMENT_CHECKS = [
  {
    q: 'Which statement is a snapshot on one date?',
    options: ['Income statement', 'Balance sheet', 'Cash flow statement'],
    answer: 1,
    explain: 'The balance sheet is a photograph; the other two cover a period.',
  },
  {
    q: 'With revenue $1,000m and net income $120m, the profit margin is:',
    options: ['8%', '12%', '80%'],
    answer: 1,
    explain: '$120m ÷ $1,000m = 12%.',
  },
  {
    q: 'Free cash flow here is:',
    options: ['$180m', '$100m', '$80m'],
    answer: 1,
    explain: '$180m operating cash − $80m capital spending = $100m.',
  },
];

export function StatementsSection() {
  const [openRow, setOpenRow] = useState<number | null>(null);
  const [checks, setChecks] = useState<Record<number, number>>({});

  return (
    <div>
      <Objective>
        The three statements every public company publishes, and the few numbers worth reading
        first.
      </Objective>

      <p>
        SLTP&apos;s engine and strategies work from price data. Company numbers are here as
        background: many investors use them, and knowing what they mean makes the rest of the
        financial press readable.
      </p>

      <div className="learn-cards">
        <div className="learn-card">
          <p className="learn-card-term">Income statement</p>
          <p>Money over a period: revenue, costs, and what is left.</p>
          <p className="learn-card-note">Read first: revenue growth and profit margin.</p>
        </div>
        <div className="learn-card">
          <p className="learn-card-term">Balance sheet</p>
          <p>A snapshot: what the company owns, what it owes, and the difference.</p>
          <p className="learn-card-note">Read first: debt against yearly earnings.</p>
        </div>
        <div className="learn-card">
          <p className="learn-card-term">Cash flow statement</p>
          <p>Money actually moving, which is why profit and cash are not the same thing.</p>
          <p className="learn-card-note">Read first: free cash flow.</p>
        </div>
      </div>

      <div className="learn-fin">
        <p className="learn-fin-title">One simplified year</p>
        <p className="learn-fin-hint">
          Illustrative figures, not a real filing. Click any row to see what it measures.
        </p>
        <div className="learn-statement">
          {STATEMENT_ROWS.map((row, i) => (
            <button
              key={row.label}
              type="button"
              className={`learn-statement-row ${openRow === i ? 'is-open' : ''}`}
              onClick={() => setOpenRow(openRow === i ? null : i)}
              aria-expanded={openRow === i}
            >
              <span className="learn-statement-tag">{row.statement}</span>
              <span className="learn-statement-label">{row.label}</span>
              <span className="learn-statement-value">{row.value}</span>
              {openRow === i && <span className="learn-statement-note">{row.note}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="learn-fin">
        <p className="learn-fin-title">Three quick checks</p>
        {STATEMENT_CHECKS.map((c, i) => {
          const picked = checks[i];
          return (
            <div key={c.q} className="learn-hunch">
              <p className="learn-hunch-text">{c.q}</p>
              <div className="learn-ordertypes">
                {c.options.map((opt, j) => (
                  <Button
                    key={opt}
                    variant="chip"
                    className={`learn-ordertype ${picked === j ? 'is-active' : ''}`}
                    onClick={() => setChecks((p) => ({ ...p, [i]: j }))}
                  >
                    {opt}
                  </Button>
                ))}
              </div>
              {picked !== undefined && (
                <p className={`learn-hunch-feedback ${picked === c.answer ? 'is-right' : 'is-wrong'}`}>
                  {picked === c.answer ? 'Correct. ' : 'Not quite. '}
                  {c.explain}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p>
        Four numbers are worth knowing first: revenue growth,{' '}
        <GText>profit margin</GText>, debt compared with earnings, and{' '}
        <GText>free cash flow</GText>. Each tells you something real and hides something: growth
        can be bought with discounts, margin can be flattered by one-off cuts, and free cash flow
        can swing with the timing of a single big payment.
      </p>

      <Narrator icon={FileText}>
        Numbers describe the past, and accounting choices move them. One figure proves nothing;
        several years of the same direction is evidence.
      </Narrator>

      <Recap points={[
        <>Income statement covers a period, balance sheet is a snapshot, cash flow is the money that actually moved.</>,
        <>Free cash flow is what the business generated after maintaining itself.</>,
        <>Ratios are questions to ask, not answers: each one hides as much as it shows.</>,
      ]} />
    </div>
  );
}

/* ============================================================
   Valuation
   ============================================================ */

// Two illustrative companies, chosen so the arithmetic is visible: same price,
// very different businesses.
const COMPANIES = [
  { name: 'Company A', price: 40, eps: 4, shares: 500, growth: '3% a year', note: 'A mature, slow-growing business.' },
  { name: 'Company B', price: 40, eps: 1, shares: 500, growth: '25% a year', note: 'A faster-growing business, priced for that growth.' },
];

const pct = (v: number) => `${v > 0 ? '+' : ''}${v}%`;

export function ValuationSection() {
  const [idx, setIdx] = useState(0);
  const [growth, setGrowth] = useState(10);
  const c = COMPANIES[idx];
  const marketCap = c.price * c.shares;
  const pe = c.price / c.eps;
  // Years of today's earnings needed to match the price at a constant growth rate.
  const yearsToMatch = growth > 0 ? Math.log(c.price / c.eps) / Math.log(1 + growth / 100) : Infinity;

  return (
    <div>
      <Objective>
        What a price-to-earnings ratio means, and why a cheap-looking stock is not automatically
        a good one.
      </Objective>

      <p>
        A share price on its own says nothing. A $40 share can be expensive and a $400 share can
        be cheap, because what matters is what you get for the price.
      </p>

      <div className="learn-fin">
        <p className="learn-fin-title">Two companies, same share price</p>
        <p className="learn-fin-hint">Illustrative numbers. Pick a company and compare.</p>

        <div className="learn-ordertypes">
          {COMPANIES.map((item, i) => (
            <Button
              key={item.name}
              variant="chip"
              className={`learn-ordertype ${i === idx ? 'is-active' : ''}`}
              onClick={() => setIdx(i)}
            >
              {item.name}
            </Button>
          ))}
        </div>

        <div className="learn-factrow">
          <div className="learn-fact">
            <span className="learn-fact-label">Share price</span>
            <span className="learn-fact-value">${c.price}</span>
          </div>
          <div className="learn-fact">
            <span className="learn-fact-label">Earnings per share</span>
            <span className="learn-fact-value">${c.eps}</span>
          </div>
          <div className="learn-fact">
            <span className="learn-fact-label">Market capitalisation</span>
            <span className="learn-fact-value">${marketCap.toLocaleString()}m</span>
          </div>
          <div className="learn-fact">
            <span className="learn-fact-label">P/E ratio</span>
            <span className="learn-fact-value">{pe.toFixed(0)}</span>
          </div>
        </div>

        <p className="learn-caption learn-caption-strong">
          {c.name}: a P/E of {pe.toFixed(0)} means the price equals {pe.toFixed(0)} years of
          today&apos;s profit. {c.note}
        </p>
      </div>

      <div className="learn-fin">
        <p className="learn-fin-title">Why a high P/E can be reasonable</p>
        <p className="learn-fin-hint">
          At a constant growth rate, how many years of earnings does the price represent? Move
          the growth dial for Company B (P/E 40).
        </p>
        <div className="learn-slider-block">
          <div className="learn-slider-readout">
            <span>Yearly earnings growth</span>
            <strong className="learn-money">{pct(growth)}</strong>
          </div>
          <input
            type="range"
            min={0}
            max={30}
            step={1}
            value={growth}
            onChange={(e) => setGrowth(parseInt(e.target.value, 10))}
            className="learn-slider"
            aria-label="Earnings growth percentage"
          />
        </div>
        <p className="learn-caption learn-caption-strong">
          {growth === 0
            ? `At no growth, a P/E of 40 is 40 years of today’s profit: hard to justify without a reason.`
            : `At ${pct(growth)} a year, earnings catch up with today’s price in about ${Math.round(yearsToMatch)} years. That is the bet: not that the company is cheap now, but that it will be reasonable later.`}
        </p>
      </div>

      <p>
        The other common ratios: <GText>price-to-sales</GText> (market value ÷ revenue) for
        companies without profit, and <GText>enterprise value</GText> (market value + debt −
        cash) when two companies carry very different debt. All of them are comparisons, not
        verdicts.
      </p>

      <p>
        Investors often split into two camps. <strong>Growth</strong> investors pay up for
        companies expanding fast. <strong>Value</strong> investors look for companies priced low
        against today&apos;s profits or assets. Neither is right by definition: a high P/E can be
        justified by growth, and a low one can be cheap for a reason.
      </p>

      <Narrator icon={Tag}>
        Valuation is a tool for thinking about a price, not a rule that tells you to buy.
      </Narrator>

      <Recap points={[
        <>A price means something only against what you get: earnings, sales, assets.</>,
        <>Market cap is price × shares; P/E is price ÷ earnings per share.</>,
        <>Cheap and expensive are questions, and a low ratio can be low for a reason.</>,
      ]} />
    </div>
  );
}

/** Icons kept explicit for LearnPage. */
export const ADVANCED_ICONS = { Code, FileText, Tag };
