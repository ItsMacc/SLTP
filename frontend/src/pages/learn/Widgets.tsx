// Widgets.tsx — Fixed data and small controls for the Level 1 lessons.

import { useId, useState } from 'react';
import type { WidgetId } from '../../learn/types';
import { AdvancedLessonWidget } from './AdvancedWidgets';
import { BacktestLessonWidget } from './BacktestWidgets';

const money = (value: number, cents = false) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: cents ? 2 : 0,
    minimumFractionDigits: cents ? 2 : 0,
  }).format(value);

export function LessonWidget({ id }: { id: WidgetId }) {
  switch (id) {
    case 'company-story':
      return <CompanyStory />;
    case 'price-news':
      return <PriceNews />;
    case 'crowd-patterns':
      return <CrowdPatterns />;
    case 'order-costs':
      return <OrderCosts />;
    case 'candle-builder':
      return <CandleBuilder />;
    case 'index-compare':
      return <IndexCompare />;
    case 'compound':
      return <Compound />;
    case 'drawdown':
      return <Drawdown />;
    case 'plan-builder':
      return <PlanBuilder />;
    default:
      return id.startsWith('backtest')
        ? <BacktestLessonWidget id={id} />
        : id === 'first-run' || id === 'equity-curve-detail' || id === 'return-breakdown' || id === 'drawdown-map' || id === 'risk-return' || id === 'trade-stats' || id === 'cost-drag' || id === 'results-tour' || id === 'overfit-sweep' || id === 'bias-check' || id === 'walk-forward-map' || id === 'skeptic-cards'
          ? <BacktestLessonWidget id={id} />
          : <AdvancedLessonWidget id={id} />;
  }
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="widget-readout">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function randomSeries(count: number, drift = 0, volatility = 0.04): number[] {
  const values = [100];
  for (let index = 1; index < count; index += 1) {
    const move = drift + (Math.random() - 0.5) * volatility;
    const previous = values[values.length - 1];
    values.push(Math.max(5, previous * (1 + move)));
  }
  return values;
}

function maxDrawdown(values: number[]): number {
  let peak = values[0];
  let worst = 0;
  for (const value of values) {
    peak = Math.max(peak, value);
    worst = Math.max(worst, ((peak - value) / peak) * 100);
  }
  return worst;
}

function percent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(0)}%`;
}

function CompanyStory() {
  const [invest, setInvest] = useState(1000);
  const [stage, setStage] = useState(0);
  const investId = useId();
  const sharePrice = 3;
  const profit = Math.round(invest * 0.12);
  const companyAfterFirst = invest + profit;
  const sharesSold = Math.max(1, Math.floor((companyAfterFirst * 0.3) / sharePrice));
  const sale = sharesSold * sharePrice;
  const secondProfit = profit * 2;
  const companyFinal = companyAfterFirst + secondProfit;
  const yourValue = (stage >= 3 ? companyFinal : companyAfterFirst) * 0.7;
  const aliceValue = (companyFinal * 0.3) / sharesSold;
  const stageCopy = [
    [
      'You start Northstar Coffee with your own money. You own 100% of the company.',
      'Use the slider to choose how much you put in.',
    ],
    [
      `A year of sales and costs leaves ${money(profit)} in profit. The company is worth ${money(companyAfterFirst)}.`,
      `You have already put in ${money(invest)} and do not want to use more savings. You sell 30% of the company to the market so you can raise ${money(sale)} for better equipment.`,
    ],
    [
      `You and the buyers settle on a simple $3 price. The ${money(sale)} stake becomes ${sharesSold} shares (${money(sale)} / $3), and all of them sell.`,
      `Alice buys one share for $3. You get ${money(sale)} in cash and still own 70% of the company.`,
      `Your remaining 70% is worth ${money(companyAfterFirst * 0.7)}. The cash and your remaining stake together are still about ${money(companyAfterFirst)}.`,
    ],
    [
      `You spend the ${money(sale)} on better equipment. The next year, profit doubles from ${money(profit)} to ${money(secondProfit)}.`,
      `The company is worth ${money(companyFinal)}. Your 70% is worth ${money(yourValue)}, and Alice's one share is worth ${money(aliceValue, true)}.`,
    ],
  ];

  return (
    <div className="learn-widget">
      {stageCopy[stage].map((line) => (
        <p className="widget-note" key={line}>{line}</p>
      ))}
      <div className="widget-readouts">
        {stage === 0 && (
          <>
            <Readout label="You put in" value={money(invest)} />
            <Readout label="You own" value="100%" />
            <Readout label="Company worth" value={money(invest)} />
          </>
        )}
        {stage === 1 && (
          <>
            <Readout label="Profit after a year" value={money(profit)} />
            <Readout label="Company worth" value={money(companyAfterFirst)} />
            <Readout label="Your 30% stake" value={money(sale)} />
            <Readout label="You own" value="100%" />
          </>
        )}
        {stage === 2 && (
          <>
            <Readout label="Cash raised" value={money(sale)} />
            <Readout label="Price per share" value={money(sharePrice, true)} />
            <Readout label="Shares sold" value={String(sharesSold)} />
            <Readout label="You own" value="70%" />
          </>
        )}
        {stage === 3 && (
          <>
            <Readout label="Profit this year" value={money(secondProfit)} />
            <Readout label="Company worth" value={money(companyFinal)} />
            <Readout label="Your 70%" value={money(yourValue)} />
            <Readout label="Alice's share" value={money(aliceValue, true)} />
          </>
        )}
      </div>
      {stage === 0 && (
        <>
          <label className="widget-label" htmlFor={investId}>
            Amount invested: {money(invest)}
          </label>
          <input
            id={investId}
            className="widget-slider"
            type="range"
            min="500"
            max="5000"
            step="100"
            value={invest}
            onChange={(event) => setInvest(Number(event.target.value))}
          />
        </>
      )}
      <div className="widget-controls">
        {stage < 3 && (
          <button type="button" className="widget-btn" onClick={() => setStage(stage + 1)}>
            {stage === 0 ? 'Run it for a year' : stage === 1 ? 'Sell 30% to the market' : 'Buy better equipment'}
          </button>
        )}
        {stage > 0 && (
          <button
            type="button"
            className="widget-btn widget-btn--quiet"
            onClick={() => {
              setInvest(1000);
              setStage(0);
            }}
          >
            Start over
          </button>
        )}
      </div>
    </div>
  );
}

function PriceNews() {
  const [history, setHistory] = useState(() => randomSeries(18, 0.001, 0.035));
  const [label, setLabel] = useState('No news yet');
  const apply = (shock: number, nextLabel: string) => {
    setHistory((current) => {
      const previous = current[current.length - 1];
      const noise = (Math.random() - 0.5) * 0.025;
      return [...current, Math.max(5, previous * (1 + shock + noise))].slice(-30);
    });
    setLabel(nextLabel);
  };
  const current = history[history.length - 1];
  const first = history[0];
  const points = autoChartPoints(history);
  const pointList = points.split(' ');
  const lastY = pointList[pointList.length - 1]?.split(',')[1] ?? '60';

  return (
    <div className="learn-widget">
      <div className="widget-readouts">
        <Readout label="Share price" value={money(current, true)} />
        <Readout label="Since start" value={percent(((current - first) / first) * 100)} />
        <Readout label="Last news" value={label} />
      </div>
      <svg className="widget-chart-svg" viewBox="0 0 320 120" role="img" aria-label="A random price path responding to news">
        <line x1="10" y1="110" x2="310" y2="110" className="widget-axis" />
        <polyline points={points} className="widget-line" />
        <circle cx="310" cy={lastY} r="4" className="widget-dot" />
      </svg>
      <div className="widget-controls">
        <button type="button" className="widget-btn" onClick={() => apply(0.001, 'A normal day')}>
          Next day
        </button>
        <button type="button" className="widget-btn" onClick={() => apply(0.06, 'Strong sales')}>
          Strong sales
        </button>
        <button type="button" className="widget-btn" onClick={() => apply(-0.06, 'Weak profit')}>
          Weak profit
        </button>
        <button
          type="button"
          className="widget-btn widget-btn--quiet"
          onClick={() => {
            setHistory(randomSeries(18, 0.001, 0.035));
            setLabel('No news yet');
          }}
        >
          New path
        </button>
      </div>
      <p className="widget-note">
        Most daily moves are noise. News can shift expectations, and the price can move before the news is fully known.
      </p>
    </div>
  );
}

