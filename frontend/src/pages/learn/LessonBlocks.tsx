// LessonBlocks.tsx — Renders the plain-text lesson blocks with glossary links.

import { GlossaryText } from '../../components/GlossaryText';
import { LEARN_GLOSSARY } from '../../learn/learnGlossary';
import type { ContentBlock } from '../../learn/types';
import { LessonWidget } from './Widgets';
import { layoutForLesson } from './lessonLayout';

const G = ({ children }: { children: string }) => (
  <GlossaryText text={children} glossary={LEARN_GLOSSARY} />
);

export function LessonBlocks({ blocks, lessonId }: { blocks: ContentBlock[]; lessonId: string }) {
  const layout = layoutForLesson(lessonId);
  const figureIndex = blocks.findIndex((block) => block.kind === 'figure');
  const figure = figureIndex >= 0 ? blocks[figureIndex] : undefined;
  const withoutFigure = blocks.filter((_, index) => index !== figureIndex);
  const figureAt = layout.figureAfter === undefined
    ? -1
    : Math.min(layout.figureAfter, withoutFigure.length);
  const ordered = figure && figureAt >= 0
    ? [...withoutFigure.slice(0, figureAt), figure, ...withoutFigure.slice(figureAt)]
    : blocks;

  return (
    <div className="learn-lesson-body">
      {ordered.map((block, index) => {
        if (block.kind === 'p') {
          return (
            <p className="learn-prose" key={index}>
              <G>{block.text}</G>
            </p>
          );
        }
        if (block.kind === 'h') {
          return (
            <h2 className="learn-chunk-heading" key={index}>
              {block.text}
            </h2>
          );
        }
        if (block.kind === 'list') {
          const Tag = block.ordered ? 'ol' : 'ul';
          return (
            <Tag className="learn-list" key={index}>
              {block.items.map((item) => (
                <li key={item}>
                  <G>{item}</G>
                </li>
              ))}
            </Tag>
          );
        }
        if (block.kind === 'callout') {
          return (
            <div className={`learn-callout learn-callout--${block.tone}`} key={index}>
              <p className="learn-callout-title">{block.title}</p>
              <p>
                <G>{block.text}</G>
              </p>
            </div>
          );
        }
        if (block.kind === 'terms') {
          if (layout.terms === 'none') return null;
          return (
            <div className={`learn-terms learn-terms--${layout.terms}`} key={index}>
              {block.items.map((item) => (
                <div className="learn-term" key={item.term}>
                  <p className="learn-term-name">{item.term}</p>
                  <p className="learn-term-text">
                    <G>{item.text}</G>
                  </p>
                </div>
              ))}
            </div>
          );
        }
        if (block.kind === 'formula') {
          return (
            <div className="learn-formula" key={index}>
              {block.title && <p className="learn-formula-title">{block.title}</p>}
              <dl className="learn-formula-list">
                {block.rows.map((row) => (
                  <div className="learn-formula-row" key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>
                      <code>{row.expression}</code>
                      {row.note && <span className="learn-formula-note">{row.note}</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        }
        return (
          <figure className="learn-figure" key={index}>
            <LessonWidget id={block.widget} />
          </figure>
        );
      })}
    </div>
  );
}
