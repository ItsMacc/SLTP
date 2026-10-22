// LearnPage.tsx - "Absolute beginner" course: plain-language, interactive
// lessons that teach stocks, price movement, order execution, candles,
// strategies, risk and testing from zero.
// Layout mirrors DocsPage: sticky sidebar TOC on the left, content on the right.
import { useMemo, useState } from 'react';
import {
  ArrowRight, Check, ChevronRight, Building2, TrendingUp, Calculator, FlaskConical,
  Sparkles, Users, CircleDollarSign, Lightbulb, AlertTriangle, Receipt, Lock, Trophy,
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
import { Objective, Recap, SectionQuiz } from './learn/parts';
import { MODULE_QUIZZES } from '../learn/moduleQuizzes';
import RewardToast from './learn/RewardToast';
import { BadgeShelf, TierBanner, TierGate, TierNav } from './learn/LearnShell';
import { useActiveSection } from '../learn/useActiveSection';
import './LearnPage.css';

interface LearnPageProps {
  onNavigate?: (tab: string) => void;
}

// Landmark sections that are always rendered, above the tier-by-tier modules.
const INTRO_SECTIONS = [
  { id: 'start', label: 'Start here', num: '00' },
  { id: 'credentials', label: 'Your badges', num: '★' },
];

/** Scrolls a module back to its own heading - story steps change in place. */
function scrollToSectionTop(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- small building blocks ----------

function Continue({ onClick, label = 'Continue' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className="learn-continue" onClick={onClick}>
      {label}
      <ChevronRight size={15} />
    </button>
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

// Marks a module complete, earning its badge.
//
// Two states, both deliberately more than a bare button:
//   PENDING   - a card that shows which badge is on offer and asks for the
//               claim, so finishing feels like collecting something.
//   DONE      - a celebratory confirmation with the badge stamped in, plus
//               the jump to the next module (or the tier gate).
function ModuleComplete({ sectionId, learn, nextId, gateId }: {
  sectionId: string;
  learn: ReturnType<typeof useLearn>;
  nextId?: string;
  /** Set on a tier's last module: the CTA points at the validation gate. */
  gateId?: string;
}) {
  const badge = badgeFor(sectionId);
  const BadgeIcon = badge.icon;
  const done = learn.isSectionDone(sectionId);

  if (done) {
    return (
      <div className="learn-claim is-claimed">
        <span className="learn-claim-badge is-earned">
          <BadgeIcon size={22} />
        </span>
        <div className="learn-claim-body">
          <p className="learn-claim-kicker"><Check size={13} /> Module complete</p>
          <p className="learn-claim-name">{badge.name} added to your badge case</p>
          <p className="learn-claim-note">
            {nextId
              ? 'The next module in this tier is now unlocked.'
              : gateId
                ? 'Every module in this tier is done, your validation gate is open.'
                : 'This was the last module of the tier.'}
          </p>
        </div>
        {nextId && !learn.isSectionDone(nextId) && (
          <button
            type="button"
            className="learn-continue learn-claim-next"
            onClick={() => scrollToSectionTop(nextId)}
          >
            Next module
            <ArrowRight size={15} />
          </button>
        )}
        {!nextId && gateId && (
          <button
            type="button"
            className="learn-continue learn-claim-next"
            onClick={() => scrollToSectionTop(gateId)}
          >
            Take the gate
            <ArrowRight size={15} />
          </button>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="learn-claim learn-claim-pending"
      onClick={() => learn.completeSection(sectionId)}
    >
      <span className="learn-claim-badge">
        <BadgeIcon size={22} />
      </span>
      <span className="learn-claim-body">
        <span className="learn-claim-kicker">Finish this module</span>
        <span className="learn-claim-name">Claim the “{badge.name}” badge</span>
        <span className="learn-claim-note">Marks the module done and unlocks what comes next.</span>
      </span>
      <span className="learn-claim-cta">
        Mark complete
        <Check size={15} />
      </span>
    </button>
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
// Section A: the company story, told one step at a time
// ============================================================
function StockSection() {
  // 0 pick investment, 1 profits accrue, 2 concept: ownership + why companies
  // sell shares, 3 concept: shares defined, 4 quiz, 5 Alice buys, 6 payoff, 7 recap
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
  const outOfPocket = invest - profitSoFar;
  const brokeEven = years > 0 && profitSoFar >= invest;
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
        By the end of this module you will be able to explain what a share is, how a company is divided into shares, and why owning part of a company means owning part of its future profits.
      </Objective>
      {step >= 1 && <ValuationChip worth={companyWorth} stakePct={stakePct} />}

      {/* Step 0: starting the company */}
      {step === 0 && (
        <div className="learn-story-step">
          <h4 className="learn-story-title">
            <Building2 size={18} /> You are starting a company
          </h4>
          <p>
            Picture this. You have an idea for a company, and you decide to put your own
            money into it to get it off the ground. How much do you put in?
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
            That money buys equipment, a small workspace, and everything else the company
            needs to open its doors. From this moment, the company is worth what you put in.
          </p>

          <div className="learn-factrow">
            <div className="learn-fact">
              <span className="learn-fact-label">Company worth</span>
              <span className="learn-fact-value"><Money value={invest} /></span>
            </div>
            <div className="learn-fact">
              <span className="learn-fact-label">You own</span>
              <span className="learn-fact-value">100%</span>
            </div>
            <div className="learn-fact">
              <span className="learn-fact-label">Out of pocket</span>
              <span className="learn-fact-value learn-negative">-<Money value={invest} /></span>
            </div>
          </div>

          <Narrator>
            Note the last number. The company is worth {invest.toLocaleString()} dollars, but
            that was your money. You have not made anything yet, so you are down
            {' '}{invest.toLocaleString()} dollars until the company starts earning.
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
            Your company sells its product and, every year, it makes <Money value={100} /> in
            <GlossaryText text=" profit. Press the button to let time pass and watch what happens." glossary={LEARN_GLOSSARY} />
          </p>

          <div className="learn-yearbox">
            <button type="button" className="learn-yearbtn" onClick={() => setYears((y) => y + 1)}>
              + 1 year
            </button>
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
                <span className="learn-fact-label">{outOfPocket > 0 ? 'You are down' : 'You are up'}</span>
                <span className={`learn-fact-value ${outOfPocket > 0 ? 'learn-negative' : 'learn-positive'}`}>
                  {outOfPocket > 0 ? '-' : '+'}<Money value={Math.abs(outOfPocket)} />
                </span>
              </div>
            </div>
          </div>

          {years > 0 && outOfPocket > 0 && (
            <Narrator>
              The company is now worth {companyWorth.toLocaleString()} dollars. Notice the
              last box: you are only down {outOfPocket.toLocaleString()} dollars, because
              the profits belong to you. The company getting richer is you getting richer.
            </Narrator>
          )}
          {brokeEven && (
            <Narrator icon={Sparkles}>
              At this point you have made everything back. Every dollar the company earns
              from here is pure gain: it no longer owes you a cent of what you put in.
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
            Before anything is sold, one idea needs to be precise. <strong>Ownership of a
            company is a claim on two things:</strong> everything the company owns today
            (equipment, cash, inventory) and everything it will earn in the future. If the
            company owns 100%, then 100% of that claim belongs to you. If you own half, half
            of that claim is yours. That claim is what investors mean when they say a company
            is <em>worth</em> a certain amount.
          </p>
          <p>
            Business is good, and you have figured out how to make more product. Expanding
            will take far more money than you have, though. A friend gives you advice:
          </p>
          <Narrator icon={Users}>
            <em>"You do not need one person with a lot of money. You need a lot of people
            with a little money each. Sell pieces of your company on the
            <GlossaryText text=" stock market" glossary={LEARN_GLOSSARY} />. Strangers can
            buy those pieces, and every buyer hands you cash."</em>
          </Narrator>
          <p>
            This is the real reason companies sell pieces of themselves. The money raised
            pays for growth the owner could never fund alone. So you decide to sell
            <strong> 30% of your shares</strong>. Look at the corner: your company is worth{' '}
            <Money value={companyWorth} />, so selling 30% of it means
            <strong> 30% of {companyWorth.toLocaleString()} = {saleValue.toLocaleString()}</strong>.
            That is what you gain once all of those shares sell.
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
              <span className="learn-fact-label">Total company value</span>
              <span className="learn-fact-value"><Money value={companyWorth} /></span>
            </div>
          </div>
          <p>
            Nothing about the company itself changed. It is worth the same
            {' '}{companyWorth.toLocaleString()} dollars as before. What changed is who owns
            it: a claim that used to be 100% yours is now split between you and the buyers.
            The corner readout shows your stake dropping to 70%.
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
            There is a practical problem with selling "30% of a company." A company is one
            thing. You cannot hand a stranger three tenths of it. The market solves this
            with a unit called a <GlossaryText text="share" glossary={LEARN_GLOSSARY} />.
          </p>
          <Narrator>
            A <GlossaryText text="share" glossary={LEARN_GLOSSARY} /> is one equal,
            standardized slice of a company. The owner slices the whole company into many
            identical shares, and from then on every sale, every price and every percentage
            of ownership is expressed in shares. Own 1 share out of 100 total shares and you
            own 1% of the company, no matter which shares they are.
          </Narrator>
          <p>
            Two numbers now define the sale. The <strong>price of one share</strong>, which
            you set as the owner, and the <strong>number of shares</strong> sold, which has
            to work out so that the pieces add up to the value being sold. You decide:
            <strong> 1 share costs $3</strong>.
          </p>
          <p>
            Check yourself with the corner readout: the 30% you are selling is worth{' '}
            <Money value={saleValue} />. At $3 per share, how many shares will be available
            in the market?
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
            <button type="button" className="learn-quiz-check" onClick={checkShares}>Check</button>
          </div>
          {sharesResult === 'wrong' && (
            <p className="learn-quiz-wrong">
              Not quite. Hint: take the value being sold, {saleValue.toLocaleString()}
              {' '}dollars, and divide by the price of one share, 3 dollars.
            </p>
          )}
          {sharesResult === 'correct' && (
            <>
              <p className="learn-quiz-right">
                <Check size={14} /> Exactly. {correctShares} shares of your company, at $3 each,
                add up to {saleValue.toLocaleString()} dollars.
              </p>
              <p>
                That is the arithmetic behind every
                <GlossaryText text=" share" glossary={LEARN_GLOSSARY} /> ever sold: price
                times count must equal the value being sold. Slicing a company this way is
                what makes it possible for anyone, with any amount of money, to own a piece
                of it.
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
            Your {correctShares} <GlossaryText text="shares" glossary={LEARN_GLOSSARY} /> are
            now listed on the <GlossaryText text="stock market" glossary={LEARN_GLOSSARY} />,
            where anyone can see them. Along comes <strong>Alice</strong>. She has heard
            about your product and expects the company to keep growing. She pays
            <strong> $3</strong> and buys <strong>1 share</strong>.
          </p>
          <Narrator>
            Alice does not get to walk into your office and make decisions. Owning a share
            means owning a small slice of the company's value and its future profits. What
            she really did was hand you $3 of her own money because she believes that slice
            will be worth more later.
          </Narrator>
          <p>
            Day by day, the rest of the shares sell. A few weeks later, all
            {' '}{correctShares} shares are gone.
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
            {saleValue.toLocaleString()} dollars</strong>. That is a stock sale.
            <GlossaryText text=" This exact trade, at a much larger scale, happens every day on the real stock market." glossary={LEARN_GLOSSARY} />
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
            Time to settle up. The company is worth <Money value={companyWorth} />, your
            shares sit at $3 each, and you own 70% of it. Step through what happened next,
            one stage at a time.
          </p>

          {/* Beat 1: the money goes to work */}
          {payoffBeat >= 1 && (
            <div className="learn-beat">
              <span className="learn-beat-num">1</span>
              <div className="learn-beat-body">
                <p className="learn-beat-title">The money goes to work</p>
                <p>
                  You take the <Money value={saleValue} /> raised from the 30% sale and
                  spend it on better equipment and a better product. It works. Yearly profit
                  doubles from <Money value={100} /> to <Money value={200} />.
                </p>
              </div>
            </div>
          )}

          {/* Beat 2: one more year passes */}
          {payoffBeat >= 2 && (
            <div className="learn-beat">
              <span className="learn-beat-num">2</span>
              <div className="learn-beat-body">
                <p className="learn-beat-title">One more year passes</p>
                <p>
                  From this year on, the company earns <Money value={200} /> annually instead
                  of <Money value={100} />. The company was worth <Money value={companyWorth} />,
                  it earns <Money value={200} />, so it is now worth{' '}
                  <Money value={finalWorth} />. Your 70% stake is now
                  {' '}<Money value={Math.round(finalWorth * 0.7)} />.
                </p>
              </div>
            </div>
          )}

          {/* Beat 3: what happened to Alice */}
          {payoffBeat >= 3 && (
            <div className="learn-beat">
              <span className="learn-beat-num">3</span>
              <div className="learn-beat-body">
                <p className="learn-beat-title">What happened to Alice</p>
                <p>
                  Alice bought 1 of the {correctShares} shares you sold, and those shares
                  together made up 30% of the company. Her single share is therefore a
                  {' '}{alicePct.toFixed(2)}% slice, which was worth exactly $3 on the day
                  she bought it.
                </p>
                <p>
                  Now the company is worth <Money value={finalWorth} />, so her
                  {' '}{alicePct.toFixed(2)}% slice is worth <Money value={aliceValue} />.
                  Her $3 grew to <Money value={aliceValue} />.
                </p>
              </div>
            </div>
          )}

          {/* Beat 4: the final scoreboard */}
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
                Notice that Alice gained the same percentage you did, about
                {' '}{(((finalWorth / companyWorth) - 1) * 100).toFixed(0)}% this year,
                because every slice of a company grows together. Her $3 will keep growing as
                long as the company does, which is why people buy stocks.
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
              <strong>A stock is a slice of a company.</strong> Buying one share means owning
              a small piece of that business and everything it earns in the future.
            </li>
            <li>
              <strong>Companies sell shares to raise money.</strong> They trade a piece of
              ownership for cash they can use to grow.
            </li>
            <li>
              <strong>People buy shares because they expect the company to be worth more
              later.</strong> Alice paid $3 for a slice she expected to grow. If it does,
              her slice becomes worth more than $3.
            </li>
            <li>
              <strong>Everyone's slice grows when the company grows.</strong> Your 70% and
              Alice's share both became more valuable as profits came in.
            </li>
          </ul>
          <Narrator>
            That is the whole game. A stock market is a place where these slices change
            hands, every day, millions of times. Everything else on this site builds on what
            you just did.
          </Narrator>
          <button type="button" className="learn-continue" onClick={reset}>
            Replay the story
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Section B: why prices move (mini scenario chart)
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
        By the end of this module you will be able to say what makes a share price rise or fall, and understand that every price you see is the result of a buyer and a seller meeting.
      </Objective>
      <p>
        In the story, your company's shares sold for $3 each. On a real
        <GlossaryText text=" stock market" glossary={LEARN_GLOSSARY} />, that price changes
        every single day, sometimes by a lot. Why?
      </p>
      <p>
        Think about a farmers market. If there is one crate of strawberries and ten people
        who want them, the price gets bid up until only the ten who value them most are
        left holding them. If there are ten crates and one buyer, sellers start cutting
        prices to win that buyer. A stock works the same way, except the market never
        closes: at every moment of the trading day, thousands of people are placing orders
        to buy or sell, and the price you see is the level where the two sides last met.
      </p>
      <p>
        So the useful question is not "what is the price?" but "what just changed the
        balance between buyers and sellers?" Usually the answer is news:
      </p>
      <ul className="learn-movelist">
        <li>
          <strong>Good news</strong>, such as a hit product or rising sales, makes more
          people want to own the company. Buyers crowd in, sellers hold back, and the price
          rises until enough owners are tempted to sell.
        </li>
        <li>
          <strong>Bad news</strong>, such as a failed product or rising costs, makes owners
          want out. Sellers crowd in, buyers back away, and the price falls until enough
          buyers step in.
        </li>
        <li>
          <strong>No news</strong> leaves the balance roughly where it was. The price drifts.
        </li>
      </ul>
      <p>
        The price, then, is not a fact about the company. It is a running vote, cast with
        real money, on what the company will be worth later. Cast a few votes yourself:
        each button below is a piece of news, and the chart is your company's share price
        reacting to it.
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
            <button key={s} type="button" className="learn-scenario" onClick={() => applyScenario(s)}>
              {SCENARIOS[s].label}
            </button>
          ))}
        </div>
        {caption && <p className="learn-caption">{caption}</p>}
        {used >= 4 && (
          <p className="learn-caption learn-caption-strong">
            See the pattern? No single button tells you where the price goes. What matters
            is which side, buyers or sellers, suddenly shows up in larger numbers. Every
            real market move starts the same way.
          </p>
        )}
      </div>
      <p>
        One last piece: nobody checks whether a stock is "correctly" priced. Two people can
        look at the same company and honestly disagree about what it is worth, one seeing
        mostly upside, the other mostly risk. That disagreement is why trades happen at
        all: the seller prefers cash, the buyer prefers the share, and only time reveals
        who was right.
      </p>
    </div>
  );
}

// ============================================================
// Section C: market execution (orders, broker, slippage)
// ============================================================

function ExecutionSection() {
  return (
    <div>
      <Objective>
        By the end of this module you will be able to name the three order types, say what each one guarantees and what it does not, and know which one to use when you want to buy right now.
      </Objective>
      <p>
        In the story, Alice walked up and bought 1 share for $3, and that was that. Real
        trading has a few more moving parts, and they all have names. Learning them now
        makes everything later on the site easier to read.
      </p>
      <ul className="learn-movelist">
        <li>
          <strong>Buying</strong> means paying money to acquire shares. <strong>Selling</strong>{' '}
          is the reverse: handing over shares to receive money. Every trade needs both
          sides, one buyer and one seller.
        </li>
        <li>
          A <strong>broker</strong> is the middleman with direct access to the market. You
          tell the broker what to buy, how much, and at what price, and the broker places
          the order on the exchange. The app or website you would use to trade works with a
          broker behind the scenes.
        </li>
        <li>
          A <strong>market order</strong> says "trade right now, at whatever the current
          price is." It always fills, but the exact price is whatever the market offers at
          that instant.
        </li>
        <li>
          A <strong>limit order</strong> says "trade, but only at my price or better." It
          gives you control over price at the cost of certainty: if the market never
          reaches your price, the order never fills.
        </li>
        <li>
          A <strong>stop-limit order</strong> is a stop-loss you place in advance with a
          price attached. If the stock falls to your trigger, the broker attempts to sell
          at that price or better. Traders use it to cap a loss without having to watch
          the screen.
        </li>
        <li>
          <strong>Slippage</strong> is the gap between the price you expected and the price
          you got. Markets move in the second your order is in flight, so a market order
          for a fast-moving stock can fill a few cents away from the price on your screen.
        </li>
        <li>
          <GlossaryText text="Commission" glossary={LEARN_GLOSSARY} /> is the broker's fee
          for handling the trade. Many brokers charge none today, but it is one of the
          costs that quietly separates the returns you read about from the returns you
          actually receive.
        </li>
      </ul>
      <p>
        These terms describe the mechanics of trading, not the decision of what to trade.
        The decision is where <GlossaryText text=" strategies" glossary={LEARN_GLOSSARY} />
        {' '}live, and that comes next.
      </p>
    </div>
  );
}

// ============================================================
// Section D: candlesticks
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
  const candles = useMemo(makeCandles, []);
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
        By the end of this module you will be able to read a candlestick chart, say what each of the four daily prices means, and know what the green and red colours are telling you.
      </Objective>
      <p>
        Before the math can mean anything, you need to be able to read the raw material
        every strategy works with: the price chart. And the most common kind of price chart
        is the candlestick chart, the same style used on the Performance page.
      </p>
      <p>
        A <GlossaryText text="candlestick chart" glossary={LEARN_GLOSSARY} /> shows each
        day as a single candle. One candle carries four prices for that day:
      </p>
      <ul className="learn-movelist">
        <li><strong>Open</strong>: the first price of the day, when trading began.</li>
        <li><strong>Close</strong>: the last price of the day, when trading ended.</li>
        <li><strong>High</strong>: the highest price reached at any point during the day.</li>
        <li><strong>Low</strong>: the lowest price reached at any point during the day.</li>
      </ul>
      <p>
        The wide part of the candle is drawn between the open and the close, and the thin
        lines above and below it, called wicks, reach to the high and the low. The color
        carries the summary: <strong>green</strong> means the close finished above the
        open, so the day ended higher than it started. <strong>Red</strong> means the
        close finished below the open, so the day ended lower.
      </p>

      <div className="learn-quizcandle">
        <p className="learn-quizcandle-title">Practice: green or red?</p>
        <p>
          Below are one day's four prices, exactly as a data feed reports them. Decide
          whether this day's candle would be green or red, then check the answer.
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
          <button type="button" className="learn-ordertype" onClick={() => answer('green')}>Green</button>
          <button type="button" className="learn-ordertype" onClick={() => answer('red')}>Red</button>
          <button type="button" className="learn-ordertype" onClick={newCandle}>New candle</button>
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
        Now put a week of them together. This is your company's first week on the market,
        one candle per day. Read it the way you just learned: each candle is one day's
        summary, and the colors show which days the buyers or the sellers won.
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
        Notice the story the week tells without a single word: two strong green days, a
        small pullback, a red day where sellers took control, and then a final green day
        that recovered most of the loss. Traders read charts this way, looking for
        patterns in who is winning. Patterns are exactly what the next section turns into
        rules.
      </p>
    </div>
  );
}

// ============================================================
// Section E: how strategies are made
// ============================================================

function MathSection() {
  return (
    <div>
      <Objective>
        By the end of this module you will be able to name the two schools every
        strategy is built from, summarise a company’s finances from four numbers,
        and state the three jobs any strategy must do.
      </Objective>
      <p>
        You can now read a chart and judge single days. The next question is the
        most important one: how does anyone decide what to buy? Not by feeling. By
        writing rules down. And those rules come from one of two places, sometimes
        both.
      </p>

      <div className="learn-school">
        <p className="learn-school-name">A. Technical analysis: reading price action</p>
        <p>
          The first way uses nothing but the prices you already know: the{' '}
          <strong>open, high, low and close</strong> of each day, the same four numbers
          from the candle quiz. Stacked over weeks and months, they form patterns, and
          those patterns tend to repeat, because they are produced by the same forces you
          saw in section B: crowds of buyers and sellers reacting to news, fear and
          greed, over and over. Finding patterns in price action and acting on them is
          called <GlossaryText text="technical analysis" glossary={LEARN_GLOSSARY} />.
          Almost every <strong>trading</strong> strategy, the kind that buys and sells
          over days or weeks, is built on it.
        </p>
      </div>

      <div className="learn-school">
        <p className="learn-school-name">B. Financial analysis: reading the business</p>
        <p>
          The second way ignores the day-to-day price and studies the company itself.
          Every company publishes the same basic story once a year: how much money came
          in, what it cost to run the business, what was left over, and how much the
          company owes. Reading those numbers to decide whether the business is worth
          owning is <GlossaryText text="financial analysis" glossary={LEARN_GLOSSARY} />
          the approach behind <strong>investing</strong> strategies, the kind held for
          years rather than days.
        </p>
        <div className="learn-rules">
          <div className="learn-rule">
            <span className="learn-rule-num">1</span>
            <p><strong>What does the company actually sell?</strong> Does anyone want it, and can the company stop competitors from taking the customers? A great product nobody wants is still a failing business.</p>
          </div>
          <div className="learn-rule">
            <span className="learn-rule-num">2</span>
            <p><strong>How much of every dollar does it keep?</strong> Money that comes in is <strong>revenue</strong>. What remains after every cost is paid is <strong>profit</strong>, also called <strong>earnings</strong>. The share of revenue that survives is the <strong>profit margin</strong>, the single number analysts quote most.</p>
          </div>
          <div className="learn-rule">
            <span className="learn-rule-num">3</span>
            <p><strong>How much does it owe?</strong> <strong>Debt</strong> is money the company must repay. Some debt is normal and useful; heavy debt turns a bad year into a crisis, because lenders get paid whether the company thrives or not.</p>
          </div>
          <div className="learn-rule">
            <span className="learn-rule-num">4</span>
            <p><strong>Which direction are those numbers heading?</strong> One good year proves little. A profit climbing steadily for four straight years is the picture long-term investors look for, and the share price tends to follow the business over time.</p>
          </div>
        </div>
        <p>
          Two honest caveats, because this course would rather be fair than
          convincing. First, financial analysis explains the long run but not the next
          month: a wonderful business can still see its share price fall for reasons
          that have nothing to do with it. Second, numbers describe the past, they are
          evidence about a business, not a prophecy about its future. Used carefully,
          they are still the best snapshot of what you are actually buying when you buy
          a share.
        </p>
      </div>

      <p>
        So a <GlossaryText text="strategy" glossary={LEARN_GLOSSARY} /> is a set of
        rules drawn from one of these two schools: either finding and following patterns
        in price action, or measuring how well a company is doing and investing in that
        company. Whatever the source, every strategy has the same three jobs:
      </p>
      <div className="learn-rules">
        <div className="learn-rule">
          <span className="learn-rule-num">1</span>
          <p><strong>Decide if and when to buy.</strong> Based on the rules it was given: a pattern appearing on the chart, or the company's numbers crossing a threshold.</p>
        </div>
        <div className="learn-rule">
          <span className="learn-rule-num">2</span>
          <p><strong>Decide how much to buy.</strong> Based on how much risk you can take, so no single trade can hurt more than you allowed.</p>
        </div>
        <div className="learn-rule">
          <span className="learn-rule-num">3</span>
          <p><strong>Set the exits.</strong> The <GlossaryText text="stop-loss" glossary={LEARN_GLOSSARY} /> where a losing trade gets cut, and the <GlossaryText text="take-profit" glossary={LEARN_GLOSSARY} /> where a winning trade gets banked.</p>
        </div>
      </div>
      <p>
        The computer applies these rules the same way every day, without fear, excitement,
        or fatigue, which is precisely what human traders find difficult. The next section
        walks you through jobs 2 and 3 yourself, with real numbers. Every strategy on
        SLTP shows its rules openly, so the idea can be judged before it is trusted.
      </p>
      <Recap points={[
        <>The two schools: <strong>technical analysis</strong> reads price action, <strong>financial analysis</strong> reads the business.</>,
        <>Revenue is money in; <strong>profit</strong> (earnings) is what survives costs; <strong>margin</strong> is the share kept per dollar.</>,
        <>Rising revenue can hide falling profit, always read the three together.</>,
        <>Every strategy does the same three jobs: when to buy, how much, and where to exit.</>,
      ]} />
    </div>
  );
}

// ============================================================
// Section F: risk management, guided by the user's own numbers
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
        By the end of this module you will be able to set a stop-loss and a take-profit, explain why the stop must sit below your entry price, and calculate a position size that keeps any single mistake affordable.
      </Objective>
      <p>
        The rules so far decide <em>what</em> to buy. None of them answer the question
        that separates traders who survive from those who do not: <strong>when do you get
        out, and how much do you bet?</strong> The clearest way to understand this is to
        make the decisions yourself, with real numbers.
      </p>
      <Narrator>
        The setup: you bought 1 share of a stock at <Money value={entry} />. It is a
        company you believe in, but no belief is guaranteed. Two prices need to be chosen
        before anything else happens, and both are yours to pick.
      </Narrator>
      <p>
        Why decide now, instead of when it happens? Because from tomorrow morning on,
        nobody, including you, knows whether the price will go up or down. Decisions made
        while losing money are made under stress, and stress reliably produces the two
        worst habits in markets: holding losers far too long, and selling winners far too
        early. So both exits are written down in advance. A level below the entry
        protects you from losing too much, and a level above it tells you when you have
        made enough and it is time to take the profit.
      </p>
      <p>
        One thing the stop can never be is <Money value={entry} /> itself, the price you
        just paid. A stop must sit below the entry, because it is the line where the
        trade is declared failed. Placed exactly at the entry, the first ordinary
        downward wiggle would sell you out immediately and the position would never
        survive long enough to be right. The real decision is how far below.
      </p>

      {/* Sub-step 1: the stop */}
      {subStep === 0 && (
        <div className="learn-substep">
          <p className="learn-substep-title">Decision 1: where do you cut your losses?</p>
          <p>
            The stock trades at <Money value={entry} /> today. Some morning it opens lower.
            Then lower again. At what price do you want to say: <strong>my trade is not
            working, sell now, before it falls further?</strong> That price is the
            <GlossaryText text=" stop-loss" glossary={LEARN_GLOSSARY} />. Pick it:
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
            Think about what your slider choice buys, and what it costs. A tight stop
            near {entry.toLocaleString()} dollars keeps every loss small, but stocks
            wobble by a few percent in ordinary conditions, so a tight stop converts that
            noise into a stream of small losses: you get sold out of trades that would
            eventually have worked. A wider stop survives those dips and gives the trade
            room to be right, at the price of a bigger loss when it is wrong. Neither is
            free, and there is no universally correct number. The professional habit is
            simply to choose it here, calmly, in advance.
          </Narrator>
          <Continue onClick={() => advanceSub(1)} label="I picked my stop" />
        </div>
      )}

      {/* Sub-step 2: the target */}
      {subStep === 1 && (
        <div className="learn-substep">
          <p className="learn-substep-title">Decision 2: where do you take the money?</p>
          <p>
            Now the other direction. The stock climbs. At what price do you want to say:
            <strong> I have made enough, sell now, before it slides back?</strong> That
            price is the <GlossaryText text="take-profit" glossary={LEARN_GLOSSARY} />.
            Pick it:
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
            The same tradeoff applies here, in mirror image. A wide target pays well when
            reached but is reached rarely: a price rarely travels far without pulling
            back along the way, and that pullback can hit your stop first. A near target
            is reached often but small, and if each gain is routinely smaller than each
            loss, the arithmetic of the whole strategy turns negative no matter how
            often it wins. The target decides how much each victory pays; the stop
            decides how much each defeat costs; the strategy lives between the two.
          </Narrator>
          <Continue onClick={() => advanceSub(2)} label="See what I just built" />
        </div>
      )}

      {/* Sub-step 3: the reveal */}
      {subStep === 2 && (
        <div className="learn-substep">
          <p className="learn-substep-title">What your two decisions created</p>
          <p>
            Your stop and your target together define the shape of the trade. Here is the
            complete picture:
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
                <GlossaryText text="Risk-reward ratio" glossary={LEARN_GLOSSARY} />
              </span>
              <span className="learn-fact-value">1 : {rrr.toFixed(1)}</span>
            </div>
          </div>
          <p>
            The <strong>risk-reward ratio</strong> reads directly from your two sliders:
            you risk <Money value={riskPerShare} /> per share to potentially make{' '}
            <Money value={gainPerShare} />. A ratio of 1:{rrr.toFixed(1)} means{' '}
            {rrr > 1.05
              ? 'every dollar of loss is backed by more than a dollar of potential gain, so the wins can outweigh the losses even when you are wrong often.'
              : rrr >= 0.95
                ? 'each dollar of loss is matched by one dollar of gain, so the trade only breaks even if you are right slightly more often than you are wrong.'
                : 'each win is smaller than each loss, so you need to win considerably more often than you lose just to stay ahead.'}
            {' '}This single number is why some traders profit while being wrong half the
            time, and others lose while being right most of the time.
          </p>

          <div className="learn-riskbox">
            <p className="learn-riskbox-title">Last piece: how many shares?</p>
            <p>
              The stop defines the worst case per share. Position sizing decides how many
              shares that worst case is allowed to happen to. The standard rule: risk a
              small fixed slice of the account on any single trade. With a{' '}
              <Money value={account} /> account risking 2% per trade:
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
              Read the last box carefully: if this trade fails, the account loses
              {' '}{potentialLoss.toLocaleString()} dollars, no more, and if it works it
              makes about {rrr.toFixed(1)} times that.{' '}
              {shares === sharesByRisk
                ? 'Notice how your wider stop automatically bought fewer shares: the position shrank to keep the maximum loss fixed. That is position sizing working exactly as intended.'
                : 'Your stop sits so close to the entry that the 2% rule alone would allow more shares than the account can afford, so here the position is limited by available cash, and the actual worst case comes in under the limit. Slide the stop wider and watch the risk rule take over, buying fewer shares as the stop moves down.'}
            </p>
          </div>
          <p>
            This is why the strategies on SLTP always publish a stop-loss and a
            take-profit alongside every buy rule. The buy rule finds the opportunity. The
            sizing rule keeps any single mistake affordable. The stops and targets make
            sure that, over many trades, the wins outweigh the losses by design rather
            than by luck. Change your sliders above and watch every number here respond.
          </p>
          <button type="button" className="learn-continue" onClick={() => setSubStep(0)}>
            Replay the exercise
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Section G: testing a strategy
// ============================================================

function TestingSection() {
  return (
    <div>
      <Objective>
        By the end you will be able to describe what a <GlossaryText text="backtest" glossary={LEARN_GLOSSARY} /> is,
        explain the one rule that keeps it honest, and say why it is evidence
        rather than proof.
      </Objective>
      <p>
        Here is the question that matters before you risk a single dollar: <strong>would
        these rules have actually worked?</strong> The person selling a strategy will always
        say yes. A glossy chart of what it <em>could</em> have earned proves nothing,
        because anyone can draw a beautiful chart after seeing what the market did.
      </p>
      <p>
        The way out of this trap is a useful fact about markets: they keep records. The
        price of essentially every stock, on every trading day, going back decades, is
        written down and public. So instead of arguing about whether the rules look smart,
        they can be checked.
      </p>
      <p>
        The check works like this. Pick a date in the past, say January 1st, five years
        ago, and give the computer a pretend pot of money. Show the computer only the
        prices known on that date, and let it apply the strategy's rules. If a rule says
        buy, the computer buys at the price that actually existed then. Move the clock
        forward one day and repeat. Day after day, the computer lives through history in
        slow motion, obeying the rules, buying and selling, while the score is kept.
      </p>
      <Narrator>
        One rule makes this honest: on each simulated day, the computer only sees prices
        from that day and earlier. It is never allowed to see tomorrow's price. That would
        be like grading a student's predictions using the answer sheet, and the real world
        does not hand anyone tomorrow's price today.
      </Narrator>
      <p>
        This replay is a <GlossaryText text="backtest" glossary={LEARN_GLOSSARY} />, and it
        turns opinions into evidence. At the end you get the full record: every trade the
        rules would have made, the growth of the money over time, the worst losing stretch
        they would have survived, and how they compare against simply holding an
        <GlossaryText text=" index fund" glossary={LEARN_GLOSSARY} />. If a strategy cannot
        beat that baseline over ten years, the rules are not worth following.
      </p>

      <div className="learn-pitfalls">
        <p className="learn-pitfalls-title">
          <AlertTriangle size={15} /> Where backtests lie: the three classic traps
        </p>
        <p>
          A backtest is only as honest as the way it was built. Three mistakes show up so
          often they have names, and every serious backtesting tool guards against them.
        </p>
        <div className="learn-pitfall">
          <span className="learn-pitfall-num">1</span>
          <div className="learn-pitfall-body">
            <p className="learn-pitfall-name">Overfitting</p>
            <p>
              Suppose you keep adjusting your stop-loss and take-profit levels until the
              backtest shows the best possible result. Those numbers no longer describe a
              general strategy; they describe exactly what would have worked on that one
              slice of history. The rules have memorized the past rather than learned
              anything that transfers to the future, and a test on any different period
              will usually expose it.
            </p>
          </div>
        </div>
        <div className="learn-pitfall">
          <span className="learn-pitfall-num">2</span>
          <div className="learn-pitfall-body">
            <p className="learn-pitfall-name">Look-ahead bias</p>
            <p>
              This happens when the simulation uses information nobody could have had at
              the time. The classic version: a rule that buys at today's price using a
              signal based on today's closing price. During the trading day, nobody knows
              what the close will be, so a real trader could never have acted on it. The
              test must only ever use prices from that day and earlier.
            </p>
          </div>
        </div>
        <div className="learn-pitfall">
          <span className="learn-pitfall-num">3</span>
          <div className="learn-pitfall-body">
            <p className="learn-pitfall-name">Survivorship bias</p>
            <p>
              Testing on today's list of stocks quietly removes every company that went
              bankrupt or was delisted along the way. All the losers are deleted from the
              sample before the test even starts, so the past looks far safer than it
              actually was. An honest test runs against the full historical universe,
              including the companies that no longer exist.
            </p>
          </div>
        </div>
        <p className="learn-pitfall-close">
          <Receipt size={14} /> A backtest that avoids all three traps is evidence. One that
          does not is marketing.
        </p>
      </div>

      <p>
        A final word of honesty: a backtest shows what the rules <em>did</em> do, not what
        they <em>will</em> do. The future is allowed to differ from the past; the next ten
        years can bring things no previous year contained. Backtests are the beginning of
        trust, not the end of it. But they remain the best evidence available, and they
        beat hoping every single time.
      </p>


      <Recap points={[
        <>A <GlossaryText text="backtest" glossary={LEARN_GLOSSARY} /> replays rules against real past prices, one day at a time.</>,
        <>The honesty rule: the simulation may only see prices from that day and earlier.</>,
        <>Compare against a plain <GlossaryText text="index fund" glossary={LEARN_GLOSSARY} />, if it cannot beat that, the rules earn nothing.</>,
        <>Evidence, not prophecy. It shows what the rules did, never what they will do.</>,
      ]} />

    </div>
  );
}

// ============================================================
export default function LearnPage({ onNavigate }: LearnPageProps) {
  const learn = useLearn();

  // Every anchor the sidebar can point at, in document order: the two intro
  // landmarks, then each unlocked tier's revealed modules and its gate.
  const anchorIds = useMemo(() => {
    const ids = INTRO_SECTIONS.map((s) => s.id);
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
      case 't3-indicators': return <IndicatorsSection />;
      case 't4-walkthrough': return <BacktestWalkthroughSection />;
      case 't5-metrics': return <MetricsSection />;
      case 't5-allocation': return <AllocationSection />;
      default: return null;
    }
  };

  return (
    <div className="learn-page">
      <div className="learn-hero-wrapper page-hero-band is-full-bleed is-dot-grid">
        <div className="learn-hero-inner page-hero-inner">
        <div className="learn-hero-top">
          <span className="learn-hero-subtitle">New to the stock market? Start here.</span>
          <h1 className="learn-hero-title">The stock market, from zero.</h1>
          <p className="learn-hero-description">
          Five tiers, unlocked one at a time. Each tier opens with a single module, and the
          next one appears only when you finish the last, so there is always exactly one
          thing to do. Finish a module to claim its badge, and pass a tier's quiz to earn
          its certificate. Every module also ends with an optional quiz if you want to
          check yourself.
          </p>
        </div>
        <div className="learn-herostats">
          <div className="learn-herostat">
            <span className="learn-herostat-value">{learn.earnedBadges.length}</span>
            <span className="learn-herostat-label">badges</span>
          </div>
          <div className="learn-herostat">
            <span className="learn-herostat-value">{learn.earnedTrophies.length}</span>
            <span className="learn-herostat-label">trophies</span>
          </div>
          <div className="learn-herostat">
            <span className="learn-herostat-value">{learn.progress.certifications.length}/5</span>
            <span className="learn-herostat-label">tiers</span>
          </div>
        </div>
        </div>
      </div>

      <div className="learn-layout">
        <TierNav learn={learn} activeId={activeId} onJump={jump} />

        <div className="learn-content">
          <section id="start" className="learn-section">
            <div className="learn-section-heading">
              <span className="learn-section-num">00</span>
              <h2>Start here</h2>
            </div>
            <p>
              Most finance material assumes the vocabulary is already familiar. This course
              assumes the opposite. Everything is built up from one story about a small
              company, and the decisions are yours to make along the way.
            </p>
            <div className="learn-tierlist">
              {TIERS.map((tier, i) => {
                const status = learn.tierStatus(tier);
                return (
                  <div key={tier.id} className={`learn-tierlist-item is-${status}`}>
                    <span className="learn-tierlist-num">{i + 1}</span>
                    <span className="learn-tierlist-body">
                      <strong>{tier.title}</strong>
                      <small>
                        {status === 'locked'
                          ? 'Locked, finish the tier above'
                          : status === 'certified'
                            ? `Certified, ${tier.certification}`
                            : tier.objective}
                      </small>
                    </span>
                    {status === 'certified' && <Trophy size={16} />}
                    {status === 'locked' && <Lock size={14} />}
                  </div>
                );
              })}
            </div>
          </section>

          <section id="credentials" className="learn-section">
            <div className="learn-section-heading">
              <span className="learn-section-num">★</span>
              <h2>Your badges</h2>
            </div>
            <p>
              Everything you have earned, saved to your account. Badges come from finishing
              a module; trophies come from passing a tier's quiz.
            </p>
            <BadgeShelf learn={learn} />
          </section>

          {TIERS.map((tier, tierIdx) => {
            if (learn.tierStatus(tier) === 'locked') return null;
            const visible = learn.visibleSections(tier);
            const gateOpen = learn.gateAvailable(tier);

            return (
              <div key={tier.id} className="learn-tierblock">
                <TierBanner id={`tier-${tier.id}`} tier={tier} learn={learn} index={tierIdx} />

                {visible.map((s) => {
                  const next = visible[visible.indexOf(s) + 1];
                  const badge = badgeFor(s.id);
                  const BadgeIcon = badge.icon;
                  return (
                    <section key={s.id} id={s.id} className="learn-section">
                      <div className="learn-section-heading">
                        <span className="learn-section-num">{s.num}</span>
                        <div>
                          <h2>{s.label}</h2>
                          <p className={`learn-section-badge ${learn.isSectionDone(s.id) ? 'is-earned' : ''}`}>
                            <BadgeIcon size={13} />
                            {learn.isSectionDone(s.id) ? `Badge earned: ${badge.name}` : `Badge: ${badge.name}`}
                          </p>
                        </div>
                      </div>
                      {moduleFor(s.id)}
                      <SectionQuiz questions={MODULE_QUIZZES[s.id] ?? []} />
                      {s.id !== 'long-short' && (
                        <ModuleComplete
                          sectionId={s.id}
                          learn={learn}
                          nextId={next?.id}
                          gateId={!next && gateOpen && !learn.isCertified(tier.id) ? `gate-${tier.id}` : undefined}
                        />
                      )}
                    </section>
                  );
                })}

                {gateOpen && !learn.isCertified(tier.id) && <TierGate tier={tier} learn={learn} />}
              </div>
            );
          })}

          <section id="next-steps" className="learn-section">
            <div className="learn-section-heading">
              <span className="learn-section-num">→</span>
              <h2>Where to go from here</h2>
            </div>
            <p>
              You now know what a strategy is, how one is built, how it is tested,
              and how risk is sized. The rest of SLTP is where you put that to use.
            </p>
            <div className="learn-nextsteps">
              <button
                type="button"
                className="learn-nextcard"
                onClick={() => onNavigate?.('performance')}
              >
                <span className="learn-nextcard-icon"><TrendingUp size={17} /></span>
                <span className="learn-nextcard-body">
                  <strong>Performance</strong>
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
