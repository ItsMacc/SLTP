import React, { useState } from 'react'
import './Header.css'

const navItems = [
  'Invest',
  'Strategies',
  'Performance',
  'Portfolio'
]

export interface UserProfile {
  name: string
  email: string
}

interface HeaderProps {
  user: UserProfile | null
  onNavigate: (page: string) => void
  onOpenAuth?: (mode: 'login' | 'signup') => void
  onLogout?: () => void
}

const Header: React.FC<HeaderProps> = ({ user, onNavigate, onOpenAuth, onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)

  const handleNavClick = (e: React.MouseEvent, item: string) => {
    e.preventDefault()
    setMenuOpen(false)
    onNavigate(item.toLowerCase())
  }

  return (
    <header className="st-header">
      <div className="st-header__inner">
        <div className="st-brand" onClick={() => onNavigate('home')} style={{ cursor: 'pointer' }}>
          Stocker
        </div>

        <button
          type="button"
          className={`st-menu-toggle ${menuOpen ? 'is-open' : ''}`}
          onClick={() => setMenuOpen((current) => !current)}
        >
          <span /><span /><span />
        </button>

        <nav className={`st-nav ${menuOpen ? 'is-open' : ''}`}>
          <ul className="st-nav__list">
            {navItems.map((item) => (
              <li key={item} className="st-nav__item">
                <a href={`#${item.toLowerCase()}`} onClick={(e) => handleNavClick(e, item)}>
                  {item}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="st-actions">
          {user ? (
            <div className="st-user-menu">
              <button type="button" className="st-user-btn" onClick={() => setUserDropdownOpen(!userDropdownOpen)}>
                <span className="st-user-avatar">{user.name.charAt(0).toUpperCase()}</span>
                <span className="st-user-name">{user.name}</span>
                <span className="st-user-arrow">▾</span>
              </button>

              {userDropdownOpen && (
                <div className="st-dropdown">
                  <a href="#portfolio" className="st-dropdown__item" onClick={(e) => { e.preventDefault(); setUserDropdownOpen(false); onNavigate('portfolio'); }}>Your Portfolio</a>
                  <a href="#strategies" className="st-dropdown__item" onClick={(e) => { e.preventDefault(); setUserDropdownOpen(false); onNavigate('strategies'); }}>Your Strategies</a>
                  <a href="#settings" className="st-dropdown__item" onClick={(e) => { e.preventDefault(); setUserDropdownOpen(false); onNavigate('settings'); }}>Settings</a>
                  <div className="st-dropdown__divider" />
                  <button type="button" className="st-dropdown__item st-dropdown__item--danger" onClick={() => { setUserDropdownOpen(false); onLogout?.(); }}>
                    Log Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <button className="st-btn st-btn--ghost" onClick={() => onOpenAuth?.('login')}>Log In</button>
              <button className="st-btn st-btn--primary" onClick={() => onOpenAuth?.('signup')}>Sign Up</button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header