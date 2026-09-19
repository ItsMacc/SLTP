// StrategyGuide.tsx — Long-form strategy guide chapters

import './StrategyGuide.css'

export default function StrategyGuide() {
  return (
    <section className="stg-guide">
      <h2 className="stg-title">Beginner Guide: Understanding Strategies</h2>
      <p className="stg-deck">
        Every performance metric in the dashboard is detailed below in clear language,
        complete with practical examples and industry benchmarks. Read sequentially to
        build a comprehensive framework for evaluating systematic strategies.
      </p>

      <div className="stg-flow">
        <article className="stg-chapter" data-num="01">
          <h3 className="stg-chapter-title">The core concept</h3>
          <p className="stg-copy">
            A strategy is an automated, rule-based framework for market participation.
            Rather than relying on intuition or emotional reactions during periods of volatility,
            a strategy operates on explicit rules that dictate <strong>what to buy, what to sell,
            and precisely when to execute</strong>.
          </p>
          <p className="stg-copy">
            The primary advantage of a systematic strategy is discipline. Human decision-making
            is frequently compromised by fear during downturns or exuberance during rallies. A
            rule-based system removes discretionary bias, applying identical criteria across
            every market cycle.
          </p>
        </article>

        <article className="stg-chapter" data-num="02">
          <h3 className="stg-chapter-title">Defining the trading universe</h3>
          <p className="stg-copy">
            Before execution rules can trigger, the strategy requires a predefined pool of assets.
            This selection is called the <strong>universe</strong>. A universe defines the specific
            set of equities, ETFs, or instruments the strategy is permitted to trade. If an asset
            falls outside this list, the system ignores it regardless of short-term momentum.
          </p>
          <p className="stg-copy">
            Universes range from focused groups, such as mega-cap technology equities, to broad
            market indices. Because performance depends directly on asset selection and liquidity,
            backtest metrics should always be evaluated against the specific universe tested.
          </p>
        </article>

        <div className="stg-chapter" data-num="03">
          <h3 className="stg-chapter-title">Investment horizons: Investing vs. Trading</h3>
          <p className="stg-copy">
            Strategies generally fall into two distinct execution models. Understanding which
            framework a strategy uses informs how you evaluate risk, return, and transaction costs.
          </p>
          <div className="stg-duo">
            <div className="stg-duo-card is-invest">
              <p className="stg-duo-tag">Long-Term Horizon</p>
              <h4 className="stg-duo-title">Investing</h4>
              <p className="stg-duo-copy">
                Operating on multi-year horizons, investing focuses on capital growth driven by
                business fundamentals. Short-term price volatility is treated as noise rather than a
                signal. Lower turnover minimizes transaction costs and tax drag, prioritizing
                systematic capital compounding over market timing.
              </p>
            </div>
            <div className="stg-duo-card is-trade">
              <p className="stg-duo-tag">Short-Term Execution</p>
              <h4 className="stg-duo-title">Trading</h4>
              <p className="stg-duo-copy">
                Operating across days, hours, or minutes, trading seeks to profit directly from
                short-term price movements. This model demands active oversight and strict
                risk parameters. Higher trade frequency means execution costs and slippage exert a
                significantly greater impact on net performance.
              </p>
            </div>
          </div>
          <p className="stg-copy">
            Neither approach is inherently superior; they address different capital objectives.
            Investing evaluates long-term value creation, while trading seeks to capture transitory
            price inefficiencies.
          </p>
        </div>

        <article className="stg-chapter" data-num="04">
          <h3 className="stg-chapter-title">Simulating history: The backtest</h3>
          <p className="stg-copy">
            A backtest evaluates how a strategy would have performed historically. The algorithm runs
            chronologically through past market data, applying its rules strictly on information available
            at each specific point in time to prevent forward-looking bias. Every trade, fee, and
            execution price is recorded.
          </p>
          <p className="stg-copy">
            The resulting performance curve illustrates how the account balance evolved over time.
            Although historical performance does not guarantee future results, backtesting provides an
            objective measure of a strategy's baseline behavior and risk parameters.
          </p>
          <p className="stg-copy">
            Strategies that demonstrate consistent performance across diverse market environments offer
            greater reliability than those optimized for a single favorable market phase.
          </p>
        </article>

        <article className="stg-chapter" data-num="05">
          <h3 className="stg-chapter-title">Standardizing account metrics: Base 100</h3>
          <p className="stg-copy">
            Most financial platforms plot performance using raw dollar balances (e.g., watching a $10,000 portfolio move to $12,500). While this reflects true cash value, comparing two strategies initialized with different starting amounts can obscure their actual efficiency.
          </p>
          <p className="stg-copy">
            To eliminate capital size bias, backtests normalize initial portfolio equity to an index value of <strong>100</strong> (representing 100% of initial balance). Indexing converts absolute dollars into proportional growth: an ending index of 110 indicates a 10% gain, while an ending value of 92 represents an 8% loss.
          </p>
          <div className="stg-example">
            Indexed evaluation:
            - A $2,000 account ending at an index value of 110 yields $2,200 (+10%).
            - A $500,000 account ending at an index value of 110 yields $550,000 (+10%).
            Indexing isolates pure strategic return from account size.
          </div>
          <div className="stg-sign">
            <p>
              <strong>An ending value above 100 indicates net profitability.</strong> Values below
              100 reflect a net loss, while exactly 100 represents break-even performance.
            </p>
          </div>
        </article>

        <article className="stg-chapter" data-num="06">
          <h3 className="stg-chapter-title">Measuring annual growth: CAGR</h3>
          <p className="stg-copy">
            Simple return calculations can distort actual growth over multi-year periods. If a $100 allocation
            grows to $110 in Year 1 and reaches $130 by Year 2, the total return is 30%. However, because Year 2
            grew from a $110 base, the annualized rate of return must account for compounding.
          </p>
          <p className="stg-copy">
            The <strong>Compound Annual Growth Rate (CAGR)</strong> normalizes performance into a constant
            annual growth rate. It provides the standard metric for comparing returns across different assets
            and time horizons.
          </p>
          <div className="stg-example">
            Initial Capital: 100 | Year 1: 110 | Year 2: 130
            Total Return: 30.0%
            CAGR: ~14.0% annualized (100 × 1.14 × 1.14 ≈ 130)
          </div>
          <p className="stg-copy">
            Below is a sample illustration of continuous compounding at a 10% CAGR over a 10-year horizon:
          </p>
          <div className="stg-example">
            Year 1:  110.0 | Year 6:  177.2
            Year 2:  121.0 | Year 7:  194.9
            Year 3:  133.1 | Year 8:  214.4
            Year 4:  146.4 | Year 9:  235.8
            Year 5:  161.1 | Year 10: 259.4
            Total 10-Year Growth: +159.4%
          </div>
          <p className="stg-copy">
            Over a 20-year horizon at 10% CAGR, the initial 100 expands to approximately 672.7. The non-linear
            acceleration in later years highlights the impact of long-term compounding.
          </p>
          <div className="stg-sign">
            <p>
              <strong>A CAGR above 10% over a multi-year backtest reflects strong compound growth potential.</strong> Short-term
              CAGR readings (under one year) should be interpreted cautiously as they may be skewed by brief market trends.
            </p>
          </div>
        </article>

        <article className="stg-chapter" data-num="07">
          <h3 className="stg-chapter-title">Evaluating risk-adjusted return: Sharpe Ratio</h3>
          <p className="stg-copy">
            Two strategies may achieve identical 15% annual returns while experiencing drastically different trajectory
            smoothness. One may ascend steadily, while the other endures sharp drawdown periods. The <strong>Sharpe ratio</strong> measures
            excess return relative to overall portfolio volatility.
          </p>
          <p className="stg-copy">
            In risk metrics, volatility represents uncertainty. A high Sharpe ratio indicates strong returns relative
            to the fluctuations experienced, while a low ratio indicates excessive volatility for the return generated.
          </p>
          <p className="stg-copy">
            In simplified backtest environments without risk-free rate adjustments, a Sharpe ratio of 1.0 serves as a standard baseline
            for acceptable risk-adjusted performance.
          </p>
          <div className="stg-sign">
            <p>
              <strong>A Sharpe ratio above 1.0 indicates viable risk-adjusted performance.</strong> Ratios between 1.0 and 2.0
              are solid, 2.0 to 3.0 are strong, and above 3.0 represents outstanding equity curve efficiency.
            </p>
          </div>
        </article>

        <article className="stg-chapter" data-num="08">
          <h3 className="stg-chapter-title">Statistical confidence: PSR</h3>
          <p className="stg-copy">
            A backtest reflects a single historical path. The <strong>Probabilistic Sharpe Ratio (PSR)</strong> addresses
            whether a strategy's observed performance reflects a true statistical edge or simply favorable historical timing.
          </p>
          <p className="stg-copy">
            Expressed as a percentage, PSR estimates the probability that the strategy’s true operational Sharpe ratio exceeds
            the threshold benchmark of 1.0. It incorporates backtest duration and non-normal return distributions (skewness and kurtosis).
          </p>
          <div className="stg-example">
            50% PSR: High uncertainty; performance is statistically indistinguishable from random noise.
            70% PSR: Moderate confidence in strategy persistence.
            90% PSR: High statistical confidence that the edge will persist out-of-sample.
          </div>
          <div className="stg-sign">
            <p>
              <strong>A PSR above 50% indicates positive statistical confidence.</strong> Higher values confirm that observed performance
              is driven by strategy mechanics rather than backtest duration artifacts.
            </p>
          </div>
        </article>

        <article className="stg-chapter" data-num="09">
          <h3 className="stg-chapter-title">Focusing on downside risk: Sortino Ratio</h3>
          <p className="stg-copy">
            The <strong>Sortino ratio</strong> isolates downside volatility from overall volatility. While the Sharpe ratio penalizes
            both upward and downward price swings equally, the Sortino ratio only penalizes negative variance.
          </p>
          <p className="stg-copy">
            This distinction is valuable for growth strategies that experience frequent upward jumps. A high Sortino ratio paired with
            a moderate Sharpe ratio indicates that total volatility is heavily driven by upside moves rather than painful portfolio drops.
          </p>
          <div className="stg-sign">
            <p>
              <strong>A Sortino ratio above 1.0 confirms sufficient return relative to downside risk.</strong> Values above 2.0
              indicate excellent downside protection during portfolio contractions.
            </p>
          </div>
        </article>

        <article className="stg-chapter" data-num="10">
          <h3 className="stg-chapter-title">Trade metrics: Win rate and Expectancy</h3>
          <p className="stg-copy">
            Evaluating execution metrics requires analyzing individual trade outputs:
          </p>
          <ul className="stg-list">
            <li><strong>Win rate:</strong> The percentage of closed positions that yielded positive net returns.</li>
            <li><strong>Loss rate:</strong> The percentage of closed positions that resulted in net losses.</li>
            <li><strong>Average win:</strong> The mean return percentage across all profitable trades.</li>
            <li><strong>Average loss:</strong> The mean loss percentage across all unprofitable trades.</li>
            <li>
              <strong>Expectancy:</strong> The expected net return per trade over a statistically significant series.
            </li>
          </ul>
          <p className="stg-copy">
            A positive expectancy confirms an operational trading edge. Win rate alone can be misleading; a system with a 90% win rate
            can still lose capital if its average loss significantly exceeds its average win.
          </p>
          <div className="stg-sign">
            <p>
              <strong>An expectancy greater than 0 confirms profitability over repeated executions.</strong> Always assess win rate
              in conjunction with average gain and loss magnitude.
            </p>
          </div>
        </article>

        <article className="stg-chapter" data-num="11">
          <h3 className="stg-chapter-title">Measuring peak-to-trough decline: Max Drawdown</h3>
          <p className="stg-copy">
            Portfolio equity rarely grows linearly. <strong>Max drawdown</strong> measures the single largest percentage decline from a peak
            equity high-water mark to a subsequent trough before a new peak is achieved.
          </p>
          <div className="stg-example">
            Peak Portfolio Value: 100
            Trough Value: 90
            Max Drawdown: 10.0% peak-to-trough contraction.
          </div>
          <p className="stg-copy">
            Drawdown thresholds serve as standard risk indicators: declines under 10% represent low variance, 10% to 20% represent moderate equity swings,
            and contractions above 20% indicate high exposure to capital impairment.
          </p>
          <div className="stg-sign">
            <p>
              <strong>Max drawdown defines peak equity risk.</strong> Select strategies whose historical drawdown profiles align with your institutional or personal risk tolerance.
            </p>
          </div>
        </article>

        <article className="stg-chapter" data-num="12">
          <h3 className="stg-chapter-title">Duration of decline: Drawdown Recovery</h3>
          <p className="stg-copy">
            In addition to drawdown magnitude, duration is critical. <strong>Drawdown recovery</strong> tracks the number of trading days required for
            portfolio equity to recover from a peak-to-trough drop and reclaim a new high-water mark.
          </p>
          <div className="stg-example">
            Equity drop from 100 to 90 requires 20 trading days to reach 101.
            Recovery Duration: 20 days.
          </div>
          <div className="stg-sign">
            <p>
              <strong>Short recovery periods indicate resilient capital restoration.</strong> Extended recovery durations stretching across months highlight prolonged periods of equity stagnation.
            </p>
          </div>
        </article>

        <article className="stg-chapter" data-num="13">
          <h3 className="stg-chapter-title">Trade execution parameters</h3>
          <p className="stg-copy">
            Detailed trade logs track positions across four fundamental pricing levels:
          </p>
          <ul className="stg-list">
            <li>
              <strong>Entry price:</strong> The execution price at position initiation.
            </li>
            <li>
              <strong>Exit price:</strong> The execution price when closing the position.
            </li>
            <li>
              <strong>Stop loss:</strong> An automated risk ceiling set below entry that triggers an exit to mitigate downside capital loss.
            </li>
            <li>
              <strong>Take profit:</strong> A target price level set above entry that automatically locks in target gains.
            </li>
          </ul>
          <p className="stg-copy">
            Pre-defining stop-loss and take-profit thresholds ensures objective execution, eliminating discretionary errors during live market movement.
          </p>
          <p className="stg-copy">
            The trade table also includes <strong>allocated size</strong>, indicating the fraction of total account equity committed to an individual trade.
          </p>
        </article>

        <article className="stg-chapter" data-num="14">
          <h3 className="stg-chapter-title">Benchmark comparison: Buy and Hold</h3>
          <p className="stg-copy">
            Active strategies must demonstrate value relative to a passive baseline. A <strong>buy and hold</strong> benchmark allocates capital fully on day one
            and maintains position exposure through the entire backtest period without tactical adjustment.
          </p>
          <p className="stg-copy">
            Because passive holding incurs minimal turnover costs, beating a buy-and-hold benchmark after accounting for execution fees is the primary validation requirement for active quantitative strategies.
          </p>
          <div className="stg-sign">
            <p>
              <strong>If active strategy return exceeds the passive benchmark return, the tactical complexity is justified.</strong> Lower relative returns indicate that passive index tracking would have provided superior net efficiency.
            </p>
          </div>
        </article>

        <article className="stg-chapter" data-num="15">
          <h3 className="stg-chapter-title">Capital allocation: Unrealized Cash</h3>
          <p className="stg-copy">
            The dashboard reports <strong>unrealized cash</strong> (the unallocated portion of total account capital not deployed in active positions).
            Cash reserves vary as the strategy filters for valid trade entries.
          </p>
          <p className="stg-copy">
            Persistently high cash allocations indicate strict entry parameters, which may reduce capital efficiency during broad market rallies.
          </p>
        </article>
      </div>

      <div className="stg-section-gap">
        <span className="stg-kicker">Performance Standards</span>
        <h3 className="stg-title">Target Threshold Summary</h3>
        <p className="stg-deck">
          Reference key strategy metrics against standard industry evaluation targets.
        </p>
        <div className="stg-scorecard-wrap">
          <table className="stg-scorecard">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Analytical Focus</th>
                <th>Target Range</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Ending value</td>
                <td>Total strategy return output</td>
                <td>Above 100</td>
              </tr>
              <tr>
                <td>CAGR</td>
                <td>Annualized compound growth rate</td>
                <td>Above 10% (multi-year)</td>
              </tr>
              <tr>
                <td>Sharpe</td>
                <td>Total volatility risk-adjusted return</td>
                <td>&gt; 1.0 (Optimal &gt; 2.0)</td>
              </tr>
              <tr>
                <td>Sortino</td>
                <td>Downside volatility risk-adjusted return</td>
                <td>&gt; 1.0 (Optimal &gt; 2.0)</td>
              </tr>
              <tr>
                <td>PSR</td>
                <td>Statistical persistence probability</td>
                <td>&gt; 50% (Optimal &gt; 70%)</td>
              </tr>
              <tr>
                <td>Expectancy</td>
                <td>Expected profit yield per trade</td>
                <td>Above 0.0</td>
              </tr>
              <tr>
                <td>Win rate / loss rate</td>
                <td>Trade execution profitability distribution</td>
                <td>Evaluated alongside average win/loss</td>
              </tr>
              <tr>
                <td>Max drawdown</td>
                <td>Peak-to-trough capital decline</td>
                <td>&lt; 10% Low, &gt; 20% High</td>
              </tr>
              <tr>
                <td>Drawdown recovery</td>
                <td>Time required to reclaim high-water mark</td>
                <td>Shorter duration preferred</td>
              </tr>
              <tr>
                <td>Unrealized cash</td>
                <td>Undeployed capital percentage</td>
                <td>Contextual to execution style</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="stg-section-gap">
        <div className="stg-2col">
          <div>
            <span className="stg-tag">Quantitative Insights</span>
            <h3 className="stg-title">Core Principles</h3>
            <div className="stg-fact">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L12 2L5 12L19 12L12 22Z M2 12L12 12L22 12L12 2Z" />
              </svg>
              <div className="stg-fact-body">
                <span className="stg-tag">Benchmark Superiority</span>
                <p className="stg-fact-copy">
                  Passive index tracking represents the baseline standard. Tactical strategies must deliver positive net alpha after accounting for execution costs and slippage.
                </p>
              </div>
            </div>
            <div className="stg-fact">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L12 2L5 12L19 12L12 22Z M2 12L12 12L22 12L12 2Z" />
              </svg>
              <div className="stg-fact-body">
                <span className="stg-tag">Asymmetric Drawdown Impact</span>
                <p className="stg-fact-copy">
                  A 30% loss requires a 42.8% gain to recover to break-even. Mitigating downside drawdown impact is essential for sustainable long-term compounding.
                </p>
              </div>
            </div>
            <div className="stg-fact">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L12 2L5 12L19 12L12 22Z M2 12L12 12L22 12L12 2Z" />
              </svg>
              <div className="stg-fact-body">
                <span className="stg-tag">Transaction Friction</span>
                <p className="stg-fact-copy">
                  Execution costs, spread friction, and slippage compound with trade frequency. Backtests must incorporate realistic fee structures to avoid performance inflation.
                </p>
              </div>
            </div>
            <div className="stg-fact">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L12 2L5 12L19 12L12 22Z M2 12L12 12L22 12L12 2Z" />
              </svg>
              <div className="stg-fact-body">
                <span className="stg-tag">Compounding Horizon</span>
                <p className="stg-fact-copy">
                  Time horizon significantly influences net outcomes under exponential compounding. Maintaining consistent compound rates over longer time frames generates expanding capital returns.
                </p>
              </div>
            </div>
            <div className="stg-fact">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L12 2L5 12L19 12L12 22Z M2 12L12 12L22 12L12 2Z" />
              </svg>
              <div className="stg-fact-body">
                <span className="stg-tag">Systematic Position Sizing</span>
                <p className="stg-fact-copy">
                  Capital allocation per trade is as critical as entry generation. Quantitative frameworks adjust sizing relative to trade expectancy and prevailing volatility.
                </p>
              </div>
            </div>
          </div>

          <div>
            <span className="stg-tag">Analysis Guidelines</span>
            <h3 className="stg-title">Evaluation Framework</h3>
            <div className="stg-notes">
              <h4 className="stg-notes-heading">How professionals evaluate backtests</h4>
              <ul className="stg-notes-list">
                <li>
                  <strong>Prioritize consistency over peak returns:</strong> A 12% CAGR across diverse market regimes is superior to a 25% CAGR dependent on a single favorable market trend.
                </li>
                <li>
                  <strong>Account for market regimes:</strong> Assess performance across varying market cycles, including bull trends, bear corrections, and sideways consolidation periods.
                </li>
                <li>
                  <strong>Align strategy parameters with goals:</strong> Establish whether the core objective is long-term asset accumulation or tactical short-term capture before judging risk metrics.
                </li>
                <li>
                  <strong>Recognize tactical rebalancing:</strong> Periodic portfolio adjustments to maintain risk allocations represent systematic discipline, not unnecessary friction.
                </li>
                <li>
                  <strong>Evaluate against baseline metrics:</strong> Confirm that active strategy returns exceed benchmark performance on a risk-adjusted basis after fees.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="stg-ritual stg-section-gap">
        <h3 className="stg-ritual-heading">Standardized Strategy Checklist</h3>
        <p className="stg-ritual-deck">
          Systematically audit backtest results using this evaluation sequence before allocating capital.
        </p>
        <ol className="stg-ritual-list">
          <li><strong>Ending value &gt; 100:</strong> Confirms positive net capital return.</li>
          <li><strong>CAGR &gt; 10%:</strong> Confirms sufficient annualized return over multi-year backtests.</li>
          <li><strong>Sharpe & Sortino &gt; 1.0:</strong> Demonstrates acceptable return per unit of volatility.</li>
          <li><strong>PSR &gt; 50%:</strong> Indicates statistical confidence in persistent strategy performance.</li>
          <li><strong>Max drawdown within risk parameters:</strong> Verifies capital drops remain tolerable.</li>
          <li><strong>Drawdown recovery period controlled:</strong> Confirms efficient recovery timeline back to high-water mark.</li>
          <li><strong>Positive expectancy:</strong> Validates positive expected value across repeated position entries.</li>
          <li><strong>Outperforms passive benchmark:</strong> Confirms active tactical management beats passive indexing.</li>
        </ol>
        <p className="stg-ritual-outro">
          Strategies satisfying all baseline parameters qualify for further out-of-sample testing or live paper trading. Strategies failing key criteria require parameter refinement or structural reassessment.
        </p>
      </div>

      <div className="stg-disclaimer stg-section-gap">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 4L22 19H2L12 4Z" />
          <line x1="12" y1="10" x2="12" y2="14" />
          <line x1="12" y1="16.5" x2="12" y2="16.5" />
        </svg>
        <div className="stg-disclaimer-body">
          <span className="stg-tag">Worth Knowing</span>
          <p className="stg-disclaimer-copy">
            Backtested results are hypothetical, built from historical data. They show how a set of rules would have behaved, not how it will behave next. Live markets add slippage, liquidity and conditions that a backtest cannot capture.
          </p>
          <p className="stg-disclaimer-copy">
            Treat a backtest as the start of your thinking rather than the end of it. Use the signals as a starting point for your own research, size positions so a bad outcome is survivable, and make the final call yourself.
          </p>
        </div>
      </div>
    </section>
  )
}