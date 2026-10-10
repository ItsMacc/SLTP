// LongShortSection.tsx - Tier II module A: long vs. short, told as two
// mirror stories with a live trade simulator.
//
// Teaching model (per course design):
//   LONG  - you buy FIRST, hoping the price rises, then sell for profit.
//   SHORT - you sell FIRST at today's price (a borrowed share you owe back,
//           sort of like a loan), then buy it back cheaper and keep the gap.
//
// SLTP strategies are long-only; this module teaches shorting so the
// concept is understood, not feared.

import { useState } from 'react';
import { ArrowRight, Check, ChevronRight, Lightbulb, TrendingDown, TrendingUp } from 'lucide-react';
import { Objective } from './parts';

interface Props {
  onComplete?: () => void;
  onCredentials?: () => void;
}

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

export default function LongShortSection({ onComplete, onCredentials }: Props) {
  // 0: long story, 1: short story, 2: side-by-side simulator, 3: recap
  const [step, setStep] = useState(0);
  const [exitPrice, setExitPrice] = useState(90);
  const [ack, setAck] = useState(false);

  const longProfit = exitPrice - 100;
  const shortProfit = 100 - exitPrice;

  // Each beat swaps the copy in place, so pull the reader back up to the
  // top of the module for the new beat instead of leaving them mid-page.
  const advance = (next: number) => {
    setStep(next);
    document.getElementById('long-short')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div>
      <Objective>
        By the end of this module you will be able to explain what it means to go
        long and what it means to go short, describe how a short works when you do
        not own the share, and say why going short carries the greater risk.
      </Objective>

      {/* ---------- Step 0: the long side ---------- */}
      {step === 0 && (
        <div className="learn-story-step">
          <h4 className="learn-story-title">
            <TrendingUp size={18} /> Side one: going long
          </h4>
          <p>
            Almost everything you have learned so far is one side of the trade:
            <strong> you buy first</strong>. You pay $100 today because you believe the
            stock will be worth more later. Nothing is borrowed, nothing is owed. Your
            risk is bounded, the worst case is the company going to zero, and you would
            lose your $100.
          </p>
          <div className="learn-factrow">
            <div className="learn-fact">
              <span className="learn-fact-label">You pay today</span>
              <span className="learn-fact-value learn-negative">-$100</span>
            </div>
            <div className="learn-fact">
              <span className="learn-fact-label">If it rises to $130, you sell for</span>
              <span className="learn-fact-value learn-positive">+$130</span>
            </div>
            <div className="learn-fact">
              <span className="learn-fact-label">Your profit</span>
              <span className="learn-fact-value learn-positive">+$30</span>
            </div>
          </div>
          <Narrator icon={TrendingUp}>
            Buy first, sell later at a higher price. That is a <strong>long</strong> position,
            and it is how every strategy on SLTP works. You are betting the price goes UP.
          </Narrator>
          <Continue onClick={() => advance(1)} label="Now the other side" />
        </div>
      )}

      {/* ---------- Step 1: the short story ---------- */}
      {step === 1 && (
        <div className="learn-story-step">
          <h4 className="learn-story-title">
            <TrendingDown size={18} /> Side two: going short
          </h4>
          <p>
            Suppose you are convinced the stock is going to <strong>fall</strong>. It sits
            at $100 right now. How do you profit from a drop, when the normal move is to
            buy something and hope it rises?
          </p>
          <p>
            You do the steps in reverse order. You <strong>sell first</strong>, but you
            do not own any shares. So you borrow one. Conceptually, you hand a share to
            someone who wants to buy right now and collect their $100. Now
            <strong> you owe that share back</strong>, sort of like a loan of stock.
          </p>
          <div className="learn-factrow">
            <div className="learn-fact">
              <span className="learn-fact-label">You sell the borrowed share at</span>
              <span className="learn-fact-value learn-positive">+$100</span>
            </div>
            <div className="learn-fact">
              <span className="learn-fact-label">You now owe</span>
              <span className="learn-fact-value learn-negative">-1 share</span>
            </div>
            <div className="learn-fact">
              <span className="learn-fact-label">Cash in your pocket</span>
              <span className="learn-fact-value">$100</span>
            </div>
          </div>
          <Narrator icon={TrendingDown}>
            You have not made or lost anything yet. You are holding $100 of someone
            else's money and a debt of one share that must be returned
            <strong> the shares, not the cash, are what you owe back</strong>.
          </Narrator>
          <Continue onClick={() => advance(2)} label="Watch the price drop" />
        </div>
      )}

      {/* ---------- Step 2: cover, the price drops to $90 ---------- */}
      {step === 2 && (
        <div className="learn-story-step">
          <h4 className="learn-story-title">
            <TrendingDown size={18} /> Closing the loan: buying it back at $90
          </h4>
          <p>
            The stock falls to <strong>$90</strong>, exactly as you predicted. Now you
            buy one share on the open market for $90 and hand that share back to settle
            your debt. The loan is repaid. Slide the price to see how the math changes:
          </p>

          <div className="learn-slider-block">
            <div className="learn-slider-readout">
              <span>You buy back at</span>
              <strong className="learn-money">${exitPrice}</strong>
            </div>
            <input
              type="range"
              min={60}
              max={140}
              step={1}
              value={exitPrice}
              onChange={(e) => setExitPrice(parseInt(e.target.value, 10))}
              className="learn-slider"
              aria-label="Price you buy the share back at"
            />
            <div className="learn-slider-scale">
              <span>$60 (it crashed)</span><span>$140 (it rallied)</span>
            </div>
          </div>

          <div className="learn-factrow">
            <div className="learn-fact">
              <span className="learn-fact-label">Sold first at</span>
              <span className="learn-fact-value">$100</span>
            </div>
            <div className="learn-fact">
              <span className="learn-fact-label">Bought back at</span>
              <span className="learn-fact-value">${exitPrice}</span>
            </div>
            <div className="learn-fact">
              <span className="learn-fact-label">Your result</span>
              <span className={`learn-fact-value ${shortProfit >= 0 ? 'learn-positive' : 'learn-negative'}`}>
                {shortProfit >= 0 ? '+' : '-'}${Math.abs(shortProfit)}
              </span>
            </div>
          </div>

          {shortProfit > 0 && (
            <Narrator icon={TrendingDown}>
              You sold at $100 and bought back at ${exitPrice}: you kept{' '}
              <strong>${shortProfit}</strong> without ever owning the stock. The price
              dropped {100 - exitPrice} dollars, and that drop was your income.
            </Narrator>
          )}
          {shortProfit === 0 && (
            <Narrator>
              The price ended exactly where it started. The loan is repaid, but the
              trade earned nothing. Shorts only pay when the price actually falls.
            </Narrator>
          )}
          {shortProfit < 0 && (
            <Narrator icon={TrendingUp}>
              The price went <strong>up</strong> to ${exitPrice} instead. You still owe
              the share, so you had to buy it back for <strong>${exitPrice}</strong>
              losing <strong>${Math.abs(shortProfit)}</strong>. Notice the cruel
              symmetry: you sold at $100 and the bill had no ceiling. This is why SLTP
              strategies never short: they only ever buy first.
            </Narrator>
          )}
          <Continue onClick={() => advance(3)} label="Compare both sides" />
        </div>
      )}

      {/* ---------- Step 3: side by side + recap ---------- */}
      {step === 3 && (
        <div className="learn-story-step">
          <h4 className="learn-story-title">
            <Check size={18} /> Both sides, one screen
          </h4>
          <div className="learn-factrow">
            <div className="learn-fact">
              <span className="learn-fact-label">LONG at ${exitPrice}</span>
              <span className={`learn-fact-value ${longProfit >= 0 ? 'learn-positive' : 'learn-negative'}`}>
                {longProfit >= 0 ? '+' : '-'}${Math.abs(longProfit)}
              </span>
            </div>
            <div className="learn-fact">
              <span className="learn-fact-label">SHORT at ${exitPrice}</span>
              <span className={`learn-fact-value ${shortProfit >= 0 ? 'learn-positive' : 'learn-negative'}`}>
                {shortProfit >= 0 ? '+' : '-'}${Math.abs(shortProfit)}
              </span>
            </div>
          </div>
          <p>
            At any price, the two positions are exact mirror images: one's gain is the
            other's loss. The difference is in the order of operations and in the risk:
          </p>
          <ul className="learn-movelist">
            <li>
              <strong>Long:</strong> buy first at $100, sell later. Maximum loss is your
              $100 (a stock cannot go below zero), and the profit has no ceiling.
            </li>
            <li>
              <strong>Short:</strong> sell first at $100 using a borrowed share, buy it
              back later to repay. Maximum <em>profit</em> is $100 (the stock stops at
              zero), but the <em>loss</em> has no ceiling if it keeps rising.
            </li>
          </ul>
          <Narrator>
            SLTP strategies are long-only: every signal buys first and sells later. You
            will rarely short anything here, but knowing the mechanism explains a lot of
            market language, like why a stock that keeps climbing can inflict unlimited
            pain on short sellers and trigger a <strong>short squeeze</strong>.
          </Narrator>
          {!ack ? (
            <Continue
              onClick={() => { setAck(true); onComplete?.(); }}
              label="Mark module complete"
            />
          ) : (
            <p className="learn-quiz-right">
              <Check size={14} /> Module complete, progress saved to your account.
              <button
                type="button"
                className="learn-continue learn-module-next"
                onClick={() => onCredentials?.()}
              >
                See your credentials <ArrowRight size={15} />
              </button>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
