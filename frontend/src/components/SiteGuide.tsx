// SiteGuide.tsx — "See how SLTP works": a full-screen slideshow with a small
// close button in the corner. The first slide welcomes, the next three go
// page by page (Research, Strategies, Lab) with a small "Take the tour"
// action on each, and a final slide points to help. Plain sentences only:
// no glossary tooltips anywhere in here.
import { useCallback, useEffect, useState } from 'react';
import {
  X,
  LineChart,
  Layers,
  FlaskConical,
  Radar,
  MousePointerClick,
  LifeBuoy,
} from 'lucide-react';
import Button from '../ui/Button';
import { startPageTour, type TourTab } from '../pageTours';
import './SiteGuide.css';

export interface SiteGuideProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
  /** The slide on screen. Held here so a page tour can return to it. */
  index: number;
  onIndexChange: (index: number) => void;
  /** Reopens the guide on a slide after its page tour ends. */
  onOpenGuideAt: (index: number) => void;
}

/* ============================================================
   Slides 1-4: plain content slides
   ============================================================ */

function SlideWelcome() {
  return (
    <div className="tsg-slide-inner">
      <span className="tsg-kicker">Welcome to SLTP</span>
      <h1 className="tsg-title">
        What is SLTP?
      </h1>
      <p className="tsg-lede">
        SLTP is a stock-market research platform. The name stands for stop-loss
        take-profit, the two rules that decide when a position is cut and when a
        gain is banked. Here you can look up market data, read and backtest
        trading strategies, and work through a course that explains what all of
        it means.
      </p>
      <p className="tsg-body">
        SLTP is a research tool, not a broker. Nothing here places a real trade or moves
        real money. You look at real market data, test ideas against history, and
        practise with pretend cash.
      </p>
    </div>
  );
}

interface SlidePageProps {
  icon: typeof LineChart;
  title: string;
  body: string;
  ctaLabel: string;
  onCta?: () => void;
  /** The page is not ready yet, so its tour cannot run */
  disabled?: boolean;
  disabledNote?: string;
}

/* One slide per page: an icon, what the page does, and a small tour action.
   The Research, Strategies and Lab buttons open their page; the Watchlist
   button stays disabled until that page (and its tour) is ready. */
function SlidePage({ icon: Icon, title, body, ctaLabel, onCta, disabled, disabledNote }: SlidePageProps) {
  return (
    <div className="tsg-slide-inner">
      <span className="tsg-kicker">The pages</span>
      <span className="tsg-page-icon"><Icon size={24} strokeWidth={1.75} /></span>
      <h1 className="tsg-title">{title}</h1>
      <p className="tsg-lede">{body}</p>
      <div className="tsg-page-actions">
        <Button variant="primary" size="md" onClick={onCta} disabled={disabled}>
          <MousePointerClick size={16} className="tsg-cta-icon" />
          {ctaLabel}
        </Button>
        {disabled && disabledNote && (
          <p className="tsg-tour-note">{disabledNote}</p>
        )}
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
        The Research and Strategies pages each have a written guide at the
        bottom. Research explains candlesticks, and Strategies explains how to
        read a backtest.
      </p>
      <p className="tsg-body">
        If something is unfamiliar, scroll down. It is usually explained there.
      </p>
    </div>
  );
}

/* ============================================================
   Slideshow shell
   ============================================================ */

const CONTENT_SLIDES = 6; // welcome, research, strategies, lab, watchlist, final

export default function SiteGuide({ open, onClose, onNavigate, index, onIndexChange, onOpenGuideAt }: SiteGuideProps) {
  const [leaving, setLeaving] = useState(false);

  /* The slideshow fades out first, then hands over: closing lands on Home,
     a page tour button lands on that page. */
  const dismiss = useCallback((tab: string) => {
    setLeaving(true);
    window.setTimeout(() => {
      setLeaving(false);
      onClose();
      onNavigate(tab);
    }, 200);
  }, [onClose, onNavigate]);

  const close = useCallback(() => dismiss('home'), [dismiss]);

  /* A page tour needs the page on screen, so the slideshow closes first and the
     tour takes over once the page has mounted. The slide it was on is carried
     into the callback: however the tour ends, the reader lands back on that
     slide rather than at the welcome. */
  const takeTour = useCallback(
    (tab: TourTab) => {
      const returnIndex = index;
      setLeaving(true);
      window.setTimeout(() => {
        setLeaving(false);
        onClose();
        onNavigate(tab);
        startPageTour(tab, () => {
          onNavigate('home');
          onOpenGuideAt(returnIndex);
        });
      }, 200);
    },
    [index, onClose, onNavigate, onOpenGuideAt],
  );

  /* Escape closes the slideshow. Body scroll stays locked while it is open. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, close]);

  if (!open) return null;

  const isFirst = index === 0;
  const isLast = index === CONTENT_SLIDES - 1;

  return (
    <div
      className={`tsg-overlay ${leaving ? 'is-leaving' : ''}`}
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
            onClick={() => onIndexChange(i)}
          />
        ))}
      </div>

      <div className="tsg-stage" key={index}>
        {index === 0 && <SlideWelcome />}
        {index === 1 && (
          <SlidePage
            icon={LineChart}
            title="Research"
            body="Start with any company you're curious about and pull up decades of its market history. Every chart on SLTP is drawn from the same deep dataset: over 11,500 symbols going back 28 years. Choose whatever window matters to you, from a single earnings season to the full history, and when you're ready, run any of our premade strategies across those exact dates to see how it would have handled the markets you actually lived through."
            ctaLabel="Take the tour"
            onCta={() => takeTour('research')}
          />
        )}
        {index === 2 && (
          <SlidePage
            icon={Layers}
            title="Strategies"
            body="This is the library: every strategy SLTP publishes, with nothing hidden. Each one lays out its rules in plain language, shows you how it performed against its benchmark, and breaks its results across eight different market periods. Read them the way you'd interview a partner, and decide whether a strategy's style fits yours before you trust a single one of its signals."
            ctaLabel="Take the tour"
            onCta={() => takeTour('strategies')}
          />
        )}
        {index === 3 && (
          <SlidePage
            icon={FlaskConical}
            title="Lab"
            body="The Lab is where your own code lives: projects grouped into workspaces, a file explorer, an editor checked as you type, and a terminal beside it. Python runs in the browser, so Run works without a server; the strategy engine joins next."
            ctaLabel="Take the tour"
            onCta={() => takeTour('lab')}
          />
        )}
        {index === 4 && (
          <SlidePage
            icon={Radar}
            title="Watchlist"
            body="Once you know what you like, the Watchlist keeps an eye on it for you. Your followed stocks with live prices, the news that's moving them, and an alert whenever a strategy you trust issues a signal on one of your names. And while you watch, short explainers teach you what you're looking at, so the page trains your judgment instead of just feeding you tickers."
            ctaLabel="Take the tour"
            disabled
            disabledNote="The Watchlist tour opens when the Watchlist launches."
          />
        )}
        {index === 5 && <SlideFinal />}
      </div>

      <div className="tsg-footer">
        <Button variant="secondary" size="md" onClick={() => onIndexChange(Math.max(0, index - 1))} disabled={isFirst}>
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
          <Button variant="primary" size="md" onClick={() => onIndexChange(index + 1)}>
            Next
          </Button>
        )}
      </div>
    </div>
  );
}
