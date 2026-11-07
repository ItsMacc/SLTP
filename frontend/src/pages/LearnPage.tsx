// LearnPage.tsx — "Absolute beginner" course: plain-language, interactive
// lessons that teach stocks, price movement, order execution, candles,
// strategies, risk and testing from zero.
// Layout mirrors DocsPage: sticky sidebar TOC on the left, content on the right,
// with the course map (header, up next, tier stepper) at the top of the column.
import { useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowRight, Award, BookOpen, Building2, Calculator, Check, ChevronRight,
  CircleDollarSign, FlaskConical, Lightbulb, Lock, Receipt, Sparkles, Terminal, TrendingUp, Users,
} from 'lucide-react';
import { GlossaryText } from '../components/GlossaryText';
import { LEARN_GLOSSARY } from '../learn/learnGlossary';
import { useLearn } from '../learn/useLearn';
import { TIERS } from '../learn/curriculum';
import { badgeFor } from '../learn/badges';
import LongShortSection from './learn/LongShortSection';
import { OrderBookSection, SpreadsSection } from './learn/Tier2Sections';
import { IndexSection, TradingVsInvestingSection } from './learn/Tier3Basics';
import { IndicatorsSection } from './learn/IndicatorsSection';
import { BacktestWalkthroughSection } from './learn/BacktestWalkthrough';
import { AllocationSection, MetricsSection } from './learn/Tier5Sections';
import {
  AnatomySection, IdeasSection, MarketPsychologySection, VocabularySection, WhyMathSection,
} from './learn/IntermediateSections';
import {
  CodeReadingSection, CodeWritingSection, StatementsSection, ValuationSection,
} from './learn/AdvancedNewSections';
import { Objective, Recap, SectionQuiz } from './learn/parts';
import { MODULE_QUIZZES } from '../learn/moduleQuizzes';
import RewardToast from './learn/RewardToast';
import { BadgeShelf, TierBanner, TierGate, TierNav } from './learn/LearnShell';
import { useActiveSection } from '../learn/useActiveSection';
import Button from '../ui/Button';
import './LearnPage.css';

interface LearnPageProps {
  onNavigate?: (tab: string) => void;
}

/** Wraps one plain sentence so every term in it is one hover away. */
const G = ({ children }: { children: string }) => (
  <GlossaryText text={children} glossary={LEARN_GLOSSARY} />
);

/** Scrolls a lesson back to its own heading — story steps change in place. */
function scrollToSectionTop(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- small building blocks ----------

function Continue({ onClick, label = 'Continue' }: { onClick: () => void; label?: string }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      {label}
      <ChevronRight size={15} />
    </Button>
  );
}

function Narrator({ icon: Icon = Lightbulb, children }: { icon?: typeof Lightbulb; children: React.ReactNode }) {
  return (
    <div className="learn-narrator">
      <span className="learn-narrator-icon"><Icon size={15} /></span>
      <p>{children}</p>
    </div>
  );
}

function Money({ value }: { value: number }) {
  return (
    <strong className="learn-money">
      ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
    </strong>
  );
}

