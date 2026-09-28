// SiteGuide.tsx - "See how SLTP works": a full-screen slideshow with a small
// close button in the corner. The tour slide hands control to Driver.js, which
// opens the real pages and spotlights their elements as an interactive product
// walkthrough. A final slide points to the always-present page guides.
import { useCallback, useEffect, useRef, useState } from 'react';
import { driver, type Driver, type DriveStep } from 'driver.js';
import {
  X,
  LineChart,
  FlaskConical,
  Code2,
  Wallet,
  MousePointerClick,
  LifeBuoy,
} from 'lucide-react';
import { GlossaryText } from './GlossaryText';
import { type GlossaryTerm } from '../types/strategy';
import './SiteGuide.css';

export interface SiteGuideProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
}

/* ============================================================
   Glossary (same terms as the site guide page)
   ============================================================ */

const GUIDE_GLOSSARY: Record<string, string | GlossaryTerm> = {
  stock: {
    definition: 'A share of ownership in a company. If the company does well, the value of your share tends to grow.',
    example: 'Buying one share of Apple (AAPL) makes you a tiny part-owner of Apple.',
  },
  etf: {
    definition: 'Exchange-Traded Fund. A basket of many stocks or bonds you can buy in a single trade, giving instant diversification.',
    example: 'VOO holds all 500 companies in the S&P 500, so one share spreads your money across all of them.',
  },
  backtest: {
    definition: 'Running a strategy\u2019s rules over past market data to see how it would have performed, without risking real money.',
    example: 'Backtesting a strategy on 10 years of data shows its returns and worst losing streak it would have caused.',
  },
  'stop-loss': {
    definition: 'A preset rule that sells a holding when its price falls to a set level, limiting how much you can lose on it.',
    example: 'A stop-loss set 10% below your buy price automatically sells if the stock drops 10%.',
  },
  'take-profit': {
    definition: 'A preset rule that sells a holding once it reaches a target gain, locking in the profit.',
    example: 'A take-profit set 20% above your buy price automatically sells after a 20% rise.',
  },
  signal: {
    definition: 'A message from a strategy saying it would buy, sell, or hold a stock, usually with the numbers behind the call.',
    example: 'A signal might read: BUY MU, confidence 82%, because price health is accelerating.',
  },
  strategy: {
    definition: 'A fixed set of rules that decides what to buy, when to sell, and when to re-check the holdings.',
    example: 'A rule like "hold the 10 healthiest stocks, re-check weekly" is a strategy.',
  },
  'index fund': {
    definition: 'A fund that simply holds everything in a market index instead of picking winners.',
    example: 'An S&P 500 index fund owns the same 500 companies as the index, no more and no less.',
  },
  compounding: {
    definition: 'Returns earning their own returns over time, which is what makes long investing horizons powerful.',
    example: '$1,000 growing 7% per year becomes about $2,000 in 10 years and $4,000 in 20, without adding anything.',
  },
  benchmark: {
    definition: 'A simple baseline used for comparison, so you can tell whether extra effort is adding value.',
    example: 'If a strategy returns 8% while simply holding the index returned 10%, it failed against its benchmark.',
  },
  rebalancing: {
    definition: 'Periodically adjusting holdings so a strategy stays true to its rules as prices move.',
    example: 'A weekly strategy sells what no longer qualifies and buys what does, every week.',
  },
  ticker: {
    definition: 'The short code that identifies a stock on an exchange.',
    example: 'AAPL is the ticker for Apple; SHOP.TO is Shopify on the Toronto exchange.',
  },
};

/* ============================================================
   Slides 1-3 and 5: plain content slides
   ============================================================ */

function SlideWelcome() {
  return (
    <div className="tsg-slide-inner">
      <span className="tsg-kicker">Welcome to SLTP</span>
      <h1 className="tsg-title">
        What is SLTP?
      </h1>
      <p className="tsg-lede">
        <GlossaryText
          text="SLTP is a stock-market research platform that guides users and helps them start investing. The name stands for stop-loss take-profit, the platform provides actionable insights, market analysis, and beginner-friendly tools designed to help investors manage risk and build confidence."
          glossary={GUIDE_GLOSSARY}
        />
      </p>
      <p className="tsg-body">
        SLTP is a research tool, not a broker. Nothing here places real trades or moves
        real money. You explore real market data, test ideas against history, and
        practice with pretend cash until you are ready.
      </p>
    </div>
  );
}

