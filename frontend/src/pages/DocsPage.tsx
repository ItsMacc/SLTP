// DocsPage.tsx — The documentation site shell.
//
// Three columns on desktop: a collapsible group sidebar, one reading column, and
// an "On this page" rail. Each page has its own route under #/docs/<slug>, so
// links and back/forward work without a router or a server rewrite. The content
// itself lives in src/docs/pages; this file only frames it.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Menu,
  Moon,
  Search,
  Sun,
  X,
} from 'lucide-react';
import { BlockList } from '../docs/Blocks';
import { DOCS_GROUPS, VERSION } from '../docs';
import { groupOf, headingsOf, neighbours } from '../docs/types';
import type { Block } from '../docs/types';
import { applyTheme, saveUserTheme } from '../../lib/settings';
import './DocsPage.css';

interface DocsPageProps {
  /** Signed-in account, so the theme switch writes the same row Settings reads. */
  userId?: string | null;
}

const ROUTE_PREFIX = '#/docs/';
const FIRST_PAGE = 'introduction';
const REPO = 'https://github.com/ItsMacc/SLTP/blob/main/';

type PaletteHit = {
  kind: 'page' | 'heading';
  slug: string;
  title: string;
  context: string;
  search: string;
  anchor?: string;
};

/* ---------- Route ---------- */

function readRoute(): { slug: string; anchor: string | null } {
  const raw = window.location.hash.startsWith(ROUTE_PREFIX)
    ? window.location.hash.slice(ROUTE_PREFIX.length)
    : '';
  const [slug, anchor] = raw.split('#');
  return { slug: slug ?? '', anchor: anchor || null };
}

/* ---------- Search index ---------- */

/** Flatten the prose inside a block's JSX so body terms are searchable. */
function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(' ');
  if (typeof node === 'object' && 'props' in node) {
    return textOf((node as { props?: { children?: ReactNode } }).props?.children);
  }
  return '';
}

function blockText(block: Block): string {
  switch (block.kind) {
    case 'h2':
    case 'h3':
      return block.text;
    case 'p':
      return textOf(block.text);
    case 'ul':
    case 'ol':
      return block.items.map(textOf).join(' ');
    case 'callout':
      return [block.title, textOf(block.text)].filter(Boolean).join(' ');
    case 'table':
      return block.rows.flat().map(textOf).join(' ');
    case 'params':
      return block.rows
        .map((row) => [row.name, row.type, row.fallback, textOf(row.description)].filter(Boolean).join(' '))
        .join(' ');
    case 'cards':
      return block.items
        .map((item) => [item.title, textOf(item.text), item.badge].filter(Boolean).join(' '))
        .join(' ');
    case 'tabs':
      return block.tabs.map((tab) => tab.blocks.map(blockText).join(' ')).join(' ');
    case 'code':
      return [block.file, block.code].filter(Boolean).join(' ');
    default:
      return '';
  }
}

const SEARCH_INDEX: PaletteHit[] = DOCS_GROUPS.flatMap((group) =>
  group.pages.flatMap((page) => {
    const pageText = [page.title, page.lead, ...page.blocks.map(blockText)].join(' ');
    return [
      { kind: 'page' as const, slug: page.slug, title: page.title, context: group.title, search: pageText },
      ...headingsOf(page.blocks).map((heading) => ({
        kind: 'heading' as const,
        slug: page.slug,
        title: heading.text,
        context: page.title,
        search: heading.text,
        anchor: heading.id,
      })),
    ];
  }),
);

/* ---------- Sidebar ---------- */

interface SidebarProps {
  slug: string;
  openGroups: Record<string, boolean>;
  onToggleGroup: (id: string) => void;
  onGo: (slug: string) => void;
}

