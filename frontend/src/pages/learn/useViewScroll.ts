// useViewScroll.ts — The only function that moves the window for Learn.
// After a view change, the new view starts directly below the sticky level bar.
// On the first overview, and on reference views, it starts at the very top.
// Pressing a level tab asks for the badge shelf instead, so the badges for that
// level are on screen rather than the lesson list below them.

import { useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';

// Learn decides where every view starts, including after a reload. Set this
// before the browser restores a saved offset; the App-level effect is later.
if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

export type LearnScrollMode = 'overview' | 'top' | 'switcher' | 'shelf';

export function useViewScroll(
  viewKey: string,
  mode: LearnScrollMode,
  switcherRef: RefObject<HTMLDivElement | null>,
  viewRef: RefObject<HTMLDivElement | null>,
  ready = true,
  shelfRef?: RefObject<HTMLElement | null>,
  shelfNonce = 0,
) {
  const first = useRef(true);

  useLayoutEffect(() => {
    if (!ready) return;
    const modeAtRun = mode;
    const firstAtRun = first.current;
    const run = () => {
      if (modeAtRun === 'top' || (modeAtRun === 'overview' && firstAtRun)) {
        window.scrollTo(0, 0);
      } else if (modeAtRun === 'shelf') {
        // The shelf owns its own scroll-margin-top, which clears the site header.
        shelfRef?.current?.scrollIntoView({ block: 'start', inline: 'nearest' });
      } else {
        const stickyHeight = switcherRef.current?.offsetHeight ?? 0;
        const viewTop = viewRef.current
          ? viewRef.current.getBoundingClientRect().top + window.scrollY
          : 0;
        window.scrollTo(0, Math.max(0, viewTop - stickyHeight));
      }
    };

    // A direct pass covers a background tab, where animation frames can be
    // suspended. The frame repeats the same target after layout settles and
    // marks the first pass done. Keeping that flag for the frame lets React's
    // development double-effect settle on the top, not the view anchor.
    run();
    const frame = requestAnimationFrame(() => {
      run();
      first.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [viewKey, mode, switcherRef, viewRef, ready, shelfRef, shelfNonce]);
}
