import React from 'react'
import './Footer.css'

interface FooterProps {
  onNavigate?: (page: string) => void
}

const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, page: string) => {
    e.preventDefault()
    onNavigate?.(page)
  }

  return (
    <footer className="st-footer" role="contentinfo">
      <div className="st-footer__inner">
        <div className="st-footer__top">
          <div className="st-footer__brand">
            <p className="st-footer__copy">© 2026 Stocker</p>
          </div>

          <nav className="st-footer__nav" aria-label="Footer navigation">
            <a href="#invest" onClick={(e) => handleNavClick(e, 'invest')}>Invest</a>
            <a href="#strategies" onClick={(e) => handleNavClick(e, 'strategies')}>Strategies</a>
            <a href="#performance" onClick={(e) => handleNavClick(e, 'performance')}>Performance</a>
            <a href="#about" onClick={(e) => handleNavClick(e, 'about')}>About</a>
            <a href="#contact" onClick={(e) => handleNavClick(e, 'contact')}>Contact</a>
          </nav>

          {/* Standard HTML links opening in a new tab */}
          <div className="st-footer__links">
            <a href="/terms.html" target="_blank" rel="noopener noreferrer">Terms</a>
            <a href="/privacy.html" target="_blank" rel="noopener noreferrer">Privacy</a>
          </div>
        </div>

        <div className="st-footer__bottom">
          <p className="bottom-text">
            Stocker provides research and educational content for informational purposes only. It is not intended to be a substitute for professional financial advice. Historical performance does not predict future performance, and all investing involves the risk of loss. Please do your due diligence before making any investment decisions. By using this website, you agree to our Terms and Privacy Policy.
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer