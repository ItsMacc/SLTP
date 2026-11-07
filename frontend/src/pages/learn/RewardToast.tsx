// RewardToast.tsx — Bottom-right popup, the celebratory twin of ErrorToast.
// Fires when a badge or a tier certificate is earned, then auto-dismisses.

import { useEffect } from 'react';
import { Award, Sparkles, X } from 'lucide-react';
import Button from '../../ui/Button';
import type { Earned } from '../../learn/useLearn';
import './RewardToast.css';

interface RewardToastProps {
  earned: Earned;
  onClose: () => void;
  autoDismissMs?: number;
}

export default function RewardToast({ earned, onClose, autoDismissMs = 6000 }: RewardToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, autoDismissMs);
    return () => clearTimeout(timer);
  }, [earned, onClose, autoDismissMs]);

  const Icon = earned.kind === 'certificate' ? Sparkles : Award;
  const kicker = earned.kind === 'certificate' ? 'Certificate earned' : 'Badge earned';

  return (
    <div className={`reward-toast is-${earned.metal ?? earned.kind}`} role="status" aria-live="polite">
      <span className="reward-toast-icon"><Icon size={18} /></span>
      <div className="reward-toast-body">
        <p className="reward-toast-kicker">{kicker}</p>
        <p className="reward-toast-name">{earned.name}</p>
        <p className="reward-toast-detail">{earned.detail}</p>
      </div>
      <Button variant="ghost" size="icon" onClick={onClose} aria-label="Dismiss">
        <X size={14} />
      </Button>
    </div>
  );
}
