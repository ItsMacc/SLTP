// HomePage.tsx — Landing page: the hero, the bento grid, and the cards
// linking out to the Research, Strategies, Lab and Learn pages.
//
// Those four pages have addresses but no content yet, so the cards land on a
// shared placeholder. The pre-trim five-card version (with Watchlist and
// Docs) lives on the backup-before-trim branch.
import { type ComponentType } from 'react';
import { ArrowRight, FlaskConical, GraduationCap, Layers, LineChart, Radar } from 'lucide-react';

function GithubIcon({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='currentColor' className={className} aria-hidden='true' focusable='false'>
      <path d='M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.14 0 .3.2.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z' />
    </svg>
  );
}
import Button from '../ui/Button';
import './HomePage.css';

interface HomePageProps {
  onNavigate: (tab: string) => void;
  onOpenGuide?: () => void;
}

type IconType = ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;

interface ToolData {
  id: string;
  nav: string;
  title: string;
  description: string;
  cta: string;
  icon: IconType;
}

/* ---------- The four parts of the site ---------- */
const TOOLS: ToolData[] = [
  {
    id: 'research',
    nav: 'research',
    title: 'Research',
    description:
      'Access daily price data and historical performance spanning across 11,000+ securities and nearly 3 decades of market history along with a backtest engine to see how our strategies have performed in the past.',
    cta: 'Open research',
    icon: LineChart,
  },
  {
    id: 'strategies',
    nav: 'strategies',
    title: 'Strategies',
    description:
      'A collection of tested strategies, with the rules that drive them, and the backtest results over eight different market regimes.',
    cta: 'Open the library',
    icon: Layers,
  },
  {
    id: 'lab',
    nav: 'lab',
    title: 'Lab',
    description:
      'A Python workspace for your own ideas: projects, files, an editor and a terminal, with Python running in the browser.',
    cta: 'Open the Lab',
    icon: FlaskConical,
  },
  {
    id: 'watchlist',
    nav: 'watchlist',
    title: 'Watchlist',
    description:
      'Your market radar: the stocks you follow with live quotes, the market around them, and signals from the strategies you trust.',
    cta: 'Open your watchlist',
    icon: Radar,
  },
  {
    id: 'learn',
    nav: 'learn',
    title: 'Learn',
    description:
      'New to investing? A course that starts from zero and walks through the fundamentals of investing step by step.',
    cta: 'Start the course',
    icon: GraduationCap,
  },
];

/* ---------- Bento section ---------- */

/* Soft tones from the reference palette, orange left out. One pillow per pill in the
   tile, so the field reads as a patchwork rather than a single colour. Nothing
   is painted behind them, so the three butters are a shade deeper than the
   swatch sheet: on the light card they would otherwise sit within a few points
   of the cream and read as holes rather than pillows. */
const BENTO_PILLOWS = [
  '#f0e4b6',
  '#b57a72',
  '#7c9a80',
  '#e3d09a',
  '#6f8f74',
  '#eddfae',
  '#c3948b',
  '#89a38d',
];

const BENTO_CELL_W = 120;
const BENTO_CELL_H = 85.5;

/* One pillow: a 120 × 85.5 cell with two rounded corners, the orientation
   flipping by parity so neighbours interlock and the gaps fall into stars.
   Each is inset by two units, which is the seam — nothing is painted behind
   them, so the seam and the stars are the card showing through. */
function bentoPillow(col: number, row: number, inset = 1.4): string {
  const left = col * BENTO_CELL_W + inset;
  const top = row * BENTO_CELL_H + inset;
  const right = (col + 1) * BENTO_CELL_W - inset;
  const bottom = (row + 1) * BENTO_CELL_H - inset;
  const rx = BENTO_CELL_W / 2 - inset;
  const ry = BENTO_CELL_H / 2 - inset;
  const midX = left + rx;
  const midY = top + ry;

  return (col + row) % 2 === 0
    ? `M${left},${midY} A${rx},${ry} 0 0 1 ${midX},${top} L${right},${top} L${right},${midY} A${rx},${ry} 0 0 1 ${midX},${bottom} L${left},${bottom} Z`
    : `M${left},${top} L${midX},${top} A${rx},${ry} 0 0 1 ${right},${midY} L${right},${bottom} L${midX},${bottom} A${rx},${ry} 0 0 1 ${left},${midY} Z`;
}

/* Four columns by two rows: eight pillows, eight tones. */
const BENTO_TILE = Array.from({ length: 8 }, (_, index) => {
  const col = index % 4;
  const row = Math.floor(index / 4);
  return {
    d: bentoPillow(col, row),
    fill: BENTO_PILLOWS[index % BENTO_PILLOWS.length],
  };
});

const BENTO_MINIS: { title: string; text: string; code?: string }[] = [
  {
    title: 'Local Development and Cloud Backtesting.',
    text: 'We provide a local development environment for building and testing strategies and cloud backtesting services on the website. Switch seamlessly from your machine to cloud execution.',
    code: 'pip install sltp',
  },
  {
    title: 'Optimized for Massive Datasets.',
    text: 'Our custom storage format handles all the heavy lifting behind the scenes, using 90% less memory and running your simulations over 65% faster so you can focus on building strategies, not managing code bottlenecks.',
  },
];

