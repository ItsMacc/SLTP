// Tier5Sections.tsx - Tier V modules B and C.
//
// Module B (metrics): two strategies, same return, different risk. A single
//   slider moves volatility and the verdict moves with it.
// Module C (allocation): a step-through on one idea. Split the same money
//   across 1, then 2, then 4, then 10, then 20 companies, and watch what one
//   bankruptcy costs each time. That is the whole argument for diversifying.

import { useState } from 'react';
import { Gauge, PieChart } from 'lucide-react';
import { GlossaryText } from '../../components/GlossaryText';
import { LEARN_GLOSSARY } from '../../learn/learnGlossary';
import { Money, Narrator, Objective, Recap } from './parts';

const G = LEARN_GLOSSARY;

/* ============================================================
   Module B, Sharpe, Sortino & drawdown
   ============================================================ */

const W = 520;
const H = 190;
const M = { l: 10, r: 46, t: 14, b: 26 };

export function MetricsSection() {
  const [vol, setVol] = useState(10);
  const annualReturn = 12;

  // Sharpe = return / volatility, with the risk free rate set to zero so the
  // arithmetic a beginner can do on paper is the number on screen.
  const sharpe = annualReturn / vol;
  const drawdown = +(vol * 1.6).toFixed(1);

  const months = 60;
  const curve = Array.from({ length: months + 1 }, (_, m) => {
    const growth = 100 * (1 + annualReturn / 100) ** (m / 12);
    const wobble = 1 + (vol / 100) * 0.16 * Math.sin(m * 0.9 + vol * 0.05) + (vol / 100) * 0.1 * Math.sin(m * 0.31);
    return growth * wobble;
  });
  const cMin = Math.min(...curve) * 0.94;
  const cMax = Math.max(...curve) * 1.02;
  const pts = curve
    .map((v, i) => {
      const x = M.l + (i / months) * (W - M.l - M.r);
      const y = M.t + (H - M.t - M.b) - ((v - cMin) / (cMax - cMin)) * (H - M.t - M.b);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const verdict = sharpe >= 1.5
    ? 'Genuinely efficient. High return relative to the ride.'
    : sharpe >= 0.8
      ? 'Solid. The return is worth the roughness.'
      : sharpe >= 0.4
        ? 'The same return could have been earned with far less pain.'
        : 'Return is being bought with risk rather than skill.';

  return (
    <div>
      <Objective>
        By the end of this module you will be able to compare two strategies on
        return, volatility, the Sharpe ratio and drawdown, and explain why two
        strategies with the same return can still be very different investments.
      </Objective>

      <p>
        You can now build a strategy and survive it. The last job is judging one,
        and judging is where most of the vocabulary on the Performance page comes
        from.
      </p>

      <div className="learn-rules">
        <div className="learn-rule">
          <span className="learn-rule-num">1</span>
          <p><strong>Return.</strong> The yearly growth your money earned. Necessary, but the least informative number on its own.</p>
        </div>
        <div className="learn-rule">
          <span className="learn-rule-num">2</span>
          <p><strong><GlossaryText text="volatility" glossary={G} />.</strong> How violently those returns arrive. Two strategies can both average 12 percent a year and feel nothing alike.</p>
        </div>
        <div className="learn-rule">
          <span className="learn-rule-num">3</span>
          <p><strong><GlossaryText text="Sharpe ratio" glossary={G} />.</strong> Return per unit of risk, roughly return divided by volatility. Above 1.0 is generally considered viable.</p>
        </div>
        <div className="learn-rule">
          <span className="learn-rule-num">4</span>
          <p><strong><GlossaryText text="drawdown" glossary={G} />.</strong> The worst fall from a peak before recovering. <strong>Max drawdown</strong> is the deepest one in the whole record.</p>
        </div>
      </div>

      <div className="learn-fin">
        <p className="learn-fin-title">One return, two very different strategies</p>
        <p className="learn-fin-hint">
          Both strategies return 12 percent a year. Move the volatility of the
          rougher one and watch the verdict change while the return stays put.
        </p>

        <div className="learn-slider-block">
          <div className="learn-slider-readout">
            <span>Strategy B volatility</span>
            <strong className="learn-money">{vol}%</strong>
          </div>
          <input
            type="range"
            min={2}
            max={40}
            step={1}
            value={vol}
            onChange={(e) => setVol(parseInt(e.target.value, 10))}
            className="learn-slider"
            aria-label="Strategy B volatility percentage"
          />
          <div className="learn-slider-scale">
            <span>2 percent, a staircase</span>
            <span>40 percent, a rollercoaster</span>
          </div>
        </div>

        <div className="learn-chartbox">
          <svg viewBox={`0 0 ${W} ${H}`} className="learn-fin-chart" role="img"
            aria-label={`Equity curve growing 12 percent a year with ${vol} percent volatility`}>
            <line x1={M.l} x2={W - M.r} y1={M.t} y2={M.t} className="learn-fin-grid" />
            <line x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} className="learn-fin-grid" />
            <polyline points={pts} fill="none" className="chart-line avg" strokeWidth={2} />
            <text x={W - M.r + 6} y={M.t + 10} className="learn-fin-axis">
              ${curve[months].toFixed(0)}
            </text>
            <text x={W} y={H - M.b + 4} textAnchor="end" className="learn-fin-axis">starts at 100</text>
          </svg>
          <span className="learn-minichart-caption">
            Five years of the same 12 percent annual return, drawn with the
            volatility you picked. The end point barely moves. The ride does all
            the work.
          </span>
        </div>

        <div className="learn-factrow">
          <div className="learn-fact">
            <span className="learn-fact-label">Annual return, both</span>
            <span className="learn-fact-value learn-positive">{annualReturn}%</span>
          </div>
          <div className="learn-fact">
            <span className="learn-fact-label">Volatility, B</span>
            <span className="learn-fact-value">{vol}%</span>
          </div>
          <div className="learn-fact">
            <span className="learn-fact-label">Sharpe ratio</span>
            <span className="learn-fact-value learn-positive">{sharpe.toFixed(2)}</span>
          </div>
          <div className="learn-fact">
            <span className="learn-fact-label">Max drawdown</span>
            <span className="learn-fact-value learn-negative">{drawdown}%</span>
          </div>
        </div>

        <p className="learn-caption learn-caption-strong">
          Sharpe {sharpe.toFixed(2)}. {verdict}
        </p>
      </div>

      <Narrator icon={Gauge}>
        A <strong>Sortino ratio</strong> is the same idea with one change. It only
        counts the bad side of the ride. A strategy that climbs steadily and never
        falls far scores well on Sortino even if its volatility looks high,
        because volatility caused by upside is not really risk.
      </Narrator>

      <p>
        This is why the Performance page ranks systems{' '}
        <GlossaryText text="risk-adjusted" glossary={G} /> rather than by raw
        return. Two identical 12 percent returns, one earned calmly and one earned
        while being thrown around, are not the same investment, and a table that
        cannot tell them apart is not measuring what matters.
      </p>

      <Recap points={[
        <>Raw return is not a verdict. <GlossaryText text="Risk-adjusted" glossary={G} /> performance is.</>,
        <><GlossaryText text="Sharpe ratio" glossary={G} /> is return divided by volatility: what you earn per unit of pain.</>,
        <><GlossaryText text="Drawdown" glossary={G} /> is peak to trough. Max drawdown is the worst you would have endured.</>,
        <>Sortino counts only downside movement, so it rewards steady climbers.</>,
      ]} />
    </div>
  );
}

/* ============================================================
   Module C, Position sizing & allocation
   ============================================================ */

const STEPS = [1, 2, 4, 10, 20];
const STARTING = 1000;

/** Whole dollars stay whole: 500 not 500.00, but 333.33 keeps its cents. */
const cash = (v: number) =>
  '$' + v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: Number.isInteger(v) ? 0 : 2 });

