// HomePage.tsx — Landing page: hero, platform module grid, audience paths.
import { useEffect, type CSSProperties, type ComponentType } from 'react';
import {
  FlaskConical,
  Wallet,
  Layers,
  LineChart,
  FileCode2,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Hourglass,
  ShieldCheck,
  Sprout,
} from 'lucide-react';
import Button from '../ui/Button';
import './HomePage.css';

interface HomePageProps {
  onNavigate: (tab: string) => void;
  onOpenGuide?: () => void;
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
    id: 'lab',
    nav: 'lab',
    index: '01',
    kicker: 'Build & backtest',
    title: 'Lab',
    description:
      'For more advanced users. Compose your own rules, run them against decades of market history, and keep every experiment organised in one place.',
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
    index: '02',
    kicker: 'Positions & watchlist',
    title: 'Portfolio',
    description:
      'Keep a watchlist of the stocks you are considering and record the positions you hold, with the gain or loss on each one.',
    icon: Wallet,
    cta: 'Manage portfolio',
    feature: true,
  },
  {
    id: 'strategies',
    nav: 'strategies',
    index: '03',
    kicker: 'Strategy library',
    title: 'Strategies',
    description:
      'Read how each strategy works, from the reasoning behind it to its rebalancing rules, and see how it performed against buy and hold.',
    icon: Layers,
    cta: 'Browse strategies',
  },
  {
    id: 'performance',
    nav: 'performance',
    index: '04',
    kicker: 'Track record',
    title: 'Performance',
    description:
      'Follow how each strategy behaves in real market conditions, with drawdown, CAGR and risk-adjusted returns kept in plain sight.',
    icon: LineChart,
    cta: 'View performance',
  },
  {
    id: 'docs',
    nav: 'docs',
    index: '05',
    kicker: 'Write & extend',
    title: 'Docs',
    description:
      'The reference for building on SLTP: how a strategy class works, which methods to override, and worked recipes you can copy into the Lab.',
    icon: FileCode2,
    cta: 'Open the docs',
  },
];

/* ---------- Trust & honesty ---------- */
const TRUST_POINTS: { icon: IconType; title: string; text: string }[] = [
  {
    icon: ShieldCheck,
    title: 'Not financial advice',
    text: 'SLTP shows research, rules and history. Every decision about your money is yours to make.',
  },
  {
    icon: Hourglass,
    title: 'Past results are not promises',
    text: 'Backtests use past prices. They can look better than real trading, and markets change.',
  },
  {
    icon: Sprout,
    title: 'Small steps still count',
    text: 'You do not need a large amount or perfect timing. Starting early gives time to learn and compound.',
  },
];

export default function HomePage({ onNavigate, onOpenGuide }: HomePageProps) {
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
      <section className="home-hero-wrapper page-hero-band is-full-bleed is-dot-grid">
        <div className="home-hero-inner page-hero-inner">
          <div className="home-hero-copy">
            <span className="page-hero-eyebrow">Research platform for the stock market</span>
            <h1 className="page-hero-title">
              Research stocks, test strategies,
              <br />
              <em>and track what you own.</em>
            </h1>
            <p className="page-hero-description">
              Every strategy on SLTP comes with the rules behind it and its full backtest history,
              so you can see how it works, test your own ideas, and decide what to follow.
            </p>

            <div className="home-hero-actions">
              <Button
                variant="primary"
                size="lg"
                className="home-btn-primary"
                onClick={() => (onOpenGuide ? onOpenGuide() : onNavigate('guide'))}
              >
                See how the site works
                <ArrowRight size={18} className="home-btn-icon" />
              </Button>
              <Button variant="link" size="sm" onClick={() => onNavigate('learn')}>
                <div className="link-text">
                  <span>New to investing?</span>
                  <strong>Start from zero</strong>
                </div>
                <ArrowRight size={14} />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ================= MODULES ================= */}
      <section className="home-section">
        <div className="home-section-head home-reveal" style={revealDelay(0)}>
          <span className="home-section-label">The platform</span>
          <h2 className="home-section-title">What each part of SLTP does</h2>
          <p className="home-section-lede">
            Follow a model or build your own, keep track of what you hold, and check the record
            before you act.
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

      {/* ================= TRUST ================= */}
      <section className="home-section home-trust">
        <div className="home-trust-panel home-reveal" style={revealDelay(0)}>
          <div className="home-trust-head">
            <h2 className="home-trust-title">
              It is not financial advice, <em>but the earlier you start, the better.</em>
            </h2>
            <p className="home-trust-lede">
              Investing can feel closed off, with jargon, minimums and a fear of getting it wrong.
              SLTP is here to make the research clearer so you can begin with confidence.
            </p>
          </div>

          <div className="home-trust-grid">
            {TRUST_POINTS.map((point, i) => {
              const Icon = point.icon;
              return (
                <div key={point.title} className="home-trust-item home-reveal" style={revealDelay(90 * (i + 1))}>
                  <span className="home-trust-icon">
                    <Icon size={18} strokeWidth={1.75} />
                  </span>
                  <h3 className="home-trust-item-title">{point.title}</h3>
                  <p className="home-trust-item-text">{point.text}</p>
                </div>
              );
            })}
          </div>

          <div className="home-trust-footer">
            <Button variant="outline" size="sm" onClick={() => onNavigate('learn')}>
              <BookOpen size={15} />
              Start with the basics
              <ArrowRight size={14} />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
