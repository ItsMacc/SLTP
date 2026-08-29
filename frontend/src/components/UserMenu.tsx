// src/components/UserMenu.tsx
import { useState, useRef, useEffect } from 'react';
import './UserMenu.css';

interface UserMenuProps {
  userName?: string | null;
  userEmail?: string | null;
  onSettingsClick: () => void;
  onExtraOptionClick?: (option: string) => void;
  onSignOut: () => void;
}

export default function UserMenu({ 
  userName,
  userEmail, 
  onSettingsClick, 
  onExtraOptionClick, 
  onSignOut 
}: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fallback chain: uses name first, then email, then defaults safely
  const displayName = userName || userEmail || 'Account';
  const initial = displayName.charAt(0).toUpperCase();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="st-user-menu" ref={menuRef}>
      <button 
        type="button" 
        className="st-user-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label="User account menu"
      >
        <span className="st-user-avatar">{initial}</span>
        <span className="st-user-email-truncate">{displayName}</span>
        <span className="st-user-arrow">▼</span>
      </button>

      {isOpen && (
        <div className="st-dropdown">
          <div className="st-dropdown__header">
            {userName && <span className="st-dropdown__name" style={{ fontWeight: 600, display: 'block', marginBottom: '2px' }}>{userName}</span>}
            <span className="st-dropdown__signed-in-as">Signed in as</span>
            <span className="st-dropdown__email">{userEmail || 'user@example.com'}</span>
          </div>
          <div className="st-dropdown__divider"></div>
          
          <button 
            type="button" 
            className="st-dropdown__item"
            onClick={() => { setIsOpen(false); onSettingsClick(); }}
          >
            Settings
          </button>

          <button 
            type="button" 
            className="st-dropdown__item"
            onClick={() => { setIsOpen(false); onExtraOptionClick?.('portfolio'); }}
          >
            My Portfolios
          </button>

          <button 
            type="button" 
            className="st-dropdown__item"
            onClick={() => { setIsOpen(false); onExtraOptionClick?.('preferences'); }}
          >
            Preferences
          </button>

          <div className="st-dropdown__divider"></div>

          <button 
            type="button" 
            className="st-dropdown__item st-dropdown__item--danger"
            onClick={() => { setIsOpen(false); onSignOut(); }}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}