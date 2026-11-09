// Sltp404Page.tsx — Boilerplate placeholder for SLTP pages that have an
// address but no content yet (research, strategies, lab, learn).
//
// Every one of those tabs renders this until its real page is built. The
// card links on Home point at those addresses, so the tabs already work,
// deep-link and carry a proper document title — only the body is a stub.
import Button from '../ui/Button';
import './Sltp404Page.css';

interface Sltp404PageProps {
  page: string;
  onNavigate: (tab: string) => void;
}

export default function Sltp404Page({ page, onNavigate }: Sltp404PageProps) {
  return (
    <div className="sltp-404">
      <p className="sltp-404-eyebrow">SLTP</p>
      <h1 className="sltp-404-title">{page} is on its way</h1>
      <p className="sltp-404-copy">
        This page has an address but no content yet. We are building it now —
        check back soon.
      </p>
      <Button variant="primary" size="lg" onClick={() => onNavigate('home')}>
        Back to home
      </Button>
    </div>
  );
}
