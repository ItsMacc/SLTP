// NotFoundPage.tsx — the public 404 used when an unknown route is opened.
import Button from '../ui/Button';
import './NotFoundPage.css';

interface NotFoundPageProps {
  onNavigate: (tab: string) => void;
}

export default function NotFoundPage({ onNavigate }: NotFoundPageProps) {
  return (
    <section className="notfound-page" aria-labelledby="notfound-title">
      <p className="notfound-eyebrow">404 / Not found</p>
      <h1 id="notfound-title" className="notfound-title">
        This page does not exist.
      </h1>
      <p className="notfound-copy">
        The address is unknown. The research engine, tested strategies, research tools
        and Lab are live.
      </p>
      <div className="notfound-actions">
        <Button variant="primary" size="md" onClick={() => onNavigate('strategies')}>
          Explore strategies
        </Button>
        <Button variant="secondary" size="md" onClick={() => onNavigate('lab')}>
          Open the Lab
        </Button>
      </div>
      <p className="notfound-meta">
        SLTP is a research engine first. Start from the strategies or the watchlist.
      </p>
    </section>
  );
}
