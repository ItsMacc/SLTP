// SiteGuide.tsx — "See how SLTP works": a full-screen slideshow with a small
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
  Lock,
} from 'lucide-react';
import { GlossaryText } from './GlossaryText';
import Button from '../ui/Button';
import { type GlossaryTerm } from '../types/strategy';
import './SiteGuide.css';

export interface SiteGuideProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
  /** True when somebody is signed in, so pages behind a sign-in can be toured */
  isSignedIn?: boolean;
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
    example:
      'Backtesting "buy the 10 healthiest stocks, rebalance quarterly" over 20 years shows its returns and its worst losing streak.',
  },
  'stop-loss': {
    definition: 'A preset rule that sells a holding when its price falls to a set level, capping how much you can lose.',
    example: 'A stop-loss 10% below your buy price sells automatically if the stock drops 10%.',
  },
  'take-profit': {
    definition: 'A preset rule that sells a holding once it reaches a target gain, locking in the profit.',
    example: 'A take-profit set 20% above your buy price automatically sells after a 20% rise.',
  },
  signal: {
    definition:
      "The moment a strategy's rules say to act, buy, sell or hold. A signal is the output of the rules, not a guess.",
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
    definition: 'Returns earning their own returns over time, which is why holding for years beats acting often.',
    example: '$1,000 growing 7% per year becomes about $2,000 in 10 years and $4,000 in 20, without adding anything.',
  },
  benchmark: {
    definition: 'A standard the strategy is measured against, so you can tell whether it added anything.',
    example: 'If a strategy returns 8% and the S&P 500 returned 10%, it underperformed its benchmark.',
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
          text="SLTP is a stock-market research platform. The name stands for stop-loss take-profit, the two rules that decide when a position is cut and when a gain is banked. Here you can look up market data, read and backtest trading strategies, and work through a course that explains what all of it means."
          glossary={GUIDE_GLOSSARY}
        />
      </p>
      <p className="tsg-body">
        SLTP is a research tool, not a broker. Nothing here places a real trade or moves
        real money. You look at real market data, test ideas against history, and
        practise with pretend cash.
      </p>
    </div>
  );
}

