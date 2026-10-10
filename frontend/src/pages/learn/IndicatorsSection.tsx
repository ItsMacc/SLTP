// IndicatorsSection.tsx - Tier III module B: trend indicators.
//
// One idea, shown properly: a moving average is an averaging window dragged
// along price. The slider shows the only real decision you make with it, the
// window length. SMA and EMA are the two ways of weighting the window.
//
// Ends on the point that generalises: every other technical indicator is the
// same arithmetic over the same OHLCV data.

import { useState } from 'react';
import { Activity } from 'lucide-react';
import { GlossaryText } from '../../components/GlossaryText';
import { LEARN_GLOSSARY } from '../../learn/learnGlossary';
import { Narrator, Objective, Recap } from './parts';

const G = LEARN_GLOSSARY;

// Deterministic price path so the chart tells the same story every render.
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
    window <= 8 ? 'Fast and twitchy. It follows the price closely, but it also reacts to noise.'
      : window <= 20 ? 'Balanced. Smooth enough to ignore daily jitter, quick enough to catch a real turn.'
        : 'Smooth and slow. It ignores almost all noise, but it will be late telling you the trend changed.';

  return (
    <div>
      <Objective>
        By the end of this module you will be able to explain what a moving
        average is, say what happens when you lengthen or shorten the window, and
        describe how a crossover becomes a buy signal.
      </Objective>

      <p>
        Module A said the rules have to be written down. This is the most common
        rule people write. A{' '}
        <GlossaryText text="moving average" glossary={G} /> is the average closing
        price of the last N days, redrawn every day so it follows the price.
      </p>
      <p>
        If the last ten closes were 100, 102, 99, 101, 103, 100, 104, 102, 101, 105,
        your 10 day average sits at 101.7. Tomorrow it drops the oldest number and
        adds the newest, so the line moves. That is the entire idea.
      </p>

      <div className="learn-rules">
        <div className="learn-rule">
          <span className="learn-rule-num">1</span>
          <p><strong>N decides everything.</strong> A 5 day average reacts almost instantly. A 50 day average barely notices a week.</p>
        </div>
        <div className="learn-rule">
          <span className="learn-rule-num">2</span>
          <p><strong>There are two ways to average.</strong> The <strong>simple moving average (SMA)</strong> gives every day in the window the same weight. The <strong>exponential moving average (EMA)</strong> gives recent days more weight, so it turns sooner and gives a few more false turns.</p>
        </div>
        <div className="learn-rule">
          <span className="learn-rule-num">3</span>
          <p><strong>Price versus average is the signal.</strong> Price above a rising average means the trend is up. Price below a falling average means it is down.</p>
        </div>
      </div>

      {/* ---------- The one control that matters ---------- */}
      <div className="learn-fin">
        <p className="learn-fin-title">Drag the window</p>
        <p className="learn-fin-hint">
          The grey line is the daily close. The coloured line is your average.
          Change N, then switch between SMA and EMA.
        </p>

        <div className="learn-slider-block">
          <div className="learn-slider-readout">
            <span>Window N = last {window} days</span>
            <strong className="learn-money">{useEma ? 'EMA' : 'SMA'}({window})</strong>
          </div>
          <input
            type="range"
            min={3}
            max={40}
            step={1}
            value={window}
            onChange={(e) => setWindow(parseInt(e.target.value, 10))}
            className="learn-slider"
            aria-label="Moving average window in days"
          />
          <div className="learn-slider-scale">
            <span>3 days (fast)</span>
            <span>40 days (slow)</span>
          </div>
        </div>

        <div className="learn-ordertypes">
          <button
            type="button"
            className={`learn-ordertype ${!useEma ? 'is-active' : ''}`}
            onClick={() => setUseEma(false)}
          >
            SMA, every day equal
          </button>
          <button
            type="button"
            className={`learn-ordertype ${useEma ? 'is-active' : ''}`}
            onClick={() => setUseEma(true)}
          >
            EMA, recent days count more
          </button>
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
        The classic rule built on this is the <strong>crossover</strong>. You watch
        a fast average (say 10 days) and a slow one (say 50 days). When the fast
        one crosses above the slow one, recent prices have started beating the
        long term habit, and that is treated as a buy. SLTP&apos;s Stock Health
        Filter does the same idea with a 200 day average as its filter, and the
        SMA Crossover recipe on the Docs page is this idea written as code.
      </Narrator>

      <p>
        One thing worth being honest about: the moving average is late by design.
        It needs several days before it can confirm anything, so you will always
        enter after the move has started. That is the price of not guessing, and
        it is the whole trade: you give up the first part of the move to avoid
        reacting to noise.
      </p>

      <p>
        <strong>There are many more technical indicators</strong>: momentum gauges,
        range measures, volume measures, band widths. But every one of them is the
        same maths you just did, run over the same five numbers a data feed gives
        you for each day. Those are <strong>OHLCV</strong>: the{' '}
        <strong>O</strong>pen, the <strong>H</strong>igh, the <strong>L</strong>ow,
        the <strong>C</strong>lose, and the <strong>V</strong>olume. Learn to
        average, sum, compare and take ratios of those five columns and you can
        read any indicator chart anyone shows you.
      </p>

      <Recap points={[
        <>A <GlossaryText text="moving average" glossary={G} /> is the average close of the last N days, redrawn daily.</>,
        <>Bigger N is smoother and later. Smaller N is faster and noisier. That tradeoff cannot be avoided.</>,
        <><strong>SMA</strong> weights all N days equally. <strong>EMA</strong> weights recent days and turns sooner.</>,
        <>Price above a rising average means uptrend. A fast average crossing above a slow one is the classic buy signal.</>,
        <>Every other technical indicator is the same maths over the same OHLCV data.</>,
      ]} />
    </div>
  );
}