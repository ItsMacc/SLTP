// Tier2Sections.tsx — Tier II modules B and C: the real cost of trading.
//
// Module B (spreads): every stock has TWO prices at once; the gap between
//   them is the invisible commission. Interactive: pick a liquidity profile,
//   watch the spread and the true cost of crossing it.
// Module C (order book): a market order eats through a ladder of resting
//   orders. Interactive: choose order size, watch which price levels get
//   consumed and how far the average fill slips from the quoted price.
//
// Both modules feed the same milestone (Liquidity Analysis Badge) and use
// the shared Objective / QuickCheck / Recap frame from parts.tsx.

import { useState } from 'react';
import { Layers, Waves } from 'lucide-react';
import { GlossaryText } from '../../components/GlossaryText';
import { LEARN_GLOSSARY } from '../../learn/learnGlossary';
import { Narrator, Objective, Recap } from './parts';

const G = LEARN_GLOSSARY;

/* ============================================================
   Module B, Bid-ask spreads & liquidity
   ============================================================ */

interface Profile {
  id: string;
  label: string;
  bid: number;
  ask: number;
  volume: string;
  note: string;
}

// Three real-world shapes of stock: plenty of traffic, moderate, nearly dead.
const PROFILES: Profile[] = [
  {
    id: 'liquid',
    label: 'Big, busy stock',
    bid: 199.98,
    ask: 200.02,
    volume: '~50M shares/day',
    note: 'Thousands of buyers and sellers are present at every moment, so owners can sell instantly without moving the price.',
  },
  {
    id: 'normal',
    label: 'Average stock',
    bid: 52.10,
    ask: 52.34,
    volume: '~4M shares/day',
    note: 'A healthy, normally traded stock. The gap exists but is small enough to ignore on a long-term hold.',
  },
  {
    id: 'thin',
    label: 'Thinly traded stock',
    bid: 8.40,
    ask: 8.72,
    volume: '~80k shares/day',
    note: 'Few participants. The wide gap means you pay a real toll every time you cross from buyer to seller.',
  },
];

export function SpreadsSection() {
  const [idx, setIdx] = useState(1);
  const p = PROFILES[idx];
  const spread = +(p.ask - p.bid).toFixed(2);
  const spreadPct = ((spread / p.ask) * 100).toFixed(2);
  // What crossing the spread costs on one round trip (buy + sell) for 10 shares.
  const roundTrip = +(spread * 10 * 2).toFixed(2);

  return (
    <div>
      <Objective>
        By the end you will be able to read the two prices a stock quotes at once,
        measure the spread, and tell cheap-to-trade stocks from expensive ones
        before you place an order.
      </Objective>

      <p>
        Module A showed both sides of a trade. This module is about what the trip
        itself costs. Brokers advertise zero commission, which is true but
        incomplete. There is a second cost, built into the price itself, that
        nobody itemises.
      </p>
      <p>
        Every stock carries <strong>two</strong> prices at any moment, not one:
      </p>
      <div className="learn-rules">
        <div className="learn-rule">
          <span className="learn-rule-num">Bid</span>
          <p>The <strong>bid</strong> is the highest price some buyer is willing to pay right now. Sell to a buyer and this is what you receive.</p>
        </div>
        <div className="learn-rule">
          <span className="learn-rule-num">Ask</span>
          <p>The <strong>ask</strong> (or offer) is the lowest price some seller is willing to accept. Buy from a seller and this is what you pay.</p>
        </div>
        <div className="learn-rule">
          <span className="learn-rule-num">Spread</span>
          <p>The gap between them (ask minus bid) is the <GlossaryText text="bid-ask spread" glossary={G} />: an invisible toll you pay simply for crossing to the other side.</p>
        </div>
      </div>

      <Narrator icon={Layers}>
        Think of a currency exchange at an airport. It buys your dollars at one
        rate and sells them back at a slightly worse rate. The difference is the
        shop’s profit, and you never see it itemised. Stocks work the same way: the
        market maker pocketing the spread is how quotes stay available all day.
      </Narrator>

      {/* ---------- Interactive: pick a liquidity profile ---------- */}
      <div className="learn-fin">
        <p className="learn-fin-title">The spread, side by side</p>
        <p className="learn-fin-hint">
          Pick a stock and watch the two prices. The wider the gap, the more the
          market charges you for an instant trade.
        </p>
        <div className="learn-ordertypes">
          {PROFILES.map((prof, i) => (
            <button
              key={prof.id}
              type="button"
              className={`learn-ordertype ${i === idx ? 'is-active' : ''}`}
              onClick={() => setIdx(i)}
            >
              {prof.label}
            </button>
          ))}
        </div>

        {/* Ladder visualisation: bid | spread | ask */}
        <div className="learn-spreadviz" role="img"
          aria-label={`${p.label}: bid ${p.bid}, ask ${p.ask}, spread ${spread} dollars`}>
          <div className="learn-spread-side is-bid">
            <span className="learn-spread-tag">You can sell at</span>
            <span className="learn-spread-price">${p.bid.toFixed(2)}</span>
            <span className="learn-spread-role">the bid</span>
          </div>
          <div className="learn-spread-gap" style={{ flex: Math.max(spread, 0.04) }}>
            <span className="learn-spread-amount">${spread.toFixed(2)}</span>
            <span className="learn-spread-caption">spread · {spreadPct}%</span>
          </div>
          <div className="learn-spread-side is-ask">
            <span className="learn-spread-tag">You must pay</span>
            <span className="learn-spread-price">${p.ask.toFixed(2)}</span>
            <span className="learn-spread-role">the ask</span>
          </div>
        </div>

        <div className="learn-factrow">
          <div className="learn-fact">
            <span className="learn-fact-label">Spread</span>
            <span className="learn-fact-value">${spread.toFixed(2)}</span>
          </div>
          <div className="learn-fact">
            <span className="learn-fact-label">As % of price</span>
            <span className="learn-fact-value">{spreadPct}%</span>
          </div>
          <div className="learn-fact">
            <span className="learn-fact-label">Round trip, 10 shares</span>
            <span className="learn-fact-value learn-negative">-${roundTrip.toFixed(2)}</span>
          </div>
          <div className="learn-fact">
            <span className="learn-fact-label">Typical volume</span>
            <span className="learn-fact-value">{p.volume}</span>
          </div>
        </div>

        <p className="learn-caption learn-caption-strong">{p.note}</p>
      </div>

      <p>
        This is what <GlossaryText text="liquidity" glossary={G} /> really means:
        how many counterparties are waiting on the other side of every trade. A
        liquid stock has a narrow spread because buyers and sellers crowd the
        same price. An illiquid one demands a toll, because the only seller
        available gets to set the price.
      </p>
      <p>
        The lesson for a long-term investor is mild. A few cents rarely matter
        if you hold for years. The lesson for anyone trading frequently is
        severe: a 30-cent spread crossed on every entry and exit eats into
        returns that a backtest may never have charged for. Later tiers show
        that costs are the first thing an honest <GlossaryText text="backtest" glossary={G} /> includes.
      </p>


      <Recap points={[
        <>Every stock quotes two prices: the <strong>bid</strong> (buyers) and the <strong>ask</strong> (sellers).</>,
        <>The <GlossaryText text="bid-ask spread" glossary={G} /> is the built-in cost of trading instantly. It is invisible, but real.</>,
        <><GlossaryText text="liquidity" glossary={G} /> is how crowded the other side of the trade is; crowded means narrow spreads.</>,
        <>Frequent trading multiplies spread costs; long-term holding barely feels them.</>,
      ]} />
    </div>
  );
}

