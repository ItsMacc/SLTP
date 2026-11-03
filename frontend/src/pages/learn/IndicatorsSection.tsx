// IndicatorsSection.tsx — Intermediate lesson: what indicators actually
// measure.
//
// Every definition here matches the engine (app/engine/strategy/base_strategy.py):
//   _sma(values, window) / _ema(values, window)          - TA-Lib SMA / EMA
//   _rsi(values, window)                                  - TA-Lib RSI
//   _bollinger_bands(values, window, deviations = 2)      - TA-Lib BBANDS
//   _atr(high, low, close, window)                        - TA-Lib ATR
// The strategy parameters quoted come from the shipped strategies, not from a
// textbook: Statistical Mean Reversion uses RSI(25) with 30/70 thresholds, a
// 20-bar z-score, and exits three standard deviations from entry.

import { useState } from 'react';
import Button from '../../ui/Button';
import { Activity } from 'lucide-react';
import { GlossaryText } from '../../components/GlossaryText';
import { LEARN_GLOSSARY } from '../../learn/learnGlossary';
import { Narrator, Objective, Recap } from './parts';


const GText = ({ children }: { children: string }) => (
  <GlossaryText text={children} glossary={LEARN_GLOSSARY} />
);

// Deterministic price path (illustrative). Fixed so the description of the
// chart is always true: a rise, a dip in the middle, then a recovery.
const PRICES = Array.from({ length: 60 }, (_, i) => {
  const trend = 100 + i * 0.55;
  const wave = Math.sin(i / 4.2) * 4.2 + Math.sin(i / 9.5) * 3;
  const dip = i > 24 && i < 40 ? -7 : 0;
  return +(trend + wave + dip).toFixed(2);
});

