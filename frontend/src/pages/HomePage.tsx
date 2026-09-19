import { useEffect, type CSSProperties, type ComponentType } from 'react';
import {
  Bell,
  FlaskConical,
  Wallet,
  Layers,
  LineChart,
  ArrowRight,
  ArrowUpRight,
  ShieldCheck,
  Check,
} from 'lucide-react';
import Button from '../ui/Button';
import './HomePage.css';

interface HomePageProps {
  onNavigate: (tab: string) => void;
}

type IconType = ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;

interface ModuleData {
  id: string;
  nav: string;
  index: string;
  kicker: string;
  title: string;
  description: string;
  icon: IconType;
  points?: string[];
  cta: string;
  feature?: boolean;
}

/* ---------- Platform modules ---------- */
const MODULES: ModuleData[] = [
  {
    id: 'invest',
    nav: 'invest',
    index: '01',
    kicker: 'Signals & alerts',
    title: 'Invest',
    description:
      'Shape how SLTP reaches you. Follow the models that fit your comfort, set the position and risk limits you can live with, then decide exactly when and how you want to be notified.',
    icon: Bell,
    points: [
      'Subscribe to signals from the model library',
      'Customise alert channels, triggers and quiet hours',
      'Plan each entry before you commit any capital',
    ],
    cta: 'Open the desk',
    feature: true,
  },
  {
    id: 'lab',
    nav: 'lab',
    index: '02',
    kicker: 'Build & backtest',
    title: 'Lab',
    description:
      'For the tinkerers. Compose your own rules, run them against decades of market history, and keep every experiment organised in one place.',
    icon: FlaskConical,
    points: [
      'Write and version custom strategies',
      'Run, compare and stress-test backtests',
      'Assemble portfolios from what survives',
    ],
    cta: 'Enter the Lab',
  },
  {
    id: 'portfolio',
    nav: 'portfolio',
    index: '03',
    kicker: 'Positions & watchlist',
    title: 'Portfolio',
    description:
      'Every stock you care about in a single view — shortlisted, held or exited — with the notes that explain why you own it.',
    icon: Wallet,
    cta: 'Manage portfolio',
  },
  {
    id: 'strategies',
    nav: 'strategies',
    index: '04',
    kicker: 'Model library',
    title: 'Strategies',
    description:
      'Curated, rules-based models documented end to end and measured against buy-and-hold across bull, bear and recovery regimes.',
    icon: Layers,
    cta: 'Browse strategies',
  },
  {
    id: 'performance',
    nav: 'performance',
    index: '05',
    kicker: 'Track record',
    title: 'Performance',
    description:
      'Follow how each model behaves in real market conditions, with drawdown, CAGR and risk-adjusted returns kept in plain sight.',
    icon: LineChart,
    cta: 'View performance',
  },
];

/* ---------- Illustrative ticker tape ---------- */
const TICKER = [
  { symbol: 'AAPL', price: '231.40', change: '+1.24%', up: true },
  { symbol: 'NVDA', price: '176.28', change: '+2.61%', up: true },
  { symbol: 'MSFT', price: '418.05', change: '-0.42%', up: false },
  { symbol: 'SHOP.TO', price: '152.13', change: '+0.87%', up: true },
  { symbol: 'TSLA', price: '242.90', change: '-1.35%', up: false },
  { symbol: 'AMZN', price: '198.44', change: '+0.53%', up: true },
  { symbol: 'META', price: '512.70', change: '+1.08%', up: true },
  { symbol: 'SPY', price: '601.22', change: '+0.31%', up: true },
];

/* ---------- Illustrative signal feed ---------- */
const SIGNALS = [
  { ticker: 'AAPL', action: 'Buy', tone: 'buy', entry: '228.10', stop: '219.40', confidence: 82 },
  { ticker: 'NVDA', action: 'Watch', tone: 'watch', entry: '176.20', stop: '168.90', confidence: 64 },
  { ticker: 'SHOP.TO', action: 'Exit', tone: 'exit', entry: '152.05', stop: '158.30', confidence: 71 },
];

/* ---------- Audience split ---------- */
const AUDIENCES = [
  {
    id: 'follower',
    tag: 'For investors',
    title: 'The follower',
    body: 'You want signals you can act on without building anything yourself. Follow a model, set your alerts, and let the rules do the watching.',
    points: ['Guided signal feed', 'Notification preferences', 'Position and risk limits'],
  },
  {
    id: 'builder',
    tag: 'For builders',
    title: 'The tinkerer',
    body: 'You want the machinery. Write the rules, torture-test them on old markets, and only keep the ones that survive the drawdown.',
    points: ['Custom rule sets', 'Multi-regime backtests', 'Portfolio construction'],
  },
];

