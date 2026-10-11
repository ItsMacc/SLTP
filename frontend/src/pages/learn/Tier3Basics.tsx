// Tier3Basics.tsx - Tier III modules A and B: the groundwork before rules.
//
// Module A (trading vs. investing): two different ways to profit from shares,
//   judged on different time horizons. Sets expectations for what this
//   course builds toward: rule-based trading.
// Module B (indexes & benchmarks): what an index is, why every strategy is
//   measured against one, and what buy and hold really means.
//
// Both are concept modules: clear definitions first, the honest tradeoffs
// second, no jargon left unexplained.

import { Compass, LineChart } from 'lucide-react';
import { GlossaryText } from '../../components/GlossaryText';
import { LEARN_GLOSSARY } from '../../learn/learnGlossary';
import { Narrator, Objective, Recap } from './parts';

const G = LEARN_GLOSSARY;

/* ============================================================
   Module A, Trading vs. investing
   ============================================================ */

export function TradingVsInvestingSection() {
  return (
    <div>
      <Objective>
        By the end of this module you will be able to explain the difference
        between trading and investing, describe what each one studies and how
        long each one holds, and say which side this course builds toward.
      </Objective>

      <p>
        There are two ways to make money from shares, and almost every newcomer
        meets them mixed together. They are not rivals, and neither is
        guaranteed. They simply answer the same question on different time
        scales: <strong>what do you buy, and for how long?</strong>
      </p>

      <div className="learn-school">
        <p className="learn-school-name">Investing: own a piece of a business, for years</p>
        <p>
          An <strong>investor</strong> buys a share because they believe the
          business behind it will be worth more in a few years than it is today.
          The share price matters on the day they sell, not on any day before
          that. What they study is the company itself: what it sells, how much
          profit it keeps, how much it owes, and whether those numbers are
          improving. This is{' '}
          <GlossaryText text="financial analysis" glossary={G} />, and the holding
          period is measured in years.
        </p>
      </div>

      <div className="learn-school">
        <p className="learn-school-name">Trading: follow the price, for days or weeks</p>
        <p>
          A <strong>trader</strong> cares less about what the company sells and
          more about what its price is doing. Prices move in trends and patterns,
          and a trader tries to follow those movements: buy when the evidence
          points up, sell when it turns. What they study is price action itself.
          This is{' '}
          <GlossaryText text="technical analysis" glossary={G} />, and the holding
          period is measured in days, weeks or months.
        </p>
      </div>

      <p>
        The two styles are best compared on four questions, the same four you
        would ask before committing real money:
      </p>

      <div className="learn-rules">
        <div className="learn-rule">
          <span className="learn-rule-num">1</span>
          <p>
            <strong>How long do you expect to hold?</strong> Years points to
            investing. Days to months points to trading. The horizon decides
            almost everything else.
          </p>
        </div>
        <div className="learn-rule">
          <span className="learn-rule-num">2</span>
          <p>
            <strong>What do you study before buying?</strong> Investors read the
            business. Traders read the chart. Both are evidence; they are simply
            evidence about different things.
          </p>
        </div>
        <div className="learn-rule">
          <span className="learn-rule-num">3</span>
          <p>
            <strong>How much do costs matter?</strong> A spread of a few cents is
            rounding error over five years, but it is charged on every one of a
            trader&apos;s many round trips. Trading multiplies costs; investing
            divides them.
          </p>
        </div>
        <div className="learn-rule">
          <span className="learn-rule-num">4</span>
          <p>
            <strong>What can go wrong?</strong> The investor&apos;s risk is being
            wrong about the business for a long time. The trader&apos;s risk is
            being whipsawed by noise: buying a move that immediately reverses.
            Neither risk can be removed, only managed.
          </p>
        </div>
      </div>

      <Narrator icon={Compass}>
        One habit belongs to both styles: <strong>write the rules down before you
        start</strong>. Deciding in advance what you will buy, how much, and when
        you will get out is what separates a plan from a hunch. The rest of this
        course is about building that plan, and the strategies on SLTP are
        trading strategies: written rules applied to price data, holding
        positions for weeks to months.
      </Narrator>

      <p>
        A fair word for both sides. Most investors who do well are simply
        patient: they buy sensibly and then do nothing for a long time. Most
        traders who do well are simply disciplined: they follow their rules even
        when it is uncomfortable. In both cases the skill is behaviour, not
        prediction.
      </p>

      <Recap points={[
        <>Investing buys part of a business for years and studies the business.</>,
        <>Trading follows price movements for days to months and studies the chart.</>,
        <>Trading pays costs far more often, so spreads and slippage matter much more.</>,
        <>Both need written rules in advance. This course builds toward trading rules.</>,
      ]} />
    </div>
  );
}