// One compact row at the end of a lesson: the badge on offer, then a single
// button. Once it is done the same row names what comes next.
function ModuleComplete({ sectionId, learn, nextId, nextLabel, gateId }: {
  sectionId: string;
  learn: ReturnType<typeof useLearn>;
  nextId?: string;
  nextLabel?: string;
  /** Set on a tier's last lesson: the CTA points at the tier quiz. */
  gateId?: string;
}) {
  const badge = badgeFor(sectionId);
  const BadgeIcon = badge.icon;
  const done = learn.isSectionDone(sectionId);

  if (done) {
    return (
      <div className="learn-claim is-claimed">
        <span className="learn-claim-badge"><BadgeIcon size={18} /></span>
        <p className="learn-claim-line">
          <strong>{badge.name}</strong> collected
          {nextId && !learn.isSectionDone(nextId) && nextLabel ? ` · Next: ${nextLabel}` : ''}
        </p>
        {nextId && !learn.isSectionDone(nextId) && (
          <Button variant="outline" size="sm" onClick={() => scrollToSectionTop(nextId)}>
            Next lesson
            <ArrowRight size={15} />
          </Button>
        )}
        {!nextId && gateId && (
          <Button variant="outline" size="sm" onClick={() => scrollToSectionTop(gateId)}>
            Take the level quiz
            <ArrowRight size={15} />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="learn-claim">
      <span className="learn-claim-badge"><BadgeIcon size={18} /></span>
      <p className="learn-claim-line">
        <strong>Finished this lesson?</strong> {badge.name}
      </p>
      <Button variant="primary" size="sm" onClick={() => learn.completeSection(sectionId)}>
        Mark as done
        <Check size={15} />
      </Button>
    </div>
  );
}

// Persistent valuation readout shown in the story's corner while the
// company exists, so the math (30% of X = Y) is always visible.
function ValuationChip({ worth, stakePct }: { worth: number; stakePct: number }) {
  return (
    <div className="learn-valuation" aria-live="polite">
      <span className="learn-valuation-label">Company valuation</span>
      <span className="learn-valuation-worth"><Money value={worth} /></span>
      <span className="learn-valuation-stake">
        Your {stakePct}% = <Money value={Math.round((worth * stakePct) / 100)} />
      </span>
    </div>
  );
}

// ============================================================
// Lesson A: the company story, told one step at a time
// ============================================================
function StockSection() {
  // 0 pick investment, 1 profits accrue, 2 concept: ownership + why companies
  // sell shares, 3 concept: shares defined, 4 Alice buys, 5 payoff, 6 recap
  const [step, setStep] = useState(0);
  const [invest, setInvest] = useState(1000);
  const [years, setYears] = useState(0);
  const [sharesAnswer, setSharesAnswer] = useState('');
  const [sharesResult, setSharesResult] = useState<'none' | 'correct' | 'wrong'>('none');
  const [payoffBeat, setPayoffBeat] = useState(0);

  const profitSoFar = years * 100;
  const companyWorth = invest + profitSoFar;
  const saleValue = Math.round(companyWorth * 0.3);
  const correctShares = Math.round(saleValue / 3);
  const stakePct = step >= 2 ? 70 : 100;
  const finalWorth = companyWorth + 200;
  const alicePct = 30 / correctShares;
  const aliceValue = Math.round(((finalWorth * 0.3) / correctShares) * 100) / 100;

  const checkShares = () => {
    const n = parseInt(sharesAnswer.replace(/[^0-9]/g, ''), 10);
    setSharesResult(n === correctShares ? 'correct' : 'wrong');
  };

  const advance = (next: number) => {
    setStep(next);
    // The next beat replaces this one in place. Without this the reader is
    // left staring at empty space where the old copy used to be, so bring
    // them back to the top of the story for the new step.
    scrollToSectionTop('stocks');
  };

  const reset = () => {
    setStep(0);
    scrollToSectionTop('stocks');
    setYears(0);
    setSharesAnswer('');
    setSharesResult('none');
    setPayoffBeat(0);
  };

  return (
    <div className={`learn-story ${step >= 1 ? 'has-valuation' : ''}`}>
      <Objective>
        What a share is, and why owning one means owning part of a company and its future profit.
      </Objective>
      {step >= 1 && <ValuationChip worth={companyWorth} stakePct={stakePct} />}

      {/* Step 0: starting the company */}
      {step === 0 && (
        <div className="learn-story-step">
          <h4 className="learn-story-title">
            <Building2 size={18} /> You are starting a company
          </h4>
          <p>
            You have an idea for a company, and you put your own money in to get it open.
            How much do you put in?
          </p>

          <div className="learn-slider-block">
            <div className="learn-slider-readout">
              <span>You put in</span>
              <Money value={invest} />
            </div>
            <input
              type="range"
              min={1000}
              max={2000}
              step={100}
              value={invest}
              onChange={(e) => setInvest(parseInt(e.target.value, 10))}
              className="learn-slider"
              aria-label="Money you invest in your company"
            />
            <div className="learn-slider-scale">
              <span>$1,000</span><span>$2,000</span>
            </div>
          </div>

          <p>
            That money buys equipment, a small workspace, and stock for the shelves. The
            company is worth what it owns, and right now it owns what you put in.
          </p>

          <div className="learn-factrow">
            <div className="learn-fact">
              <span className="learn-fact-label">You put in</span>
              <span className="learn-fact-value"><Money value={invest} /></span>
            </div>
            <div className="learn-fact">
              <span className="learn-fact-label">You own</span>
              <span className="learn-fact-value">100% of a <Money value={invest} /> company</span>
            </div>
            <div className="learn-fact">
              <span className="learn-fact-label">Net so far</span>
              <span className="learn-fact-value"><Money value={0} /></span>
            </div>
          </div>

          <Narrator>
            Your {invest.toLocaleString()} dollars turned into equipment and stock, so you
            own a company worth the same amount. Nothing gained, nothing lost.
          </Narrator>

          <Continue onClick={() => advance(1)} />
        </div>
      )}

      {/* Step 1: profits accrue */}
      {step === 1 && (
        <div className="learn-story-step">
          <h4 className="learn-story-title">
            <CircleDollarSign size={18} /> The company starts earning
          </h4>
          <p>
            Your company sells its product and makes <Money value={100} /> of
            <G> profit</G> a year. Press the button to let time pass.
          </p>

          <div className="learn-yearbox">
            <Button variant="secondary" size="sm" className="learn-yearbtn" onClick={() => setYears((y) => y + 1)}>
              + 1 year
            </Button>
            <div className="learn-yeargrid">
              <div className="learn-fact">
                <span className="learn-fact-label">Years passed</span>
                <span className="learn-fact-value">{years}</span>
              </div>
              <div className="learn-fact">
                <span className="learn-fact-label">Profit earned</span>
                <span className="learn-fact-value learn-positive">+<Money value={profitSoFar} /></span>
              </div>
              <div className="learn-fact">
                <span className="learn-fact-label">Company worth</span>
                <span className="learn-fact-value"><Money value={companyWorth} /></span>
              </div>
              <div className="learn-fact">
                <span className="learn-fact-label">Net so far</span>
                <span className="learn-fact-value learn-positive">+<Money value={profitSoFar} /></span>
              </div>
            </div>
          </div>

          {years > 0 && (
            <Narrator>
              The profit stays inside the company, so the company is now worth{' '}
              {companyWorth.toLocaleString()} dollars. You own all of it, so that extra value
              is yours.
            </Narrator>
          )}

          {profitSoFar >= invest && (
            <Narrator icon={Sparkles}>
              You have now earned back everything you put in. From here, each year&apos;s
              profit is new money on top.
            </Narrator>
          )}

          {years >= 1 ? (
            <Continue onClick={() => advance(2)} label="Keep going" />
          ) : (
            <p className="learn-hint">Add at least 1 year to watch the profit arrive, then continue.</p>
          )}
        </div>
      )}

      {/* Step 2: ownership concept, then the decision to sell */}
      {step === 2 && (
        <div className="learn-story-step">
          <h4 className="learn-story-title">
            <Users size={18} /> What it means to own a company
          </h4>
          <p>
            <strong>Ownership is a claim on two things:</strong> what the company owns today
            (equipment, cash, stock) and what it will earn in the future. If you own all of
            it, all of that claim is yours.
          </p>
          <p>
            Business is good, and expanding will cost more than you have. A friend gives you
            advice:
          </p>
          <Narrator icon={Users}>
            <em>&ldquo;You do not need one person with a lot of money. You need a lot of
            people with a little money each.&rdquo;</em> That is what a
            <G> stock market</G> is for: it lets strangers buy pieces of a company.
          </Narrator>
          <p>
            So you sell <strong>30% of the company</strong>. It is worth
            {' '}<Money value={companyWorth} />, so 30% of {companyWorth.toLocaleString()} is{' '}
            <strong>{saleValue.toLocaleString()}</strong>. That is the cash you raise.
          </p>
          <div className="learn-ownership">
            <div className="learn-ownership-bar">
              <div className="learn-ownership-you" style={{ width: '70%' }} />
              <div className="learn-ownership-market" style={{ width: '30%' }} />
            </div>
            <div className="learn-ownership-legend">
              <span><i className="dot you" /> You keep 70%</span>
              <span><i className="dot market" /> For sale: 30% = <Money value={saleValue} /></span>
            </div>
          </div>
          <div className="learn-factrow">
            <div className="learn-fact">
              <span className="learn-fact-label">You gain from the sale</span>
              <span className="learn-fact-value learn-positive">+<Money value={saleValue} /></span>
            </div>
            <div className="learn-fact">
              <span className="learn-fact-label">You have left</span>
              <span className="learn-fact-value">70% = <Money value={companyWorth - saleValue} /></span>
            </div>
            <div className="learn-fact">
              <span className="learn-fact-label">Company value</span>
              <span className="learn-fact-value"><Money value={companyWorth} /></span>
            </div>
          </div>
          <p>
            The company itself did not change. It is worth the same {companyWorth.toLocaleString()}{' '}
            dollars. What changed is who owns it: the whole thing was yours, and now 70% is.
          </p>
          <Continue onClick={() => advance(3)} />
        </div>
      )}

      {/* Step 3: shares, defined before the quiz */}
      {step === 3 && (
        <div className="learn-story-step">
          <h4 className="learn-story-title">
            <Calculator size={18} /> Shares: the unit of ownership
          </h4>
          <p>
            There is a practical problem with selling &ldquo;30% of a company&rdquo;. A
            company is one thing, and you cannot hand a stranger three tenths of it. The
            market solves this with a <G>share</G>.
          </p>
          <Narrator>
            A <G>share</G> is one equal slice of a company. Split the company into many
            identical slices and every sale is counted in slices. Own 1 share out of 100 and
            you own 1% of the company, whichever shares they are.
          </Narrator>
          <p>
            Two numbers now define the sale: the <strong>price of one share</strong>, which
            you set, and <strong>how many shares</strong> you sell. You set the price at
            <strong> $3</strong>.
          </p>
          <p>
            The 30% you are selling is worth <Money value={saleValue} />. At $3 per share,
            how many shares go on sale?
          </p>

          <div className="learn-quiz">
            <input
              type="text"
              inputMode="numeric"
              className="learn-quiz-input"
              placeholder="Your answer"
              value={sharesAnswer}
              onChange={(e) => { setSharesAnswer(e.target.value); setSharesResult('none'); }}
              onKeyDown={(e) => e.key === 'Enter' && checkShares()}
              aria-label="How many shares"
            />
            <Button variant="primary" size="sm" onClick={checkShares}>Check</Button>
          </div>
          {sharesResult === 'wrong' && (
            <p className="learn-quiz-wrong">
              Not quite. Divide the {saleValue.toLocaleString()} dollars you are raising by
              the $3 price of one share.
            </p>
          )}
          {sharesResult === 'correct' && (
            <>
              <p className="learn-quiz-right">
                <Check size={14} /> Exactly. {correctShares} shares at $3 each add up to
                {' '}{saleValue.toLocaleString()} dollars.
              </p>
              <p>
                That is the arithmetic behind every <G> share</G> sale: price times count
                equals the value being sold. Slicing a company this way is what lets
                anyone, with any amount of money, own a piece of it.
              </p>
              <Continue onClick={() => advance(4)} />
            </>
          )}
        </div>
      )}

      {/* Step 4: Alice buys */}
      {step === 4 && (
        <div className="learn-story-step">
          <h4 className="learn-story-title">
            <Users size={18} /> Someone buys in
          </h4>
          <p>
            Your {correctShares} <G>shares</G> are listed on the
            {' '}<G>stock market</G>, where anyone can see them. Along comes
            <strong> Alice</strong>. She expects the company to keep growing, so she pays
            <strong> $3</strong> for <strong>1 share</strong>.
          </p>
          <Narrator>
            Alice now owns one slice of the company. As a shareholder she gets a vote, a
            small one, on big decisions like selling the business. For almost everyone the
            vote is not the point; the money is.
          </Narrator>
          <p>
            Day by day the rest of the shares sell. A few weeks later, all
            {' '}{correctShares} are gone.
          </p>
          <div className="learn-factrow">
            <div className="learn-fact">
              <span className="learn-fact-label">Cash you raised</span>
              <span className="learn-fact-value learn-positive">+<Money value={saleValue} /></span>
            </div>
            <div className="learn-fact">
              <span className="learn-fact-label">Company you gave up</span>
              <span className="learn-fact-value">30%</span>
            </div>
            <div className="learn-fact">
              <span className="learn-fact-label">You still own</span>
              <span className="learn-fact-value">70%</span>
            </div>
          </div>
          <p>
            In plain terms: <strong>you traded 30% of your company for{' '}
            {saleValue.toLocaleString()} dollars</strong>. That is a stock sale. The same
            trade happens every day on real markets, just far larger.
          </p>
          <Continue onClick={() => advance(5)} />
        </div>
      )}

      {/* Step 5: the payoff, revealed beat by beat */}
      {step === 5 && (
        <div className="learn-story-step">
          <h4 className="learn-story-title">
            <Sparkles size={18} /> What the money did
          </h4>
          <p>
            The company is worth <Money value={companyWorth} />, shares sit at $3, and you
            own 70%. Step through what happened next.
          </p>

          {payoffBeat >= 1 && (
            <div className="learn-beat">
              <span className="learn-beat-num">1</span>
              <div className="learn-beat-body">
                <p className="learn-beat-title">The money goes to work</p>
                <p>
                  You spend the <Money value={saleValue} /> raised from the 30% sale on
                  better equipment and a better product. Yearly profit doubles from
                  {' '}<Money value={100} /> to <Money value={200} />.
                </p>
              </div>
            </div>
          )}

          {payoffBeat >= 2 && (
            <div className="learn-beat">
              <span className="learn-beat-num">2</span>
              <div className="learn-beat-body">
                <p className="learn-beat-title">One more year passes</p>
                <p>
                  The company now earns <Money value={200} /> a year instead of
                  {' '}<Money value={100} />. It was worth <Money value={companyWorth} /> and
                  earns <Money value={200} /> more, so it is worth
                  {' '}<Money value={finalWorth} />. Your 70% is now
                  {' '}<Money value={Math.round(finalWorth * 0.7)} />.
                </p>
              </div>
            </div>
          )}

          {payoffBeat >= 3 && (
            <div className="learn-beat">
              <span className="learn-beat-num">3</span>
              <div className="learn-beat-body">
                <p className="learn-beat-title">What happened to Alice</p>
                <p>
                  Alice bought 1 of the {correctShares} shares you sold, and those shares
                  together were 30% of the company. Her single share is therefore a
                  {' '}{alicePct.toFixed(2)}% slice, worth exactly $3 on the day she bought it.
                </p>
                <p>
                  Now the company is worth <Money value={finalWorth} />, so her
                  {' '}{alicePct.toFixed(2)}% slice is worth <Money value={aliceValue} />.
                  Her $3 grew to <Money value={aliceValue} />.
                </p>
              </div>
            </div>
          )}

          {payoffBeat >= 4 && (
            <div className="learn-scoreboard">
              <p className="learn-scoreboard-title">The final scoreboard</p>
              <div className="learn-score-row">
                <span className="learn-score-name">You</span>
                <span className="learn-score-math">70% of <Money value={finalWorth} /></span>
                <span className="learn-score-value"><Money value={Math.round(finalWorth * 0.7)} /></span>
                <span className="learn-score-delta">started at <Money value={invest} /></span>
              </div>
              <div className="learn-score-row">
                <span className="learn-score-name">Alice</span>
                <span className="learn-score-math">1 share, a {alicePct.toFixed(2)}% slice</span>
                <span className="learn-score-value"><Money value={aliceValue} /></span>
                <span className="learn-score-delta">started at $3</span>
              </div>
              <p className="learn-score-note">
                Alice gained the same percentage you did, about
                {' '}{(((finalWorth / companyWorth) - 1) * 100).toFixed(0)}% this year, because
                every slice of a company grows together. That is why people buy stocks.
              </p>
            </div>
          )}

          {payoffBeat < 4 ? (
            <Continue onClick={() => setPayoffBeat((b) => b + 1)} label="Next" />
          ) : (
            <Continue onClick={() => advance(6)} label="Finish the story" />
          )}
        </div>
      )}

      {/* Step 6: recap */}
      {step === 6 && (
        <div className="learn-story-step">
          <h4 className="learn-story-title"><Check size={18} /> What you just learned</h4>
          <ul className="learn-recap">
            <li>
              <strong>A stock is a slice of a company.</strong> One share is a small piece of
              the business and of everything it earns later.
            </li>
            <li>
              <strong>Companies sell shares to raise money.</strong> They give up part of the
              ownership in exchange for cash they can spend on growth.
            </li>
            <li>
              <strong>Every slice grows together.</strong> When the company is worth more,
              your 70% and Alice&apos;s single share are both worth more.
            </li>
          </ul>
          <Button variant="outline" size="sm" onClick={reset}>
            Replay the story
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Lesson B: why prices move (mini scenario chart)
// ============================================================

type Scenario = 'good' | 'bad' | 'quiet';

const SCENARIOS: Record<Scenario, { label: string; caption: string; lo: number; hi: number }> = {
  good: {
    label: 'Great news about the company',
    caption: 'More people want to own the company than there are shares for. Buyers raise their offer until someone sells. The price goes up.',
    lo: 2, hi: 6,
  },
  bad: {
    label: 'Bad news about the company',
    caption: 'Owners get nervous and want out. There are more sellers than buyers, so sellers accept less. The price goes down.',
    lo: -6, hi: -2,
  },
  quiet: {
    label: 'A normal, uneventful day',
    caption: 'Roughly as many buyers as sellers. The price barely moves.',
    lo: -1, hi: 1,
  },
};

function PricesSection() {
  const [prices, setPrices] = useState<number[]>([100]);
  const [caption, setCaption] = useState<string | null>(null);
  const [used, setUsed] = useState(0);

  const applyScenario = (s: Scenario) => {
    const cfg = SCENARIOS[s];
    const pct = cfg.lo + Math.random() * (cfg.hi - cfg.lo);
    const next = Math.max(20, prices[prices.length - 1] * (1 + pct / 100));
    setPrices((p) => [...p.slice(-11), Math.round(next * 100) / 100]);
    setCaption(cfg.caption);
    setUsed((u) => u + 1);
  };

  const points = useMemo(() => {
    if (prices.length < 2) return '';
    const min = Math.min(...prices) * 0.98;
    const max = Math.max(...prices) * 1.02;
    return prices
      .map((p, i) => {
        const x = (i / (prices.length - 1)) * 300;
        const y = 110 - ((p - min) / (max - min || 1)) * 100;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [prices]);

  const last = prices[prices.length - 1];
  const change = prices.length > 1 ? last - prices[prices.length - 2] : 0;

  return (
    <div>
      <Objective>
        What makes a share price rise or fall, and why every price is a buyer and a seller
        meeting.
      </Objective>
      <p>
        In the story your shares sold for $3 each. On a real
        {' '}<G>stock market</G> that price changes every day, sometimes by a lot. Why?
      </p>
      <p>
        Picture a farmers market with one crate of strawberries and ten people who want them.
        The price gets bid up until only the people who want them most are left buying. Ten
        crates and one buyer works the other way: sellers start cutting prices. A stock works
        the same way, except the market never closes.
      </p>
      <p>
        So the useful question is not &ldquo;what is the price?&rdquo; but &ldquo;what just
        changed the balance between buyers and sellers?&rdquo; Usually the answer is news:
      </p>
      <ul className="learn-movelist">
        <li>
          <strong>Good news</strong>, like a hit product or rising sales, makes more people
          want the company. Buyers crowd in and the price rises until enough owners sell.
        </li>
        <li>
          <strong>Bad news</strong>, like a failed product or rising costs, makes owners want
          out. Sellers accept less and the price falls until buyers step in.
        </li>
        <li>
          <strong>No news</strong> leaves the balance roughly where it was. The price drifts.
        </li>
      </ul>
      <p>
        The price is not a fact about the company. It is a running vote, cast with real money,
        on what the company will be worth later. Cast a few votes yourself: each button is a
        piece of news, and the chart is your company&apos;s share price reacting to it.
      </p>

      <div className="learn-pricebox">
        <div className="learn-pricehead">
          <span className="learn-priceticker">YOURCO</span>
          <span className={`learn-priceval ${change >= 0 ? 'learn-positive' : 'learn-negative'}`}>
            ${last.toFixed(2)}{' '}
            <small>{change >= 0 ? '+' : ''}{change.toFixed(2)}</small>
          </span>
        </div>
        <svg viewBox="0 0 300 120" className="learn-pricechart" role="img" aria-label="Share price chart">
          <line x1="0" y1="110" x2="300" y2="110" className="chart-axis" />
          {prices.length > 1 && (
            <polyline points={points} className={`chart-line ${change >= 0 ? 'up' : 'down'}`} />
          )}
        </svg>

        <div className="learn-scenarios">
          {(Object.keys(SCENARIOS) as Scenario[]).map((s) => (
            <Button key={s} variant="chip" className="learn-scenario" onClick={() => applyScenario(s)}>
              {SCENARIOS[s].label}
            </Button>
          ))}
        </div>
        {caption && <p className="learn-caption">{caption}</p>}
        {used >= 4 && (
          <p className="learn-caption learn-caption-strong">
            No single button tells you where the price goes next. What matters is which side,
            buyers or sellers, suddenly shows up in larger numbers.
          </p>
        )}
      </div>
      <p>
        Nobody checks whether a stock is &ldquo;correctly&rdquo; priced. Two people can look at
        the same company and disagree about what it is worth, one seeing upside and the other
        risk. That disagreement is why trades happen: the seller prefers cash, the buyer
        prefers the share, and only time shows who was right.
      </p>
    </div>
  );
}

// ============================================================
// Lesson C: buying a share for real (orders, broker, costs)
// ============================================================

function ExecutionSection() {
  return (
    <div>
      <Objective>
        What the three order types promise, and how a broker, slippage and commission take
        a small cut of every trade.
      </Objective>
      <p>
        In the story Alice walked up, paid $3 and owned a share. Real trading has a few more
        moving parts, and they all have names.
      </p>

      <div className="learn-group">
        <p className="learn-group-title">Who you trade with</p>
        <div className="learn-cards">
          <div className="learn-card">
            <p className="learn-card-term">Buying and selling</p>
            <p>
              Buying means paying money for shares. Selling is the reverse: handing over
              shares for money. Every trade needs both sides, one buyer and one seller.
            </p>
          </div>
          <div className="learn-card">
            <p className="learn-card-term">Broker</p>
            <p>
              A <G>broker</G> is the licensed middleman with direct access to the
              {' '}<G>exchange</G>. You say what to trade and at what price, and the broker
              places the order.
            </p>
          </div>
        </div>
      </div>

      <div className="learn-group">
        <p className="learn-group-title">The three order types</p>
        <div className="learn-cards">
          <div className="learn-card">
            <p className="learn-card-term">Market order</p>
            <p>
              &ldquo;Buy now, at whatever the price is.&rdquo; A <G>market order</G> fills
              almost always, but the fill price is whatever the market offers at that second.
            </p>
          </div>
          <div className="learn-card">
            <p className="learn-card-term">Limit order</p>
            <p>
              &ldquo;Buy, but only at my price or better.&rdquo; A <G>limit order</G> gives
              you the price you wanted and no guarantee it ever fills.
            </p>
          </div>
          <div className="learn-card">
            <p className="learn-card-term">Stop order</p>
            <p>
              It sleeps until the price hits your trigger. A <G>stop order</G> then becomes a
              market order, so it is a way to say &ldquo;sell if this level breaks&rdquo;
              without watching the screen.
            </p>
          </div>
          <div className="learn-card">
            <p className="learn-card-term">Stop-limit</p>
            <p>
              The same trigger, but it becomes a <G>stop-limit order</G>: it fills at your
              price or better, and may not fill at all if the price jumps straight past it.
            </p>
          </div>
        </div>
      </div>

      <div className="learn-group">
        <p className="learn-group-title">The two costs</p>
        <div className="learn-cards">
          <div className="learn-card">
            <p className="learn-card-term">Slippage</p>
            <p>
              The gap between the price you expected and the price you got.{' '}
              <G>slippage</G> happens because the market moves while your order is in flight.
            </p>
          </div>
          <div className="learn-card">
            <p className="learn-card-term">Commission</p>
            <p>
              The broker&apos;s fee for handling the trade. Many brokers charge none now, but a
              fee still separates the return in an article from the return in your account.
            </p>
          </div>
        </div>
      </div>

      <p>
        These words describe how a trade happens, not what to trade. The decision about what
        to buy is where <G>strategies</G> live, and that comes later.
      </p>
    </div>
  );
}

// ============================================================
// Lesson D: candlesticks
// ============================================================

const CANDLE_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

interface Candle { open: number; high: number; low: number; close: number }

function makeCandles(): Candle[] {
  // Deterministic, hand-shaped week: up, big up, pullback, down, strong up
  return [
    { open: 100, high: 104, low: 99, close: 103 },
    { open: 103, high: 110, low: 102, close: 108 },
    { open: 108, high: 109, low: 103, close: 105 },
    { open: 105, high: 106, low: 100, close: 101 },
    { open: 101, high: 107, low: 100.5, close: 106 },
  ];
}

// Random OHLC set for the green/red practice. The close is always at least
// $1 away from the open so the candle is never ambiguous.
function makeQuizCandle(): Candle {
  const open = 90 + Math.round(Math.random() * 20);
  const close = open + (Math.random() < 0.5 ? -1 : 1) * (1 + Math.round(Math.random() * 7));
  const high = Math.max(open, close) + Math.round(Math.random() * 3);
  const low = Math.min(open, close) - Math.round(Math.random() * 3);
  return { open, high, low, close };
}

function candleSvg(candles: Candle[], highlight?: number) {
  const min = Math.min(...candles.map((c) => c.low));
  const max = Math.max(...candles.map((c) => c.high));
  const pad = (max - min) * 0.1;
  const y = (v: number) => 130 - ((v - (min - pad)) / ((max + pad) - (min - pad))) * 120;
  const w = 560 / candles.length;
  return candles.map((c, i) => {
    const cx = i * w + w / 2;
    const up = c.close >= c.open;
    const bodyTop = y(Math.max(c.open, c.close));
    const bodyH = Math.max(2, Math.abs(y(c.open) - y(c.close)));
    return (
      <g key={i} className={`${up ? 'candle-up' : 'candle-down'} ${highlight === i ? 'is-highlight' : ''}`}>
        <line x1={cx} y1={y(c.high)} x2={cx} y2={y(c.low)} className="learn-candle-wick" />
        <rect
          x={cx - w * 0.28}
          y={bodyTop}
          width={w * 0.56}
          height={bodyH}
          rx={2}
          className="learn-candle-body"
        />
        <text x={cx} y={146} textAnchor="middle" className="learn-candle-label">
          {CANDLE_DAYS[i] ?? ''}
        </text>
      </g>
    );
  });
}

function CandlesSection() {
  const candles = useMemo(() => makeCandles(), []);
  const [quizCandle, setQuizCandle] = useState<Candle>(makeQuizCandle);
  const [quizResult, setQuizResult] = useState<'none' | 'correct-green' | 'correct-red' | 'wrong'>('none');

  const answer = (guess: 'green' | 'red') => {
    const isGreen = quizCandle.close >= quizCandle.open;
    setQuizResult(guess === (isGreen ? 'green' : 'red') ? (isGreen ? 'correct-green' : 'correct-red') : 'wrong');
  };

  const newCandle = () => {
    setQuizCandle(makeQuizCandle());
    setQuizResult('none');
  };

  return (
    <div>
      <Objective>
        How to read a candlestick chart: the four prices in each candle, and what the green
        and red colours tell you.
      </Objective>
      <p>
        Every strategy on this site works from the same raw material: the price chart. The
        most common kind is the candlestick chart, the style used on the Research page.
      </p>
      <p>
        A <G>candlestick chart</G> draws each day as a single candle. One candle carries four
        prices for that day:
      </p>
      <ul className="learn-movelist">
        <li><strong>Open</strong>: the first price of the day, when trading began.</li>
        <li><strong>Close</strong>: the last price of the day, when trading stopped.</li>
        <li><strong>High</strong>: the highest price reached during the day.</li>
        <li><strong>Low</strong>: the lowest price reached during the day.</li>
      </ul>
      <p>
        The wide body is drawn from the open to the close. The thin lines above and below,
        called wicks, reach to the high and the low. The colour is the summary:
        {' '}<strong>green</strong> means the close finished above the open, and
        {' '}<strong>red</strong> means it finished below.
      </p>

      <div className="learn-quizcandle">
        <p className="learn-quizcandle-title">Practice: green or red?</p>
        <p>
          Here is one day&apos;s four prices, as a <G>data feed</G> reports them. Decide
          whether the candle is green or red, then check.
        </p>
        <div className="learn-factrow">
          <div className="learn-fact">
            <span className="learn-fact-label">Open</span>
            <span className="learn-fact-value">${quizCandle.open}</span>
          </div>
          <div className="learn-fact">
            <span className="learn-fact-label">High</span>
            <span className="learn-fact-value">${quizCandle.high}</span>
          </div>
          <div className="learn-fact">
            <span className="learn-fact-label">Low</span>
            <span className="learn-fact-value">${quizCandle.low}</span>
          </div>
          <div className="learn-fact">
            <span className="learn-fact-label">Close</span>
            <span className="learn-fact-value">${quizCandle.close}</span>
          </div>
        </div>
        <div className="learn-ordertypes">
          <Button variant="chip" className="learn-ordertype" onClick={() => answer('green')}>Green</Button>
          <Button variant="chip" className="learn-ordertype" onClick={() => answer('red')}>Red</Button>
          <Button variant="chip" className="learn-ordertype" onClick={newCandle}>New candle</Button>
        </div>
        {quizResult !== 'none' && (
          <p className="learn-caption learn-caption-strong">
            {quizResult === 'wrong' && (
              `Not this time. The open was $${quizCandle.open} and the close was $${quizCandle.close}. The close finished ${quizCandle.close >= quizCandle.open ? 'above' : 'below'} the open, so this candle is ${quizCandle.close >= quizCandle.open ? 'green' : 'red'}.`
            )}
            {quizResult === 'correct-green' && 'Correct. The close finished above the open, so the day ended higher than it started: green.'}
            {quizResult === 'correct-red' && 'Correct. The close finished below the open, so the day ended lower than it started: red.'}
          </p>
        )}
      </div>

      <p>
        Now put a week together. This is your company&apos;s first week on the market, one
        candle per day.
      </p>

      <div className="learn-chartbox">
        <svg viewBox="0 0 560 150" className="learn-bigchart" role="img" aria-label="One week of candlesticks for YOURCO">
          {candleSvg(candles)}
        </svg>
        <div className="learn-chartlegend">
          <span><i className="dot green" /> Closed higher than it opened (up day)</span>
          <span><i className="dot red" /> Closed lower than it opened (down day)</span>
        </div>
      </div>

      <p>
        The week tells a story without a word: two strong green days, a small pullback, a red
        day where sellers took over, then a green day that recovered most of the loss. That is
        how traders read charts, and patterns are what the next lessons turn into rules.
      </p>
    </div>
  );
}

// ============================================================
// Lesson E: how strategies are made
// ============================================================

function MathSection() {
  return (
    <div>
      <Objective>
        What a strategy is, in one minute: the two ways people choose what to buy, and the three
        jobs every strategy has to do.
      </Objective>
      <p>
        You can read a chart and judge single days. The next question is the big one: how
        does anyone decide what to buy? The answer is written rules, and those rules come from
        one of two places.
      </p>

      <div className="learn-school">
        <p className="learn-school-name">A. Technical analysis: reading price action</p>
        <p>
          The first way uses only the prices you already know: the
          {' '}<strong>open, high, low and close</strong> of each day. Stacked over weeks they
          form shapes, and finding shapes in <G>price action</G> and acting on them is
          {' '}<G>technical analysis</G>. Many traders believe those shapes repeat, because the
          same crowd of buyers and sellers produces them. That belief is a claim to test, not a
          fact.
        </p>
      </div>

      <div className="learn-school">
        <p className="learn-school-name">B. Financial analysis: reading the business</p>
        <p>
          The second way ignores today&apos;s price and studies the company. Every company
          publishes the same basic story once a year: money in, costs out, what is left, and
          what it owes. Reading those numbers to judge whether the business is worth owning is
          {' '}<G>financial analysis</G>, the approach behind <strong>investing</strong>. The
          statements themselves are covered in the Advanced level.
        </p>
      </div>

      <p>
        A <G>strategy</G> is a set of rules drawn from one of those schools. Whatever the
        source, every strategy does the same three jobs.
      </p>
      <div className="learn-rules">
        <div className="learn-rule">
          <span className="learn-rule-num">1</span>
          <p><strong>Decide when to buy.</strong> A shape on the chart, or the company&apos;s numbers crossing a threshold.</p>
        </div>
        <div className="learn-rule">
          <span className="learn-rule-num">2</span>
          <p><strong>Decide how much to buy.</strong> Enough to matter, never enough that one trade can hurt you badly.</p>
        </div>
        <div className="learn-rule">
          <span className="learn-rule-num">3</span>
          <p><strong>Set the exits.</strong> The <G>stop-loss</G> where a losing trade is cut, and the <G>take-profit</G> where a winner is banked.</p>
        </div>
      </div>
      <p>
        A computer applies those rules identically every day, without fear, excitement or
        fatigue. That consistency is the whole advantage. The next lesson walks you through
        choosing exits and position size yourself, with real numbers.
      </p>

      <p>
        How do you know a rule works? You test it on past prices. That is covered in the Advanced
        level, together with the ways a test can fool you. In between, the Intermediate level is
        about where the rules come from in the first place.
      </p>

      <Recap points={[
        <>The two schools: <strong>technical analysis</strong> reads price, <strong>financial analysis</strong> reads the business.</>,
        <>Every strategy answers the same three questions: when to buy, how much, and where to exit.</>,
        <>Whether the rules actually work is a question for a test, which comes later.</>,
      ]} />
    </div>
  );
}

// ============================================================
// Lesson F: risk management, guided by the user's own numbers
// ============================================================

function RiskSection() {
  const entry = 100;       // the price they paid per share
  const account = 10000;
  // 0: intro, 1: pick stop, 2: pick target, 3: position sizing + summary
  const [subStep, setSubStep] = useState(0);
  const [stop, setStop] = useState(90);
  const [target, setTarget] = useState(110);

  const advanceSub = (next: number) => {
    setSubStep(next);
    scrollToSectionTop('risk');
  };

  const riskPerShare = entry - stop;
  const gainPerShare = target - entry;
  const rrr = gainPerShare / riskPerShare;
  const riskPerTrade = 2;
  const sharesByRisk = Math.floor((account * (riskPerTrade / 100)) / riskPerShare);
  const sharesByCash = Math.floor(account / entry);
  const shares = Math.min(sharesByRisk, sharesByCash);
  const potentialLoss = shares * riskPerShare;
  const potentialGain = shares * gainPerShare;

  return (
    <div>
      <Objective>
        Decide in advance where to sell a losing trade, where to bank a winner, and how much
        money to put in.
      </Objective>
      <p>
        The rules so far decide <em>what</em> to buy. They do not answer the question that
        separates traders who last from the rest: <strong>when do you get out, and how much do
        you bet?</strong> Make those two decisions yourself, with real numbers.
      </p>
      <Narrator>
        You bought 1 share at <Money value={entry} />, in a company you believe in. No belief
        is guaranteed, so two prices need choosing before anything else happens.
      </Narrator>
      <p>
        Why decide now rather than later? Because nobody knows whether tomorrow brings a rise
        or a fall. Decisions made while losing money are made under stress, and stress produces
        the two worst habits in markets: holding losers too long and selling winners too early.
      </p>
      <p>
        The stop can never be <Money value={entry} />, the price you just paid. It has to sit
        below the entry, because it marks where the trade is declared wrong. Placed at the
        entry, the first ordinary dip would sell you out before the trade had a chance. The
        real decision is how far below.
      </p>

      {/* Sub-step 1: the stop */}
      {subStep === 0 && (
        <div className="learn-substep">
          <p className="learn-substep-title">Decision 1: where do you cut your losses?</p>
          <p>
            The stock trades at <Money value={entry} /> today. Some morning it opens lower,
            then lower again. At what price do you say: <strong>this is not working, sell?</strong>
            {' '}That price is the <G> stop-loss</G>. Pick it:
          </p>
          <div className="learn-slider-block">
            <div className="learn-slider-readout">
              <span>Sell if the price falls to</span>
              <Money value={stop} />
            </div>
            <input
              type="range"
              min={80}
              max={99}
              step={1}
              value={stop}
              onChange={(e) => setStop(parseInt(e.target.value, 10))}
              className="learn-slider"
              aria-label="Stop-loss price"
            />
            <div className="learn-slider-scale">
              <span>$80 (down 20%)</span><span>$99 (down 1%)</span>
            </div>
          </div>
          <div className="learn-factrow">
            <div className="learn-fact">
              <span className="learn-fact-label">Loss per share if stopped</span>
              <span className="learn-fact-value learn-negative">-<Money value={riskPerShare} /></span>
            </div>
            <div className="learn-fact">
              <span className="learn-fact-label">That is</span>
              <span className="learn-fact-value">{((entry - stop) / entry * 100).toFixed(0)}% of your entry</span>
            </div>
          </div>
          <Narrator>
            A tight stop keeps every loss small, but stocks wobble a few percent in ordinary
            weeks, so a tight stop turns that noise into a run of small losses.
          </Narrator>
          <p>
            A wider stop survives those dips and gives the trade room to be right, at the cost
            of a bigger loss when it is wrong. Neither is free and there is no correct number.
            The habit that matters is choosing it here, calmly, before the price moves.
          </p>
          <Continue onClick={() => advanceSub(1)} label="I picked my stop" />
        </div>
      )}

      {/* Sub-step 2: the target */}
      {subStep === 1 && (
        <div className="learn-substep">
          <p className="learn-substep-title">Decision 2: where do you take the money?</p>
          <p>
            Now the other direction. The stock climbs. At what price do you say:
            {' '}<strong>I have made enough, sell?</strong> That price is the
            {' '}<G> take-profit</G>. Pick it:
          </p>
          <div className="learn-slider-block">
            <div className="learn-slider-readout">
              <span>Sell if the price rises to</span>
              <Money value={target} />
            </div>
            <input
              type="range"
              min={101}
              max={140}
              step={1}
              value={target}
              onChange={(e) => setTarget(parseInt(e.target.value, 10))}
              className="learn-slider"
              aria-label="Take-profit price"
            />
            <div className="learn-slider-scale">
              <span>$101 (up 1%)</span><span>$140 (up 40%)</span>
            </div>
          </div>
          <div className="learn-factrow">
            <div className="learn-fact">
              <span className="learn-fact-label">Gain per share if target hit</span>
              <span className="learn-fact-value learn-positive">+<Money value={gainPerShare} /></span>
            </div>
            <div className="learn-fact">
              <span className="learn-fact-label">That is</span>
              <span className="learn-fact-value">{((target - entry) / entry * 100).toFixed(0)}% of your entry</span>
            </div>
          </div>
          <Narrator>
            A wide target pays well when it hits, and hits rarely, because price usually pulls
            back on the way. A near target hits often and pays little.
          </Narrator>
          <p>
            If each win is smaller than each loss, the arithmetic of the whole strategy turns
            negative no matter how often it wins. The target sets what a victory pays, the stop
            sets what a defeat costs, and the strategy lives in the gap between them.
          </p>
          <Continue onClick={() => advanceSub(2)} label="See what I just built" />
        </div>
      )}

      {/* Sub-step 3: the reveal */}
      {subStep === 2 && (
        <div className="learn-substep">
          <p className="learn-substep-title">What your two decisions created</p>
          <p>
            Your stop and your target together define the shape of the trade.
          </p>
          <div className="learn-factrow">
            <div className="learn-fact">
              <span className="learn-fact-label">Buy at</span>
              <span className="learn-fact-value"><Money value={entry} /></span>
            </div>
            <div className="learn-fact">
              <span className="learn-fact-label">Give up at (stop)</span>
              <span className="learn-fact-value learn-negative"><Money value={stop} /></span>
            </div>
            <div className="learn-fact">
              <span className="learn-fact-label">Bank at (target)</span>
              <span className="learn-fact-value learn-positive"><Money value={target} /></span>
            </div>
            <div className="learn-fact">
              <span className="learn-fact-label">
                <G>Risk-reward ratio</G>
              </span>
              <span className="learn-fact-value">1 : {rrr.toFixed(1)}</span>
            </div>
          </div>
          <p>
            The <strong>risk-reward ratio</strong> reads straight off your sliders: you risk
            {' '}<Money value={riskPerShare} /> per share to potentially make
            {' '}<Money value={gainPerShare} />. At 1:{rrr.toFixed(1)},{' '}
            {rrr > 1.05
              ? 'each dollar of loss is backed by more than a dollar of gain, so the wins can outweigh the losses even when you are wrong often.'
              : rrr >= 0.95
                ? 'each dollar of loss is matched by a dollar of gain, so the trade only works if you are right slightly more often than wrong.'
                : 'each win is smaller than each loss, so you need to be right far more often than wrong to stay ahead.'}
          </p>

          <div className="learn-riskbox">
            <p className="learn-riskbox-title">Last piece: how many shares?</p>
            <p>
              The stop sets the worst case per share. Position size decides how many shares are
              exposed to it. The usual rule: risk a small fixed slice of the account on any one
              trade. With a <Money value={account} /> account risking 2%:
            </p>
            <div className="learn-factrow">
              <div className="learn-fact">
                <span className="learn-fact-label">Max loss allowed (2%)</span>
                <span className="learn-fact-value learn-negative"><Money value={(account * riskPerTrade) / 100} /></span>
              </div>
              <div className="learn-fact">
                <span className="learn-fact-label">Loss per share (your stop)</span>
                <span className="learn-fact-value"><Money value={riskPerShare} /></span>
              </div>
              <div className="learn-fact">
                <span className="learn-fact-label">Position size</span>
                <span className="learn-fact-value">{shares} shares (<Money value={shares * entry} />)</span>
              </div>
              <div className="learn-fact">
                <span className="learn-fact-label">If stopped / if target</span>
                <span className="learn-fact-value">-<Money value={potentialLoss} /> / +<Money value={potentialGain} /></span>
              </div>
            </div>
            <p className="learn-caption learn-caption-strong">
              If this trade fails the account loses {potentialLoss.toLocaleString()} dollars and
              no more. If it works it makes about {rrr.toFixed(1)} times that.{' '}
              {shares === sharesByRisk
                ? 'Your wider stop automatically bought fewer shares: the position shrank to keep the maximum loss fixed.'
                : 'Your stop is so close that the 2% rule would allow more shares than the cash can buy, so cash is the limit here. Slide the stop wider and the risk rule takes over.'}
            </p>
          </div>
          <p>
            This is why every strategy on SLTP publishes a stop-loss and a take-profit next to
            its buy rule. The buy rule finds the opportunity, and the sizing rule keeps any one
            mistake affordable. Change your sliders and watch every number respond.
          </p>
          <Button variant="outline" size="sm" onClick={() => setSubStep(0)}>
            Replay the exercise
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Lesson G: testing a strategy
// ============================================================

function TestingSection() {
  return (
    <div>
      <Objective>
        What a <G>backtest</G> is, the one rule that stops it cheating, and why it is
        evidence rather than proof.
      </Objective>
      <p>
        Before you risk a dollar, one question matters: <strong>would these rules have
        worked?</strong> Whoever is selling the strategy will say yes. A glossy chart of what it
        <em> could</em> have earned proves nothing, because anyone can draw a chart after seeing
        what the market did.
      </p>
      <p>
        Markets keep records, though. The price of nearly every stock, on every trading day,
        going back decades, is public.
      </p>
      <p>
        So the rules can be checked. Pick a date five years ago and give a computer a pretend
        pot of money. Show it only the prices known on that date and let it apply the rules. If a
        rule says buy, it buys at the price that existed then. Move the clock forward one day
        and repeat.
      </p>
      <Narrator>
        One rule stops it cheating: on each simulated day, the computer only sees prices
        from that day and earlier. It never sees tomorrow.
      </Narrator>
      <p>
        That replay is a <G>backtest</G>. At the end you get the full record: every trade, the
        growth of the money, the worst losing stretch, and how it compares to simply holding an
        {' '}<G>index fund</G>. An index fund holds every company in a market index, so it is
        the &ldquo;do nothing clever&rdquo; baseline; the Intermediate level covers it properly. If a strategy
        cannot beat it, the strategy has to give you another reason to prefer it.
      </p>

      <div className="learn-pitfalls">
        <p className="learn-pitfalls-title">
          <AlertTriangle size={15} /> Where backtests lie: three classic traps
        </p>
        <p>
          A backtest is only as good as the way it was built. Three mistakes show up so often
          they have names.
        </p>
        <div className="learn-pitfall">
          <span className="learn-pitfall-num">1</span>
          <div className="learn-pitfall-body">
            <p className="learn-pitfall-name">Overfitting</p>
            <p>
              You keep adjusting your stop and target until the backtest looks perfect. Those
              numbers no longer describe a strategy; they describe one slice of history. The
              rules memorized the past instead of learning anything that carries forward.
            </p>
          </div>
        </div>
        <div className="learn-pitfall">
          <span className="learn-pitfall-num">2</span>
          <div className="learn-pitfall-body">
            <p className="learn-pitfall-name">Look-ahead bias</p>
            <p>
              The simulation uses information nobody had at the time. The classic version: a
              rule that buys at today&apos;s close using a signal built from that same close.
              During the day, nobody knows the close yet.
            </p>
          </div>
        </div>
        <div className="learn-pitfall">
          <span className="learn-pitfall-num">3</span>
          <div className="learn-pitfall-body">
            <p className="learn-pitfall-name">Survivorship bias</p>
            <p>
              Testing on today&apos;s list of stocks deletes every company that went bankrupt or
              was <G>delisted</G>, so the past looks safer than it was. A proper test uses the
              full <G>universe</G>, including the companies that no longer exist.
            </p>
          </div>
        </div>
        <p className="learn-pitfall-close">
          <Receipt size={14} /> A backtest that avoids all three traps is evidence. One that
          does not is marketing.
        </p>
      </div>

      <p>
        One limit to carry away: a backtest shows what the rules <em>did</em>, not what they
        <em> will</em> do. The next ten years can bring something no past year contained. It is
        still the best evidence available before you commit real money.
      </p>

      <Recap points={[
        <>A <G>backtest</G> replays rules against real past prices, one day at a time.</>,
        <>The one rule: the simulation only sees prices from that day and earlier.</>,
        <>It is evidence, not a forecast. It shows what the rules did, never what they will do.</>,
      ]} />
    </div>
  );
}

// ============================================================
// Course map: header, up next, tier stepper
// ============================================================

function CourseMap({ learn, onJump, onNavigate }: {
  learn: ReturnType<typeof useLearn>;
  onJump: (id: string) => void;
  onNavigate?: (tab: string) => void;
}) {
  const next = learn.nextLesson;

  return (
    <header id="start" className="learn-map">
      <p className="learn-map-kicker">Learn</p>
      <h1 className="learn-map-title">How the market works</h1>
      <p className="learn-map-lede">
        Short lessons across {TIERS.length} levels, and a badge each time you finish one. The
        first level is open now; the rest opens as you go.
      </p>

      <div className="learn-upnext">
        <p className="learn-upnext-kicker">Up next</p>
        <div className="learn-upnext-row">
          <div className="learn-upnext-body">
            {learn.loading ? (
              <p className="learn-upnext-title">Loading your progress…</p>
            ) : next ? (
              <>
                <p className="learn-upnext-title">{next.section.label}</p>
                <p className="learn-upnext-meta">
                  Lesson {next.index} of {learn.totals.lessons} · Badge:{' '}
                  {badgeFor(next.section.id).name}
                </p>
              </>
            ) : (
              <>
                <p className="learn-upnext-title">Every lesson is done</p>
                <p className="learn-upnext-meta">
                  {learn.totals.done} of {learn.totals.lessons} finished. Put it to work on real
                  reports.
                </p>
              </>
            )}
          </div>
          {!learn.loading && next && (
            <Button variant="primary" size="sm" onClick={() => onJump(next.section.id)}>
              Continue
              <ArrowRight size={15} />
            </Button>
          )}
          {!learn.loading && !next && (
            <Button variant="outline" size="sm" onClick={() => onNavigate?.('research')}>
              Research
              <ArrowRight size={15} />
            </Button>
          )}
        </div>
      </div>

      <div className="learn-stepper">
        <p className="learn-stepper-kicker">
          Your path · {TIERS.filter((t) => learn.tierStatus(t) === 'certified').length} of{' '}
          {TIERS.length} levels
        </p>
        <ol className="learn-stepper-list">
          {TIERS.map((tier, i) => {
            const status = learn.tierStatus(tier);
            const counts = learn.tierCounts(tier);
            return (
              <li key={tier.id} className={`learn-step is-${status}`}>
                <button
                  type="button"
                  className="learn-step-btn"
                  onClick={() => onJump(`tier-${tier.id}`)}
                  disabled={status === 'locked'}
                  aria-label={`${tier.name} level, ${tier.title}, ${
                    status === 'locked' ? 'locked' : `${counts.done} of ${counts.total} lessons done`
                  }`}
                >
                  <span className="learn-step-dot">
                    {status === 'certified' ? <Check size={12} /> : status === 'locked' ? <Lock size={11} /> : i + 1}
                  </span>
                  <span className="learn-step-body">
                    <span className="learn-step-title">{tier.name}</span>
                    <span className="learn-step-meta">
                      {status === 'locked' ? 'Locked' : `${counts.done} of ${counts.total} lessons`}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </header>
  );
}

// ============================================================
export default function LearnPage({ onNavigate }: LearnPageProps) {
  const learn = useLearn();

  // Every anchor the sidebar can point at, in document order: the course map,
  // the badges section, then each unlocked tier's revealed lessons and quiz.
  const anchorIds = useMemo(() => {
    const ids = ['start', 'credentials'];
    for (const tier of TIERS) {
      if (learn.tierStatus(tier) === 'locked') continue;
      for (const s of learn.visibleSections(tier)) ids.push(s.id);
      if (learn.gateAvailable(tier) && !learn.isCertified(tier.id)) ids.push(`gate-${tier.id}`);
    }
    return ids;
  }, [learn]);

  const activeId = useActiveSection(anchorIds);

  const jump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const moduleFor = (id: string) => {
    switch (id) {
      case 'stocks': return <StockSection />;
      case 'prices': return <PricesSection />;
      case 'orders': return <ExecutionSection />;
      case 'candles': return <CandlesSection />;
      case 'long-short':
        return (
          <LongShortSection
            onComplete={() => learn.completeSection('long-short')}
            onCredentials={() => jump('credentials')}
          />
        );
      case 'math': return <MathSection />;
      case 'risk': return <RiskSection />;
      case 'testing': return <TestingSection />;
      case 't2-spreads': return <SpreadsSection />;
      case 't2-orderbook': return <OrderBookSection />;
      case 't3-style': return <TradingVsInvestingSection />;
      case 't3-index': return <IndexSection />;
      case 'psychology': return <MarketPsychologySection />;
      case 'ideas': return <IdeasSection />;
      case 'why-math': return <WhyMathSection />;
      case 't3-indicators': return <IndicatorsSection />;
      case 'vocabulary': return <VocabularySection />;
      case 'anatomy': return <AnatomySection onNavigate={onNavigate} />;
      case 'code-read': return <CodeReadingSection />;
      case 'code-write': return <CodeWritingSection onNavigate={onNavigate} />;
      case 'statements': return <StatementsSection />;
      case 'valuation': return <ValuationSection />;
      case 't4-walkthrough': return <BacktestWalkthroughSection />;
      case 't5-metrics': return <MetricsSection />;
      case 't5-allocation': return <AllocationSection />;
      default: return null;
    }
  };

  return (
    <div className="learn-page">
      <div className="learn-layout">
        <TierNav learn={learn} activeId={activeId} onJump={jump} />

        <div className="learn-content">
          <CourseMap learn={learn} onJump={jump} onNavigate={onNavigate} />

          <section id="credentials" className="learn-section">
            <div className="learn-section-heading">
              <span className="learn-section-num">★</span>
              <h2>Your badges</h2>
            </div>
            <p>
              One badge per lesson, one certificate per tier. Everything earned is saved to your
              account; the rest is here so you can see what is ahead.
            </p>
            <BadgeShelf learn={learn} />
          </section>

          {TIERS.map((tier, tierIdx) => {
            if (learn.tierStatus(tier) === 'locked') return null;
            const lessons = tier.sections.filter((s) => s.content);
            const revealed = new Set(learn.visibleSections(tier).map((s) => s.id));
            const gateOpen = learn.gateAvailable(tier);
            const certified = learn.isCertified(tier.id);

            return (
              <div key={tier.id} className="learn-tierblock">
                <TierBanner id={`tier-${tier.id}`} tier={tier} learn={learn} index={tierIdx} />

                <div className="learn-trail">
                  {lessons.map((s, i) => {
                    const done = learn.isSectionDone(s.id);
                    const open = revealed.has(s.id) || done;
                    const badge = badgeFor(s.id);
                    const BadgeIcon = badge.icon;
                    const nextLesson = lessons[i + 1];
                    const part = s.part && s.part !== lessons[i - 1]?.part ? s.part : null;

                    if (!open) {
                      return (
                        <div key={s.id} className="learn-trail-item is-locked">
                          <span className="learn-trail-node"><Lock size={12} /></span>
                          <div className="learn-trail-body">
                            {part && <p className="learn-part">{part}</p>}
                            <p className="learn-trail-locked-title">{s.label}</p>
                            <p className="learn-trail-locked-note">
                              Opens after &ldquo;{lessons[i - 1].label}&rdquo;.
                            </p>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <section
                        key={s.id}
                        id={s.id}
                        className={`learn-trail-item ${done ? 'is-earned' : 'is-current'}`}
                      >
                        <span className="learn-trail-node" aria-hidden>
                          {done ? <Check size={13} /> : <BadgeIcon size={14} />}
                        </span>
                        <div className="learn-trail-body">
                          {part && <p className="learn-part">{part}</p>}
                          <div className="learn-lesson-head">
                            <h2 className="learn-lesson-title">{s.label}</h2>
                            <p className={`learn-lesson-chip ${done ? 'is-earned' : ''}`}>
                              <BadgeIcon size={13} />
                              {done ? `Badge earned: ${badge.name}` : `Badge: ${badge.name}`}
                            </p>
                          </div>
                          {moduleFor(s.id)}
                          <SectionQuiz questions={MODULE_QUIZZES[s.id] ?? []} />
                          {s.id !== 'long-short' && (
                            <ModuleComplete
                              sectionId={s.id}
                              learn={learn}
                              nextId={nextLesson?.id}
                              nextLabel={nextLesson?.label}
                              gateId={!nextLesson && gateOpen ? `gate-${tier.id}` : undefined}
                            />
                          )}
                        </div>
                      </section>
                    );
                  })}

                  <div
                    className={`learn-trail-item learn-trail-cert ${certified ? 'is-earned' : gateOpen ? 'is-current' : 'is-locked'}`}
                  >
                    <span className="learn-trail-node" aria-hidden>
                      {certified ? <Check size={13} /> : <Award size={14} />}
                    </span>
                    <div className="learn-trail-body">
                      {gateOpen && !certified ? (
                        <TierGate tier={tier} learn={learn} />
                      ) : (
                        <>
                          <p className="learn-trail-locked-title">
                            Certificate: {tier.certification}
                          </p>
                          <p className="learn-trail-locked-note">
                            {certified
                              ? 'Earned. This tier is finished.'
                              : `Pass the quiz after the ${lessons.length} lessons in this level.`}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <section id="next-steps" className="learn-section">
            <div className="learn-section-heading">
              <span className="learn-section-num">→</span>
              <h2>Where to go from here</h2>
            </div>
            <p>
              You now know what a strategy is, how one is built, how it is tested, and how risk
              is sized. The rest of SLTP is where you use it.
            </p>
            <div className="learn-nextsteps">
              <button
                type="button"
                className="learn-nextcard"
                onClick={() => onNavigate?.('research')}
              >
                <span className="learn-nextcard-icon"><TrendingUp size={17} /></span>
                <span className="learn-nextcard-body">
                  <strong>Research</strong>
                  <small>Watch real strategies replay decades of market history, stock by stock.</small>
                </span>
                <ArrowRight size={16} />
              </button>
              <button
                type="button"
                className="learn-nextcard"
                onClick={() => onNavigate?.('strategies')}
              >
                <span className="learn-nextcard-icon"><FlaskConical size={17} /></span>
                <span className="learn-nextcard-body">
                  <strong>Strategies</strong>
                  <small>Read the actual rules behind each strategy, in plain language.</small>
                </span>
                <ArrowRight size={16} />
              </button>
              <button
                type="button"
                className="learn-nextcard"
                onClick={() => onNavigate?.('lab')}
              >
                <span className="learn-nextcard-icon"><Terminal size={17} /></span>
                <span className="learn-nextcard-body">
                  <strong>Lab</strong>
                  <small>Write a strategy yourself and run it against past prices.</small>
                </span>
                <ArrowRight size={16} />
              </button>
              <button
                type="button"
                className="learn-nextcard"
                onClick={() => onNavigate?.('docs')}
              >
                <span className="learn-nextcard-icon"><BookOpen size={17} /></span>
                <span className="learn-nextcard-body">
                  <strong>Docs</strong>
                  <small>The strategy API, method by method, with the arguments each one takes.</small>
                </span>
                <ArrowRight size={16} />
              </button>
            </div>
          </section>
        </div>
      </div>

      {learn.toast && (
        <RewardToast earned={learn.toast} onClose={learn.dismissToast} />
      )}
    </div>
  );
}
