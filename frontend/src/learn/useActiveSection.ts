// useActiveSection.ts - Tracks which course landmark is currently on screen
// so the sidebar can highlight it.
//
// A scroll listener is used instead of an IntersectionObserver because short
// modules can sit entirely outside an observer's root margin band. The id
// list changes as modules unlock, so the listener re-binds whenever it does.

import { useEffect, useState } from 'react';

export function useActiveSection(ids: string[]): string {
  const [active, setActive] = useState(ids[0] ?? 'start');
  const key = ids.join('|');

  useEffect(() => {
    // Measuring every anchor on every scroll event forces a React render per
    // scroll frame, which reads as stutter while the page moves. Coalesce to
    // one measurement per animation frame, and only commit when the answer
    // actually changes - most scroll frames land on the same section.
    let frame = 0;

    const measure = () => {
      frame = 0;
      const offset = window.scrollY + 200;
      let current = ids[0] ?? 'start';
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top + window.scrollY;
        if (top <= offset) current = id;
      }
      setActive((prev) => (prev === current ? prev : current));
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return active;
}
