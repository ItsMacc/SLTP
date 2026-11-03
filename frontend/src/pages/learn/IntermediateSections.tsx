// IntermediateSections.tsx — the four new Intermediate lessons plus the
// strategy anatomy tour. Each one follows the course anatomy: objective, body
// in chunks with the interactive early, three-bullet recap.
//
// Claims are written as hypotheses, never as facts. Chart examples are fixed
// arrays labelled as illustrative, so the text and the picture always agree.

import { useState } from 'react';
import { ArrowRight, Calculator, MessageSquare, Puzzle, Brain } from 'lucide-react';
import Button from '../../ui/Button';
import { GlossaryText } from '../../components/GlossaryText';
import Select from '../../ui/Select';
import { LEARN_GLOSSARY } from '../../learn/learnGlossary';
import { Narrator, Objective, Recap } from './parts';


const GText = ({ children }: { children: string }) => (
  <GlossaryText text={children} glossary={LEARN_GLOSSARY} />
);

/* ============================================================
   Market psychology
   ============================================================ */

// Fixed, illustrative path: calm, a run up, a sharp fall, a partial recovery.
// Fixed so the sentence next to it is always true.
const PSYCH_PATH = [100, 101, 100, 102, 104, 108, 113, 121, 118, 106, 97, 99, 104, 108];

const PSYCH_PHASES = [
  {
    label: 'Calm',
    range: [0, 2] as const,
    feeling: 'Nobody is excited. Few people are watching closely.',
    chart: 'The price drifts sideways in a narrow range.',
  },
  {
    label: 'Optimism',
    range: [3, 6] as const,
    feeling: 'Good news arrives and holders feel clever. Attention grows.',
    chart: 'The line climbs, slowly at first and then faster.',
  },
  {
    label: 'Rush in',
    range: [6, 7] as const,
    feeling: 'People buy because others are buying, not because of new information.',
    chart: 'The climb gets steep, and the price overshoots the earlier trend.',
  },
  {
    label: 'Panic',
    range: [8, 10] as const,
    feeling: 'The fall is frightening, so holders sell to stop the discomfort.',
    chart: 'The line drops hard, ending below where the run began.',
  },
  {
    label: 'Recovery',
    range: [10, 13] as const,
    feeling: 'The worst did not happen. Calmer buyers return.',
    chart: 'The price partly retraces the fall.',
  },
];

const BEHAVIOURS = [
  {
    name: 'Fear and greed',
    text: 'People pay up when they expect more, and dump when they fear more. Both push price past a fair estimate.',
    chart: 'Prices overshoot in both directions, then drift back.',
    caveat: 'Overshoots are only obvious afterwards, so sizing matters more than timing.',
  },
  {
    name: 'Herding',
    text: 'Buying because others buy needs no new information, and it is contagious.',
    chart: 'A trend extends further than the news alone would justify.',
    caveat: 'Crowded trades reverse sharply when the last buyer arrives.',
  },
  {
    name: 'Overreaction',
    text: 'Bad news gets priced as if it were worse than it is.',
    chart: 'A sharp fall is followed by a partial bounce.',
    caveat: 'Some falls are fully justified; telling the two apart is the hard part.',
  },
  {
    name: 'Underreaction',
    text: 'Good news is absorbed slowly, as people wait for confirmation.',
    chart: 'A move continues for days or weeks after the news is public.',
    caveat: 'Slow absorption looks identical to a random drift until it is tested.',
  },
  {
    name: 'Loss aversion',
    text: 'A loss hurts more than an equal gain pleases, so people hold losers hoping to break even and bank winners early.',
    chart: 'Selling clusters after small gains; big losers linger.',
    caveat: 'This affects the trader, not the price. Rules exist to remove the choice.',
  },
  {
    name: 'Anchoring',
    text: 'People fix on a memorable price and judge everything against it.',
    chart: 'Buying appears around old highs and lows, whatever happened since.',
    caveat: 'The old price carries no information unless something real changed with it.',
  },
];