/* ============================================================
   Module B, Indexes & benchmarks
   ============================================================ */

export function IndexSection() {
  return (
    <div>
      <Objective>
        By the end of this module you will be able to explain what a market
        index is, describe what buy and hold means, and say why every strategy
        is measured against a benchmark.
      </Objective>

      <p>
        One question will follow you through every strategy you ever evaluate:{' '}
        <strong>compared to what?</strong> A strategy that turns $100 into $130
        sounds good, until you learn that simply leaving the same $100 alone
        would have turned it into $150. To answer the question you need a
        baseline, and the standard baseline is a{' '}
        <GlossaryText text="market index" glossary={G} />.
      </p>

      <div className="learn-rules">
        <div className="learn-rule">
          <span className="learn-rule-num">1</span>
          <p>
            <strong>An index is a representative list of stocks.</strong> Instead
            of tracking one company, an index groups many of the largest or most
            important ones and combines their prices into a single number. If
            that number rises, the market as a whole rose. The S&amp;P 500, which
            follows about 500 large US companies, is the best known example.
          </p>
        </div>
        <div className="learn-rule">
          <span className="learn-rule-num">2</span>
          <p>
            <strong>Buy and hold is the simplest strategy there is.</strong> Buy
            a broad slice of the market, then hold it through every up and down,
            adding nothing clever. It requires no predictions and almost no
            maintenance. That is exactly why it is the benchmark everything else
            must face.
          </p>
        </div>
        <div className="learn-rule">
          <span className="learn-rule-num">3</span>
          <p>
            <strong>A benchmark is the score to beat.</strong> Any strategy is
            judged not by its return alone but by its return against the
            baseline. Risk matters too: a strategy that grows a little less but
            falls much less along the way may still be the better ride.
          </p>
        </div>
      </div>

      <Narrator icon={LineChart}>
        This is why every backtest in this course, and on the Strategies page,
        shows two curves instead of one: the strategy, and buy and hold over the
        exact same period starting with the exact same money. Without the second
        curve, the first one means very little.
      </Narrator>

      <p>
        Two honest notes about indexes. First, holding an index means holding
        every company in it, including the ones that do badly. That is not a
        flaw; it is the price of never having to guess which ones those will be.
        Second, an index falls too. Buy and hold is not a guarantee of smooth
        growth, it is a promise to sit through rough years rather than exit at
        the bottom of one.
      </p>

      <p>
        For most people, most of the time, buy and hold on a broad index is the
        correct answer. Any strategy you build later is trying to beat that
        answer while taking less punishment along the way. Keeping the baseline
        honest is what makes the comparison meaningful.
      </p>

      <Recap points={[
        <>An index combines many representative stocks into one number that tracks the market.</>,
        <>Buy and hold is buying a broad slice of the market and holding it. Simple, which is why it is the benchmark.</>,
        <>Every strategy is judged against the baseline: return compared, and the ride compared too.</>,
        <>An index can fall. Holding it means sitting through bad years, not avoiding them.</>,
      ]} />
    </div>
  );
}
