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
