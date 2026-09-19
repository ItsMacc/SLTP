import type { LegalPageKind } from '../pages/LegalPage';
import './Footer.css';

interface FooterProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
  onLegalPage: (page: LegalPageKind) => void;
}

const navLinks = [
  { id: 'home', label: 'Home' },
  { id: 'invest', label: 'Invest' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'strategies', label: 'Strategies' },
  { id: 'performance', label: 'Performance' },
  { id: 'lab', label: 'Lab' },
];

export default function Footer({ activeTab, onNavigate, onLegalPage }: FooterProps) {
  return (
    <footer className="st-footer">
      <div className="st-footer-container">
        <div className="st-footer-grid">
          <div className="st-footer-brand">
            <span className="st-footer-brand-title" onClick={() => onNavigate('home')}>
              SLTP
            </span>
            <p className="st-footer-brand-tagline">
              A research-first platform for market analysis, strategy building, and informed
              investing.
            </p>
            <a className="st-footer-contact" href="mailto:legal.sltp@gmail.com">
              legal.sltp@gmail.com
            </a>
          </div>

          <nav className="st-footer-col" aria-label="Site navigation">
            <h4 className="st-footer-col-title">Navigate</h4>
            <ul className="st-footer-col-list">
              {navLinks.map((link) => (
                <li key={link.id}>
                  <button
                    type="button"
                    className={`st-footer-link ${activeTab === link.id ? 'is-active' : ''}`}
                    onClick={() => onNavigate(link.id)}
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <nav className="st-footer-col" aria-label="Legal">
            <h4 className="st-footer-col-title">Legal</h4>
            <ul className="st-footer-col-list">
              <li>
                <button
                  type="button"
                  className="st-footer-link"
                  onClick={() => onLegalPage('privacy')}
                >
                  Privacy Policy
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="st-footer-link"
                  onClick={() => onLegalPage('terms')}
                >
                  Terms of Service
                </button>
              </li>
            </ul>
          </nav>
        </div>

        <div className="st-footer-disclaimer">
          <span className="st-footer-disclaimer-label">Disclaimer</span>
          <p className="st-footer-disclaimer-text">
            SLTP provides research and educational content for informational purposes only.
            It is not intended to be a substitute for professional financial advice.
            Historical performance does not predict future performance, and all investing involves
            the risk of loss. Please do your due diligence before making any investment decisions.
            By using this website, you agree to our{' '}
            <button
              type="button"
              className="st-footer-inline-link"
              onClick={() => onLegalPage('terms')}
            >
              Terms
            </button>{' '}
            and{' '}
            <button
              type="button"
              className="st-footer-inline-link"
              onClick={() => onLegalPage('privacy')}
            >
              Privacy Policy
            </button>
            .
          </p>
        </div>

        <div className="st-footer-bottom">
          <span>© 2026 SLTP. All rights reserved.</span>
          <span>SLTP is for educational use only — not financial advice.</span>
        </div>
      </div>
    </footer>
  );
}