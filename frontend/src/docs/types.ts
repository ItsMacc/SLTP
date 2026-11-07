// types.ts — The docs content model.
//
// Pages are data, not hand-written JSX. That buys three things the shell needs:
// headings can be collected for the "On this page" rail and the search index
// without rendering anything, every page gets the same type scale and spacing,
// and a page file reads like the document it produces.
//
// Prose is still JSX, so inline code and emphasis stay ordinary components.
import type { ReactNode } from 'react';

export type CalloutTone = 'note' | 'tip' | 'warning' | 'danger';

/** One row of a class or method parameter table. */
export interface ParamRow {
  name: string;
  type: string;
  fallback?: string;
  description: ReactNode;
}

export type Block =
  | { kind: 'h2' | 'h3'; id: string; text: string }
  | { kind: 'p'; text: ReactNode }
  | { kind: 'ul' | 'ol'; items: ReactNode[] }
  | { kind: 'code'; file?: string; language?: string; code: string }
  | { kind: 'callout'; tone: CalloutTone; title?: string; text: ReactNode }
  | { kind: 'table'; head: string[]; rows: ReactNode[][] }
  | { kind: 'params'; rows: ParamRow[] }
  | { kind: 'tabs'; tabs: { label: string; blocks: Block[] }[] }
  | { kind: 'cards'; items: { title: string; text: ReactNode; badge?: string }[] };

export interface DocPage {
  slug: string;
  title: string;
  lead: string;
  /** Repository file this page documents. Drives the "Edit this page" link. */
  source?: string;
  blocks: Block[];
}

export interface DocGroup {
  id: string;
  title: string;
  /** Default edit target for pages in the group. */
  source: string;
  pages: DocPage[];
}

/** A heading lifted out of a page, for the rail and the search index. */
export interface Heading {
  id: string;
  text: string;
  level: 2 | 3;
}

/** Walk every block, including tab panels, and collect its headings. */
export function headingsOf(blocks: Block[]): Heading[] {
  const headings: Heading[] = [];
  for (const block of blocks) {
    if (block.kind === 'h2' || block.kind === 'h3') {
      headings.push({ id: block.id, text: block.text, level: block.kind === 'h2' ? 2 : 3 });
    } else if (block.kind === 'tabs') {
      for (const tab of block.tabs) headings.push(...headingsOf(tab.blocks));
    }
  }
  return headings;
}

/** The page immediately before or after this one in reading order. */
export function neighbours(groups: DocGroup[], slug: string) {
  const pages = groups.flatMap((group) => group.pages);
  const index = pages.findIndex((page) => page.slug === slug);
  return {
    previous: index > 0 ? pages[index - 1] : null,
    next: index >= 0 && index < pages.length - 1 ? pages[index + 1] : null,
  };
}

/** The group a page belongs to. */
export function groupOf(groups: DocGroup[], slug: string): DocGroup | null {
  return groups.find((group) => group.pages.some((page) => page.slug === slug)) ?? null;
}
