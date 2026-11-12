// pageTours.ts — the interactive tours behind "Take the tour" on the Research and
// Strategies slides of the site guide.
//
// Each tour spotlights the real page: driver.js dims everything, then walks the
// page section by section with a small popover. No copies of the UI, no mock
// screenshots, so a step can never drift away from the page it describes.
//
// The page has to be on screen before the first step runs, and the mode switch in
// Research has to finish rendering before the later steps point at anything, so
// both tours wait for their anchors instead of assuming the DOM is ready.

import { driver, type DriveStep, type Driver } from 'driver.js';

export type TourTab = 'strategies' | 'research';

/* ---------- Waiting ---------- */

/** Resolves with the element once it exists, or null when the wait runs out. */
function waitForElement(selector: string, timeout = 5000): Promise<Element | null> {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeout;
    const check = () => {
      const found = document.querySelector(selector);
      if (found) {
        resolve(found);
        return;
      }
      if (Date.now() > deadline) {
        resolve(null);
        return;
      }
      window.setTimeout(check, 80);
    };
    check();
  });
}

/** Clicks one of the two view buttons in the Research bar by its label. */
function clickModeSwitch(label: 'Stocks' | 'Strategies'): boolean {
  const options = Array.from(
    document.querySelectorAll<HTMLElement>('.mode-switch .seg-option'),
  );
  const target = options.find((option) => option.textContent?.trim() === label);
  if (!target) return false;
  target.click();
  return true;
}

/** Clicks the Backtests tab in the strategy card. */
function clickBacktestsTab(): boolean {
  const tabs = Array.from(document.querySelectorAll<HTMLElement>('.strat-tabs [role="tab"]'));
  const target = tabs.find((tab) => tab.textContent?.trim() === 'Backtests');
  if (!target) return false;
  target.click();
  return true;
}

/* ---------- Strategies ---------- */

const STRATEGY_STEPS = (): DriveStep[] => [
  {
    element: '.strat-head',
    popover: {
      title: 'The strategy library',
      description:
        'Every strategy SLTP publishes, written out the same way: the idea, the case for it, the case against it, and the settings the engine runs.',
    },
  },
  {
    element: '.strat-index',
    popover: {
      title: 'One strategy at a time',
      description:
        'This list holds all five. Choosing a row opens that strategy on the right and brings you back to the top of it, so you never land in the middle of an argument.',
    },
  },
  {
    element: '.strat-detail',
    popover: {
      title: 'The short version first',
      description:
        'The name, what it buys, and four facts: the horizon it needs, how busy it is, how many positions it holds, and how often it rebalances.',
    },
  },
  {
    element: '.strat-tabs',
    popover: {
      title: 'Three tabs',
      description:
        'Overview makes the case for the rules and against them. Mechanics lists what the engine actually runs. Backtests shows what those rules did, which is where we are going next.',
      onNextClick: (_element, _step, { driver: instance }) => {
        clickBacktestsTab();
        void waitForElement('.strat-window-cards').then(() => instance.moveNext());
      },
    },
  },
  {
    element: '.strat-window-cards',
    popover: {
      title: 'Eight fixed windows',
      description:
        'Four declines and four recoveries, the same eight for every strategy. Each chart starts both lines at 100 on the first session, so the strategy and the market are read on one scale.',
    },
  },
  {
    element: '.strat-window-card',
    popover: {
      title: 'Read the figures as a pair',
      description:
        'Under each chart the figures are shown for the strategy and, wherever there is a benchmark, for buy and hold as well, with the better of the two in green. Winning one row is not a verdict: a strategy can lead on return and still carry the deeper fall.',
    },
  },
  {
    element: '.strat-detail-foot',
    popover: {
      title: 'Then run it yourself',
      description:
        'This button opens Research with the strategy already picked, so you can put it over any dates you like and watch the equity curve build.',
    },
  },
];

/* ---------- Research ---------- */

const RESEARCH_STEPS = (): DriveStep[] => [
  {
    element: '.research-top',
    popover: {
      title: 'One page, two views',
      description:
        'Look up a single company, or put a whole strategy over a date range. Both run on the same market data and the same engine.',
    },
  },
  {
    element: '.ticker-search',
    popover: {
      title: 'Find a company',
      description:
        'Search by ticker or by name. The list underneath keeps the price beside each symbol, so you can scan before you commit.',
    },
  },
  {
    element: '.quote-panel',
    popover: {
      title: 'The numbers for the day',
      description:
        'Last price, the open and close, the day range and the volume. Everything here is read from the same daily history the chart draws.',
    },
  },
  {
    element: '.is-timeframe',
    popover: {
      title: 'How much history',
      description:
        'A week, a year, or the full record going back nearly three decades. The window you pick is the window the chart and every figure under it use.',
    },
  },
  {
    element: '.mode-switch',
    popover: {
      title: 'Now the other view',
      description:
        'The strategies view runs a published strategy over the dates you choose and reports every figure the engine records. We will switch to it.',
      onNextClick: (_element, _step, { driver: instance }) => {
        clickModeSwitch('Strategies');
        void waitForElement('.strategy-library').then(() => instance.moveNext());
      },
    },
  },
  {
    element: '.strategy-library',
    popover: {
      title: 'Pick a strategy',
      description:
        'The same five from the library. Choosing one sets what the engine will run, and the description says what it holds in one line.',
    },
  },
  {
    element: '.strategy-controls-bar',
    popover: {
      title: 'Set the dates, then run',
      description:
        'The range decides the test. A long run shows a full cycle, a short one shows how the rules behaved in a single stretch. Press run when the dates look right.',
    },
  },
  {
    element: '.strategy-workspace',
    popover: {
      title: 'What comes back',
      description:
        'The equity curve, the benchmark beside it, every recorded metric, and the trade list. A strategy that buys and never sells reports a win rate of zero while its curve climbs, which is why the guide below explains what to read first.',
    },
  },
];

/* ---------- Running ---------- */

const STEPS: Record<TourTab, () => DriveStep[]> = {
  strategies: STRATEGY_STEPS,
  research: RESEARCH_STEPS,
};

/**
 * Opens the tour for one page. The caller navigates first; this waits for the
 * page's opening anchor, then hands control to driver.js.
 */
/* One tour at a time. A second driver would draw its own overlay on top of the
   first and both would answer the same clicks, so the running one is torn down
   before another starts. */
let activeTour: Driver | null = null;

export function startPageTour(tab: TourTab): void {
  const steps = STEPS[tab]();
  const anchor = typeof steps[0]?.element === 'string' ? steps[0].element : null;

  activeTour?.destroy();
  activeTour = null;

  void (async () => {
    if (anchor) await waitForElement(anchor, 6000);
    const instance = driver({
      showProgress: true,
      progressText: '{{current}} of {{total}}',
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      doneBtnText: 'Done',
      popoverClass: 'tsg-driver-popover',
      /* Not smooth: driver waits for the scroll to settle before it draws the
         popover, and a sticky target like the strategy rail never moves, so the
         smooth version can leave the tour stuck with its popover hidden. */
      smoothScroll: false,
      onDestroyed: () => {
        if (activeTour === instance) activeTour = null;
      },
      steps,
    });
    activeTour = instance;
    instance.drive();
  })();
}
