// LessonBlocks.tsx — Renders the plain-text lesson blocks with glossary links.

import { GlossaryText } from '../../components/GlossaryText';
import { LEARN_GLOSSARY } from '../../learn/learnGlossary';
import type { ContentBlock } from '../../learn/types';
import { LessonWidget } from './Widgets';

const G = ({ children }: { children: string }) => (
  <GlossaryText text={children} glossary={LEARN_GLOSSARY} />
);

export function LessonBlocks({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <div className="learn-lesson-body">
      {blocks.map((block, index) => {
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
          return (
            <div className="learn-terms" key={index}>
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
        return (
          <figure className="learn-figure" key={index}>
            <LessonWidget id={block.widget} />
            <figcaption>{block.caption}</figcaption>
          </figure>
        );
      })}
    </div>
  );
}
