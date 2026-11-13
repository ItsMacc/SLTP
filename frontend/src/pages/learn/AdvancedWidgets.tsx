// AdvancedWidgets.tsx — One small visual per Advanced lesson. These are kept
// separate from the Beginner and Intermediate widgets so each idea has its
// own control instead of recycling an older chart.

import { useState } from 'react';
import type { WidgetId } from '../../learn/types';

const pct = (value: number, digits = 0) => `${value > 0 ? '+' : ''}${value.toFixed(digits)}%`;
const money = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

function Value({ label, value }: { label: string; value: string }) {
  return (
    <div className="widget-readout">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function advPoints(values: number[], min = Math.min(...values), max = Math.max(...values)) {
  const pad = Math.max(1, (max - min) * 0.12);
  return values
    .map((value, index) => {
      const x = 10 + (index / Math.max(1, values.length - 1)) * 300;
      const y = 110 - ((value - (min - pad)) / (max - min + pad * 2)) * 100;
      return `${x},${y}`;
    })
    .join(' ');
}

function MiniChart({ values, second, label }: { values: number[]; second?: number[]; label: string }) {
  const all = second ? [...values, ...second] : values;
  const min = Math.min(...all);
  const max = Math.max(...all);
  return (
    <svg className="widget-chart-svg" viewBox="0 0 320 120" role="img" aria-label={label}>
      <line x1="10" y1="110" x2="310" y2="110" className="widget-axis" />
      <polyline points={advPoints(values, min, max)} className="widget-line" />
      {second && <polyline points={advPoints(second, min, max)} className="widget-line widget-line--second" />}
    </svg>
  );
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function correlation(first: number[], second: number[]) {
  const firstMean = average(first);
  const secondMean = average(second);
  const covariance = average(first.map((value, index) => (value - firstMean) * (second[index] - secondMean)));
  return covariance / Math.sqrt(standardDeviation(first) ** 2 * standardDeviation(second) ** 2);
}

function standardDeviation(values: number[]) {
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
}

export function AdvancedLessonWidget({ id }: { id: WidgetId }) {
  switch (id) {
    case 'return-split':
      return <ReturnSplit />;
    case 'average-window':
      return <AverageWindow />;
    case 'volatility-compare':
      return <VolatilityCompare />;
    case 'z-score-lab':
      return <ZScoreLab />;
    case 'expectancy-lab':
      return <ExpectancyLab />;
    case 'correlation-pairs':
      return <CorrelationPairs />;
    case 'hypothesis-loop':
      return <HypothesisLoop />;
    case 'indicator-anatomy':
      return <IndicatorAnatomy />;
    case 'ma-crossover':
      return <MaCrossover />;
    case 'rsi-gauge':
      return <RsiGauge />;
    case 'atr-volume':
      return <AtrVolume />;
    case 'redundant-signals':
      return <RedundantSignals />;
    case 'trend-pattern':
      return <TrendPattern />;
    case 'bounce-pattern':
      return <BouncePattern />;
    case 'breakout-range':
      return <BreakoutRange />;
    case 'noise-decay':
      return <NoiseDecay />;
    case 'long-short':
      return <LongShort />;
    case 'rule-anatomy':
      return <RuleAnatomy />;
    case 'exposure-limits':
      return <ExposureLimits />;
    case 'position-size':
      return <PositionSize />;
    case 'exit-planner':
      return <ExitPlanner />;
    case 'market-filter':
      return <MarketFilter />;
    case 'strategy-card':
      return <StrategyCard />;
    default:
      return null;
  }
}

function ReturnSplit() {
  const [start, setStart] = useState(100);
  const [end, setEnd] = useState(50);
  const change = ((end - start) / start) * 100;
  const recovery = end < start ? ((start - end) / end) * 100 : 0;

  return (
    <div className="learn-widget">
      <div className="widget-readouts">
        <Value label="Start price" value={money(start)} />
        <Value label="Current price" value={money(end)} />
        <Value label="Return" value={pct(change)} />
        <Value label="Gain needed" value={pct(recovery)} />
      </div>
      <label className="widget-label" htmlFor="return-start">Start price: {money(start)}</label>
      <input id="return-start" className="widget-slider" type="range" min="20" max="200" step="10" value={start} onChange={(event) => setStart(Number(event.target.value))} />
      <label className="widget-label" htmlFor="return-end">Current price: {money(end)}</label>
      <input id="return-end" className="widget-slider" type="range" min="10" max="200" step="10" value={end} onChange={(event) => setEnd(Number(event.target.value))} />
      <p className="widget-note">The recovery is measured from the current price. A fall from $100 to $50 needs a 100% gain, because $50 has to double.</p>
    </div>
  );
}

const AVERAGE_PATH = [100, 102, 101, 104, 106, 105, 108, 111, 109, 113, 116, 114, 118, 121, 120, 124, 127, 126, 130, 133];

function AverageWindow() {
  const [windowSize, setWindowSize] = useState(5);
  const moving = AVERAGE_PATH.map((_, index) =>
    average(AVERAGE_PATH.slice(Math.max(0, index - windowSize + 1), index + 1)),
  );

  return (
    <div className="learn-widget">
      <div className="widget-readouts">
        <Value label="Window" value={`${windowSize} days`} />
        <Value label="Latest price" value={money(AVERAGE_PATH[AVERAGE_PATH.length - 1])} />
        <Value label="Latest average" value={money(moving[moving.length - 1])} />
      </div>
      <MiniChart values={AVERAGE_PATH} second={moving} label="A price path with a moving average" />
      <div className="widget-legend">
        <span className="widget-key widget-key--first">Price</span>
        <span className="widget-key widget-key--second">Moving average</span>
      </div>
      <label className="widget-label" htmlFor="average-window">Window: {windowSize} days</label>
      <input id="average-window" className="widget-slider" type="range" min="3" max="15" value={windowSize} onChange={(event) => setWindowSize(Number(event.target.value))} />
      <p className="widget-note">A larger window keeps older prices in the calculation. The line becomes smoother, but it turns later.</p>
    </div>
  );
}

const CALM_PATH = [100, 100.4, 100.2, 100.8, 100.6, 101.2, 101, 101.5, 101.3, 101.8, 101.6, 102];
const CHOPPY_PATH = [100, 103, 99, 105, 98, 106, 97, 108, 99, 104, 96, 107];

function VolatilityCompare() {
  const [choppy, setChoppy] = useState(false);
  const path = choppy ? CHOPPY_PATH : CALM_PATH;
  const returns = path.slice(1).map((value, index) => ((value - path[index]) / path[index]) * 100);
  const daily = standardDeviation(returns);
  const yearly = daily * Math.sqrt(252);

  return (
    <div className="learn-widget">
      <div className="widget-readouts">
        <Value label="Daily standard deviation" value={`${daily.toFixed(2)}%`} />
        <Value label="Annualised" value={`${yearly.toFixed(1)}%`} />
        <Value label="Path" value={choppy ? 'Choppy' : 'Calm'} />
      </div>
      <MiniChart values={path} label="Two price paths with different daily swings" />
      <div className="widget-controls" role="group" aria-label="Choose a price path">
        <button type="button" className={`widget-btn ${!choppy ? 'is-selected' : ''}`} aria-pressed={!choppy} onClick={() => setChoppy(false)}>Calm path</button>
        <button type="button" className={`widget-btn ${choppy ? 'is-selected' : ''}`} aria-pressed={choppy} onClick={() => setChoppy(true)}>Choppy path</button>
      </div>
      <p className="widget-note">Both paths end near the same place. The choppy one has much wider daily returns, so its standard deviation is larger.</p>
    </div>
  );
}

function ZScoreLab() {
  const [move, setMove] = useState(2);
  const [volatileMarket, setVolatileMarket] = useState(false);
  const spread = volatileMarket ? 2 : 1;
  const z = move / spread;

  return (
    <div className="learn-widget">
      <div className="widget-readouts">
        <Value label="Daily move" value={`${move.toFixed(1)}%`} />
        <Value label="Typical spread" value={`${spread.toFixed(1)}%`} />
        <Value label="Z-score" value={z.toFixed(1)} />
      </div>
      <label className="widget-label" htmlFor="z-move">Daily move: {move.toFixed(1)}%</label>
      <input id="z-move" className="widget-slider" type="range" min="0.5" max="5" step="0.5" value={move} onChange={(event) => setMove(Number(event.target.value))} />
      <div className="widget-controls" role="group" aria-label="Choose a market">
        <button type="button" className={`widget-btn ${!volatileMarket ? 'is-selected' : ''}`} aria-pressed={!volatileMarket} onClick={() => setVolatileMarket(false)}>Calm market</button>
        <button type="button" className={`widget-btn ${volatileMarket ? 'is-selected' : ''}`} aria-pressed={volatileMarket} onClick={() => setVolatileMarket(true)}>Volatile market</button>
      </div>
      <p className="widget-result">{z >= 2 ? 'This move is far from the recent average.' : z <= -2 ? 'This move is far below the recent average.' : 'This move sits inside the usual range.'}</p>
      <p className="widget-note">A z-score measures distance in standard deviations. A 2% move is a z-score of 2 in a calm market and 1 in a market with a 2% spread.</p>
    </div>
  );
}

function ExpectancyLab() {
  const [winRate, setWinRate] = useState(40);
  const [averageWin, setAverageWin] = useState(300);
  const [averageLoss, setAverageLoss] = useState(100);
  const lossRate = (100 - winRate) / 100;
  const expectancy = (winRate / 100) * averageWin - lossRate * averageLoss;
  const streak = (lossRate ** 5) * 100;

  return (
    <div className="learn-widget">
      <div className="widget-readouts">
        <Value label="Expectancy" value={money(expectancy)} />
        <Value label="Five losses in a row" value={`${streak.toFixed(1)}%`} />
      </div>
      <label className="widget-label" htmlFor="win-rate">Win rate: {winRate}%</label>
      <input id="win-rate" className="widget-slider" type="range" min="20" max="80" step="5" value={winRate} onChange={(event) => setWinRate(Number(event.target.value))} />
      <label className="widget-label" htmlFor="average-win">Average win: {money(averageWin)}</label>
      <input id="average-win" className="widget-slider" type="range" min="100" max="500" step="25" value={averageWin} onChange={(event) => setAverageWin(Number(event.target.value))} />
      <label className="widget-label" htmlFor="average-loss">Average loss: {money(averageLoss)}</label>
      <input id="average-loss" className="widget-slider" type="range" min="50" max="400" step="25" value={averageLoss} onChange={(event) => setAverageLoss(Number(event.target.value))} />
      <p className="widget-note">Expectancy combines the odds with the payoff. A high win rate can still lose money when the average loss is large.</p>
    </div>
  );
}

function CorrelationPairs() {
  const [mode, setMode] = useState<'together' | 'opposite' | 'apart'>('together');
  const together = [100, 103, 102, 106, 105, 109, 108, 112, 111, 115];
  const opposite = [100, 97, 99, 95, 96, 92, 94, 90, 91, 87];
  const apart = [100, 97, 102, 99, 104, 100, 103, 98, 102, 100];
  const second = mode === 'together' ? together.map((v) => v + 2) : mode === 'opposite' ? opposite : apart;
  const r = correlation(together, second);

  return (
    <div className="learn-widget">
      <div className="widget-readouts">
        <Value label="Correlation" value={`${r >= 0 ? '+' : ''}${r.toFixed(2)}`} />
        <Value label="Pair" value={mode === 'together' ? 'Moves together' : mode === 'opposite' ? 'Moves apart' : 'Little relation'} />
      </div>
      <MiniChart values={together} second={second} label="Two series with different correlation" />
      <div className="widget-controls" role="group" aria-label="Choose a pair">
        <button type="button" className={`widget-btn ${mode === 'together' ? 'is-selected' : ''}`} aria-pressed={mode === 'together'} onClick={() => setMode('together')}>Together</button>
        <button type="button" className={`widget-btn ${mode === 'opposite' ? 'is-selected' : ''}`} aria-pressed={mode === 'opposite'} onClick={() => setMode('opposite')}>Opposite</button>
        <button type="button" className={`widget-btn ${mode === 'apart' ? 'is-selected' : ''}`} aria-pressed={mode === 'apart'} onClick={() => setMode('apart')}>Independent</button>
      </div>
      <p className="widget-note">A coefficient near +1 means the pair tends to move together. Near -1 means it tends to move apart.</p>
    </div>
  );
}

const HYPOTHESIS_STEPS = [
  ['Notice', 'A stock keeps holding above its 20-day average after a pullback.'],
  ['Explain', 'Buyers may treat the average as a sign that the trend is still intact.'],
  ['State', 'Large stocks that close above a rising 20-day average tend to rise over the next 10 days.'],
  ['Define', 'Write the entry, exit, size and test period before looking at the result.'],
  ['Test', 'Check the result after costs and decide whether the idea earned another test.'],
];

function HypothesisLoop() {
  const [step, setStep] = useState(0);
  const [title, text] = HYPOTHESIS_STEPS[step];

  return (
    <div className="learn-widget">
      <div className="widget-readouts">
        <Value label="Step" value={`${step + 1} of ${HYPOTHESIS_STEPS.length}`} />
        <Value label="Focus" value={title} />
      </div>
      <p className="widget-result">{text}</p>
      <div className="widget-controls">
        <button type="button" className="widget-btn widget-btn--quiet" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
        <button type="button" className="widget-btn" disabled={step === HYPOTHESIS_STEPS.length - 1} onClick={() => setStep(step + 1)}>Next step</button>
      </div>
      <p className="widget-note">A hypothesis is useful when the result could prove it wrong.</p>
    </div>
  );
}

const INDICATOR_TYPES = {
  trend: { question: 'Is the price above its recent average?', input: 'Daily closes', formula: 'Average of the last N closes', output: 'A moving average line' },
  momentum: { question: 'How fast has the price moved?', input: 'Recent gains and losses', formula: 'Compare average gain with average loss', output: 'A reading from 0 to 100' },
  activity: { question: 'Is trading busier than usual?', input: 'Daily volume', formula: 'Today volume divided by recent average', output: 'A relative volume number' },
} as const;

function IndicatorAnatomy() {
  const [kind, setKind] = useState<keyof typeof INDICATOR_TYPES>('trend');
  const data = INDICATOR_TYPES[kind];

  return (
    <div className="learn-widget">
      <div className="widget-readouts">
        <Value label="Input" value={data.input} />
        <Value label="Output" value={data.output} />
      </div>
      <p className="widget-result">{data.question}</p>
      <p className="widget-note">Formula: {data.formula}.</p>
      <div className="widget-controls" role="group" aria-label="Choose an indicator question">
        {(['trend', 'momentum', 'activity'] as const).map((key) => (
          <button key={key} type="button" className={`widget-btn ${kind === key ? 'is-selected' : ''}`} aria-pressed={kind === key} onClick={() => setKind(key)}>
            {key[0].toUpperCase() + key.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}

const MA_PRICE = [100, 102, 101, 104, 106, 105, 108, 111, 109, 113, 116, 114, 118, 121, 120, 124, 127, 126, 130, 133, 131, 135, 138, 137, 141, 144, 142, 146, 149, 148];

function MaCrossover() {
  const [slowWindow, setSlowWindow] = useState(20);
  const fastWindow = 5;
  const fast = MA_PRICE.map((_, index) => average(MA_PRICE.slice(Math.max(0, index - fastWindow + 1), index + 1)));
  const slow = MA_PRICE.map((_, index) => average(MA_PRICE.slice(Math.max(0, index - slowWindow + 1), index + 1)));
  const above = fast[fast.length - 1] > slow[slow.length - 1];

  return (
    <div className="learn-widget">
      <div className="widget-readouts">
        <Value label="Fast average" value={money(fast[fast.length - 1])} />
        <Value label="Slow average" value={money(slow[slow.length - 1])} />
        <Value label="Position" value={above ? 'Fast above slow' : 'Fast below slow'} />
      </div>
      <MiniChart values={slow} second={fast} label="A fast and a slow moving average" />
      <div className="widget-legend">
        <span className="widget-key widget-key--first">Slow average</span>
        <span className="widget-key widget-key--second">Fast average</span>
      </div>
      <label className="widget-label" htmlFor="slow-window">Slow window: {slowWindow} days</label>
      <input id="slow-window" className="widget-slider" type="range" min="10" max="25" value={slowWindow} onChange={(event) => setSlowWindow(Number(event.target.value))} />
      <p className="widget-note">The crossover is the crossing point. A faster average gets there sooner, but it can also cross back more often.</p>
    </div>
  );
}

function RsiGauge() {
  const [rsi, setRsi] = useState(55);
  const label = rsi >= 70 ? 'Overbought' : rsi <= 30 ? 'Oversold' : 'Middle range';

  return (
    <div className="learn-widget">
      <div className="widget-readouts">
        <Value label="RSI" value={rsi.toFixed(0)} />
        <Value label="Zone" value={label} />
      </div>
      <div className="widget-table" role="table" aria-label="RSI zones">
        <div className="widget-table-row" role="row"><span role="cell">0 to 30</span><strong role="cell">Oversold</strong></div>
        <div className="widget-table-row" role="row"><span role="cell">30 to 70</span><strong role="cell">Middle range</strong></div>
        <div className="widget-table-row" role="row"><span role="cell">70 to 100</span><strong role="cell">Overbought</strong></div>
      </div>
      <label className="widget-label" htmlFor="rsi-value">RSI reading: {rsi}</label>
      <input id="rsi-value" className="widget-slider" type="range" min="5" max="95" value={rsi} onChange={(event) => setRsi(Number(event.target.value))} />
      <p className="widget-note">The zone describes recent momentum. It does not say the price must reverse.</p>
    </div>
  );
}

function AtrVolume() {
  const [active, setActive] = useState(false);
  const values = active ? { band: 'Wide', atr: '$3.20', volume: '1.8×' } : { band: 'Narrow', atr: '$1.10', volume: '1.0×' };

  return (
    <div className="learn-widget">
      <div className="widget-readouts">
        <Value label="Band width" value={values.band} />
        <Value label="Average true range" value={values.atr} />
        <Value label="Relative volume" value={values.volume} />
      </div>
      <div className="widget-controls" role="group" aria-label="Choose a market state">
        <button type="button" className={`widget-btn ${!active ? 'is-selected' : ''}`} aria-pressed={!active} onClick={() => setActive(false)}>Calm market</button>
        <button type="button" className={`widget-btn ${active ? 'is-selected' : ''}`} aria-pressed={active} onClick={() => setActive(true)}>Active market</button>
      </div>
      <p className="widget-result">{active ? 'A wider day range and heavier volume describe an active market.' : 'A narrow band and normal volume describe a quiet market.'}</p>
      <p className="widget-note">These measures describe movement and activity. They do not say which direction the next close will take.</p>
    </div>
  );
}

function RedundantSignals() {
  const [second, setSecond] = useState<'none' | 'rsi' | 'volume'>('rsi');
  const score = second === 'none' ? 0 : second === 'rsi' ? 82 : 28;

  return (
    <div className="learn-widget">
      <div className="widget-readouts">
        <Value label="First signal" value="20-day average" />
        <Value label="Second signal" value={second === 'none' ? 'None' : second === 'rsi' ? 'RSI' : 'Volume'} />
        <Value label="Overlap" value={`${score}%`} />
      </div>
      <div className="widget-controls" role="group" aria-label="Add a second signal">
        <button type="button" className={`widget-btn ${second === 'none' ? 'is-selected' : ''}`} aria-pressed={second === 'none'} onClick={() => setSecond('none')}>None</button>
        <button type="button" className={`widget-btn ${second === 'rsi' ? 'is-selected' : ''}`} aria-pressed={second === 'rsi'} onClick={() => setSecond('rsi')}>Add RSI</button>
        <button type="button" className={`widget-btn ${second === 'volume' ? 'is-selected' : ''}`} aria-pressed={second === 'volume'} onClick={() => setSecond('volume')}>Add volume</button>
      </div>
      <p className="widget-result">{score >= 70 ? 'High overlap: the second signal mostly repeats the first.' : score > 0 ? 'Lower overlap: the second signal adds different information.' : 'One signal. No redundancy yet.'}</p>
      <p className="widget-note">More lines are not the same as more evidence. A different data source is more useful than another price measure.</p>
    </div>
  );
}

const TREND_PATH = [100, 102, 101, 105, 108, 106, 111, 115, 113, 118, 121, 119, 124, 128, 126, 131];
const RANGE_PATH = [100, 105, 101, 104, 100, 106, 102, 105, 101, 104, 100, 105, 101, 104, 100, 103];

function TrendPattern() {
  const [range, setRange] = useState(false);
  const path = range ? RANGE_PATH : TREND_PATH;

  return (
    <div className="learn-widget">
      <div className="widget-readouts">
        <Value label="Pattern" value={range ? 'Sideways range' : 'Higher highs'} />
        <Value label="Result" value={range ? 'False starts' : 'Trend continues'} />
      </div>
      <MiniChart values={path} label="A trend path beside a sideways path" />
      <div className="widget-controls" role="group" aria-label="Choose a price pattern">
        <button type="button" className={`widget-btn ${!range ? 'is-selected' : ''}`} aria-pressed={!range} onClick={() => setRange(false)}>Trend</button>
        <button type="button" className={`widget-btn ${range ? 'is-selected' : ''}`} aria-pressed={range} onClick={() => setRange(true)}>Sideways</button>
      </div>
      <p className="widget-note">The same trend rule can make money in the first path and suffer repeated small losses in the second.</p>
    </div>
  );
}

const BOUNCE_PATH = [100, 96, 92, 88, 84, 80, 82, 84, 83, 86, 85, 84];

function BouncePattern() {
  const [day, setDay] = useState(6);
  const current = BOUNCE_PATH[day];
  const fromLow = ((current - 80) / 80) * 100;
  const fromHigh = ((current - 100) / 100) * 100;

  return (
    <div className="learn-widget">
      <div className="widget-readouts">
        <Value label="Price" value={money(current)} />
        <Value label="From the low" value={pct(fromLow)} />
        <Value label="From the high" value={pct(fromHigh)} />
      </div>
      <MiniChart values={BOUNCE_PATH} label="A fall followed by a weak bounce" />
      <label className="widget-label" htmlFor="bounce-day">Day of the bounce: {day}</label>
      <input id="bounce-day" className="widget-slider" type="range" min="0" max={BOUNCE_PATH.length - 1} value={day} onChange={(event) => setDay(Number(event.target.value))} />
      <p className="widget-note">A gain from the low can still leave the price below the old high. The bounce is not a full recovery.</p>
    </div>
  );
}

const BREAKOUT_PATH = [100, 103, 101, 105, 102, 106, 104, 107, 105, 108, 106, 109];

function BreakoutRange() {
  const [holds, setHolds] = useState(true);
  const path = holds ? BREAKOUT_PATH : [...BREAKOUT_PATH.slice(0, 8), 104, 102, 105, 101];

  return (
    <div className="learn-widget">
      <div className="widget-readouts">
        <Value label="Resistance" value="$106" />
        <Value label="Result" value={holds ? 'Holds above' : 'Falls back'} />
      </div>
      <svg className="widget-chart-svg" viewBox="0 0 320 120" role="img" aria-label="A breakout that holds or fails">
        <line x1="10" y1="110" x2="310" y2="110" className="widget-axis" />
        <line x1="10" y1="42" x2="310" y2="42" className="widget-crowd-news" />
        <polyline points={advPoints(path)} className="widget-line" />
      </svg>
      <div className="widget-controls" role="group" aria-label="Choose a breakout result">
        <button type="button" className={`widget-btn ${holds ? 'is-selected' : ''}`} aria-pressed={holds} onClick={() => setHolds(true)}>Breakout holds</button>
        <button type="button" className={`widget-btn ${!holds ? 'is-selected' : ''}`} aria-pressed={!holds} onClick={() => setHolds(false)}>False breakout</button>
      </div>
      <p className="widget-note">The dashed line is resistance. A close above it is the signal; a quick return below it is the failure.</p>
    </div>
  );
}

function NoiseDecay() {
  const [edge, setEdge] = useState(6);
  const [cost, setCost] = useState(2);
  const net = edge - cost;

  return (
    <div className="learn-widget">
      <div className="widget-readouts">
        <Value label="Raw edge" value={`${edge.toFixed(1)}%`} />
        <Value label="Round-trip cost" value={`${cost.toFixed(1)}%`} />
        <Value label="Net edge" value={`${net.toFixed(1)}%`} />
      </div>
      <label className="widget-label" htmlFor="raw-edge">Raw edge: {edge.toFixed(1)}%</label>
      <input id="raw-edge" className="widget-slider" type="range" min="0" max="10" step="0.5" value={edge} onChange={(event) => setEdge(Number(event.target.value))} />
      <label className="widget-label" htmlFor="round-cost">Round-trip cost: {cost.toFixed(1)}%</label>
      <input id="round-cost" className="widget-slider" type="range" min="0" max="6" step="0.5" value={cost} onChange={(event) => setCost(Number(event.target.value))} />
      <p className="widget-result">{net <= 0 ? 'The pattern is not large enough to pay for trading it.' : 'The pattern still has a positive net result.'}</p>
    </div>
  );
}

function LongShort() {
  const [side, setSide] = useState<'long' | 'short'>('long');
  const [price, setPrice] = useState(50);
  const entry = 50;
  const shares = 100;
  const pnl = (side === 'long' ? price - entry : entry - price) * shares;

  return (
    <div className="learn-widget">
      <div className="widget-readouts">
        <Value label="Position" value={side === 'long' ? 'Long 100 shares' : 'Short 100 shares'} />
        <Value label="Exit price" value={money(price)} />
        <Value label="Profit or loss" value={money(pnl)} />
      </div>
      <label className="widget-label" htmlFor="exit-price">Exit price: {money(price)}</label>
      <input id="exit-price" className="widget-slider" type="range" min="20" max="80" step="5" value={price} onChange={(event) => setPrice(Number(event.target.value))} />
      <div className="widget-controls" role="group" aria-label="Choose a position">
        <button type="button" className={`widget-btn ${side === 'long' ? 'is-selected' : ''}`} aria-pressed={side === 'long'} onClick={() => setSide('long')}>Long</button>
        <button type="button" className={`widget-btn ${side === 'short' ? 'is-selected' : ''}`} aria-pressed={side === 'short'} onClick={() => setSide('short')}>Short</button>
      </div>
      <p className="widget-note">The long loses at most the amount invested. The short can lose more as the price rises.</p>
    </div>
  );
}

const ENTRY_RULES = ['Close above the 20-day average', '20-day high', 'RSI below 30'];
const EXIT_RULES = ['Close below the 20-day average', '10% fall from entry', 'RSI above 70'];
const SIZES = ['1% risk per trade', '5% of the account', '20 shares'];

function RuleAnatomy() {
  const [entry, setEntry] = useState(0);
  const [exit, setExit] = useState(0);
  const [size, setSize] = useState(0);

  return (
    <div className="learn-widget">
      <p className="widget-result">
        Buy when {ENTRY_RULES[entry].toLowerCase()}. Sell when {EXIT_RULES[exit].toLowerCase()}. Use {SIZES[size].toLowerCase()}.
      </p>
      <div className="widget-controls" role="group" aria-label="Entry rule">
        {ENTRY_RULES.map((rule, index) => (
          <button key={rule} type="button" className={`widget-btn ${entry === index ? 'is-selected' : ''}`} aria-pressed={entry === index} onClick={() => setEntry(index)}>{rule}</button>
        ))}
      </div>
      <div className="widget-controls" role="group" aria-label="Exit rule">
        {EXIT_RULES.map((rule, index) => (
          <button key={rule} type="button" className={`widget-btn ${exit === index ? 'is-selected' : ''}`} aria-pressed={exit === index} onClick={() => setExit(index)}>{rule}</button>
        ))}
      </div>
      <div className="widget-controls" role="group" aria-label="Size rule">
        {SIZES.map((rule, index) => (
          <button key={rule} type="button" className={`widget-btn ${size === index ? 'is-selected' : ''}`} aria-pressed={size === index} onClick={() => setSize(index)}>{rule}</button>
        ))}
      </div>
      <p className="widget-note">The sentence is only complete when the entry, exit and size are all stated.</p>
    </div>
  );
}

function ExposureLimits() {
  const [positions, setPositions] = useState(8);
  const [perPosition, setPerPosition] = useState(10);
  const exposure = positions * perPosition;
  const cash = 100 - exposure;

  return (
    <div className="learn-widget">
      <div className="widget-readouts">
        <Value label="Positions" value={String(positions)} />
        <Value label="Exposure" value={`${exposure}%`} />
        <Value label="Cash reserve" value={`${Math.max(0, cash)}%`} />
      </div>
      <label className="widget-label" htmlFor="position-count">Positions: {positions}</label>
      <input id="position-count" className="widget-slider" type="range" min="1" max="12" value={positions} onChange={(event) => setPositions(Number(event.target.value))} />
      <label className="widget-label" htmlFor="per-position">Each position: {perPosition}%</label>
      <input id="per-position" className="widget-slider" type="range" min="5" max="20" step="5" value={perPosition} onChange={(event) => setPerPosition(Number(event.target.value))} />
      <p className="widget-result">{exposure > 100 ? 'This plan is over the account limit.' : cash < 10 ? 'The cash reserve is below 10%.' : 'The plan stays inside the account.'}</p>
    </div>
  );
}

function PositionSize() {
  const [account, setAccount] = useState(10000);
  const [riskPercent, setRiskPercent] = useState(1);
  const [stopDistance, setStopDistance] = useState(2);
  const risk = (account * riskPercent) / 100;
  const shares = Math.floor(risk / stopDistance);
  const value = shares * 50;

  return (
    <div className="learn-widget">
      <div className="widget-readouts">
        <Value label="Risk budget" value={money(risk)} />
        <Value label="Shares" value={String(shares)} />
        <Value label="Position value" value={money(value)} />
      </div>
      <label className="widget-label" htmlFor="account-size">Account: {money(account)}</label>
      <input id="account-size" className="widget-slider" type="range" min="5000" max="100000" step="5000" value={account} onChange={(event) => setAccount(Number(event.target.value))} />
      <label className="widget-label" htmlFor="risk-percent">Risk per trade: {riskPercent}%</label>
      <input id="risk-percent" className="widget-slider" type="range" min="0.5" max="2" step="0.5" value={riskPercent} onChange={(event) => setRiskPercent(Number(event.target.value))} />
      <label className="widget-label" htmlFor="stop-distance">Stop distance: ${stopDistance}</label>
      <input id="stop-distance" className="widget-slider" type="range" min="1" max="8" value={stopDistance} onChange={(event) => setStopDistance(Number(event.target.value))} />
      <p className="widget-note">Shares equal the risk budget divided by the stop distance. The entry is assumed to be $50.</p>
    </div>
  );
}

function ExitPlanner() {
  const [stop, setStop] = useState(48);
  const [target, setTarget] = useState(56);
  const entry = 50;
  const risk = entry - stop;
  const reward = target - entry;
  const ratio = reward / risk;
  const breakEven = (1 / (1 + ratio)) * 100;

  return (
    <div className="learn-widget">
      <div className="widget-readouts">
        <Value label="Risk" value={money(risk)} />
        <Value label="Reward" value={money(reward)} />
        <Value label="Risk-to-reward" value={`${ratio.toFixed(1)}:1`} />
        <Value label="Break-even win rate" value={`${breakEven.toFixed(0)}%`} />
      </div>
      <label className="widget-label" htmlFor="stop-price">Stop price: ${stop}</label>
      <input id="stop-price" className="widget-slider" type="range" min="45" max="49" value={stop} onChange={(event) => setStop(Number(event.target.value))} />
      <label className="widget-label" htmlFor="target-price">Target price: ${target}</label>
      <input id="target-price" className="widget-slider" type="range" min="52" max="65" value={target} onChange={(event) => setTarget(Number(event.target.value))} />
      <p className="widget-note">The entry is $50. The break-even win rate is the share of wins needed before costs.</p>
    </div>
  );
}

function MarketFilter() {
  const [filter, setFilter] = useState(true);

  return (
    <div className="learn-widget">
      <div className="widget-readouts">
        <Value label="Filter" value={filter ? 'On' : 'Off'} />
        <Value label="Avoided fall" value={filter ? '-18%' : '0%'} />
        <Value label="Missed recovery" value={filter ? '+9%' : '0%'} />
      </div>
      <div className="widget-controls" role="group" aria-label="Turn the market filter on or off">
        <button type="button" className={`widget-btn ${filter ? 'is-selected' : ''}`} aria-pressed={filter} onClick={() => setFilter(true)}>Filter on</button>
        <button type="button" className={`widget-btn ${!filter ? 'is-selected' : ''}`} aria-pressed={!filter} onClick={() => setFilter(false)}>Filter off</button>
      </div>
      <p className="widget-result">{filter ? 'The filter steps aside during the fall, then waits for the market to recover.' : 'The strategy stays invested through the fall and the recovery.'}</p>
      <p className="widget-note">A filter can reduce a drawdown and still cost a recovery. Test both sides before keeping it.</p>
    </div>
  );
}

const CARD_SECTIONS = ['Hypothesis', 'Entry rule', 'Exit rule', 'Position size', 'Daily loss limit'];

function StrategyCard() {
  const [done, setDone] = useState<string[]>(['Hypothesis', 'Entry rule']);

  const toggle = (section: string) => {
    setDone((current) => current.includes(section) ? current.filter((item) => item !== section) : [...current, section]);
  };
  const missing = CARD_SECTIONS.length - done.length;

  return (
    <div className="learn-widget">
      <div className="widget-readouts">
        <Value label="Sections complete" value={`${done.length} of ${CARD_SECTIONS.length}`} />
        <Value label="Still missing" value={String(missing)} />
      </div>
      <div className="widget-controls" role="group" aria-label="Strategy card sections">
        {CARD_SECTIONS.map((section) => (
          <button key={section} type="button" className={`widget-btn ${done.includes(section) ? 'is-selected' : ''}`} aria-pressed={done.includes(section)} onClick={() => toggle(section)}>{section}</button>
        ))}
      </div>
      <p className="widget-result">{missing === 0 ? 'The card has every section. The rules are ready to be tested.' : 'A blank section is a decision that has not been made yet.'}</p>
      <p className="widget-note">The card is a record of the rules, not a prediction about the result.</p>
    </div>
  );
}