function sma(series: number[], window: number): (number | null)[] {
  return series.map((_, i) => {
    if (i < window - 1) return null;
    const slice = series.slice(i - window + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / window;
  });
}

function ema(series: number[], window: number): (number | null)[] {
  if (series.length < window) return series.map(() => null);
  const k = 2 / (window + 1);
  const out: (number | null)[] = series.map(() => null);
  let prev = series.slice(0, window).reduce((a, b) => a + b, 0) / window;
  out[window - 1] = prev;
  for (let i = window; i < series.length; i++) {
    prev = series[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

const CHART_W = 560;
const CHART_H = 220;
const C_PAD = { l: 44, r: 12, t: 16, b: 26 };

function toPoints(vals: (number | null)[], min: number, max: number) {
  const w = CHART_W - C_PAD.l - C_PAD.r;
  const h = CHART_H - C_PAD.t - C_PAD.b;
  return vals
    .map((v, i) => {
      if (v === null) return null;
      const x = C_PAD.l + (i / (vals.length - 1)) * w;
      const y = C_PAD.t + h - ((v - min) / (max - min)) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .filter(Boolean)
    .join(' ');
}

const FAMILIES = [
  { name: 'Trend', question: 'Which way is it heading?', example: 'Moving averages, MACD, ADX' },
  { name: 'Momentum', question: 'How strong is the move?', example: 'RSI, Stochastic, rate of change' },
  { name: 'Volatility', question: 'How big are the swings?', example: 'Bollinger Bands, ATR' },
  { name: 'Volume', question: 'How many people are involved?', example: 'Volume, On-Balance Volume' },
];

const INDICATORS = [
  {
    name: 'Moving average',
    engine: '_sma(closes, window) and _ema(closes, window)',
    question: 'What has the average price been over the last N days?',
    calculation: 'Add the last N closes and divide by N, then repeat tomorrow with the window shifted one day.',
    usage: 'Statistical Mean Reversion compares the close with a 20-bar average to measure how far price has stretched. Lab templates use a 50-day average as a trend filter.',
    misleading: 'It is always behind the price, and the longer the window the later it turns.',
  },
  {
    name: 'RSI',
    engine: '_rsi(closes, window)',
    question: 'How one-sided have recent gains and losses been, on a 0–100 scale?',
    calculation: 'Compare the size of recent up moves with recent down moves, then scale the result to 0–100.',
    usage: 'The shipped Statistical Mean Reversion strategy uses RSI(25): it buys below 30 and exits at 70. The Lab RSI template uses RSI(14) with the same 30 level.',
    misleading: 'An oversold stock can stay oversold for months in a downtrend. “30” is a choice, not a law.',
  },
  {
    name: 'Bollinger Bands',
    engine: '_bollinger_bands(closes, window, deviations = 2)',
    question: 'How far is price from its average, in units of its own wiggle?',
    calculation: 'A moving average, plus and minus a set number of standard deviations of the same window.',
    usage: 'A strategy might buy when price closes below the lower band, betting on a move back to the middle.',
    misleading: 'In a strong trend price can ride a band for weeks, so “outside the band” is not a reversal signal by itself.',
  },
  {
    name: 'ATR',
    engine: '_atr(high, low, close, window)',
    question: 'How much does this stock typically move in a day?',
    calculation: 'Average the daily true range: the day’s high-to-low span, adjusted for gaps from the previous close.',
    usage: 'Stops can be placed a multiple of ATR below entry, so a volatile stock gets a wider stop than a calm one.',
    misleading: 'It measures movement size, never direction, and it jumps after a shock.',
  },
];

export function IndicatorsSection() {
  const [window, setWindow] = useState(10);
  const [useEma, setUseEma] = useState(false);

  const line = useEma ? ema(PRICES, window) : sma(PRICES, window);
  const min = Math.min(...PRICES) - 3;
  const max = Math.max(...PRICES) + 3;
  const last = PRICES[PRICES.length - 1];
  const lastAvg = line[line.length - 1];
  const gap = lastAvg !== null ? +(last - lastAvg).toFixed(2) : null;

  const character =
    window <= 8 ? 'Fast. It follows the price closely and reacts to nearly every bit of noise.'
      : window <= 20 ? 'Balanced. Smooth enough to filter daily noise, quick enough to catch a real turn.'
        : 'Smooth and slow. It filters almost all noise, but it is late to report a change in trend.';

  return (
    <div>
      <Objective>
        What an indicator is, the four families, and what four common ones actually measure.
      </Objective>

      <p>
        An <GText>indicator</GText> is a formula applied to prices (and sometimes volume) that
        answers one question. It adds no new information. It rearranges prices so one thing is
        easier to see.
      </p>

      <div className="learn-cards">
        {FAMILIES.map((f) => (
          <div className="learn-card" key={f.name}>
            <p className="learn-card-term">{f.name}</p>
            <p>{f.question}</p>
            <p className="learn-card-note">{f.example}</p>
          </div>
        ))}
      </div>

      <p>
        Every indicator below is one the engine can compute today. The names in the code are the
        methods a strategy calls, so this page and the codebase say the same thing.
      </p>

      <div className="learn-rules">
        {INDICATORS.map((ind, i) => (
          <div className="learn-rule" key={ind.name}>
            <span className="learn-rule-num">{i + 1}</span>
            <p>
              <strong>{ind.name}.</strong> {ind.question} <em>In code:</em> {ind.engine}.{' '}
              {ind.calculation} <em>How a strategy might use it:</em> {ind.usage}{' '}
              <em>Where it misleads:</em> {ind.misleading}
            </p>
          </div>
        ))}
      </div>

      <div className="learn-fin">
        <p className="learn-fin-title">The one trade-off: smooth versus slow</p>
        <p className="learn-fin-hint">
          The grey line is the daily close; the coloured line is the average. An illustrative
          fixed series. Change the window and watch it lag.
        </p>

        <div className="learn-slider-block">
          <div className="learn-slider-readout">
            <span>Window = last {window} days</span>
            <strong className="learn-money">{useEma ? 'EMA' : 'SMA'}({window})</strong>
          </div>
          <input
            type="range"
            min={5}
            max={100}
            step={1}
            value={window}
            onChange={(e) => setWindow(parseInt(e.target.value, 10))}
            className="learn-slider"
            aria-label="Moving average window in days"
          />
          <div className="learn-slider-scale">
            <span>5 days (fast)</span>
            <span>100 days (slow)</span>
          </div>
        </div>

        <div className="learn-ordertypes">
          <Button
            variant="chip"
            className={`learn-ordertype ${!useEma ? 'is-active' : ''}`}
            onClick={() => setUseEma(false)}
          >
            SMA, every day equal
          </Button>
          <Button
            variant="chip"
            className={`learn-ordertype ${useEma ? 'is-active' : ''}`}
            onClick={() => setUseEma(true)}
          >
            EMA, recent days count more
          </Button>
        </div>

        <div className="learn-chartbox">
          <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="learn-fin-chart" role="img"
            aria-label={`Price chart with a ${useEma ? 'exponential' : 'simple'} ${window} day moving average overlaid`}>
            {[0, 0.25, 0.5, 0.75, 1].map((f) => {
              const y = C_PAD.t + (CHART_H - C_PAD.t - C_PAD.b) * f;
              const val = (max - (max - min) * f).toFixed(0);
              return (
                <g key={f}>
                  <line x1={C_PAD.l} x2={CHART_W - C_PAD.r} y1={y} y2={y} className="learn-fin-grid" />
                  <text x={C_PAD.l - 7} y={y + 4} textAnchor="end" className="learn-fin-axis">${val}</text>
                </g>
              );
            })}
            <polyline points={toPoints(PRICES, min, max)} className="chart-line raw" fill="none" />
            <polyline points={toPoints(line, min, max)} className="chart-line avg" fill="none" />
          </svg>
          <div className="learn-chartlegend">
            <span><i className="dot" style={{ background: 'var(--text-muted)' }} /> Daily close</span>
            <span><i className="dot" style={{ background: 'var(--accent)' }} /> {useEma ? 'EMA' : 'SMA'} of last {window} days</span>
          </div>
        </div>

        <div className="learn-factrow">
          <div className="learn-fact">
            <span className="learn-fact-label">Latest close</span>
            <span className="learn-fact-value">${last.toFixed(2)}</span>
          </div>
          <div className="learn-fact">
            <span className="learn-fact-label">Latest {useEma ? 'EMA' : 'SMA'}</span>
            <span className="learn-fact-value">${lastAvg?.toFixed(2)}</span>
          </div>
          <div className="learn-fact">
            <span className="learn-fact-label">Price versus average</span>
            <span className={`learn-fact-value ${gap !== null && gap >= 0 ? 'learn-positive' : 'learn-negative'}`}>
              {gap !== null ? `${gap >= 0 ? '+' : ''}${gap}` : '-'}
            </span>
          </div>
        </div>

        <p className="learn-caption learn-caption-strong">At N = {window}: {character}</p>
      </div>

      <Narrator icon={Activity}>
        Indicators are inputs to rules. &ldquo;Buy when X is above Y&rdquo; is the rule; the
        indicator is only X and Y.
      </Narrator>

      <p>
        No indicator predicts. Many are built on the behaviours from the psychology lesson:
        momentum and trend measures lean on herding and slow absorption, while RSI and Bollinger
        Bands lean on overreaction. That is a reason to test them, not a promise they work.
      </p>

      <Recap points={[
        <>An indicator is a formula that makes one question easier to answer; it adds no new data.</>,
        <>Four families: trend, momentum, volatility, volume.</>,
        <>Longer windows are smoother and slower. That trade-off cannot be removed.</>,
        <>Indicators feed rules, and every indicator is late by construction.</>,
      ]} />
    </div>
  );
}
