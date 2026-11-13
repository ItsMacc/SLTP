// LevelSwitcher.tsx — Text tabs, a lock for unopened levels, and Continue.

import type { RefObject } from 'react';
import { LockKeyhole } from 'lucide-react';
import { LEVELS } from '../../learn/curriculum';
import type { LearnProgress } from '../../learn/progress';

interface LevelSwitcherProps {
  activeId: string;
  progress: LearnProgress;
  counts: (level: (typeof LEVELS)[number]) => { done: number; total: number };
  onSelect: (id: string) => void;
  onContinue?: () => void;
  continueLabel?: string;
  innerRef?: RefObject<HTMLDivElement | null>;
}

export function LevelSwitcher({
  activeId,
  progress,
  counts,
  onSelect,
  onContinue,
  continueLabel,
  innerRef,
}: LevelSwitcherProps) {
  return (
    <div className="learn-switcher-shell" ref={innerRef}>
      <div className="learn-switcher">
        <div className="learn-switcher-tabs" role="tablist" aria-label="Course levels">
          {LEVELS.map((level, index) => {
            const count = counts(level);
            const previousOpen = index === 0 || progress.certifications.includes(LEVELS[index - 1].id);
            const locked = level.status === 'outline' || !previousOpen;
            return (
              <button
                key={level.id}
                type="button"
                role="tab"
                aria-selected={activeId === level.id}
                className={`learn-switcher-tab ${activeId === level.id ? 'is-active' : ''}`}
                onClick={() => onSelect(level.id)}
              >
                <span>{level.name}</span>
                <span className="learn-switcher-count">
                  {count.done}/{count.total}
                  {locked && <LockKeyhole size={13} aria-label="Locked" />}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            role="tab"
            aria-selected={activeId === 'workshops'}
            className={`learn-switcher-tab ${activeId === 'workshops' ? 'is-active' : ''}`}
            onClick={() => onSelect('workshops')}
          >
            <span>Workshops</span>
            <span className="learn-switcher-count">
              Planned
              <LockKeyhole size={13} aria-label="Planned" />
            </span>
          </button>
        </div>
        {onContinue && continueLabel && (
          <button type="button" className="learn-continue" onClick={onContinue}>
            {continueLabel}
          </button>
        )}
      </div>
    </div>
  );
}
