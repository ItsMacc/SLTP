// Header.tsx — Top nav: brand, links, auth actions, mobile drawer
import { useState } from 'react';
import Button from '../ui/Button';
import UserMenu from './UserMenu';
import './Header.css';

interface HeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onAuthClick: (mode: 'login' | 'signup') => void;
  sessionUserName?: string | null;
  sessionUserEmail?: string | null;
  onSignOut: () => void;
  onSettingsClick: () => void;
}

const navItems = [
  { id: 'home', label: 'Home' },
  { id: 'invest', label: 'Invest' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'strategies', label: 'Strategies' },
  { id: 'performance', label: 'Performance' },
  { id: 'lab', label: 'Lab' },
  { id: 'docs', label: 'Docs' },
  { id: 'learn', label: 'Learn' },
];

export default function Header({ 
  activeTab, 
  onTabChange, 
  onAuthClick, 
  sessionUserName,
  sessionUserEmail, 
  onSignOut,
  onSettingsClick 
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleTabClick = (id: string) => {
    onTabChange(id);
    setMobileMenuOpen(false);
  };

  return (
    <header className="header-container">
      <div className="header-brand" onClick={() => handleTabClick('home')}>
        <span className="brand-title">SLTP</span>
      </div>

      <nav className="header-nav desktop-only">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-link ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => handleTabClick(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="header-actions">
        <div className="desktop-only auth-buttons-group">
          {sessionUserEmail ? (
            <UserMenu 
              userName={sessionUserName}
              userEmail={sessionUserEmail}
              onSettingsClick={onSettingsClick}
              onSignOut={onSignOut}
            />
          ) : (
            <>
              <Button variant="primary" size="md" onClick={() => onAuthClick('login')}>
                Sign In
              </Button>
              <Button variant="secondary" size="md" onClick={() => onAuthClick('signup')}>
                Sign Up
              </Button>
            </>
          )}
        </div>

        <button 
          type="button" 
          className={`hamburger-toggle ${mobileMenuOpen ? 'is-open' : ''}`}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle Navigation Menu"
        >
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="mobile-menu-drawer">
          <nav className="mobile-nav-list">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`mobile-nav-link ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => handleTabClick(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
          
          <div className="mobile-auth-group">            {sessionUserEmail ? (
              <>
                <div className="mobile-user-info">
                  {sessionUserName && (
                    <span className="mobile-user-name">{sessionUserName}</span>
                  )}
                  <span className="mobile-user-email">
                    Signed in as&nbsp;{sessionUserEmail}
                  </span>
                </div>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => { setMobileMenuOpen(false); onSettingsClick(); }}
                >
                  Settings
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => { setMobileMenuOpen(false); onSignOut(); }}
                >
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => { setMobileMenuOpen(false); onAuthClick('login'); }}
                >
                  Sign In
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => { setMobileMenuOpen(false); onAuthClick('signup'); }}
                >
                  Sign Up
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}