interface CrowdPattern {
  title: string;
  copy: string;
  aria: string;
  values: number[];
  newsLevel?: number;
}

const CROWD_PATTERNS: CrowdPattern[] = [
  {
    title: 'Herding',
    copy: 'Buyers join because the crowd is buying.',
    aria: 'A price curve accelerating upward as more buyers join',
    values: [100, 101, 101.5, 102.5, 104, 107, 111, 117, 125],
  },
  {
    title: 'FOMO',
    copy: 'The rise itself becomes the reason to buy.',
    aria: 'A flat price followed by a sharp late rise',
    values: [100, 101, 100.5, 101.5, 102, 101.5, 103, 105, 119, 136],
  },
  {
    title: 'Momentum',
    copy: 'A move that keeps going, for a while.',
    aria: 'A steady upward price trend with small pullbacks',
    values: [100, 102, 101, 104, 106, 105, 108, 111, 114],
  },
  {
    title: 'Overreaction',
    copy: 'The price overshoots the news, then pulls back.',
    aria: 'A price spike above the news level followed by a pullback',
    values: [100, 102, 104, 106, 108, 124, 132, 126, 120],
    newsLevel: 108,
  },
];

const CROWD_CHART_WIDTH = 160;
const CROWD_CHART_HEIGHT = 64;
const CROWD_CHART_PAD = 6;

function crowdGeometry(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const xFor = (index: number) =>
    CROWD_CHART_PAD + (index / (values.length - 1)) * (CROWD_CHART_WIDTH - CROWD_CHART_PAD * 2);
  const yFor = (value: number) =>
    CROWD_CHART_HEIGHT - CROWD_CHART_PAD - ((value - min) / span) * (CROWD_CHART_HEIGHT - CROWD_CHART_PAD * 2);
  const points = values.map((value, index) => `${xFor(index)},${yFor(value)}`);
  return { points: points.join(' '), last: points[points.length - 1] ?? '154,32', yFor };
}