/* ============================================================
   Module C, Order books & slippage
   ============================================================ */

interface Level {
  price: number;
  shares: number;
}

// A resting order book: asks ascend (sellers cheapest first), bids descend.
const ASKS: Level[] = [
  { price: 8.72, shares: 120 },
  { price: 8.75, shares: 300 },
  { price: 8.80, shares: 650 },
  { price: 8.88, shares: 900 },
  { price: 9.00, shares: 1500 },
];
const BIDS: Level[] = [
  { price: 8.40, shares: 200 },
  { price: 8.36, shares: 480 },
  { price: 8.30, shares: 800 },
  { price: 8.22, shares: 1100 },
  { price: 8.15, shares: 2000 },
];

const SIZES = [
  { shares: 50, label: '50 shares' },
  { shares: 150, label: '150 shares' },
  { shares: 400, label: '400 shares' },
  { shares: 1100, label: '1,100 shares' },
  { shares: 2200, label: '2,200 shares' },
];

/** Walks the asks and returns fills per level + volume-weighted average price. */
function walkAsks(size: number) {
  let remaining = size;
  const fills: number[] = [];
  let cost = 0;
  let filled = 0;
  for (const lvl of ASKS) {
    const take = Math.min(remaining, lvl.shares);
    fills.push(take);
    cost += take * lvl.price;
    filled += take;
    remaining -= take;
    if (remaining <= 0) break;
  }
  // Unfilled remainder assumed at the worst (last) level - the price that
  // finally clears the book - which is exactly the point of the lesson.
  if (remaining > 0) {
    const last = ASKS[ASKS.length - 1];
    fills[fills.length - 1] += remaining;
    cost += remaining * last.price;
    filled += remaining;
  }
  return { fills, vwap: cost / filled, filled };
}

