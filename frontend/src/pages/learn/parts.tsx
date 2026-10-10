// parts.tsx - Shared building blocks for the lesson modules.
//
// Every module follows the same teaching frame so the course reads as one
// course, not a pile of unrelated pages:
//
//   Objective  - what you will be able to do by the end (up front)
//   Content    - the idea, in plain language, built on what came before
//   Recap      - the few lines worth remembering
//
// Keep these presentational and dumb: state lives in each module.

import type { ReactNode } from 'react';
import { Check, ChevronRight, Lightbulb, Target } from 'lucide-react';

/** Advances a stepped lesson and pulls the reader back to its heading. */
export function Continue({ onClick, label = 'Continue', sectionId }: {
  onClick: () => void;
  label?: string;
  /** When set, scrolls this section's heading into view after advancing. */
  sectionId?: string;
}) {
  return (
    <button
      type="button"
      className="learn-continue"
      onClick={() => {
        onClick();
        if (sectionId) {
          document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }}
    >
      {label}
      <ChevronRight size={15} />
    </button>
  );
}

/** Highlighted aside: the instructor leaning in to make a point. */
export function Narrator({ icon: Icon = Lightbulb, children }: {
  icon?: typeof Lightbulb;
  children: ReactNode;
}) {
  return (
    <div className="learn-narrator">
      <span className="learn-narrator-icon"><Icon size={15} /></span>
      <p>{children}</p>
    </div>
  );
}

/** Opening statement of a module: the goal, stated as an ability. */
export function Objective({ children }: { children: ReactNode }) {
  return (
    <div className="learn-objective">
      <span className="learn-objective-tag"><Target size={13} /> Objective</span>
      <p>{children}</p>
    </div>
  );
}

/** Closing summary: the lines worth carrying into the next module. */
export function Recap({ title = 'Remember this', points }: {
  title?: string;
  points: ReactNode[];
}) {
  return (
    <div className="learn-recapcard">
      <p className="learn-recapcard-title">{title}</p>
      <ul>
        {points.map((p, i) => (
          <li key={i}><span className="learn-recapcard-tick"><Check size={13} /></span> <span>{p}</span></li>
        ))}
      </ul>
    </div>
  );
}

export function Money({ value, decimals = 2 }: { value: number; decimals?: number }) {
  return (
    <strong className="learn-money">
      ${value.toLocaleString(undefined, { maximumFractionDigits: decimals })}
    </strong>
  );
}