function CrowdPatterns() {
  return (
    <div className="learn-widget">
      <div className="widget-crowd-grid">
        {CROWD_PATTERNS.map((pattern) => {
          const chart = crowdGeometry(pattern.values);
          const [lastX = '154', lastY = '32'] = chart.last.split(',');

          return (
            <div className="widget-crowd-card" key={pattern.title}>
              <p className="widget-crowd-title">{pattern.title}</p>
              <svg className="widget-crowd-chart" viewBox="0 0 160 64" role="img" aria-label={pattern.aria}>
                {pattern.newsLevel !== undefined && (
                  <line
                    x1={CROWD_CHART_PAD}
                    x2={CROWD_CHART_WIDTH - CROWD_CHART_PAD}
                    y1={chart.yFor(pattern.newsLevel)}
                    y2={chart.yFor(pattern.newsLevel)}
                    className="widget-crowd-news"
                  />
                )}
                <polyline points={chart.points} className="widget-crowd-line" />
                <circle cx={lastX} cy={lastY} r="2.5" className="widget-crowd-dot" />
              </svg>
              <p className="widget-crowd-copy">{pattern.copy}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrderCosts() {
  const [shares, setShares] = useState(10);
  const [limit, setLimit] = useState(100);
  const [type, setType] = useState<'market' | 'limit'>('market');
  const sharesId = useId();
  const limitId = useId();
  const fill = type === 'market' ? 100.1 : limit >= 100.1 ? 100.1 : null;
  const total = fill === null ? null : fill * shares;

  return (
    <div className="learn-widget">
      <div className="widget-controls" role="group" aria-label="Order type">
        <button
          type="button"
          className={`widget-btn ${type === 'market' ? 'is-selected' : ''}`}
          aria-pressed={type === 'market'}
          onClick={() => setType('market')}
        >
          Market order
        </button>
        <button
          type="button"
          className={`widget-btn ${type === 'limit' ? 'is-selected' : ''}`}
          aria-pressed={type === 'limit'}
          onClick={() => setType('limit')}
        >
          Limit order
        </button>
      </div>
      <label className="widget-label" htmlFor={sharesId}>
        Shares: {shares}
      </label>
      <input
        id={sharesId}
        className="widget-slider"
        type="range"
        min="1"
        max="50"
        value={shares}
        onChange={(event) => setShares(Number(event.target.value))}
      />
      {type === 'limit' && (
        <>
          <label className="widget-label" htmlFor={limitId}>
            Your buy limit: {money(limit, true)}
          </label>
          <input
            id={limitId}
            className="widget-slider"
            type="range"
            min="98"
            max="102"
            step="0.05"
            value={limit}
            onChange={(event) => setLimit(Number(event.target.value))}
          />
        </>
      )}
      <div className="widget-readouts">
        <Readout label="Best sell price" value={money(100.1, true)} />
        <Readout label="Your fill" value={fill === null ? 'No fill yet' : money(fill, true)} />
        <Readout label="Total paid" value={total === null ? 'Nothing' : money(total, true)} />
        <Readout label="Commission" value={money(0, true)} />
      </div>
      <p className="widget-note">
        The quoted buy price is $100.00 and the quoted sell price is $100.10.
      </p>
    </div>
  );
}

type CandlePreset = 'up' | 'down' | 'flat';

const CANDLE_PATHS: Record<CandlePreset, number[]> = {
  up: [100, 99, 98, 99, 101, 102, 101, 103, 104, 103, 105, 104, 106, 105, 104, 103, 104, 105, 104, 104, 104],
  down: [104, 105, 106, 105, 103, 102, 101, 100, 99, 98, 97, 96, 97, 98, 99, 98, 100, 101, 100, 100, 100],
  flat: [100, 101, 102, 101, 100, 99, 98, 97, 98, 99, 100, 101, 102, 103, 102, 101, 100, 99, 100, 100, 100],
};

function candleX(index: number) {
  return 10 + index * 11;
}

function candleY(price: number) {
  return 140 - ((price - 94) / 16) * 120;
}

function CandleBuilder() {
  const [preset, setPreset] = useState<CandlePreset>('up');
  const [time, setTime] = useState(20);
  const sliderId = useId();
  const path = CANDLE_PATHS[preset];
  const visible = path.slice(0, time + 1);
  const open = path[0];
  const high = Math.max(...visible);
  const low = Math.min(...visible);
  const latest = visible[visible.length - 1];
  const isUp = latest >= open;
  const minutes = 570 + Math.round((390 / 20) * time);
  const clock = `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
  const points = visible.map((price, index) => `${candleX(index)},${candleY(price)}`).join(' ');
  const bodyTop = candleY(Math.max(open, latest));
  const bodyBottom = candleY(Math.min(open, latest));
  const bodyHeight = Math.max(2, bodyBottom - bodyTop);

  return (
    <div className="learn-widget">
      <div className="widget-readouts">
        <Readout label="Open" value={money(open, true)} />
        <Readout label="High so far" value={money(high, true)} />
        <Readout label="Low so far" value={money(low, true)} />
        <Readout label={time === 20 ? 'Close' : 'Latest'} value={money(latest, true)} />
      </div>
      <svg className="widget-chart-svg widget-chart-svg--tall" viewBox="0 0 340 160" role="img" aria-label="A candle forming beside the day's price line">
        <line x1="10" y1="140" x2="240" y2="140" className="widget-axis" />
        <polyline points={points} className="widget-line" />
        <line x1="295" y1={candleY(high)} x2="295" y2={candleY(low)} className="widget-wick" />
        <rect
          x="280"
          y={bodyTop}
          width="30"
          height={bodyHeight}
          className={isUp ? 'widget-candle widget-candle--up' : 'widget-candle widget-candle--down'}
        />
      </svg>
      <label className="widget-label" htmlFor={sliderId}>
        Time of day: {clock}
      </label>
      <input
        id={sliderId}
        className="widget-slider"
        type="range"
        min="0"
        max="20"
        value={time}
        onChange={(event) => setTime(Number(event.target.value))}
      />
      <div className="widget-controls" role="group" aria-label="Choose a day">
        <button type="button" className={`widget-btn ${preset === 'up' ? 'is-selected' : ''}`} onClick={() => setPreset('up')}>
          Up day
        </button>
        <button type="button" className={`widget-btn ${preset === 'down' ? 'is-selected' : ''}`} onClick={() => setPreset('down')}>
          Down day
        </button>
        <button type="button" className={`widget-btn ${preset === 'flat' ? 'is-selected' : ''}`} onClick={() => setPreset('flat')}>
          Indecisive day
        </button>
      </div>
    </div>
  );
}

function chartPoints(values: number[], min: number, max: number) {
  return values
    .map((value, index) => {
      const x = 10 + (index / (values.length - 1)) * 300;
      const y = 110 - ((value - min) / (max - min)) * 100;
      return `${x},${y}`;
    })
    .join(' ');
}

function autoChartPoints(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max(2, (max - min) * 0.12);
  return chartPoints(values, min - padding, max + padding);
}

function IndexCompare() {
  const [paths, setPaths] = useState(() => ({
    company: randomSeries(24, 0.003, 0.06),
    index: randomSeries(24, 0.002, 0.02),
  }));
  const { company, index } = paths;
  const companyReturn = ((company[company.length - 1] - 100) / 100) * 100;
  const indexReturn = ((index[index.length - 1] - 100) / 100) * 100;
  const companyFall = maxDrawdown(company);
  const indexFall = maxDrawdown(index);
  const allValues = [...company, ...index];
  const chartMin = Math.min(...allValues);
  const chartMax = Math.max(...allValues);
  const chartPadding = Math.max(2, (chartMax - chartMin) * 0.12);

  return (
    <div className="learn-widget">
      <div className="widget-readouts">
        <Readout label="Company return" value={percent(companyReturn)} />
        <Readout label="Index return" value={percent(indexReturn)} />
        <Readout label="Company worst fall" value={`${companyFall.toFixed(0)}%`} />
        <Readout label="Index worst fall" value={`${indexFall.toFixed(0)}%`} />
      </div>
      <svg className="widget-chart-svg" viewBox="0 0 320 120" role="img" aria-label="A company and a broad index over the same period">
        <line x1="10" y1="110" x2="310" y2="110" className="widget-axis" />
        <polyline points={chartPoints(company, chartMin - chartPadding, chartMax + chartPadding)} className="widget-line" />
        <polyline points={chartPoints(index, chartMin - chartPadding, chartMax + chartPadding)} className="widget-line widget-line--second" />
      </svg>
      <div className="widget-legend">
        <span className="widget-key widget-key--first">Northstar Coffee</span>
        <span className="widget-key widget-key--second">Broad index</span>
      </div>
      <div className="widget-controls">
        <button
          type="button"
          className="widget-btn"
          onClick={() => setPaths({ company: randomSeries(24, 0.003, 0.06), index: randomSeries(24, 0.002, 0.02) })}
        >
          Draw another company
        </button>
      </div>
      <p className="widget-note">
        A single company can beat the index. It can also fall much further. The index spreads one period across many companies.
      </p>
    </div>
  );
}

function Compound() {
  const [initial, setInitial] = useState(1000);
  const [rate, setRate] = useState(7);
  const [years, setYears] = useState(20);
  const initialId = useId();
  const rateId = useId();
  const yearsId = useId();
  const value = initial * Math.pow(1 + rate / 100, years);

  return (
    <div className="learn-widget">
      <div className="widget-readouts">
        <Readout label={`Value after ${years} years`} value={money(value)} />
        <Readout label="Yearly return" value={`${rate}%`} />
      </div>
      <label className="widget-label" htmlFor={initialId}>
        Starting amount: {money(initial)}
      </label>
      <input
        id={initialId}
        className="widget-slider"
        type="range"
        min="500"
        max="10000"
        step="500"
        value={initial}
        onChange={(event) => setInitial(Number(event.target.value))}
      />
      <label className="widget-label" htmlFor={rateId}>
        Assumed yearly return: {rate}%
      </label>
      <input
        id={rateId}
        className="widget-slider"
        type="range"
        min="0"
        max="10"
        step="1"
        value={rate}
        onChange={(event) => setRate(Number(event.target.value))}
      />
      <label className="widget-label" htmlFor={yearsId}>
        Holding period: {years} years
      </label>
      <input
        id={yearsId}
        className="widget-slider"
        type="range"
        min="1"
        max="40"
        value={years}
        onChange={(event) => setYears(Number(event.target.value))}
      />
      <div className="widget-table" role="table" aria-label="Value at three holding periods">
        {[10, 20, 30].map((period) => (
          <div className="widget-table-row" role="row" key={period}>
            <span role="cell">{period} years</span>
            <strong role="cell">{money(initial * Math.pow(1 + rate / 100, period))}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

const DRAWDOWN_PATH = [100, 105, 112, 108, 95, 82, 70, 58, 55, 60, 68, 75, 83, 91, 100];

function PlanBuilder() {
  const [years, setYears] = useState(20);
  const [fall, setFall] = useState(25);
  const yearsId = useId();
  const fallId = useId();
  const cash = fall >= 40 ? 'more cash' : fall >= 25 ? 'some cash' : 'less cash';
  const horizon = years >= 15 ? 'long' : years >= 7 ? 'medium' : 'short';

  return (
    <div className="learn-widget">
      <div className="widget-readouts">
        <Readout label="Time horizon" value={`${years} years`} />
        <Readout label="Fall you can sit through" value={`${fall}%`} />
      </div>
      <label className="widget-label" htmlFor={yearsId}>
        Years before you need the money: {years}
      </label>
      <input
        id={yearsId}
        className="widget-slider"
        type="range"
        min="1"
        max="40"
        value={years}
        onChange={(event) => setYears(Number(event.target.value))}
      />
      <label className="widget-label" htmlFor={fallId}>
        Temporary fall you can accept: {fall}%
      </label>
      <input
        id={fallId}
        className="widget-slider"
        type="range"
        min="10"
        max="50"
        step="5"
        value={fall}
        onChange={(event) => setFall(Number(event.target.value))}
      />
      <p className="widget-result">
        My plan: invest for {years} years, use broad funds, and keep {cash} so I can sit through a {fall}% fall.
      </p>
      <p className="widget-note">
        A {horizon} horizon can carry more risk, but only if the fall does not force a sale.
      </p>
    </div>
  );
}

function Drawdown() {
  const [time, setTime] = useState(7);
  const sliderId = useId();
  const current = DRAWDOWN_PATH[time];
  const peak = Math.max(...DRAWDOWN_PATH.slice(0, time + 1));
  const value = 1000 * (current / 100);
  const fall = ((current - peak) / peak) * 100;
  const points = chartPoints(DRAWDOWN_PATH, 50, 115);
  const markerX = 10 + (time / (DRAWDOWN_PATH.length - 1)) * 300;
  const markerY = 110 - ((current - 50) / 65) * 100;

  return (
    <div className="learn-widget">
      <div className="widget-readouts">
        <Readout label="You invested" value={money(1000)} />
        <Readout label="Holding now" value={money(value)} />
        <Readout label="From the peak" value={`${fall.toFixed(0)}%`} />
      </div>
      <svg className="widget-chart-svg" viewBox="0 0 320 120" role="img" aria-label="A fall and recovery path">
        <line x1="10" y1="110" x2="310" y2="110" className="widget-axis" />
        <polyline points={points} className="widget-line" />
        <circle cx={markerX} cy={markerY} r="5" className="widget-dot" />
      </svg>
      <label className="widget-label" htmlFor={sliderId}>
        Move through the episode
      </label>
      <input
        id={sliderId}
        className="widget-slider"
        type="range"
        min="0"
        max={DRAWDOWN_PATH.length - 1}
        value={time}
        onChange={(event) => setTime(Number(event.target.value))}
      />
      <p className="widget-note">The fall is measured from the peak, not from the starting value.</p>
    </div>
  );
}
