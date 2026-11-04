// HomePage.tsx — Landing page: what SLTP is, the five parts of it, and how to
// read a backtest.
//
// Kept deliberately plain: a headline, a sentence, one button, the tools as
// cards, then the honest note on what a backtest is. No numbered labels, no
// scroll animations, no decorative bands.
import { type ComponentType } from 'react';
import { ArrowRight, FileCode2, FlaskConical, Layers, LineChart, Wallet } from 'lucide-react';
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

/* ---------- The five parts of the site ---------- */
const TOOLS: ToolData[] = [
  {
    id: 'lab',
    nav: 'lab',
    title: 'Lab',
    description:
      'A Python-based environment for building and testing your own strategies, with the same data and backtest engine that runs the site.',
    cta: 'Open the Lab',
    icon: FlaskConical,
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
    id: 'portfolio',
    nav: 'portfolio',
    title: 'Portfolio',
    description:
      'A place to track your investments, and receive alerts about market events and signals from the strategies you follow.',
    cta: 'Manage portfolio',
    icon: Wallet,
  },
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
    id: 'docs',
    nav: 'docs',
    title: 'Docs',
    description:
      'A comprehensive reference for implementing your own strategies, including examples and full documentation of the strategy class, historical data access, and API usage.',
    cta: 'Read the docs',
    icon: FileCode2,
  },
];

/* ---------- Bento section ---------- */

/* Soft tones from the reference palette, orange left out. One per pillow in the
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

/* ---------- How to read the results ---------- */
const READING: { title: string; text: string }[] = [
  {
    title: 'A backtest is not a prediction',
    text: 'Backtests are a way to evaluate a strategy using historical data. They are not a guarantee of future performance, and past results do not predict future outcomes. Always consider the inherent risks and uncertainties of investing.',
  },
  {
    title: 'Look at the whole picture',
    text: 'When evaluating a strategy, it is important you know what principle it is based on. Different strategies take on different levels of risk, so it is crucial to understand how it aligns with your own investment goals and risk tolerance.',
  },
  {
    title: 'The dates decide a lot',
    text: 'The performance of a strategy can vary greatly depending on the time period chosen for the backtest. Different market conditions, economic events, and trends can significantly impact results.',
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
            SLTP is an open-source platform that provides a comprehensive set of tools for quantitative research, backtesting, investment insights, and portfolio management. Join SLTP to explore our strategies, learn the fundamentals of investing, and make informed decisions with confidence.
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

      <section className="home-tools">
        <header className="home-tools-head">
          <h2 className="home-tools-title">See what SLTP can do, and how you can use it</h2>
          <p className="home-tools-lede">
            SLTP brings your entire investing workflow into one place. You can build custom models using our <strong>Python-based Lab</strong>, study the rules behind our <strong>tested strategies</strong>, manage your portfolio while staying informed with our automated entry and exit alerts, and dive into <strong>research</strong> to inspect historical price charts and run backtest simulations. Our <strong>documentation</strong> provides a comprehensive reference for the strategy class, data access, and API usage, helping you to write your own rules and strategies.
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
          href="#/docs/"
          onClick={(event) => {
            event.preventDefault();
            onNavigate('docs');
          }}
        >
          <h2 className="bento__card-title">Want to know how the SLTP engine runs?</h2>
          <p className="bento__card-text">
            We invite you to dive into our comprehensive system guides to see exactly how everything works under the hood. Once you get a feel for the architecture, we would love for you to get involved. Feel free to submit your own code, fix bugs, or suggest updates to help us improve. Your unique contributions are what keep this engine growing every day.
          </p>
          <span className="bento__cta-foot">
            <span className="bento__cta-label">Learn more</span>
            <ArrowRight size={18} className="bento__cta-arrow" />
          </span>
        </a>
      </section>

      <section className="home-reading">
        <header className="home-tools-head">
          <h2 className="home-tools-title">What SLTP is, and how to read the numbers</h2>
          <p className="home-tools-lede">
             SLTP is a research platform designed to support self-directed analysis. While our strategies are rigorously constructed to help inform your market perspective, they are meant to guide your research, not serve as financial advice to follow blindly. Here is how to interpret the data across the platform.
          </p>
        </header>

        <div className="home-reading-grid">
          {READING.map((item) => (
            <div className="home-reading-item" key={item.title}>
              <h3 className="home-reading-title">{item.title}</h3>
              <p className="home-reading-text">{item.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
