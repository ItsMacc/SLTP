// RewardDialog.tsx — One calm reward moment after Finish lesson.

import { useEffect, useRef } from 'react';
import { BadgeCheck } from 'lucide-react';
import type { EarnedBadge } from '../../learn/useLearn';
import { iconFor } from '../../learn/badges';
import { Medal } from './Medal';

interface RewardDialogProps {
  badge: EarnedBadge;
  levelIndex: number;
  lastLesson: boolean;
  onNext: () => void;
  onSeeAll: () => void;
  onClose: () => void;
}

export function RewardDialog({
  badge,
  levelIndex,
  lastLesson,
  onNext,
  onSeeAll,
  onClose,
}: RewardDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    primaryRef.current?.focus({ preventScroll: true });

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="learn-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="learn-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reward-title"
        ref={dialogRef}
      >
        <Medal
          icon={iconFor('chart')}
          state="earned"
          size={120}
          levelIndex={levelIndex}
          label={`${badge.name}, earned`}
        />
        <p className="learn-dialog-kicker">
          <BadgeCheck size={16} aria-hidden="true" /> Badge earned
        </p>
        <h2 id="reward-title">{badge.name}</h2>
        <p>{badge.description}</p>
        <div className="learn-dialog-actions">
          <button type="button" className="learn-primary-button" onClick={onNext} ref={primaryRef}>
            {lastLesson ? 'Back to the level' : 'Next lesson'}
          </button>
          <button type="button" className="learn-secondary-button" onClick={onSeeAll}>
            See all badges
          </button>
        </div>
      </div>
    </div>
  );
}
