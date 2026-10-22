// BacktestWalkthrough.tsx — Tier IV module B: reading a real backtest.
//
// Module A defined what a backtest is. This one reads a real one, end to end,
// using the actual Stock Health Filter report from the Strategies page: the
// same equity curves, the same numbers. The point is not the strategy, it is
// the reading skill: what each number means and how to judge the tradeoffs.

import { useState } from 'react';
import { ClipboardList, LineChart } from 'lucide-react';
import { GlossaryText } from '../../components/GlossaryText';
import { LEARN_GLOSSARY } from '../../learn/learnGlossary';
import { Narrator, Objective, Recap } from './parts';

const G = LEARN_GLOSSARY;

interface Report {
  id: string;
  label: string;
  period: string;
  note: string;
  strategySvg: string;
  benchmarkSvg: string;
  strategy: { final: string; cagr: string; drawdown: string; sharpe: string };
  benchmark: { final: string; cagr: string; drawdown: string; sharpe: string };
}

// Real numbers, taken from the Stock Health Filter comparisons on the
// Strategies page. Starting value is $100 in every test.
const REPORTS: Report[] = [
  {
    id: 'tenyear',
    label: '10 years (2016-2026)',
    period: 'January 2016 to today',
    note: 'The long view. The benchmark grew more, but it also suffered a fall of about 35% along the way, against about 19% for the strategy. Over ten years, that difference in the worst fall is the whole story.',
    strategySvg: '/assets/backtests/StockHealthFilter_10-year_current.svg',
    benchmarkSvg: '/assets/backtests/BuyAndHold_10-year_current.svg',
    strategy: { final: '275.22', cagr: '10.66%', drawdown: '-19.11%', sharpe: '1.07' },
    benchmark: { final: '364.33', cagr: '13.82%', drawdown: '-35.40%', sharpe: '0.80' },
  },
  {
    id: 'recent',
    label: 'Recent market (2024-2026)',
    period: 'the last couple of years',
    note: 'A steady market. The strategy gave up a little growth and, in return, its worst fall was about 11% against the benchmark’s 16%. A calm period rewards gentler rides.',
    strategySvg: '/assets/backtests/StockHealthFilter_Recent.svg',
    benchmarkSvg: '/assets/backtests/BuyAndHold_Recent.svg',
    strategy: { final: '132.68', cagr: '15.22%', drawdown: '-11.08%', sharpe: '1.44' },
    benchmark: { final: '137.66', cagr: '17.37%', drawdown: '-16.22%', sharpe: '1.25' },
  },
  {
    id: 'covid',
    label: 'COVID crash (2020-2021)',
    period: 'the crash and the recovery after it',
    note: 'A harsh test. The benchmark fell about 17% at its worst and then roared back to 39% a year. The strategy fell less, about 10%, but also captured far less of the rebound. Steadier, but beaten on growth.',
    strategySvg: '/assets/backtests/StockHealthFilter_COVID.svg',
    benchmarkSvg: '/assets/backtests/BuyAndHold_COVID.svg',
    strategy: { final: '125.75', cagr: '13.52%', drawdown: '-10.08%', sharpe: '1.38' },
    benchmark: { final: '181.78', cagr: '39.20%', drawdown: '-16.71%', sharpe: '1.57' },
  },
];

