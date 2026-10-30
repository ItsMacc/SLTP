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
      'Have a rule you want to test? Start with a template or a blank project, then work through it in the Python editor.',
    icon: FlaskConical,
    points: [
      'Run it against historical daily prices',
      'Review the trades and portfolio results',
      'Keep each project in its own workspace',
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
      'Choose a strategy to follow and SLTP can email you when its rules flag a possible entry, along with any stop-loss or target levels it sets. It is a prompt to review, not a trade placed for you.',
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
      'Review historical price charts and compare strategy results using measures such as CAGR, drawdown, and Sharpe ratio.',
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
      'Find the strategy class reference, engine data structures, API endpoints, and examples for writing strategies in the Lab.',
    icon: FileCode2,
    cta: 'Open the docs',
  },
];

/* ---------- Trust & honesty ---------- */
const TRUST_POINTS: { icon: IconType; title: string; text: string }[] = [
  {
    icon: ShieldCheck,
    title: 'Research, not advice',
    text: 'SLTP provides data and tools for your own research. It does not recommend investments.',
  },
  {
    icon: Hourglass,
    title: 'Past results have limits',
    text: 'A backtest uses historical prices and simulated fills. It cannot account for every live-market condition.',
  },
  {
    icon: Sprout,
    title: 'Check the assumptions',
    text: 'Changing the dates, symbols, or trading costs can change the result. Check what each test includes.',
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
            <span className="page-hero-eyebrow">Stock research platform</span>
            <h1 className="page-hero-title">
              Research stocks
              <br />
              <em>and track your portfolio.</em>
            </h1>
            <p className="page-hero-description">
              Explore historical market data, read how each strategy works, and use the Lab to
              write and backtest your own rules.
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
            Start by looking through the strategies. When you have a rule of your own to try, the
            Lab is ready for it.
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

      {/* ================= RESEARCH NOTES ================= */}
      <section className="home-section home-trust">
        <div className="home-trust-panel home-reveal" style={revealDelay(0)}>
          <div className="home-trust-head">
            <h2 className="home-trust-title">How to read backtest results</h2>
            <p className="home-trust-lede">
              A backtest applies strategy rules to past prices using assumed costs and fills. It
              shows how those rules performed over a chosen period, not how they will perform in the
              future. Dates, symbols, and execution assumptions all affect the result.
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
              Learn the basics
              <ArrowRight size={14} />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
