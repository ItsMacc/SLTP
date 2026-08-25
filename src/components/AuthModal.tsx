import React, { useEffect } from 'react';
import { AuthCard } from './AuthCard';
import './AuthModal.css';

interface AuthModalProps {
  isOpen: boolean;
  initialMode: 'login' | 'signup';
  onClose: () => void;
  onSuccess: (user: { name: string; email: string }) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode,
  onClose,
  onSuccess,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="st-modal-backdrop" onClick={onClose}>
      <div className="st-modal-container" onClick={(e) => e.stopPropagation()}>
        <AuthCard
          initialMode={initialMode}
          onClose={onClose}
          onSuccess={(user) => {
            onSuccess(user);
            onClose();
          }}
        />
      </div>
    </div>
  );
};