// Medal.tsx — One medal for badges and certificates.

import type { LucideIcon } from 'lucide-react';
import { shapeForLevel } from '../../learn/badges';

export type MedalState = 'locked' | 'current' | 'earned';

interface MedalProps {
  icon: LucideIcon;
  state: MedalState;
  size: 24 | 36 | 56 | 120;
  levelIndex: number;
  label: string;
  pulse?: boolean;
}

export function Medal({ icon: Icon, state, size, levelIndex, label, pulse = false }: MedalProps) {
  const shape = shapeForLevel(levelIndex);
  const iconSize = Math.round(size * 0.44);
  return (
    <span
      className={`learn-medal learn-medal--${size} learn-medal--${state} learn-medal--${shape}${pulse ? ' is-pulsing' : ''}`}
      role="img"
      aria-label={label}
    >
      <span className={`learn-medal__shape learn-medal__shape--${shape}`}>
        <span className={`learn-medal__inner learn-medal__shape--${shape}`}>
          <Icon size={iconSize} strokeWidth={1.7} aria-hidden="true" />
        </span>
      </span>
    </span>
  );
}
