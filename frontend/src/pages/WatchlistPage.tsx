// WatchlistPage.tsx — Placeholder for the Watchlist page: a "coming soon"
// block that says what the page will offer when it launches.
//
// Still a stub (no real content behind it), but richer than the shared 404:
// it names the planned features so the Home card, the header and the footer
// can already link here.
import Button from '../ui/Button';
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

      <p className="watch-note">
        Everything here is for learning and research, not financial advice.
      </p>

      <Button variant="primary" size="lg" onClick={() => onNavigate('home')}>
        Back to home
      </Button>
    </div>
  );
}
