// WatchlistPage.tsx — Placeholder for the Watchlist page: a "coming soon"
// block that says what the page will offer when it launches.
//
// Still a stub (no real content behind it), but richer than the shared 404:
// it names the planned features so the Home card, the header and the footer
// can already link here.
import Button from '../ui/Button';
import { prefetchOlder, useMarketSyncStatus } from '../store';
import './WatchlistPage.css';

interface WatchlistPageProps {
  onNavigate: (tab: string) => void;
}

const OFFERINGS: { title: string; text: string }[] = [
  {
    title: 'Your stocks, at a glance',
    text: 'Follow any ticker and see live quotes and the day\u2019s movement in one list, instead of hunting across tabs.',
  },
  {
    title: 'Market news that follows you',
    text: 'Headlines for the names you watch, gathered next to their prices so the story and the chart sit together.',
  },
  {
    title: 'Signal alerts from strategies you trust',
    text: 'Get a nudge when a strategy you follow issues a new signal on a stock on your list, with the rules behind it one click away.',
  },
  {
    title: 'Small insights for new investors',
    text: 'Short educational notes that build good habits: what a signal actually means, why spreading across names matters, how to read the rules before acting on a backtest.',
  },
];

function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

/** What the background download has staged so far, in plain words. */
function SyncStatusBlock() {
  const sync = useMarketSyncStatus();

  if (sync.phase === 'idle' || sync.phase === 'checking') {
    return (
      <div className="watch-sync">
        <h2 className="watch-offer-title">Market data</h2>
        <p className="watch-offer-text">Checking for the latest market data…</p>
      </div>
    );
  }

  if (sync.phase === 'degraded' || sync.phase === 'error') {
    return (
      <div className="watch-sync">
        <h2 className="watch-offer-title">Market data</h2>
        <p className="watch-offer-text">
          This browser could not keep a local copy ({sync.error ?? 'storage unavailable'}).
          Charts will fetch what they need when you open them.
        </p>
      </div>
    );
  }

  const pct = sync.bytesTotal > 0
    ? Math.min(100, Math.round((sync.bytesLoaded / sync.bytesTotal) * 100))
    : 0;
  const busy = sync.phase === 'priority' || sync.phase === 'prefetch';

  return (
    <div className="watch-sync">
      <h2 className="watch-offer-title">Market data</h2>
      <p className="watch-offer-text">
        {busy
          ? `Downloading market history into this browser… ${formatMB(sync.bytesLoaded)} of ${formatMB(sync.bytesTotal)} (${pct}%). Charts already work — older years fill in behind them.`
          : sync.olderDeferred
            ? `Recent history is cached in this browser (${sync.loadedFiles.length} of ${sync.totalFiles} files). The rest waits for an unmetered connection.`
            : sync.plan === 'full'
              ? `Full history is cached in this browser (${sync.loadedFiles.length} of ${sync.totalFiles} files, dataset ${sync.version}). Charts open instantly.`
              : `Recent history is cached in this browser (${sync.loadedFiles.length} of ${sync.totalFiles} files, dataset ${sync.version}). Charts open instantly.`}
      </p>
      {busy && (
        <div className="watch-sync-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="watch-sync-fill" style={{ width: `${pct}%` }} />
        </div>
      )}
      {!busy && sync.olderDeferred && (
        <Button variant="secondary" size="md" onClick={() => { void prefetchOlder(); }}>
          Download full history now
        </Button>
      )}
    </div>
  );
}

export default function WatchlistPage({ onNavigate }: WatchlistPageProps) {
  return (
    <div className="watch-page">
      <p className="watch-eyebrow">Coming soon!!!</p>
      <h1 className="watch-title">Watchlist</h1>
      <p className="watch-lede">
        Your market radar is on its way: the stocks you follow, the news around
        them, and signals from the strategies you trust, all in one place.
        Here is what it will offer when it launches.
      </p>

      <ul className="watch-offers">
        {OFFERINGS.map((offer) => (
          <li key={offer.title} className="watch-offer">
            <h2 className="watch-offer-title">{offer.title}</h2>
            <p className="watch-offer-text">{offer.text}</p>
          </li>
        ))}
      </ul>

      <SyncStatusBlock />

      <p className="watch-note">
        Everything here is for learning and research, not financial advice.
      </p>

      <Button variant="primary" size="lg" onClick={() => onNavigate('home')}>
        Back to home
      </Button>
    </div>
  );
}