export function MarketPsychologySection() {
  const [phase, setPhase] = useState(0);
  const p = PSYCH_PHASES[phase];

  // One fixed polyline; the current phase's points are drawn larger.
  const min = Math.min(...PSYCH_PATH);
  const max = Math.max(...PSYCH_PATH);
  const points = PSYCH_PATH.map((v, i) => {
    const x = (i / (PSYCH_PATH.length - 1)) * 280 + 10;
    const y = 100 - ((v - min) / (max - min || 1)) * 80;
    return { x, y, v, i };
  });

  return (
    <div>
      <Objective>
        Why crowds of people make prices move the way they do, and why that makes some
        patterns worth testing.
      </Objective>

      <p>
        <GText>Why do prices move?</GText> explained the mechanism: buyers and sellers change
        the balance. This lesson is about the people on both sides. They change their minds in
        fairly predictable ways.
      </p>

      <div className="learn-fin">
        <p className="learn-fin-title">A crowd, one phase at a time</p>
        <p className="learn-fin-hint">
          An illustrative price path. Step through it and watch what people are feeling and
          what the chart is doing at the same time.
        </p>

        <svg viewBox="0 0 300 110" className="learn-pricechart" role="img" aria-label="Illustrative price path with the current phase marked">
          <polyline
            points={points.map((pt) => `${pt.x},${pt.y}`).join(' ')}
            className="chart-line up"
          />
          {points
            .filter((pt) => pt.i >= p.range[0] && pt.i <= p.range[1])
            .map((pt) => (
              <circle key={pt.i} cx={pt.x} cy={pt.y} r={3} className="learn-phase-dot" />
            ))}
        </svg>

        <div className="learn-ordertypes">
          {PSYCH_PHASES.map((item, i) => (
            <Button
              key={item.label}
              variant="chip"
              className={`learn-ordertype ${i === phase ? 'is-active' : ''}`}
              onClick={() => setPhase(i)}
            >
              {item.label}
            </Button>
          ))}
        </div>

        <div className="learn-factrow">
          <div className="learn-fact">
            <span className="learn-fact-label">What people feel</span>
            <span className="learn-fact-value">{p.feeling}</span>
          </div>
          <div className="learn-fact">
            <span className="learn-fact-label">What the chart shows</span>
            <span className="learn-fact-value">{p.chart}</span>
          </div>
        </div>
      </div>

      <p>
        Six behaviours come up again and again. None of them is a law, and each one has a
        reason it might stop working.
      </p>

      <div className="learn-cards">
        {BEHAVIOURS.map((b) => (
          <div className="learn-card" key={b.name}>
            <p className="learn-card-term">{b.name}</p>
            <p>{b.text}</p>
            <p className="learn-card-note">{b.chart}</p>
            <p className="learn-card-note">Why it might stop working: {b.caveat}</p>
          </div>
        ))}
      </div>

      <p>
        This is where strategy ideas come from. Many strategies lean on one of these
        behaviours. SLTP&apos;s Statistical Mean Reversion strategy buys a name that is
        oversold on RSI and far below its own 20-day average, which is an
        <GText> overreaction</GText> bet. Trend filters, such as requiring the price to be above
        a long moving average, lean on herding and slow absorption instead. Not every strategy
        is built this way: some come from how markets are structured, or from how risk is
        priced.
      </p>

      <Narrator icon={Brain}>
        If a pattern were easy and widely traded, the trading itself would tend to remove it.
        That is why researchers treat every behaviour here as a claim to test rather than a
        fact to rely on.
      </Narrator>

      <p>
        One serious position says markets are efficient enough that most of this cannot be
        turned into profit after costs. That view deserves respect: it is the reason a strategy
        has to prove itself against a plain baseline before anyone trusts it.
      </p>

      <Recap points={[
        <>Crowds do predictable things: overshoot, herd, overreact, underreact, cling to old prices.</>,
        <>Many strategies are built on one of those behaviours, but none of them is a law.</>,
        <>Anything easy and obvious tends to get competed away, so every pattern needs a test.</>,
      ]} />
    </div>
  );
}

/* ============================================================
   Where strategy ideas come from
   ============================================================ */

const PIPELINE = [
  { title: 'Notice something', text: 'A pattern in prices, or a behaviour in people, that looks repeatable.' },
  { title: 'Ask why it might happen', text: 'A reason the pattern could exist: overreaction, forced sellers, slow information.' },
  { title: 'State the hypothesis', text: 'One sentence specific enough that data could prove it wrong.' },
  { title: 'Turn it into exact rules', text: 'A measurable condition for entry, an exit, a size, a universe.' },
  { title: 'Test it, and be ready to drop it', text: 'Most ideas fail. Discarding them cheaply is the job.' },
];