export default function HomePage({ onNavigate, onOpenGuide }: HomePageProps) {
  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="home-hero-copy">
          <h1 className="home-hero-title">
          A Quantitative research platform built for better investing and trading decisions.
          </h1>
          <p className="home-hero-lede">
            SLTP is an open-source platform that provides a comprehensive set of tools for quantitative research, backtesting, and investment insights. Join SLTP to explore our strategies, learn the fundamentals of investing, and make informed decisions with confidence.
          </p>

          <div className="home-hero-actions">
            <Button variant="primary" size="lg" onClick={() => onNavigate('strategies')}>
              Browse the strategies
              <ArrowRight size={18} className="home-btn-icon" />
            </Button>
            <Button
              variant="link"
              size="sm"
              onClick={() => (onOpenGuide ? onOpenGuide() : onNavigate('guide'))}
            >
              Take the site tour
            </Button>

            <p className="home-hero-note">
              New to investing?{' '}
              <button type="button" className="home-inline-link" onClick={() => onNavigate('learn')}>
                The course starts from zero
              </button>
            </p>
          </div>
        </div>
      </section>

      <section className="bento" aria-labelledby="bento-title">
        <article className="bento__feature">
          <div className="bento__pattern" aria-hidden="true">
            <svg width="100%" height="100%" focusable="false">
              <defs>
                <pattern
                  id="bento-tile"
                  width="480"
                  height="171"
                  patternUnits="userSpaceOnUse"
                  patternTransform="scale(0.5)"
                >
                  <g strokeLinejoin="round">
                    {BENTO_TILE.map((pillow) => (
                      <path key={pillow.d} d={pillow.d} fill={pillow.fill} />
                    ))}
                  </g>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#bento-tile)" />
            </svg>
          </div>

          <div className="bento__body">
            <h2 id="bento-title" className="bento__title">
              SLTP's open-source algorithmic engine!
            </h2>
            <p className="bento__copy">
              This engine powers all the backtests and strategies on this site. It is designed to be fast, efficient, and beginner-friendly, allowing you to start building and testing your own strategies without the need to memorize or understand complex code. With guided examples and comprehensive documentation, you can quickly learn and implement your own strategies and see how they perform in real market conditions.
            </p>
          </div>
        </article>

        <div className="bento__minis">
          {BENTO_MINIS.map((item) => (
            <article className="bento__card" key={item.title}>
              <h2 className="bento__card-title">{item.title}</h2>
              <p className="bento__card-text">{item.text}</p>
              {item.code && <code className="bento__code">{item.code}</code>}
            </article>
          ))}
        </div>

        <article className="bento__card bento__short">
          <h2 className="bento__card-title">Institutional-grade Backtesting.</h2>
          <p className="bento__card-text">
            Built for developers who want quantitative tools to run simulations directly against deep historical price series and leverage a lightning-fast execution engine locally on your machine.
          </p>
        </article>

        <article className="bento__card bento__tall">
          <h2 className="bento__card-title">Built on clean, reliable, high-quality data.</h2>
          <p className="bento__stat">
            <span className="bento__stat-lead">
              With over <span className="bento__stat-value">11,500+</span> securities
            </span>
            <span className="bento__stat-tail">
              containing more than twenty-eight years of historical data, built for faster
              backtests.
            </span>
          </p>
        </article>

        <a
          className="bento__cta"
          href="https://github.com/ItsMacc/SLTP-Engine"
          target="_blank"
          rel="noreferrer"
        >
          <h2 className="bento__card-title">Want to know how the SLTP engine runs?</h2>
          <p className="bento__card-text">
            We invite you to dive into our comprehensive system guides to see exactly how everything works under the hood. Once you get a feel for the architecture, we would love for you to get involved. Feel free to submit your own code, fix bugs, or suggest updates to help us improve. Your unique contributions are what keep this engine growing every day.
          </p>
          <span className="bento__cta-foot">
            <span className="bento__cta-label">View on GitHub</span>
            <GithubIcon size={18} className="bento__cta-arrow" />
          </span>
        </a>
      </section>

      <section className="home-tools" aria-labelledby="home-tools-title">
        <header className="home-tools-head">
          <h2 id="home-tools-title" className="home-tools-title">See what SLTP can do, and how you can use it</h2>
          <p className="home-tools-lede">SLTP puts your entire investment and trading workflow in one place. Everything you need to analyze markets, test ideas, and track strategies lives right here. Beyond core research and strategies, we also give you dedicated spaces to build and expand your skills. Whether you are completely new to quantitative finance or running advanced models, the platform is designed to be easy to pick up from day one.
          </p>
        </header>

        <div className="home-cards">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                type="button"
                key={tool.id}
                className="home-card"
                onClick={() => onNavigate(tool.nav)}
              >
                <Icon size={20} strokeWidth={1.75} className="home-card-icon" />
                <h3 className="home-card-title">{tool.title}</h3>
                <p className="home-card-desc">{tool.description}</p>
                <span className="home-card-cta">
                  <span className="home-card-cta-label">{tool.cta}</span>
                  <ArrowRight size={14} />
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
