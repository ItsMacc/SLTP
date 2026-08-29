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
  { id: 'strategies', label: 'Strategies' },
  { id: 'performance', label: 'Performance' },
  { id: 'about', label: 'About' },
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
        <span className="brand-title">Stocker</span>
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
          
          <div className="mobile-auth-group">
            {sessionUserEmail ? (
              <>
                <div className="mobile-user-info" style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '0.5rem 0' }}>
                  {sessionUserName && (
                    <span style={{ fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
                      {sessionUserName}
                    </span>
                  )}
                  <span className="mobile-user-email-label" style={{ fontSize: '0.85rem', color: 'var(--text-muted, #64748b)' }}>
                    Signed in as&nbsp;{sessionUserEmail}
                  </span>
                </div>
                <Button 
                  variant="secondary" 
                  size="md" 
                  style={{ width: '100%' }}
                  onClick={() => { setMobileMenuOpen(false); onSettingsClick(); }}
                >
                  Settings
                </Button>
                <Button 
                  variant="primary" 
                  size="md" 
                  style={{ width: '100%' }}
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
                  style={{ width: '100%' }}
                  onClick={() => { setMobileMenuOpen(false); onAuthClick('login'); }}
                >
                  Sign In
                </Button>
                <Button 
                  variant="secondary" 
                  size="md" 
                  style={{ width: '100%' }}
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