export function BacktestWalkthroughSection() {
  const [idx, setIdx] = useState(0);
  const r = REPORTS[idx];

  return (
    <div>
      <Objective>
        By the end of this module you will be able to read a backtest report
        end to end: the equity curves, the final value, the yearly return, the
        maximum drawdown and the Sharpe ratio, and you will be able to judge a
        strategy against a benchmark instead of just admiring its chart.
      </Objective>

      <p>
        Module A explained what a backtest is. This module reads a real one, the
        same report you can see on the Strategies page for the{' '}
        <strong>Stock Health Filter</strong> strategy. The point is not to
        admire the strategy. It is to learn what each part of the report is
        actually telling you.
      </p>

      {/* ---------- Step 1: what was tested ---------- */}
      <div className="learn-substep">
        <p className="learn-substep-title">Step 1: what is being tested</p>
        <p>
          In plain terms, the strategy holds up to 20 of the most heavily traded
          stocks. It buys a stock when its recent price behaviour jumps sharply
          above its own longer-term habit, and it exits each position at prices
          set in advance based on how much that stock normally moves. The
          portfolio is reviewed every three months.
        </p>
        <p>
          The rules were not tuned to fit any of the periods you are about to
          see. That matters, for the reason Module A covered: rules adjusted
          until a past period looks perfect describe that period, nothing more.
        </p>
      </div>

      {/* ---------- Step 2: the setup ---------- */}
      <div className="learn-substep">
        <p className="learn-substep-title">Step 2: the setup</p>
        <p>
          Both sides start with the same pretend money, <strong>$100</strong>,
          on the same day. One side follows the strategy&apos;s rules. The
          other side does the simplest thing possible,{' '}
          <GlossaryText text="buy and hold" glossary={G} />: it buys a broad
          slice of the market and never sells. Same period, same starting
          money, two approaches. At the end you compare where each dollar
          ended up.
        </p>
      </div>

      {/* ---------- Step 3: the curves ---------- */}
      <div className="learn-substep">
        <p className="learn-substep-title">Step 3: read the curves before the numbers</p>
        <p>
          Below are the actual equity curves for the ten-year test. The top
          chart is the strategy. The bottom chart is buy and hold. Both start
          at 100, and every point on a curve is what the $100 would have been
          worth on that day.
        </p>

        <div className="learn-fin">
          <p className="learn-fin-title">The strategy, ten years</p>
          <img
            className="learn-report-img"
            src="/assets/backtests/StockHealthFilter_10-year_current.svg"
            alt="Equity curve of the Stock Health Filter strategy over ten years, rising from 100 to about 275 with moderate dips"
          />
          <p className="learn-caption">
            Notice the shape before the ending: the line rises, but it also
            stops and dips. Those dips are the ones an owner had to sit through.
          </p>
        </div>

        <div className="learn-fin">
          <p className="learn-fin-title">Buy and hold, the same ten years</p>
          <img
            className="learn-report-img"
            src="/assets/backtests/BuyAndHold_10-year_current.svg"
            alt="Equity curve of buy and hold over the same ten years, rising from 100 to about 364 with a deeper fall"
          />
          <p className="learn-caption">
            This line ends higher, and it also contains one much deeper fall.
            Both statements are true, and a report that showed only the ending
            would be hiding half the picture.
          </p>
        </div>

        <Narrator icon={LineChart}>
          The habit worth building: look at the <strong>shape</strong> first and
          the ending second. A smooth climb to 275 and a wild ride to 364 are
          different experiences to own, even though the higher number looks
          better in a summary table.
        </Narrator>
      </div>

      {/* ---------- Step 4: the four numbers ---------- */}
      <div className="learn-substep">
        <p className="learn-substep-title">Step 4: the four numbers that summarise everything</p>
        <p>
          Curves are hard to compare precisely, so every report reduces them to
          a few numbers. Here is what each one measures, with the strategy&apos;s
          real ten-year figures:
        </p>

        <div className="learn-rules">
          <div className="learn-rule">
            <span className="learn-rule-num">1</span>
            <p>
              <strong>Final value: 275.22.</strong> What $100 became by the end.
              It says where you finished, nothing about the journey.
            </p>
          </div>
          <div className="learn-rule">
            <span className="learn-rule-num">2</span>
            <p>
              <strong><GlossaryText text="CAGR" glossary={G} />: 10.66%.</strong>{' '}
              The average yearly growth rate that gets you from the starting
              value to the final one. Individual years bounce around it, but it
              is the fairest single number for how fast the money grew.
            </p>
          </div>
          <div className="learn-rule">
            <span className="learn-rule-num">3</span>
            <p>
              <strong><GlossaryText text="drawdown" glossary={G} />: -19.11%.</strong>{' '}
              The deepest fall from a peak before recovering. This is the
              downside number: the worst an owner would have watched the
              account fall from its high.
            </p>
          </div>
          <div className="learn-rule">
            <span className="learn-rule-num">4</span>
            <p>
              <strong><GlossaryText text="Sharpe ratio" glossary={G} />: 1.07.</strong>{' '}
              Growth per unit of roughness, roughly return divided by
              volatility. Above 1.0 is generally considered respectable. It is
              what lets two different journeys be compared honestly.
            </p>
          </div>
        </div>
      </div>

      {/* ---------- Step 5: the comparison ---------- */}
      <div className="learn-substep">
        <p className="learn-substep-title">Step 5: judge it against the benchmark</p>
        <p>
          On its own, 275.22 tells you nothing. Now compare, over the identical
          ten years with the identical $100:
        </p>

        <div className="learn-factrow">
          <div className="learn-fact">
            <span className="learn-fact-label">Strategy, final value</span>
            <span className="learn-fact-value">$275.22</span>
          </div>
          <div className="learn-fact">
            <span className="learn-fact-label">Buy and hold, final value</span>
            <span className="learn-fact-value">$364.33</span>
          </div>
          <div className="learn-fact">
            <span className="learn-fact-label">Worst fall, strategy</span>
            <span className="learn-fact-value learn-positive">-19.11%</span>
          </div>
          <div className="learn-fact">
            <span className="learn-fact-label">Worst fall, buy and hold</span>
            <span className="learn-fact-value learn-negative">-35.40%</span>
          </div>
        </div>

        <p>
          The verdict is a tradeoff, and reports are full of them. Buy and hold
          won on growth: $364 against $275. The strategy won on stability: its
          worst fall was roughly half as deep, and its Sharpe ratio is higher
          (1.07 against 0.80), which says the growth it did achieve came with a
          smoother ride. Neither answer is simply right. Which one suits you
          depends on how much falling value you could sit with before abandoning
          the plan.
        </p>
      </div>

      {/* ---------- Interactive: other periods ---------- */}
      <div className="learn-fin">
        <p className="learn-fin-title">The same report, three different periods</p>
        <p className="learn-fin-hint">
          A backtest is a statement about one slice of history. Switch the
          period and watch the verdict change. Start with the ten-year view.
        </p>

        <div className="learn-ordertypes">
          {REPORTS.map((rep, i) => (
            <button
              key={rep.id}
              type="button"
              className={`learn-ordertype ${i === idx ? 'is-active' : ''}`}
              onClick={() => setIdx(i)}
            >
              {rep.label}
            </button>
          ))}
        </div>

        <div className="learn-report-grid">
          <div className="learn-report-side">
            <p className="learn-report-side-title">Strategy</p>
            <img
              className="learn-report-img"
              src={r.strategySvg}
              alt={`Stock Health Filter equity curve over ${r.period}`}
            />
            <div className="learn-factrow">
              <div className="learn-fact">
                <span className="learn-fact-label">Final value</span>
                <span className="learn-fact-value">${r.strategy.final}</span>
              </div>
              <div className="learn-fact">
                <span className="learn-fact-label">CAGR</span>
                <span className="learn-fact-value">{r.strategy.cagr}</span>
              </div>
              <div className="learn-fact">
                <span className="learn-fact-label">Max drawdown</span>
                <span className="learn-fact-value learn-positive">{r.strategy.drawdown}</span>
              </div>
              <div className="learn-fact">
                <span className="learn-fact-label">Sharpe</span>
                <span className="learn-fact-value">{r.strategy.sharpe}</span>
              </div>
            </div>
          </div>

          <div className="learn-report-side">
            <p className="learn-report-side-title">Buy and hold</p>
            <img
              className="learn-report-img"
              src={r.benchmarkSvg}
              alt={`Buy and hold equity curve over ${r.period}`}
            />
            <div className="learn-factrow">
              <div className="learn-fact">
                <span className="learn-fact-label">Final value</span>
                <span className="learn-fact-value">${r.benchmark.final}</span>
              </div>
              <div className="learn-fact">
                <span className="learn-fact-label">CAGR</span>
                <span className="learn-fact-value">{r.benchmark.cagr}</span>
              </div>
              <div className="learn-fact">
                <span className="learn-fact-label">Max drawdown</span>
                <span className="learn-fact-value learn-negative">{r.benchmark.drawdown}</span>
              </div>
              <div className="learn-fact">
                <span className="learn-fact-label">Sharpe</span>
                <span className="learn-fact-value">{r.benchmark.sharpe}</span>
              </div>
            </div>
          </div>
        </div>

        <p className="learn-caption learn-caption-strong">{r.note}</p>
      </div>

      {/* ---------- Step 6: what the report cannot tell you ---------- */}
      <div className="learn-substep">
        <p className="learn-substep-title">Step 6: what the report cannot tell you</p>
        <p>
          Three limits worth carrying away. First, this is one strategy&apos;s
          record, and every period shown is still history: the next decade is
          allowed to differ from the last one. Second, check that the test
          avoided the three traps from Module A; a report built on stale data or
          a peek at the future flatters itself. Third, the numbers hide
          something real: an average of 10.66% a year was actually a strong
          year, then a bad one, then a flat stretch, lived one day at a time.
        </p>
        <p>
          That is the honest use of a report like this one. It does not tell you
          what a strategy will do. It tells you what kind of ride the rules have
          produced so far, which is the best evidence anyone has before
          committing real money.
        </p>
      </div>

      <Narrator icon={ClipboardList}>
        You now read a performance report the way an analyst does: the curves
        first, the four numbers second, and the benchmark always in view. The
        Performance page on this site reports the same figures for live
        strategies, and you can now interpret all of it.
      </Narrator>

      <Recap points={[
        <>A backtest compares the strategy against <GlossaryText text="buy and hold" glossary={G} /> over the same period with the same money.</>,
        <>Read the shape of the curve first. The ending number hides the journey.</>,
        <>Final value and CAGR measure growth. Max drawdown measures the worst fall. Sharpe balances the two.</>,
        <>A verdict is usually a tradeoff: more growth or a smoother ride. The benchmark decides which one you are actually paying for.</>,
      ]} />
    </div>
  );
}
