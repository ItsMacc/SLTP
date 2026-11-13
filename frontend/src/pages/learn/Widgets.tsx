// Widgets.tsx — Fixed data and small controls for the Level 1 lessons.

import { useId, useState } from 'react';
import type { WidgetId } from '../../learn/types';

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
    default:
      return null;
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

function CompanyStory() {
  const [invest, setInvest] = useState(1000);
  const [years, setYears] = useState(0);
  const [investor, setInvestor] = useState(false);
  const investId = useId();
  const yearsId = useId();
  const companyValue = invest + years * 120 + (investor ? 500 : 0);
  const stake = investor ? 70 : 100;
  const yourValue = (companyValue * stake) / 100;

  return (
    <div className="learn-widget">
      <div className="widget-readouts">
        <Readout label="You put in" value={money(invest)} />
        <Readout label="Company value" value={money(companyValue)} />
        <Readout label="Your stake" value={`${stake}%`} />
        <Readout label="Your share is worth" value={money(yourValue)} />
      </div>
      <label className="widget-label" htmlFor={investId}>
        Amount invested
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
      <label className="widget-label" htmlFor={yearsId}>
        Years the company trades
      </label>
      <input
        id={yearsId}
        className="widget-slider"
        type="range"
        min="0"
        max="5"
        step="1"
        value={years}
        onChange={(event) => setYears(Number(event.target.value))}
      />
      <div className="widget-controls">
        <button
          type="button"
          className="widget-btn"
          onClick={() => setInvestor(true)}
          disabled={investor}
        >
          {investor ? 'Outside investor owns 30%' : 'An outside investor buys 30%'}
        </button>
        <button
          type="button"
          className="widget-btn widget-btn--quiet"
          onClick={() => {
            setInvest(1000);
            setYears(0);
            setInvestor(false);
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function PriceNews() {
  const [history, setHistory] = useState([100]);
  const [label, setLabel] = useState('Start');
  const apply = (delta: number, nextLabel: string) => {
    setHistory((current) => [...current, current[current.length - 1] + delta]);
    setLabel(nextLabel);
  };
  const points = history
    .map((value, index) => {
      const x = history.length === 1 ? 10 : 10 + (index / (history.length - 1)) * 300;
      const y = 110 - ((value - 90) / 25) * 100;
      return `${x},${y}`;
    })
    .join(' ');
  const current = history[history.length - 1];

  return (
    <div className="learn-widget">
      <div className="widget-readouts">
        <Readout label="Share price" value={money(current, true)} />
        <Readout label="Last news" value={label} />
      </div>
      <svg className="widget-chart-svg" viewBox="0 0 320 120" role="img" aria-label="A fixed price path responding to news">
        <line x1="10" y1="110" x2="310" y2="110" className="widget-axis" />
        <polyline points={points} className="widget-line" />
        <circle
          cx={history.length === 1 ? 10 : 310}
          cy={110 - ((current - 90) / 25) * 100}
          r="4"
          className="widget-dot"
        />
      </svg>
      <div className="widget-controls">
        <button type="button" className="widget-btn" onClick={() => apply(6, 'Strong sales')}>
          Strong sales
        </button>
        <button type="button" className="widget-btn" onClick={() => apply(-5, 'Weak profit')}>
          Weak profit
        </button>
        <button type="button" className="widget-btn" onClick={() => apply(0, 'No news')}>
          No news
        </button>
        <button
          type="button"
          className="widget-btn widget-btn--quiet"
          onClick={() => {
            setHistory([100]);
            setLabel('Start');
          }}
        >
          Reset
        </button>
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

function IndexCompare() {
  const stock = [100, 112, 108, 126, 118, 142, 136, 154, 148, 166, 160, 184];
  const index = [100, 105, 102, 110, 107, 116, 113, 122, 119, 128, 125, 138];
  const [guess, setGuess] = useState<'stock' | 'index' | null>(null);
  const stockFinal = stock[stock.length - 1];
  const indexFinal = index[index.length - 1];

  return (
    <div className="learn-widget">
      <p className="widget-note">Which holding ended higher over this fixed period?</p>
      <div className="widget-controls" role="group" aria-label="Your guess">
        <button type="button" className={`widget-btn ${guess === 'stock' ? 'is-selected' : ''}`} onClick={() => setGuess('stock')}>
          The single stock
        </button>
        <button type="button" className={`widget-btn ${guess === 'index' ? 'is-selected' : ''}`} onClick={() => setGuess('index')}>
          The index
        </button>
      </div>
      <svg className="widget-chart-svg" viewBox="0 0 320 120" role="img" aria-label="A single stock and a broad index over the same period">
        <line x1="10" y1="110" x2="310" y2="110" className="widget-axis" />
        <polyline points={chartPoints(stock, 90, 190)} className="widget-line" />
        <polyline points={chartPoints(index, 90, 190)} className="widget-line widget-line--second" />
      </svg>
      <div className="widget-legend">
        <span className="widget-key widget-key--first">Single stock</span>
        <span className="widget-key widget-key--second">Broad index</span>
      </div>
      {guess && (
        <p className="widget-result">
          {guess === 'stock' ? 'The single stock' : 'The index'} finished at{' '}
          {money(guess === 'stock' ? stockFinal : indexFinal)}. The stock finished at {money(stockFinal)} and the index at {money(indexFinal)}.
        </p>
      )}
      <p className="widget-note">Illustrative values. This is not a recommendation.</p>
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
      <p className="widget-note">The return is an assumption, not a forecast.</p>
    </div>
  );
}

const DRAWDOWN_PATH = [100, 105, 112, 108, 95, 82, 70, 58, 55, 60, 68, 75, 83, 91, 100];

function Drawdown() {
  const [time, setTime] = useState(7);
  const sliderId = useId();
  const current = DRAWDOWN_PATH[time];
  const value = 1000 * (current / 100);
  const fall = ((current - 100) / 100) * 100;
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
      <svg className="widget-chart-svg" viewBox="0 0 320 120" role="img" aria-label="A fixed fall and recovery path">
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
      <p className="widget-note">Illustrative path. A real fall can last longer than this one.</p>
    </div>
  );
}