export function OrderBookSection() {
  const [sizeIdx, setSizeIdx] = useState(1);
  const size = SIZES[sizeIdx].shares;
  const { fills, vwap } = walkAsks(size);
  const bestAsk = ASKS[0].price;
  const slippage = vwap - bestAsk;
  const slippagePct = (slippage / bestAsk) * 100;
  const totalCost = vwap * size;

  return (
    <div>
      <Objective>
        By the end you will be able to read an order book, predict how a large
        order walks through it, and explain <GlossaryText text="slippage" glossary={G} /> in
        your own words.
      </Objective>

      <p>
        The spread you just met has a home: the <GlossaryText text="order book" glossary={G} />.
        It is the live, public list of every resting order waiting to be filled:
        all the bids stacked on one side, all the asks stacked on the other,
        each level showing a price and how many shares wait there.
      </p>
      <p>
        One detail is easy to miss: the quoted ask is only the{' '}
        <em>first</em> slice. Someone offering 100 shares at $8.72 will happily
        sell you 100 and no more. Want 500? The market must keep climbing its
        ladder to find the rest, and every extra rung costs more.
      </p>

      {/* ---------- Interactive: walk the book ---------- */}
      <div className="learn-fin">
        <p className="learn-fin-title">Your market order, eating the ladder</p>
        <p className="learn-fin-hint">
          Choose how many shares you want to buy. Watch the asks light up as your
          order consumes each price level.
        </p>
        <div className="learn-ordertypes">
          {SIZES.map((s, i) => (
            <button
              key={s.shares}
              type="button"
              className={`learn-ordertype ${i === sizeIdx ? 'is-active' : ''}`}
              onClick={() => setSizeIdx(i)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="learn-book">
          <div className="learn-book-col">
            <p className="learn-book-head">Asks, sellers asking</p>
            {ASKS.map((lvl, i) => {
              const consumed = i < fills.length ? fills[i] : 0;
              const pct = Math.round((lvl.shares / ASKS[ASKS.length - 1].shares) * 100);
              return (
                <div key={lvl.price} className={`learn-book-level is-ask ${consumed > 0 ? 'is-consumed' : ''}`}>
                  <span
                    className="learn-book-fill is-ask"
                    style={{ width: `${consumed > 0 ? (consumed / lvl.shares) * 100 : 0}%` }}
                  />
                  <span className="learn-book-price">${lvl.price.toFixed(2)}</span>
                  <span className="learn-book-shares">
                    {consumed > 0
                      ? `${consumed.toLocaleString()} of ${lvl.shares.toLocaleString()} taken`
                      : `${lvl.shares.toLocaleString()} available`}
                  </span>
                  <span className="learn-book-bar" style={{ width: `${Math.max(pct, 8)}px` }} aria-hidden />
                </div>
              );
            })}
          </div>

          <div className="learn-book-col">
            <p className="learn-book-head">Bids, buyers bidding</p>
            {BIDS.map((lvl) => {
              const pct = Math.round((lvl.shares / BIDS[BIDS.length - 1].shares) * 100);
              return (
                <div key={lvl.price} className="learn-book-level is-bid">
                  <span
                    className="learn-book-fill is-bid"
                    style={{ width: '0%' }}
                  />
                  <span className="learn-book-price">${lvl.price.toFixed(2)}</span>
                  <span className="learn-book-shares">{lvl.shares.toLocaleString()} waiting</span>
                  <span className="learn-book-bar" style={{ width: `${Math.max(pct, 8)}px` }} aria-hidden />
                </div>
              );
            })}
          </div>
        </div>

        <div className="learn-factrow">
          <div className="learn-fact">
            <span className="learn-fact-label">Best quoted ask</span>
            <span className="learn-fact-value">${bestAsk.toFixed(2)}</span>
          </div>
          <div className="learn-fact">
            <span className="learn-fact-label">Your average fill</span>
            <span className="learn-fact-value">${vwap.toFixed(2)}</span>
          </div>
          <div className="learn-fact">
            <span className="learn-fact-label">Slippage per share</span>
            <span className="learn-fact-value learn-negative">
              {slippage > 0.0001 ? `+${slippage.toFixed(3)}` : '$0.000'}
            </span>
          </div>
          <div className="learn-fact">
            <span className="learn-fact-label">Total cost</span>
            <span className="learn-fact-value learn-negative">${totalCost.toFixed(0)}</span>
          </div>
        </div>

        <p className="learn-caption learn-caption-strong">
          {slippage < 0.0001
            ? 'Your order fit inside the very first price level, so you paid exactly the quoted ask. Small orders ride the top of the book.'
            : `Your order walked ${fills.filter((f) => f > 0).length} price levels. The average fill landed ${slippage.toFixed(3)} above the quoted ask, which is ${slippagePct.toFixed(2)}% of the price. That gap is slippage: the difference between the price you expected and the price you actually got.`}
        </p>
      </div>

      <Narrator icon={Waves}>
        Depth matters as much as direction. A book stacked deep with sellers is
        hard to push around; a hollow book lets one impatient order jump the
        price several cents in a single trade. The same order, in the same
        direction, on two different days can cost meaningfully different amounts.
      </Narrator>

      <p>
        This is the mechanical root of <GlossaryText text="slippage" glossary={G} />, the term
        every performance table carries. A strategy that trades often in
        thin names accumulates slippage on every fill, and a backtest that
        assumes it always gets the quoted price is overstating results before the
        first real trade settles.
      </p>


      <Recap points={[
        <>The <GlossaryText text="order book" glossary={G} /> lists every resting bid and ask with its size, the market’s real depth.</>,
        <>The quoted price is only the first level; larger orders consume deeper levels and push the average fill higher.</>,
        <><GlossaryText text="slippage" glossary={G} /> is the gap between the price you expected and the price you actually got.</>,
        <>Depth is <GlossaryText text="liquidity" glossary={G} /> in numbers: a deep book absorbs size without moving.</>,
      ]} />
    </div>
  );
}