function SlideHowToUse() {
  const uses = [
    {
      icon: LineChart,          title: 'Track performance',
          body: (
            <GlossaryText
              text="Look up any stock or ETF and study its price over 1, 2, 5 or all available years."
              glossary={GUIDE_GLOSSARY}
            />
          ),
    },
    {
      icon: FlaskConical,          title: 'Backtest strategies',
          body: (
            <GlossaryText
              text="Run the built-in strategies against years of real market history and compare each one against its benchmark."
              glossary={GUIDE_GLOSSARY}
            />
          ),
    },
    {
      icon: Code2,          title: 'Write your own',
          body: (
            <GlossaryText
              text="Advanced users can write their own strategies in the Lab and backtest them the same way."
              glossary={GUIDE_GLOSSARY}
            />
          ),
    },
    {
      icon: Wallet,          title: 'Track your portfolio',
          body: (
            <GlossaryText
              text="Set up a portfolio, follow the built-in strategies, and receive their signals as a second opinion."
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
      <span className="tsg-kicker">One distinction</span>
      <h1 className="tsg-title">Investing vs trading</h1>
      <p className="tsg-lede">
        These two words describe how long you hold an investment. Every strategy on SLTP
        is labelled one way or the other.
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
        Each page has a written guide at the bottom. The Performance page explains
        candlesticks, and the Strategies page explains how to read a backtest.
      </p>
      <p className="tsg-body">
        If something is unfamiliar, scroll down. It is usually explained there.
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
  /** The page sits behind a sign-in, so the tour needs an account */
  requiresAuth?: boolean;
  /** Waits for the page to finish loading before the first step is shown */
  prepare?: () => Promise<void>;
  /** Replaces the standard closing popover */
  closing?: DriveStep;
}

/* ============================================================
   Lab helpers

   The Lab reads its workspaces from the server, so the tour has to wait
   for the list before it knows what it can point at.
   ============================================================ */

/** Waits for the Lab list to settle, so the tour knows whether there is a
    project to open. It resolves either way, it never hangs the tour. */
function waitForLabList(): Promise<void> {
  return new Promise((resolve) => {
    const deadline = Date.now() + 4000;
    const check = () => {
      const list = document.querySelector('.lab-ws-list');
      const settled = list && !list.textContent?.includes('Loading');
      if (settled || Date.now() > deadline) resolve();
      else window.setTimeout(check, 120);
    };
    check();
  });
}

/** True when at least one workspace holds a project. */
function labHasProjects(): boolean {
  return Array.from(document.querySelectorAll('.lab-ws-badge')).some(
    (badge) => !badge.textContent?.trim().startsWith('0'),
  );
}

/** Opens the first project in the Lab list: expands the first workspace,
    clicks its first project, then waits for the editor to mount. */
function openFirstLabProject(instance: Driver): void {
  const deadline = Date.now() + 8000;
  let expanded = false;
  const attempt = () => {
    /* The editor is already open, so there is nothing left to click. */
    if (document.querySelector('.lab-explorer')) {
      instance.moveNext();
      return;
    }
    const open = document.querySelector<HTMLElement>('.lab-ws-strategy-open');
    if (open) {
      open.click();
      waitForLabEditor(instance);
      return;
    }
    if (!expanded) {
      const toggle = document.querySelector<HTMLElement>('.lab-ws-group .lab-ws-row-main');
      if (toggle) {
        toggle.click();
        expanded = true;
      }
    }
    if (Date.now() > deadline) {
      instance.moveNext();
      return;
    }
    window.setTimeout(attempt, 250);
  };
  window.setTimeout(attempt, 250);
}

/** Waits for the editor frame, then moves the tour on to it. */
function waitForLabEditor(instance: Driver): void {
  const deadline = Date.now() + 10000;
  const check = () => {
    if (document.querySelector('.lab-explorer') || Date.now() > deadline) {
      instance.moveNext();
      return;
    }
    window.setTimeout(check, 200);
  };
  window.setTimeout(check, 300);
}

/** The Docs link in the top bar, so the last step can point at it. */
function findDocsNav(): Element | null {
  const links = Array.from(document.querySelectorAll<HTMLElement>('.header-nav .nav-link'));
  return links.find((link) => link.textContent?.trim() === 'Docs') ?? null;
}

const PAGE_TOURS: PageTour[] = [
  {
    tab: 'portfolio',
    label: 'Portfolio',
    blurb: 'Your settings, watchlist, and preferences.',
    steps: null,
  },
  {
    tab: 'strategies',
    label: 'Strategies',
    blurb: 'The strategy library: rules, reasoning, and backtests.',
    steps: () => [
      {
        element: '.strategies-hero-copy',
        popover: {
          title: 'Strategies page',
          description:
            'The full strategy library: every strategy SLTP publishes, with its rules and backtests.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '.strategies-stats-row',
        popover: {
          title: 'Library summary',
          description:
            'How many strategies are published, how many periods they were tested over, and what they are compared against.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '.wireframe-card',
        popover: {
          title: 'Strategy cards',
          description:
            'Each card shows the strategy\u2019s style, how active it is, and how often it rebalances. Click to expand.',
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '.strategies-list',
        popover: {
          title: 'The full write-up',
          description:
            'Expanding a card shows the reasoning behind the strategy, the rules it follows, and its backtest against simply buying and holding.',
          side: 'top',
          align: 'center',
        },
      },
    ],
  },
  {
    tab: 'performance',
    label: 'Performance',
    blurb: 'Price charts for any stock, plus the strategy backtest runner.',
    steps: () => [
      {
        element: '.perf-hero-copy',
        popover: {
          title: 'Performance page',
          description:
            'Price charts for any stock, and a backtest runner for the built-in strategies.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '.ticker-search',
        popover: {
          title: 'Search a ticker',
          description:
            'Type a short code such as AAPL. The list filters as you type.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '.timeframe-group',
        popover: {
          title: 'Timeframe',
          description:
            '1Y, 2Y, 5Y, or all available history. The chart redraws for the span you pick.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '.perf-chart-wrapper',
        popover: {
          title: 'Price chart',
          description:
            'One candle per trading day. Green means the close was above the open, red means it was below.',
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '.guide',
        popover: {
          title: 'Chart guide',
          description:
            'A written guide to candlesticks sits under the chart, with diagrams.',
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '.mode-switch',
        popover: {
          title: 'Two modes',
          description:
            'Stocks shows one price chart at a time. Strategies runs full backtests. Switching now.',
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
          title: 'Backtest runner',
          description:
            'Replays a chosen strategy over real market history and reports the result.',
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
          title: 'Set up the run',
          description:
            'Choose a strategy and a start date, optionally an end date, then press Run Analysis.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '.strategy-card .empty-state',
        popover: {
          title: 'Results appear here',
          description:
            'After a run, this area shows the equity curve and a metrics panel for the strategy.',
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
    /* The Lab keeps its files on an account, so the tour needs a sign-in. */
    requiresAuth: true,
    prepare: waitForLabList,
    steps: () => {
      const home: DriveStep[] = [
        {
          element: '.lab-hero-copy',
          /* The list steps live on the Lab page. Once the tour opens a
             project the editor takes over, so these steps are skipped
             instead of pointing at nothing. */
          skipMissingElement: true,
          popover: {
            title: 'The Lab',
            description:
              'Where you write and backtest your own strategies. Each project opens in its own editor.',
            side: 'bottom',
            align: 'start',
          },
        },
        {
          element: '.lab-start .lab-card',
          skipMissingElement: true,
          popover: {
            title: 'New project',
            description:
              'Create a project: give it a name, pick a workspace, and choose a template.',
            side: 'right',
            align: 'start',
          },
        },
        {
          element: '.lab-ws-toolbar',
          skipMissingElement: true,
          popover: {
            title: 'Workspaces',
            description:
              'Your projects are grouped into workspaces. Press / to jump to the search box.',
            side: 'bottom',
            align: 'start',
          },
        },
        {
          element: '.lab-ws-list',
          skipMissingElement: true,
          popover: {
            title: 'Projects',
            description:
              'All your projects. Open a workspace, then click a project to open it.',
            side: 'top',
            align: 'center',
          },
        },
      ];

      /* Nothing to open yet: send the reader to the project card instead of
         walking them through an editor that has no project behind it. */
      if (!labHasProjects()) {
        home.push({
          element: '.lab-start .lab-card',
          popover: {
            title: 'No projects yet',
            description:
              'Create one from the card on the left. The next tour walks through the editor.',
            side: 'right',
            align: 'start',
          },
        });
        return home;
      }

      return [
        ...home,
        {
          element: '.lab-ws-list',
          skipMissingElement: true,
          popover: {
            title: 'Opening a project',
            description:
              'Opening one so you can see the editor.',
            side: 'top',
            align: 'center',
            onNextClick: (_element, _step, opts) => {
              openFirstLabProject(opts.driver);
            },
          },
        },
        {
          element: '.lab-explorer',
          waitForElement: 3000,
          skipMissingElement: true,
          popover: {
            title: 'Project files',
            description:
              'core/ holds the strategy classes SLTP provides and cannot be edited. Your own code goes in workspace/.',
            side: 'right',
            align: 'start',
          },
        },
        {
          element: '.lab-explorer-tools',
          waitForElement: 3000,
          skipMissingElement: true,
          popover: {
            title: 'Add files',
            description:
              'Import folder copies Python files from a folder on this computer. The plus button creates a new file.',
            side: 'bottom',
            align: 'start',
          },
        },
        {
          element: '.lab-editor-surface',
          waitForElement: 3000,
          skipMissingElement: true,
          popover: {
            title: 'Editor',
            description:
              'Where you write your code. Pyright checks the file as you type.',
            side: 'top',
            align: 'center',
          },
        },
        {
          element: '.lab-statusbar',
          waitForElement: 3000,
          skipMissingElement: true,
          popover: {
            title: 'Status bar',
            description:
              'On the left, whether Pyright is running and how many errors it found. On the right, the terminal and cursor position.',
            side: 'top',
            align: 'center',
          },
        },
      ];
    },
    closing: {
      element: () => findDocsNav() as Element,
      popover: {
        title: 'Documentation',
        description:
          'The Docs page lists every method you can override, with worked examples. The Docs link is in the top bar.',
        side: 'bottom',
        align: 'center',
        doneBtnText: 'Finish tour',
      },
    },
  },
];

/** Centered popover that closes every tour */
function closingStep(onDone: () => void): DriveStep {
  return {
    /* No element: a centered popover */
    popover: {
      title: 'Guides',
      description:
        'Each page has a written guide at the bottom. That is the end of the tour.',
      doneBtnText: 'Finish tour',
      onNextClick: onDone,
    },
  };
}

function SlideTour({
  onNavigate,
  onTourActiveChange,
  onFinish,
  isSignedIn,
}: {
  onNavigate: (tab: string) => void;
  onTourActiveChange: (active: boolean) => void;
  onFinish: () => void;
  isSignedIn: boolean;
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

      const finish = () => {
        driverRef.current?.destroy();
        setTourState(false);
        onFinish();
      };

      /* Give the target page a moment to mount, then spotlight it */
      window.setTimeout(() => {
        const build = () => {
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
            /* A page can bring its own closing popover, but it still has to
               close the tour when the reader is done. */
            tour.closing
              ? { ...tour.closing, popover: { ...tour.closing.popover, onNextClick: finish } }
              : closingStep(finish),
          ]);
          driverRef.current.drive();
        };
        /* Some pages load their content, and the tour waits for it so the
           first step lands on something real. */
        if (tour.prepare) void tour.prepare().then(build);
        else build();
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
        Pick a page. It opens, and each part of it is pointed out in turn.
      </p>
      {tourActive ? (
        <p className="tsg-tour-note">
          {runningLabel} tour running. Use the arrows in the popup.
        </p>
      ) : (
        <div className="tsg-tour-picker">
          {PAGE_TOURS.map((tour) => {
            /* A tour of a page that needs an account cannot run for a
               visitor who is not signed in. */
            const locked = Boolean(tour.steps) && Boolean(tour.requiresAuth) && !isSignedIn;
            return (
              <div
                key={tour.tab}
                className={`tsg-tour-card ${tour.steps ? '' : 'is-unavailable'} ${locked ? 'is-locked' : ''}`}
              >
                <div className="tsg-tour-card-head">
                  <span className="tsg-tour-card-name">{tour.label}</span>
                  {tour.steps ? (
                    locked ? (
                      <button
                        type="button"
                        className="tsg-tour-card-btn is-disabled"
                        disabled
                        aria-describedby={`tsg-tour-lock-${tour.tab}`}
                      >
                        <Lock size={13} aria-hidden="true" />
                        Sign in
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="tsg-tour-card-btn"
                        onClick={() => startTour(tour)}
                      >
                        <MousePointerClick size={13} />
                        Tour
                      </button>
                    )
                  ) : (
                    <span className="tsg-tour-card-soon">Coming soon</span>
                  )}
                </div>
                <p className="tsg-tour-card-blurb">{tour.blurb}</p>
                {locked && (
                  <p className="tsg-tour-lock-hint" id={`tsg-tour-lock-${tour.tab}`}>
                    Sign in to tour the {tour.label}. Projects and files are saved to
                    your account.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Slideshow shell
   ============================================================ */

const CONTENT_SLIDES = 5; // welcome, how-to, theory, tour, final

export default function SiteGuide({ open, onClose, onNavigate, isSignedIn }: SiteGuideProps) {
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
      <Button variant="ghost" size="icon" onClick={close} aria-label="Close guide">
        <X size={16} />
      </Button>

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
            isSignedIn={Boolean(isSignedIn)}
            /* Finishing a tour returns to this picker slide (4 of 5) so
               another page tour can be started right away. */
            onFinish={() => setIndex(3)}
          />
        )}
        {index === 4 && <SlideFinal />}
      </div>

      <div className="tsg-footer">
        <Button variant="secondary" size="md" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={isFirst}>
          Back
        </Button>
        <span className="tsg-counter">{index + 1} / {CONTENT_SLIDES}</span>
        {isLast ? (
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              close();
              onNavigate('home');
            }}
          >
            Back to Home
          </Button>
        ) : (
          <Button variant="primary" size="md" onClick={() => setIndex((i) => i + 1)}>
            Next
          </Button>
        )}
      </div>
    </div>
  );
}