function Sidebar({ slug, openGroups, onToggleGroup, onGo }: SidebarProps) {
  return (
    <nav className="docs-nav" aria-label="Documentation">
      {DOCS_GROUPS.map((group) => {
        const open = openGroups[group.id] !== false;
        return (
          <div className="docs-nav-group" key={group.id}>
            <button
              type="button"
              className="docs-nav-group-title"
              onClick={() => onToggleGroup(group.id)}
              aria-expanded={open}
            >
              <ChevronRight
                size={12}
                aria-hidden
                className={open ? 'docs-nav-chevron is-open' : 'docs-nav-chevron'}
              />
              {group.title}
            </button>
            {open ? (
              <ul className="docs-nav-list">
                {group.pages.map((page) => (
                  <li key={page.slug}>
                    <button
                      type="button"
                      className={page.slug === slug ? 'docs-nav-link is-active' : 'docs-nav-link'}
                      onClick={() => onGo(page.slug)}
                      aria-current={page.slug === slug ? 'page' : undefined}
                    >
                      {page.title}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

/* ---------- Page ---------- */

export default function DocsPage({ userId }: DocsPageProps) {
  const [slug, setSlug] = useState(FIRST_PAGE);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [activeHeading, setActiveHeading] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem('sltp_docs_groups');
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  });

  const articleRef = useRef<HTMLElement | null>(null);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const paletteInput = useRef<HTMLInputElement | null>(null);
  const paletteOpener = useRef<HTMLElement | null>(null);
  const paletteScrollY = useRef(0);
  const searchTrigger = useRef<HTMLButtonElement | null>(null);

  const page = useMemo(
    () => DOCS_GROUPS.flatMap((group) => group.pages).find((item) => item.slug === slug)
      ?? DOCS_GROUPS[0].pages[0],
    [slug],
  );
  const group = groupOf(DOCS_GROUPS, page.slug);
  const headings = useMemo(() => headingsOf(page.blocks), [page]);
  const { previous, next } = useMemo(() => neighbours(DOCS_GROUPS, page.slug), [page.slug]);

  /* ----- Routing ----- */

  const go = useCallback((nextSlug: string, nextAnchor?: string) => {
    setNavOpen(false);
    setPaletteOpen(false);
    const target = `${ROUTE_PREFIX}${nextSlug}${nextAnchor ? `#${nextAnchor}` : ''}`;
    if (window.location.hash === target) {
      setAnchor(nextAnchor ?? null);
      return;
    }
    window.location.hash = target.replace(/^#/, '');
  }, []);

  useEffect(() => {
    const sync = () => {
      const route = readRoute();
      const exists = DOCS_GROUPS.some((item) => item.pages.some((entry) => entry.slug === route.slug));
      if (!route.slug || !exists) {
        history.replaceState(null, '', `${ROUTE_PREFIX}${FIRST_PAGE}`);
        setSlug(FIRST_PAGE);
        setAnchor(null);
        return;
      }
      setSlug(route.slug);
      setAnchor(route.anchor);
      // Back and forward must not leave the mobile drawer or palette over a new page.
      setNavOpen(false);
      setPaletteOpen(false);
    };

    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  // Keep the current page visible in the rail without moving the window.
  useEffect(() => {
    const rail = sidebarRef.current;
    const active = rail?.querySelector<HTMLElement>('.docs-nav-link.is-active');
    if (!rail || !active) return;
    const railBox = rail.getBoundingClientRect();
    const itemBox = active.getBoundingClientRect();
    if (itemBox.top < railBox.top || itemBox.bottom > railBox.bottom) {
      rail.scrollTop += itemBox.top - railBox.top - railBox.height / 3;
    }
  }, [slug]);

  // A new page starts at the top; a section link lands on its heading.
  useEffect(() => {
    if (anchor) {
      const frame = requestAnimationFrame(() => {
        document.getElementById(anchor)?.scrollIntoView({ block: 'start' });
      });
      return () => cancelAnimationFrame(frame);
    }
    window.scrollTo(0, 0);
  }, [slug, anchor]);

  /* ----- Theme ----- */

  useEffect(() => {
    const attribute = document.documentElement.getAttribute('data-theme');
    if (attribute === 'light' || attribute === 'dark') {
      setTheme(attribute);
      return;
    }
    setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    // Paint first, then store. saveUserTheme writes the account row that the
    // Settings page reads, so the two switches cannot disagree.
    applyTheme(nextTheme);
    setTheme(nextTheme);
    void saveUserTheme(nextTheme, userId);
  };

  /* ----- Scroll spy ----- */

  useEffect(() => {
    const onScroll = () => {
      if (headings.length === 0) return;
      let current: string | null = headings[0].id;
      for (const heading of headings) {
        const element = document.getElementById(heading.id);
        if (element && element.getBoundingClientRect().top <= 140) current = heading.id;
      }
      setActiveHeading(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [headings, page.slug]);

  /* ----- Palette ----- */

  // Opening search must not move the page, and closing it must leave the reader
  // exactly where they were. Removing a dialog that holds focus makes some
  // browsers scroll to the focused element, so the offset is saved and put back
  // by hand, and focus returns to the opener without scrolling to it.
  const openPalette = useCallback(() => {
    paletteScrollY.current = window.scrollY;
    paletteOpener.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setQuery('');
    setCursor(0);
    setPaletteOpen(true);
  }, []);

  const closePalette = useCallback((restoreScroll = true) => {
    // Safari scrolls to the document when the focused input is removed with the
    // dialog. `blur()` is what actually prevents it: focusing another element is
    // not enough, because the opener is often not focusable at all (Safari does
    // not focus a button on click), and a body that refuses focus leaves the
    // caret in the input. Blur first, then hand focus back if there is somewhere
    // real to put it.
    const active = document.activeElement;
    if (active instanceof HTMLElement && active !== document.body) active.blur();

    const opener = paletteOpener.current;
    const fallback = searchTrigger.current;
    if (opener?.isConnected && opener !== document.body) opener.focus({ preventScroll: true });
    else fallback?.focus({ preventScroll: true });

    setPaletteOpen(false);
    setQuery('');
    setCursor(0);

    if (!restoreScroll) return;
    // A backstop for engines that move the page anyway: put the offset back on
    // the next frame, once the dialog has been unmounted.
    const saved = paletteScrollY.current;
    requestAnimationFrame(() => window.scrollTo(0, saved));
  }, []);

  // Ranking: a title that starts with what was typed beats a title that starts
  // a word, which beats a match buried inside a word, which beats a match in the
  // group name. Without this, "h" surfaced "What is..." ahead of "Hooks".
  const hits = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return SEARCH_INDEX.filter((hit) => hit.kind === 'page').slice(0, 14);

    const scored = SEARCH_INDEX.map((hit, order) => {
      const title = hit.title.toLowerCase();
      let score = -1;
      if (title.startsWith(needle)) score = 0;
      else if (title.includes(` ${needle}`)) score = 1;
      else if (title.includes(needle)) score = 2;
      else if (hit.context.toLowerCase().includes(needle)) score = 3;
      else if (hit.search.toLowerCase().includes(needle)) score = 4;
      return { hit, order, score };
    });

    return scored
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => a.score - b.score || a.order - b.order)
      .slice(0, 14)
      .map((entry) => entry.hit);
  }, [query]);

  // Keep the highlight on a real row when the result list shrinks under it.
  const activeHit = hits.length === 0 ? -1 : Math.min(cursor, hits.length - 1);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (paletteOpen) closePalette();
        else openPalette();
      }
      if (event.key === 'Escape') {
        if (paletteOpen) {
          // Keep the browser from treating Escape as its own command on top of
          // the close, which is another way the page can jump.
          event.preventDefault();
          closePalette();
        }
        setNavOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [paletteOpen, openPalette, closePalette]);

  // While the dialog is open the page cannot scroll, so no engine can move it
  // when the input loses focus. The scrollbar gutter becomes padding so the
  // layout does not shift sideways as the bar disappears.
  useEffect(() => {
    if (!paletteOpen) return;
    const root = document.documentElement;
    const gutter = window.innerWidth - root.clientWidth;
    const previousOverflow = root.style.overflow;
    const previousPadding = document.body.style.paddingRight;

    root.style.overflow = 'hidden';
    if (gutter > 0) document.body.style.paddingRight = `${gutter}px`;
    paletteInput.current?.focus({ preventScroll: true });

    return () => {
      root.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPadding;
      // Unlocking is the one moment the page can still be given a position by
      // the browser, so state it explicitly. A page change runs its own scroll
      // effect afterwards and wins.
      window.scrollTo(0, paletteScrollY.current);
    };
  }, [paletteOpen]);

  const openHit = (hit: PaletteHit) => {
    // The new page brings its own scroll position, so do not put the old one back.
    closePalette(false);
    go(hit.slug, hit.anchor);
  };

  const onPaletteKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor((value) => Math.min(value + 1, hits.length - 1));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((value) => Math.max(value - 1, 0));
    }
    if (event.key === 'Enter' && activeHit >= 0) {
      event.preventDefault();
      openHit(hits[activeHit]);
    }
  };

  const toggleGroup = (id: string) => {
    setOpenGroups((current) => {
      const nextValue = { ...current, [id]: current[id] === false };
      try {
        localStorage.setItem('sltp_docs_groups', JSON.stringify(nextValue));
      } catch {
        // A browser with storage disabled just loses the memory of it.
      }
      return nextValue;
    });
  };

  return (
    <div className="docs">
      <a className="docs-skip" href={`${ROUTE_PREFIX}${page.slug}#docs-content`}>Skip to content</a>

      {/* ---------- Docs bar ---------- */}
      <div className="docs-bar">
        <div className="docs-bar-left">
          <button
            type="button"
            className="docs-icon-button docs-menu-button"
            onClick={() => setNavOpen(true)}
            aria-label="Open documentation menu"
          >
            <Menu size={18} aria-hidden />
          </button>
          <button
            type="button"
            className="docs-brand"
            onClick={() => go(FIRST_PAGE)}
            title="Start at the introduction"
          >
            <span className="docs-brand-name">SLTP Engine</span>
            <span className="docs-brand-version">{VERSION}</span>
          </button>
        </div>

        <div className="docs-bar-right">
          <button
            type="button"
            ref={searchTrigger}
            className="docs-search-trigger"
            onClick={openPalette}
            aria-label="Search documentation"
          >
            <Search size={14} aria-hidden />
            <span className="docs-search-label">Search</span>
            <kbd className="docs-kbd">⌘K</kbd>
          </button>
          <button
            type="button"
            className="docs-icon-button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Use light theme' : 'Use dark theme'}
          >
            {theme === 'dark' ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
          </button>
        </div>
      </div>

      <div className={headings.length > 0 ? 'docs-body' : 'docs-body no-toc'}>
        {/* ---------- Sidebar ---------- */}
        <aside className="docs-sidebar" ref={sidebarRef}>
          <Sidebar
            slug={page.slug}
            openGroups={openGroups}
            onToggleGroup={toggleGroup}
            onGo={go}
          />
        </aside>

        {/* ---------- Article ---------- */}
        <main className="docs-main" id="docs-content">
          <article className="docs-article" ref={articleRef}>
            <nav className="docs-breadcrumb" aria-label="Breadcrumb">
              <span>Docs</span>
              <ChevronRight size={11} aria-hidden />
              <span>{group?.title}</span>
              <ChevronRight size={11} aria-hidden />
              <span className="docs-breadcrumb-current">{page.title}</span>
            </nav>

            <h1 className="docs-h1">{page.title}</h1>
            <p className="docs-lead">{page.lead}</p>

            <div className="docs-content">
              <BlockList blocks={page.blocks} slug={page.slug} />
            </div>

            <nav className="docs-pager" aria-label="Previous and next pages">
              {previous ? (
                <button type="button" className="docs-pager-card" onClick={() => go(previous.slug)}>
                  <span className="docs-pager-label"><ArrowLeft size={12} aria-hidden /> Previous</span>
                  <span className="docs-pager-title">{previous.title}</span>
                </button>
              ) : <span />}
              {next ? (
                <button type="button" className="docs-pager-card is-next" onClick={() => go(next.slug)}>
                  <span className="docs-pager-label">Next <ArrowRight size={12} aria-hidden /></span>
                  <span className="docs-pager-title">{next.title}</span>
                </button>
              ) : null}
            </nav>

            <footer className="docs-footer">
              <span>{VERSION} · Last reviewed November 2026</span>
              <a
                className="docs-footer-link"
                href={`${REPO}${page.source ?? group?.source ?? 'frontend/src/docs'}`}
                target="_blank"
                rel="noreferrer"
              >
                Edit this page
              </a>
            </footer>
          </article>
        </main>

        {/* ---------- On this page ---------- */}
        {headings.length > 0 ? (
          <aside className="docs-toc" aria-label="On this page">
            <p className="docs-toc-title">On this page</p>
            <ul className="docs-toc-list">
              {headings.map((heading) => (
                <li key={heading.id} className={heading.level === 3 ? 'docs-toc-item is-nested' : 'docs-toc-item'}>
                  <button
                    type="button"
                    className={activeHeading === heading.id ? 'docs-toc-link is-active' : 'docs-toc-link'}
                    onClick={() => go(page.slug, heading.id)}
                  >
                    {heading.text}
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </div>

      {/* ---------- Mobile drawer ---------- */}
      {navOpen ? (
        <div className="docs-drawer-scrim" onClick={() => setNavOpen(false)} role="presentation">
          <div
            className="docs-drawer"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Documentation menu"
          >
            <div className="docs-drawer-head">
              <span className="docs-drawer-title">Docs</span>
              <button
                type="button"
                className="docs-icon-button"
                onClick={() => setNavOpen(false)}
                aria-label="Close menu"
              >
                <X size={16} aria-hidden />
              </button>
            </div>
            <Sidebar
              slug={page.slug}
              openGroups={openGroups}
              onToggleGroup={toggleGroup}
              onGo={go}
            />
          </div>
        </div>
      ) : null}

      {/* ---------- Command palette ---------- */}
      {paletteOpen ? (
        <div className="docs-palette-scrim" onClick={() => closePalette()} role="presentation">
          <div
            className="docs-palette"
            role="dialog"
            aria-modal="true"
            aria-label="Search documentation"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="docs-palette-input-row">
              <Search size={15} aria-hidden />
              <input
                ref={paletteInput}
                className="docs-palette-input"
                value={query}
                onChange={(event) => { setQuery(event.target.value); setCursor(0); }}
                onKeyDown={onPaletteKeyDown}
                placeholder="Search pages and headings"
                aria-label="Search pages and headings"
              />
              <kbd className="docs-kbd">esc</kbd>
            </div>

            <ul className="docs-palette-results">
              {hits.length === 0 ? (
                <li className="docs-palette-empty">Nothing matches “{query}”.</li>
              ) : hits.map((hit, index) => (
                <li key={`${hit.kind}-${hit.slug}-${hit.anchor ?? 'page'}`}>
                  <button
                    type="button"
                    className={index === activeHit ? 'docs-palette-hit is-active' : 'docs-palette-hit'}
                    // onMouseMove, not onMouseEnter: a list re-rendered under a
                    // resting pointer would steal the highlight from the keyboard.
                    onMouseMove={() => setCursor(index)}
                    onClick={() => openHit(hit)}
                  >
                    <span className="docs-palette-hit-title">{hit.title}</span>
                    <span className="docs-palette-hit-context">
                      {hit.kind === 'heading' ? `${hit.context} · section` : hit.context}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="docs-palette-foot">
              <span><kbd className="docs-kbd">↑</kbd><kbd className="docs-kbd">↓</kbd> navigate</span>
              <span><kbd className="docs-kbd">↵</kbd> open</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