function SlideHowToUse() {
  const uses = [
    {
      icon: LineChart,
      title: 'Track performance',
      body: (
        <GlossaryText
          text="Look up any stock or ETF and study its price over 1, 2, 5 or all available years with candlestick charts."
          glossary={GUIDE_GLOSSARY}
        />
      ),
    },
    {
      icon: FlaskConical,
      title: 'Backtest strategies',
      body: (
        <GlossaryText
          text="Run the built-in strategies against years of real market history and compare each one against its benchmark."
          glossary={GUIDE_GLOSSARY}
        />
      ),
    },
    {
      icon: Code2,
      title: 'Write your own',
      body: (
        <GlossaryText
          text="More advanced users can write code for their own strategies in the Lab and backtest them the same way."
          glossary={GUIDE_GLOSSARY}
        />
      ),
    },
    {
      icon: Wallet,
      title: 'Track your portfolio',
      body: (
        <GlossaryText
          text="Set up a portfolio, follow the built-in strategies, and receive their signals whenever you want a second opinion."
          glossary={GUIDE_GLOSSARY}
        />
      ),
    },
  ];
  return (
    <div className="tsg-slide-inner">
      <span className="tsg-kicker">Getting around</span>
      <h1 className="tsg-title">How to use SLTP</h1>
      <div className="tsg-uses">
        {uses.map((u) => (
          <div key={u.title} className="tsg-use">
            <span className="tsg-use-icon"><u.icon size={18} strokeWidth={1.75} /></span>
            <div>
              <h3>{u.title}</h3>
              <p>{u.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SlideInvestingVsTrading() {
  return (
    <div className="tsg-slide-inner">
      <span className="tsg-kicker">Two minutes of theory</span>
      <h1 className="tsg-title">Investing vs trading</h1>
      <p className="tsg-lede">
        These two words describe how long you hold an investment. Every strategy on SLTP
        is labelled one way or the other, and neither is better; they suit different
        people.
      </p>
      <div className="tsg-duo">
        <div className="tsg-duo-card">
          <span className="tsg-chip">Investing</span>
          <h3>Slow and steady</h3>
          <p>
            <GlossaryText
              text="Buy good assets and hold them for months or years, letting compounding do the work. Fewer decisions, less stress. Think index funds and buy and hold."
              glossary={GUIDE_GLOSSARY}
            />
          </p>
        </div>
        <div className="tsg-duo-card">
          <span className="tsg-chip">Trading</span>
          <h3>Active and responsive</h3>
          <p>
            <GlossaryText
              text="Move in and out of positions more often, trying to catch trends and sidestep downturns. More decisions, more engagement, and tighter risk rules like a stop-loss."
              glossary={GUIDE_GLOSSARY}
            />
          </p>
        </div>
      </div>
    </div>
  );
}

function SlideFinal() {
  return (
    <div className="tsg-slide-inner">
      <span className="tsg-kicker">One last thing</span>
      <h1 className="tsg-title">If you ever need help</h1>
      <span className="tsg-final-icon"><LifeBuoy size={26} strokeWidth={1.75} /></span>
      <p className="tsg-lede">
        There is always some text at the bottom of every page to help you understand it
        better. The Performance page has a full candlestick guide, the Strategies page
        explains how to read a backtest, and more guides are added as the site grows.
      </p>
      <p className="tsg-body">
        When something looks unfamiliar, scroll down. It is probably explained right
        there.
      </p>
    </div>
  );
}

/* ============================================================
   Slide 4: interactive product tours with Driver.js

   A registry maps each page of the site to its tour. Pages with a
   `steps` function get a live walkthrough; pages still being built
   list a `steps: null` stub and render as "coming soon", so adding a
   new tour later is just filling in the steps.
   ============================================================ */

interface PageTour {
  tab: string;
  label: string;
  blurb: string;
  /** Driver steps for this page, or null while the page is not ready */
  steps: (() => DriveStep[]) | null;
}

const PAGE_TOURS: PageTour[] = [  {
    tab: 'invest',
    label: 'Invest',
    blurb: 'Signals, alerts, and following strategies.',
    steps: null,
  },
  {
    tab: 'portfolio',
    label: 'Portfolio',
    blurb: 'Your setup, watchlist, and preferences.',
    steps: null,
  },
  {
    tab: 'strategies',
    label: 'Strategies',
    blurb: 'The model library: rules, reasoning, backtests.',
    steps: () => [
      {
        element: '.strategies-hero-top',
        popover: {
          title: 'This is the Strategies page',
          description:
            'The model library. Every strategy SLTP offers, with nothing hidden.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '.strategies-stats-row',
        popover: {
          title: 'The library at a glance',
          description:
            'Quick stats about the strategies on offer, before you dive into any single one.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '.wireframe-card',
        popover: {
          title: 'Strategy cards',
          description:
            'Each card shows the strategy\u2019s style (investing or trading), how active it is, and how often it rebalances. Click a card to expand it.',
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '.strategies-list',
        popover: {
          title: 'Everything is written out',
          description:
            'Expand any card for the hypothesis behind it, the exact rules, and its full backtest against simply buying and holding.',
          side: 'top',
          align: 'center',
        },
      },
    ],
  },
  {
    tab: 'performance',
    label: 'Performance',
    blurb: 'Research any stock, then run a strategy backtest.',
    steps: () => [
      {
        element: '.perf-hero-top',
        popover: {
          title: 'This is the Performance page',
          description:
            'Your research desk. Before buying anything, look at its history here. Let us walk through the pieces.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '.ticker-search',
        popover: {
          title: 'Search any ticker',
          description:
            'Type a stock\u2019s short code, like AAPL for Apple. Suggestions appear as you type, so you can only pick real symbols.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '.timeframe-group',
        popover: {
          title: 'Pick your timeframe',
          description:
            '1Y, 2Y, 5Y, or all available history. Zoom out first for the big picture, then zoom in on interesting periods.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '.perf-chart-wrapper',
        popover: {
          title: 'The chart',
          description:
            'Each candle is one trading day: green closed higher than it opened, red closed lower. Search a ticker to bring it to life.',
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '.guide',
        popover: {
          title: 'A guide lives right here',
          description:
            'Under the chart sits a long beginner guide explaining candlesticks step by step, with diagrams. Remember this spot.',
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '.mode-switch',
        popover: {
          title: 'Two modes',
          description:
            'Everything so far was Stocks mode: one price chart at a time. The other side of this switch runs full backtests of our strategies. We will flip it now.',
          side: 'bottom',
          align: 'start',
          onNextClick: (_el, _step, opts) => {
            /* Flip the Performance page into Strategies mode, then advance
               once the strategy view has mounted. */
            const buttons = document.querySelectorAll('.mode-switch-btn');
            (buttons[1] as HTMLElement | undefined)?.click();
            window.setTimeout(() => opts.driver.moveNext(), 250);
          },
        },
      },
      {
        element: '.strategy-card',
        popover: {
          title: 'Strategies mode',
          description:
            'This is the backtest runner. Instead of one stock\u2019s price, it replays a full SLTP strategy over real market history and reports how it would have done.',
          side: 'bottom',
          align: 'start',
          /* The stock-mode elements behind us are unmounted, so Back
             cannot highlight them; hide the button on this first step. */
          showButtons: ['next', 'close'],
        },
      },
      {
        element: '.strategy-controls-bar',
        popover: {
          title: 'Set up the backtest',
          description:
            'Pick one of the built-in strategies, choose a start date (and optionally an end date), then press Run Analysis.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '.strategy-card .empty-state',
        popover: {
          title: 'Run it to see results',
          description:
            'Right now there is nothing to show. After your first run, this area fills with the strategy\u2019s equity chart plus a Performance Metrics panel comparing it against simply buying and holding.',
          side: 'top',
          align: 'center',
        },
      },
    ],
  },
  {
    tab: 'lab',
    label: 'Lab',
    blurb: 'Write and backtest your own strategies.',
    steps: null,
  },
];

/** Centered popover that closes every tour */
function closingStep(onDone: () => void): DriveStep {
  return {
    /* No element: a centered popover */
    popover: {
      title: 'Guides everywhere',
      description:
        'Every page carries beginner help at the bottom, like the candlestick guide on the Performance page. That is the end of this tour.',
      doneBtnText: 'Finish tour',
      onNextClick: onDone,
    },
  };
}

function SlideTour({
  onNavigate,
  onTourActiveChange,
  onFinish,
}: {
  onNavigate: (tab: string) => void;
  onTourActiveChange: (active: boolean) => void;
  onFinish: () => void;
}) {
  const [tourActive, setTourActive] = useState(false);
  const [runningLabel, setRunningLabel] = useState<string | null>(null);
  const driverRef = useRef<Driver | null>(null);

  /* Keep the parent informed so it can hide the slideshow while the
     Driver.js tour spotlights the real pages underneath. */
  const setTourState = useCallback(
    (active: boolean) => {
      setTourActive(active);
      onTourActiveChange(active);
      if (!active) setRunningLabel(null);
    },
    [onTourActiveChange],
  );

  const startTour = useCallback(
    (tour: PageTour) => {
      if (!tour.steps) return;
      setTourState(true);
      setRunningLabel(tour.label);
      onNavigate(tour.tab);

      /* Give the target page a moment to mount, then spotlight it */
      window.setTimeout(() => {
        driverRef.current = driver({
          showProgress: true,
          allowClose: true,
          smoothScroll: true,
          overlayColor: 'black',
          stagePadding: 6,
          stageRadius: 10,
          popoverClass: 'tsg-driver-popover',
          nextBtnText: 'Next',
          prevBtnText: 'Back',
          doneBtnText: 'Finish tour',
          progressText: '{{current}} of {{total}}',
          onDestroyed: () => {
            setTourState(false);
          },
        });
        driverRef.current.setSteps([
          ...tour.steps!(),
          closingStep(() => {
            driverRef.current?.destroy();
            setTourState(false);
            onFinish();
          }),
        ]);
        driverRef.current.drive();
      }, 400);
    },
    [onNavigate, onFinish, setTourState],
  );

  /* Clean up the driver if the slideshow is closed mid-tour */
  useEffect(
    () => () => {
      driverRef.current?.destroy();
    },
    [],
  );

  return (
    <div className="tsg-slide-inner">
      <span className="tsg-kicker">Interactive walkthrough</span>
      <h1 className="tsg-title">Tour any page</h1>
      <p className="tsg-lede">
        Pick a page and we will open it on your screen and walk through it together,
        one highlighted piece at a time. You can come back and tour another page at
        any time.
      </p>
      {tourActive ? (
        <p className="tsg-tour-note">
          {runningLabel} tour running. Use the arrows in the popup, or close it any time.
        </p>
      ) : (
        <div className="tsg-tour-picker">
          {PAGE_TOURS.map((tour) => (
            <div key={tour.tab} className={`tsg-tour-card ${tour.steps ? '' : 'is-unavailable'}`}>
              <div className="tsg-tour-card-head">
                <span className="tsg-tour-card-name">{tour.label}</span>
                {tour.steps ? (
                  <button
                    type="button"
                    className="tsg-tour-card-btn"
                    onClick={() => startTour(tour)}
                  >
                    <MousePointerClick size={13} />
                    Tour
                  </button>
                ) : (
                  <span className="tsg-tour-card-soon">Coming soon</span>
                )}
              </div>
              <p className="tsg-tour-card-blurb">{tour.blurb}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Slideshow shell
   ============================================================ */

const CONTENT_SLIDES = 5; // welcome, how-to, theory, tour, final

export default function SiteGuide({ open, onClose, onNavigate }: SiteGuideProps) {
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  const close = useCallback(() => {
    setLeaving(true);
    window.setTimeout(() => {
      setLeaving(false);
      setIndex(0);
      onClose();
      onNavigate('home');
    }, 200);
  }, [onClose, onNavigate]);

  /* Reset to the first slide each time it opens */
  useEffect(() => {
    if (open) {
      setIndex(0);
      setTourOpen(false);
    }
  }, [open]);

  /* Escape closes the slideshow (but not mid-tour, where Escape closes
     the Driver popover instead). Body scroll is locked for the slideshow
     and released while the tour runs, since the tour scrolls real pages. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !tourOpen) close();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = tourOpen ? '' : 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, close, tourOpen]);

  if (!open) return null;

  const isFirst = index === 0;
  const isLast = index === CONTENT_SLIDES - 1;

  return (
    <div
      className={`tsg-overlay ${leaving ? 'is-leaving' : ''} ${tourOpen ? 'is-hidden-for-tour' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="How SLTP works"
    >
      {/* Small close button, top corner */}
      <button type="button" className="tsg-close" onClick={close} aria-label="Close guide">
        <X size={16} />
      </button>

      {/* Progress dots */}
      <div className="tsg-progress" aria-hidden="true">
        {Array.from({ length: CONTENT_SLIDES }).map((_, i) => (
          <button
            key={i}
            type="button"
            tabIndex={-1}
            className={`tsg-dot ${i === index ? 'is-active' : ''}`}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>

      <div className="tsg-stage" key={index}>
        {index === 0 && <SlideWelcome />}
        {index === 1 && <SlideHowToUse />}
        {index === 2 && <SlideInvestingVsTrading />}
        {index === 3 && (
          <SlideTour
            onNavigate={onNavigate}
            onTourActiveChange={setTourOpen}
            /* Finishing a tour returns to this picker slide (4 of 5) so
               another page tour can be started right away. */
            onFinish={() => setIndex(3)}
          />
        )}
        {index === 4 && <SlideFinal />}
      </div>

      <div className="tsg-footer">
        <button
          type="button"
          className="tsg-nav-btn"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={isFirst}
        >
          Back
        </button>
        <span className="tsg-counter">{index + 1} / {CONTENT_SLIDES}</span>
        {isLast ? (
          <button
            type="button"
            className="tsg-nav-btn is-primary"
            onClick={() => {
              close();
              onNavigate('home');
            }}
          >
            Back to Home
          </button>
        ) : (
          <button type="button" className="tsg-nav-btn is-primary" onClick={() => setIndex((i) => i + 1)}>
            Next
          </button>
        )}
      </div>
    </div>
  );
}
