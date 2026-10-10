// RewardToast.tsx - Bottom-right unlock popup, the celebratory twin of
// ErrorToast. Fires whenever a badge or trophy is earned, then auto-dismisses.

import { useEffect } from 'react';
import { Award, Sparkles, Star, X } from 'lucide-react';
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

  const Icon = earned.kind === 'trophy' ? Sparkles : earned.kind === 'milestone' ? Star : Award;
  const kicker = earned.kind === 'trophy'
    ? 'Trophy unlocked'
    : earned.kind === 'milestone'
      ? 'Milestone reached'
      : 'Badge earned';

  return (
    <div className={`reward-toast is-${earned.metal ?? earned.kind}`} role="status" aria-live="polite">
      <span className="reward-toast-icon"><Icon size={18} /></span>
      <div className="reward-toast-body">
        <p className="reward-toast-kicker">{kicker}</p>
        <p className="reward-toast-name">{earned.name}</p>
        <p className="reward-toast-detail">{earned.detail}</p>
      </div>
      <button type="button" className="reward-toast-close" onClick={onClose} aria-label="Dismiss">
        <X size={14} />
      </button>
    </div>
  );
}