export function AllocationSection() {
  const [idx, setIdx] = useState(2);
  const n = STEPS[idx];
  const each = STARTING / n;
  const loss = each; // the one bankruptcy wipes out everything put into it
  const left = STARTING - loss;

  return (
    <div>
      <Objective>
        By the end of this module you will be able to show why spreading money
        across more companies limits what a single failure can cost you, and
        explain what <GlossaryText text=" diversification" glossary={G} /> really buys.
      </Objective>

      <p>
        Module A set a 2 percent risk budget so that one bad trade could not hurt
        you much. This module is the same idea one level up: protecting your whole
        account from one bad company.
      </p>

      <div className="learn-riskbox">
        <p className="learn-riskbox-title">The situation</p>
        <p>
          You have <Money value={STARTING} decimals={0} /> to invest. You decide
          to split it equally across a number of companies, and you keep investing
          that way. Every year, exactly one company you hold goes bankrupt, and
          you lose every single dollar you put into that one company.
        </p>
        <p>
          Nothing else changes. The rest of your companies are fine. The only
          question is how many companies you split across, so pick a number and
          watch what that one bankruptcy costs you.
        </p>
      </div>

      {/* ---------- The step-through ---------- */}
      <div className="learn-fin">
        <p className="learn-fin-title">How many companies?</p>
        <div className="learn-ordertypes">
          {STEPS.map((s, i) => (
            <button
              key={s}
              type="button"
              className={`learn-ordertype ${i === idx ? 'is-active' : ''}`}
              onClick={() => setIdx(i)}
            >
              {s} compan{s === 1 ? 'y' : 'ies'}
            </button>
          ))}
        </div>

        <div className="learn-factrow">
          <div className="learn-fact">
            <span className="learn-fact-label">You started with</span>
            <span className="learn-fact-value">{cash(STARTING)}</span>
          </div>
          <div className="learn-fact">
            <span className="learn-fact-label">Across {n} compan{n === 1 ? 'y' : 'ies'}</span>
            <span className="learn-fact-value">{cash(each)} each</span>
          </div>
          <div className="learn-fact">
            <span className="learn-fact-label">One goes bankrupt, you lose</span>
            <span className="learn-fact-value learn-negative">{cash(loss)}</span>
          </div>
          <div className="learn-fact">
            <span className="learn-fact-label">You still have</span>
            <span className="learn-fact-value learn-positive">{cash(left)}</span>
          </div>
        </div>

        <p className="learn-caption learn-caption-strong">
          {n === 1
            ? 'Everything you had was in that one company, so the bankruptcy took all of it. You are left with nothing and no way to keep trading.'
            : n === 2
              ? 'Half your money was in each company, so you lost half. Painful, but you still have a working account.'
              : `You only had ${((1 / n) * 100).toFixed(0)} percent of your money in any one company, so that bankruptcy took ${((1 / n) * 100).toFixed(0)} percent of the account instead of everything. You are still trading.`}
        </p>
      </div>

      <Narrator icon={PieChart}>
        Notice that the bankruptcy did not get smaller. You lost the whole of
        that one company every single time. What changed is how much of your life
        was sitting in it. This is why the phrase is &ldquo;do not put all your
        eggs in one basket&rdquo;, and it is the same idea behind{' '}
        <GlossaryText text=" diversification" glossary={G} />.
      </Narrator>

      <p>
        Say you pick three companies with <Money value={STARTING} decimals={0} />.
        Each one gets about $333. When one fails you lose $333 and you are left
        with $667 and a running account. Nothing dramatic happened, and that is
        the point. A single bad outcome stops being the thing that decides
        whether you are still in the game.
      </p>
      <p>
        The cost is real, and it is worth naming honestly. With 20 companies your
        best idea moves your account 5 percent when it doubles, instead of 100
        percent. You are trading upside for survival. If your plan is to still be
        trading next year, that is a good trade. If your plan is to make your one
        great pick carry the year, it is not.
      </p>
      <p>
        One last thing. Twenty companies only helps if they are not really the same
        bet. Twenty technology stocks are one position wearing twenty costumes.
        Real diversification means different sectors and different kinds of risk,
        so one bad month for the whole sector cannot take everything at once.
      </p>

      <Recap points={[
        <>The bankruptcy always costs you the whole of that company. What you control is how much of your account sat in it.</>,
        <>That amount is roughly one divided by the number of companies.</>,
        <>One company means one bankruptcy can end you. Twenty means the worst case is small.</>,
        <><GlossaryText text="Diversification" glossary={G} /> costs you upside and buys you the ability to keep going.</>,
      ]} />
    </div>
  );
}