/* ---------- Workflow ---------- */
const STEPS = [
  {
    num: '01',
    title: 'Pick your lane',
    body: 'Create an account, then choose how you want to work: guided signals or the open Lab.',
  },
  {
    num: '02',
    title: 'Set your universe',
    body: 'Add the tickers you actually care about and define the limits you are comfortable with.',
  },
  {
    num: '03',
    title: 'Choose a model',
    body: 'Start from the library, or write your own rules from a blank sheet.',
  },
  {
    num: '04',
    title: 'Review and refine',
    body: 'Track positions and performance, then head back to the Lab when the data says so.',
  },
];

/* ---------- Facts band ---------- */
const STATS = [
  { value: '02', label: 'Strategy models' },
  { value: '08', label: 'Market regimes tested' },
  { value: '15 yr', label: 'Deepest backtest span' },
  { value: '100%', label: 'Rules-based decisions' },
];

export default function HomePage({ onNavigate }: HomePageProps) {
  /* Fade elements up as they enter the viewport */
  useEffect(() => {
    const targets = Array.from(document.querySelectorAll('.home-reveal'));
    if (targets.length === 0) return;

    if (typeof IntersectionObserver === 'undefined') {
      targets.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14, rootMargin: '0px 0px -8% 0px' }
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const revealDelay = (ms: number) => ({ '--reveal-delay': `${ms}ms` } as CSSProperties);

  return (
    <div className="home-page">
      {/* ================= HERO ================= */}
      <section className="home-hero">
        <div className="home-hero-grid" aria-hidden="true" />

        <div className="home-hero-inner">
          <div className="home-hero-layout">
            <div className="home-hero-copy">
              <span className="home-eyebrow">SLTP — Research terminal for investors</span>
              <h1 className="home-hero-title">
                Trade less on <em>instinct</em>.
                <br />
                Build on <em className="is-accent">evidence</em>.
              </h1>
              <p className="home-hero-lede">
                SLTP turns market data into decisions you can defend — receive signals, build and
                backtest your own rules, and keep every position accounted for in one calm
                workspace.
              </p>

              <div className="home-hero-actions">
                <Button variant="primary" size="lg" onClick={() => onNavigate('strategies')}>
                  Explore the model library
                  <ArrowRight size={18} className="home-btn-icon" />
                </Button>
                <Button variant="secondary" size="lg" onClick={() => onNavigate('performance')}>
                  See live performance
                </Button>
              </div>

              <ul className="home-hero-meta">
                <li>
                  <Check size={14} /> Rules-based models
                </li>
                <li>
                  <Check size={14} /> Multi-regime backtests
                </li>
                <li>
                  <Check size={14} /> Research, never advice
                </li>
              </ul>
            </div>

            {/* Illustrative signal panel */}
            <aside className="home-signal-panel" aria-label="Signal feed preview">
              <div className="home-signal-head">
                <span className="home-signal-title">
                  <span className="home-signal-dot" /> Signal feed
                </span>
                <span className="home-signal-tag">Preview</span>
              </div>

              <div className="home-signal-rows">
                {SIGNALS.map((signal) => (
                  <div key={signal.ticker} className="home-signal-row">
                    <div className="home-signal-id">
                      <span className="home-signal-ticker">{signal.ticker}</span>
                      <span className={`home-signal-action is-${signal.tone}`}>{signal.action}</span>
                    </div>
                    <div className="home-signal-levels">
                      <span className="home-signal-level">
                        <span className="home-level-label">Entry</span>
                        {signal.entry}
                      </span>
                      <span className="home-signal-level">
                        <span className="home-level-label">Stop</span>
                        {signal.stop}
                      </span>
                    </div>
                    <div className="home-signal-conf">
                      <span className="home-conf-track">
                        <span className="home-conf-fill" style={{ width: `${signal.confidence}%` }} />
                      </span>
                      <span className="home-conf-value">{signal.confidence}%</span>
                    </div>
                  </div>
                ))}
              </div>

              <p className="home-signal-note">
                <ShieldCheck size={14} /> Illustrative layout — not live data.
              </p>
            </aside>
          </div>
        </div>
      </section>

      {/* ================= TICKER TAPE ================= */}
      <div className="home-ticker" aria-hidden="true">
        <div className="home-ticker-track">
          {[0, 1].map((copy) => (
            <div className="home-ticker-group" key={copy}>
              {TICKER.map((item) => (
                <span className="home-ticker-item" key={`${copy}-${item.symbol}`}>
                  <span className="home-ticker-symbol">{item.symbol}</span>
                  <span className="home-ticker-price">{item.price}</span>
                  <span className={`home-ticker-change ${item.up ? 'is-up' : 'is-down'}`}>
                    {item.change}
                  </span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ================= MODULES ================= */}
      <section className="home-section">
        <div className="home-section-head home-reveal" style={revealDelay(0)}>
          <span className="home-section-label">The platform</span>
          <h2 className="home-section-title">One desk for signals, research and record-keeping.</h2>
          <p className="home-section-lede">
            Five connected workspaces that cover the whole loop — follow a model, understand the
            risk, hold yourself accountable, and go deeper when you are ready.
          </p>
        </div>

        <div className="home-modules">
          {MODULES.map((module, i) => {
            const Icon = module.icon;
            return (
              <button
                type="button"
                key={module.id}
                className={`home-module home-reveal ${module.feature ? 'is-feature' : ''}`}
                style={revealDelay(80 * i)}
                onClick={() => onNavigate(module.nav)}
              >
                <div className="home-module-top">
                  <span className="home-module-icon">
                    <Icon size={20} strokeWidth={1.75} />
                  </span>
                  <span className="home-module-index">{module.index}</span>
                </div>

                <div className="home-module-body">
                  <span className="home-module-kicker">{module.kicker}</span>
                  <h3 className="home-module-title">{module.title}</h3>
                  <p className="home-module-desc">{module.description}</p>
                </div>

                {module.points && (
                  <ul className="home-module-list">
                    {module.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                )}

                <span className="home-module-cta">
                  {module.cta}
                  <ArrowUpRight size={15} />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ================= AUDIENCES ================= */}
      <section className="home-section">
        <div className="home-section-head home-reveal" style={revealDelay(0)}>
          <span className="home-section-label">Two ways to work</span>
          <h2 className="home-section-title">Built for two kinds of people.</h2>
          <p className="home-section-lede">
            Whether you want to be told what changed or to design the rule that flags it, the same
            engine sits underneath.
          </p>
        </div>

        <div className="home-duo">
          {AUDIENCES.map((audience, i) => (
            <article
              key={audience.id}
              className={`home-duo-card is-${audience.id} home-reveal`}
              style={revealDelay(90 * i)}
            >
              <span className="home-duo-tag">{audience.tag}</span>
              <h3 className="home-duo-title">{audience.title}</h3>
              <p className="home-duo-body">{audience.body}</p>
              <ul className="home-duo-list">
                {audience.points.map((point) => (
                  <li key={point}>
                    <Check size={14} />
                    {point}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {/* ================= WORKFLOW ================= */}
      <section className="home-section">
        <div className="home-section-head home-reveal" style={revealDelay(0)}>
          <span className="home-section-label">How it works</span>
          <h2 className="home-section-title">Four steps from curiosity to conviction.</h2>
        </div>

        <ol className="home-steps">
          {STEPS.map((step, i) => (
            <li key={step.num} className="home-step home-reveal" style={revealDelay(80 * i)}>
              <span className="home-step-num">{step.num}</span>
              <h3 className="home-step-title">{step.title}</h3>
              <p className="home-step-body">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ================= FACTS ================= */}
      <section className="home-section is-flush">
        <div className="home-stats">
          {STATS.map((stat, i) => (
            <div key={stat.label} className="home-stat home-reveal" style={revealDelay(70 * i)}>
              <span className="home-stat-value">{stat.value}</span>
              <span className="home-stat-label">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section className="home-cta">
        <div className="home-cta-inner home-reveal" style={revealDelay(0)}>
          <span className="home-section-label is-centered">Get started</span>
          <h2 className="home-cta-title">Your next decision doesn&#39;t have to be a guess.</h2>
          <p className="home-cta-body">
            Start with the model library, study the track record, then make the platform fit the way
            you actually invest.
          </p>
          <div className="home-cta-actions">
            <Button variant="primary" size="lg" onClick={() => onNavigate('invest')}>
              Create your workspace
              <ArrowRight size={18} className="home-btn-icon" />
            </Button>
            <Button variant="secondary" size="lg" onClick={() => onNavigate('strategies')}>
              Browse strategies
            </Button>
          </div>
          <p className="home-cta-note">
            SLTP is a research and education platform. Nothing here is financial advice.
          </p>
        </div>
      </section>
    </div>
  );
}