const HUNCHES = [
  {
    text: '“Tech stocks are good.”',
    testable: false,
    why: 'No time frame, no measure, no outcome. Nothing could contradict it.',
  },
  {
    text: '“A stock that rises 10 days in a row is more likely than not to rise on day 11.”',
    testable: true,
    why: 'A clear condition, a clear outcome, and a comparison that can fail.',
  },
  {
    text: '“Markets are irrational.”',
    testable: false,
    why: 'Too vague to measure. Irrational by what standard, over what period?',
  },
  {
    text: '“When the 5-day return is below −10%, the next 10 days tend to be positive.”',
    testable: true,
    why: 'Exact threshold, exact horizon, and an average that could come out negative.',
  },
];

export function IdeasSection() {
  const [picks, setPicks] = useState<Record<number, boolean>>({});

  return (
    <div>
      <Objective>
        How a hunch becomes a hypothesis, and why most ideas should be thrown away.
      </Objective>

      <p>
        A strategy does not start as code. It starts as a suspicion about how prices behave.
        The work is turning that suspicion into something a test can support or destroy.
      </p>

      <div className="learn-rules">
        {PIPELINE.map((step, i) => (
          <div className="learn-rule" key={step.title}>
            <span className="learn-rule-num">{i + 1}</span>
            <p>
              <strong>{step.title}.</strong> {step.text}
            </p>
          </div>
        ))}
      </div>

      <p>Ideas come from four places:</p>
      <ul className="learn-movelist">
        <li><strong>Watching people behave.</strong> The behaviours in the last lesson suggest where prices might overshoot.</li>
        <li><strong>How markets are built.</strong> Index changes force funds to buy, month-end flows force selling, and fees create predictable pressure.</li>
        <li><strong>Published research.</strong> Other people have already written down hypotheses with reasons. Reading them is faster than starting from nothing.</li>
        <li><strong>Digging through data.</strong> Useful, and dangerous on its own: with enough combinations you will always find a pattern that is only noise.</li>
      </ul>

      <div className="learn-fin">
        <p className="learn-fin-title">One idea, all five steps</p>
        <p className="learn-fin-hint">
          An example, not a recommendation, and not a result. Notice that every step makes the
          idea more specific and easier to disprove.
        </p>
        <div className="learn-factrow">
          <div className="learn-fact">
            <span className="learn-fact-label">1. Notice</span>
            <span className="learn-fact-value">Stocks that fall hard in a week often bounce.</span>
          </div>
          <div className="learn-fact">
            <span className="learn-fact-label">2. Why it might happen</span>
            <span className="learn-fact-value">Sellers overreact to bad news, then calmer buyers return.</span>
          </div>
          <div className="learn-fact">
            <span className="learn-fact-label">3. Hypothesis</span>
            <span className="learn-fact-value">A 5-day return below −10% is followed by a positive 10-day return on average.</span>
          </div>
          <div className="learn-fact">
            <span className="learn-fact-label">4. Exact rules</span>
            <span className="learn-fact-value">Buy when the 5-day return &lt; −10%. Exit after 10 days, or at a 10% stop.</span>
          </div>
          <div className="learn-fact">
            <span className="learn-fact-label">5. How it would be tested</span>
            <span className="learn-fact-value">Compare the average 10-day return after the signal with all days, then on data not used to design it.</span>
          </div>
        </div>
        <p className="learn-caption">
          Nothing above says the idea works. It says the idea could now be checked, and would
          survive only if the numbers agreed.
        </p>
      </div>

      <div className="learn-fin">
        <p className="learn-fin-title">Is this a hypothesis?</p>
        <p className="learn-fin-hint">Mark each statement, then read why.</p>
        {HUNCHES.map((h, i) => {
          const picked = picks[i];
          return (
            <div key={h.text} className="learn-hunch">
              <p className="learn-hunch-text">{h.text}</p>
              <div className="learn-ordertypes">
                <Button
                  variant="chip"
                  className={`learn-ordertype ${picked === true ? 'is-active' : ''}`}
                  onClick={() => setPicks((p) => ({ ...p, [i]: true }))}
                >
                  Testable
                </Button>
                <Button
                  variant="chip"
                  className={`learn-ordertype ${picked === false ? 'is-active' : ''}`}
                  onClick={() => setPicks((p) => ({ ...p, [i]: false }))}
                >
                  Not testable
                </Button>
              </div>
              {picked !== undefined && (
                <p className={`learn-hunch-feedback ${picked === h.testable ? 'is-right' : 'is-wrong'}`}>
                  {picked === h.testable ? 'Correct. ' : 'Not quite. '}
                  {h.why}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <Narrator>
        A hypothesis has to be able to fail. “Stocks go up when the news is good” cannot fail,
        so a test of it teaches nothing.
      </Narrator>

      <p>
        Most ideas fail when they meet data. That is the normal outcome, not a broken process.
        A researcher&apos;s job is to discard bad ideas cheaply, before any money is involved.
      </p>

      <Recap points={[
        <>Ideas start as a suspicion, and become useful only as a hypothesis that could be wrong.</>,
        <>Exact rules mean a measured condition, a measured outcome, and a horizon.</>,
        <>Most ideas fail a test. Throwing them away cheaply is the work.</>,
      ]} />
    </div>
  );
}

/* ============================================================
   Why maths helps
   ============================================================ */

const CALM = [100, 100.4, 99.8, 100.2, 100.1, 99.9, 100.3, 100.0];
const WILD = [100, 104, 97, 103, 94, 101, 92, 99];

const rangeOf = (series: number[]) => {
  const min = Math.min(...series);
  const max = Math.max(...series);
  return { min, max, spread: +(max - min).toFixed(1) };
};

export function WhyMathSection() {
  const [winRate, setWinRate] = useState(40);
  const [avgWin, setAvgWin] = useState(300);
  const [avgLoss, setAvgLoss] = useState(150);

  const expectancy = (winRate / 100) * avgWin - (1 - winRate / 100) * avgLoss;
  const calm = rangeOf(CALM);
  const wild = rangeOf(WILD);

  return (
    <div>
      <Objective>
        How maths turns a vague idea into a rule two people would apply identically, and how
        it measures risk and expected value.
      </Objective>

      <p>
        &ldquo;The stock has been going up a lot lately&rdquo; is not a rule. Two people will
        read it differently, and a computer cannot read it at all. Maths is how the vague
        sentence becomes exact.
      </p>

      <div className="learn-rules">
        <div className="learn-rule">
          <span className="learn-rule-num">1</span>
          <p><strong>Vague:</strong> &ldquo;it has been going up a lot.&rdquo;</p>
        </div>
        <div className="learn-rule">
          <span className="learn-rule-num">2</span>
          <p><strong>Measured:</strong> compare the price with its price 60 trading days ago.</p>
        </div>
        <div className="learn-rule">
          <span className="learn-rule-num">3</span>
          <p><strong>Exact:</strong> &ldquo;the price is 20% higher than it was 60 trading days ago.&rdquo;</p>
        </div>
      </div>

      <div className="learn-cards">
        <div className="learn-card">
          <p className="learn-card-term"><GText>Percent change</GText></p>
          <p>How far a price moved, as a share of where it started. It lets you compare a $5 stock with a $500 one.</p>
          <p className="learn-card-note">$80 to $100 is +25%. The 20-dollar move is 25% of 80.</p>
        </div>
        <div className="learn-card">
          <p className="learn-card-term"><GText>Average</GText></p>
          <p>The sum of the last N closes divided by N. It smooths daily noise so direction is easier to see.</p>
          <p className="learn-card-note">Closes of 100, 102 and 104 average 102.</p>
        </div>
      </div>

      <div className="learn-fin">
        <p className="learn-fin-title">Volatility: the typical size of the wiggle</p>
        <p className="learn-fin-hint">
          Two illustrative series with the same starting price. Same average, very different
          experience.
        </p>
        <div className="learn-factrow">
          <div className="learn-fact">
            <span className="learn-fact-label">Calm series range</span>
            <span className="learn-fact-value">${calm.min} to ${calm.max} (${calm.spread})</span>
          </div>
          <div className="learn-fact">
            <span className="learn-fact-label">Wild series range</span>
            <span className="learn-fact-value learn-negative">${wild.min} to ${wild.max} (${wild.spread})</span>
          </div>
        </div>
        <p className="learn-caption learn-caption-strong">
          The wild series swings several times as far, so a stop that survives the calm one gets
          hit for no reason on the wild one. <GText>Volatility</GText> is how that gets measured,
          in one number, usually as the <GText>standard deviation</GText> of returns.
        </p>
      </div>

      <div className="learn-fin">
        <p className="learn-fin-title">Expectancy: what a trade is worth on average</p>
        <p className="learn-fin-hint">
          A strategy can win less than half its trades and still make money. Move the dials.
        </p>

        <div className="learn-slider-block">
          <div className="learn-slider-readout">
            <span>Win rate</span>
            <strong className="learn-money">{winRate}%</strong>
          </div>
          <input
            type="range"
            min={30}
            max={70}
            step={1}
            value={winRate}
            onChange={(e) => setWinRate(parseInt(e.target.value, 10))}
            className="learn-slider"
            aria-label="Win rate percentage"
          />
        </div>

        <div className="learn-slider-block">
          <div className="learn-slider-readout">
            <span>Average win</span>
            <strong className="learn-money">${avgWin}</strong>
          </div>
          <input
            type="range"
            min={100}
            max={500}
            step={10}
            value={avgWin}
            onChange={(e) => setAvgWin(parseInt(e.target.value, 10))}
            className="learn-slider"
            aria-label="Average win in dollars"
          />
        </div>

        <div className="learn-slider-block">
          <div className="learn-slider-readout">
            <span>Average loss</span>
            <strong className="learn-money">${avgLoss}</strong>
          </div>
          <input
            type="range"
            min={50}
            max={400}
            step={10}
            value={avgLoss}
            onChange={(e) => setAvgLoss(parseInt(e.target.value, 10))}
            className="learn-slider"
            aria-label="Average loss in dollars"
          />
        </div>

        <div className="learn-factrow">
          <div className="learn-fact">
            <span className="learn-fact-label">Expectancy per trade</span>
            <span className={`learn-fact-value ${expectancy >= 0 ? 'learn-positive' : 'learn-negative'}`}>
              {expectancy >= 0 ? '+' : '-'}${Math.abs(Math.round(expectancy))}
            </span>
          </div>
          <div className="learn-fact">
            <span className="learn-fact-label">Over 100 trades</span>
            <span className={`learn-fact-value ${expectancy >= 0 ? 'learn-positive' : 'learn-negative'}`}>
              {expectancy >= 0 ? '+' : '-'}${Math.abs(Math.round(expectancy * 100)).toLocaleString()}
            </span>
          </div>
        </div>
        <p className="learn-caption learn-caption-strong">
          {expectancy >= 0
            ? 'Each trade is worth this much on average before costs. Costs are not included here, and they come out of this number.'
            : 'This combination loses money on average. The win rate is real, but the losses are too large for it.'}
        </p>
      </div>

      <p>
        A computer applies the same rule the same way every time, so the result can be repeated
        and compared. That is the whole advantage: not prediction, consistency.
      </p>

      <Narrator>
        Maths describes the past and prices risk. It does not tell you what happens next.
      </Narrator>

      <Recap points={[
        <>Maths removes ambiguity, so two people and a computer get the same answer.</>,
        <>Percent change, averages and volatility turn vague descriptions into measurable ones.</>,
        <>Expectancy combines win rate with win and loss size, which is why a low win rate can still pay.</>,
      ]} />
    </div>
  );
}

/* ============================================================
   Talking like a professional
   ============================================================ */

const VOCAB = [
  { term: 'quant', plain: 'The name for people who build trading and investment rules from data and maths.', line: 'Shorthand for quantitative analyst. The rest of this course says researchers or professionals.' },
  { term: 'hypothesis', plain: 'A statement specific enough to be proven wrong.', line: 'My hypothesis is that sharp one-week falls partly reverse.' },
  { term: 'signal', plain: 'The moment the rules say to act.', line: 'The signal fires when the 5-day return is below −10%.' },
  { term: 'edge', plain: 'A repeatable reason to beat a fair baseline, after costs.', line: 'Without an edge, a good backtest is luck or overfitting.' },
  { term: 'factor', plain: 'A measurable characteristic shared across many stocks.', line: 'Momentum is a factor: recent winners have tended to keep winning, on average.' },
  { term: 'regime', plain: 'A stretch of market conditions with a similar character.', line: 'The strategy was tested in a calm regime and a crisis regime.' },
  { term: 'parameter', plain: 'An adjustable number the rules use.', line: 'The RSI period is a parameter; 25 is the chosen value.' },
  { term: 'universe', plain: 'The list of stocks the strategy may choose from.', line: 'The universe is the 100 most heavily traded names.' },
  { term: 'noise', plain: 'Random movement that carries no information.', line: 'A two-day dip is usually noise; a 20% fall is not.' },
  { term: 'overfitting', plain: 'Tuning until the rules describe one slice of history.', line: 'A perfect curve on one window is a warning sign of overfitting.' },
  { term: 'in-sample', plain: 'The data used to design and tune the rules.', line: 'Ten years in-sample, then two years held back.' },
  { term: 'out-of-sample', plain: 'Data held back and used only to check.', line: 'The out-of-sample test is what a new period would feel like.' },
  { term: 'drawdown', plain: 'The worst fall from a peak before recovering.', line: 'A 20% drawdown is the worst an owner had to sit through.' },
];

const BUILDER = {
  hypothesis: ['sharp falls partly reverse', 'recent strength continues'],
  signal: ['5-day return below −10%', 'price above its 200-day average'],
  entry: ['buy at the next open', 'buy when the signal fires'],
  exit: ['10 days or a 10% stop', 'a 5% stop and a 15% target'],
  risk: ['1% of the account per trade', '2% of the account per trade'],
};

type BuilderKey = keyof typeof BUILDER;

export function VocabularySection() {
  const [pick, setPick] = useState<Record<BuilderKey, number>>({
    hypothesis: 0, signal: 0, entry: 0, exit: 0, risk: 0,
  });

  const sentence = [
    `My hypothesis is that ${BUILDER.hypothesis[pick.hypothesis]}.`,
    `The signal is a ${BUILDER.signal[pick.signal]}.`,
    `The entry rule is to ${BUILDER.entry[pick.entry]}.`,
    `The exit is ${BUILDER.exit[pick.exit]}.`,
    `Risk is limited to ${BUILDER.risk[pick.risk]}, then tested in-sample and out-of-sample.`,
  ].join(' ');

  return (
    <div>
      <Objective>
        The words researchers use, and how to describe an idea in the order they would.
      </Objective>

      <p>Here are some words worth knowing.</p>

      <div className="learn-cards">
        {VOCAB.map((v) => (
          <div className="learn-card" key={v.term}>
            <p className="learn-card-term">{v.term}</p>
            <p>{v.plain}</p>
            <p className="learn-card-note">“{v.line}”</p>
          </div>
        ))}
      </div>

      <div className="learn-fin">
        <p className="learn-fin-title">Say it in the standard order</p>
        <p className="learn-fin-hint">
          Pick one option in each row. The paragraph below is how a researcher would describe the
          same idea, in the order that leaves nothing out.
        </p>

        {(Object.keys(BUILDER) as BuilderKey[]).map((key) => (
          <div className="learn-builder-row" key={key}>
            <span className="learn-builder-label">{key}</span>
            <div className="learn-builder-field">
              <Select
                ariaLabel={key}
                options={BUILDER[key].map((option, i) => ({ label: option, value: i }))}
                value={pick[key]}
                onChange={(v) => setPick((p) => ({ ...p, [key]: Number(v) }))}
              />
            </div>
          </div>
        ))}

        <p className="learn-caption learn-caption-strong">{sentence}</p>
      </div>

      <div className="learn-fin">
        <p className="learn-fin-title">Say this, not that</p>
        <div className="learn-saynot">
          <div className="learn-saynot-row">
            <p>“I think it&apos;ll bounce.”</p>
            <p>“My hypothesis is that short-term losers revert; the signal is a 5-day return below −10%.”</p>
          </div>
          <div className="learn-saynot-row">
            <p>“This chart looks strong.”</p>
            <p>“Price is 8% above its 200-day average, which is the trend filter in this strategy.”</p>
          </div>
          <div className="learn-saynot-row">
            <p>“It did well last year.”</p>
            <p>“It returned 14% in-sample; the out-of-sample check has not been run yet.”</p>
          </div>
        </div>
      </div>

      <Recap points={[
        <>Precise words save arguments: hypothesis, signal, edge, regime, parameter.</>,
        <>Describe an idea in order: hypothesis, signal, entry, exit, risk, test.</>,
        <>Saying “out-of-sample” out loud is a habit that prevents most self-deception.</>,
      ]} />
    </div>
  );
}

/* ============================================================
   Anatomy of a real SLTP strategy
   ============================================================ */

// Taken from app/strategies/statistical_mean_reversion.py. If those numbers
// change in the engine, change them here in the same pass.
const SMR_PARTS = [
  { part: 'The idea', value: 'Names that fall hard, quickly, partly recover. An overreaction bet.' },
  { part: 'Indicators', value: 'RSI over 25 bars, and a z-score: how many 20-bar standard deviations the close sits from its 20-bar average.' },
  { part: 'Entry', value: 'Buy when RSI < 30 and the z-score < −1.5. Both must be true.' },
  { part: 'Position size', value: 'Base size is 1 ÷ 20 positions, scaled up a little when the dislocation is deeper. At most 20 names.' },
  { part: 'Stop-loss', value: 'Entry price − 3 × the 20-bar standard deviation.' },
  { part: 'Take-profit', value: 'Entry price + 3 × the same standard deviation.' },
  { part: 'Exit', value: 'RSI recovers to 70, and the threshold loosens as price stretches further from its average.' },
  { part: 'Universe and rebalancing', value: 'Top 100 names by 252-bar dollar volume, up to 20 ETF slots, rebuilt yearly.' },
];

export function AnatomySection({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  return (
    <div>
      <Objective>
        Read any strategy in the library: what each part is, and how to judge it.
      </Objective>

      <p>
        This is SLTP&apos;s <strong>Statistical Mean Reversion</strong> strategy, the same one in
        the library. Every value below is taken from the engine&apos;s code, not invented for the
        lesson.
      </p>

      <div className="learn-rules">
        {SMR_PARTS.map((row, i) => (
          <div className="learn-rule" key={row.part}>
            <span className="learn-rule-num">{i + 1}</span>
            <p>
              <strong>{row.part}.</strong> {row.value}
            </p>
          </div>
        ))}
      </div>

      <p>
        The numbers above are <strong>parameters</strong>. &ldquo;Settings you can defend&rdquo;
        is the phrase the rest of the site uses for how they were chosen: each candidate is
        scored on risk-adjusted return, then filtered by drawdown and trade count, and kept only
        where nearby values work too. A setting that is wonderful at 25 days and useless at 20
        and 30 is a spike, not an edge.
      </p>

      <Narrator icon={Puzzle}>
        Two rules with the same idea can differ only in their parameters. That is why the values
        matter, and why a strategy has to be judged on more than one period.
      </Narrator>

      <div className="learn-fin">
        <p className="learn-fin-title">Reading its results page at a glance</p>
        <div className="learn-factrow">
          <div className="learn-fact">
            <span className="learn-fact-label">Final value</span>
            <span className="learn-fact-value">What $100 became. Says nothing about the ride.</span>
          </div>
          <div className="learn-fact">
            <span className="learn-fact-label">CAGR</span>
            <span className="learn-fact-value">The steady yearly rate that gets you there.</span>
          </div>
          <div className="learn-fact">
            <span className="learn-fact-label">Max drawdown</span>
            <span className="learn-fact-value">The worst fall an owner sat through.</span>
          </div>
          <div className="learn-fact">
            <span className="learn-fact-label">Sharpe</span>
            <span className="learn-fact-value">Return per unit of wobble.</span>
          </div>
        </div>
        <p className="learn-caption">
          Every number hides the same thing: the order the returns arrived in. That is what a
          drawdown makes visible. How to test all of this properly is the Advanced level.
        </p>
      </div>

      <div className="learn-fin">
        <p className="learn-fin-title">Checklist for judging any strategy</p>
        <ul className="learn-movelist">
          <li>Is there a reason it should work, beyond a pattern that happened once?</li>
          <li>Are the rules exact enough for a computer to apply them identically?</li>
          <li>Is the risk on each trade limited, and the position size stated?</li>
          <li>Does it hold up across different periods, not one window?</li>
          <li>Are the parameters a plateau, or a single lucky combination?</li>
        </ul>
      </div>

      <div className="learn-ordertypes">
        <Button variant="outline" size="sm" onClick={() => onNavigate?.('strategies')}>
          Open the strategy library <ArrowRight size={15} />
        </Button>
        <Button variant="outline" size="sm" onClick={() => onNavigate?.('docs')}>
          Read the docs <ArrowRight size={15} />
        </Button>
      </div>

      <Recap points={[
        <>Every strategy has the same parts: idea, indicators, entry, size, stop, target, universe.</>,
        <>Parameters are the adjustable numbers; defensible ones also work at nearby values.</>,
        <>Judging one takes five questions, and no single number answers them.</>,
      ]} />
    </div>
  );
}

/** Icons re-exported so LearnPage's imports stay explicit about what it uses. */
export const INTERMEDIATE_ICONS = { Brain, Calculator, MessageSquare, Puzzle };
