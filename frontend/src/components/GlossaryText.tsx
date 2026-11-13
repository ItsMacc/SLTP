// GlossaryText.tsx — Inline glossary terms with hover tooltip
import React, { useMemo, useState } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { type GlossaryTerm } from '../types/strategy';
import { glossaryRegex, resolveGlossaryKey } from '../learn/termMatch';
import { lessonTitleById } from '../learn/curriculum';
import './GlossaryText.css';

interface GlossaryTextProps {
  text: string;
  glossary?: Record<string, string | GlossaryTerm>;
  className?: string;
}

export const GlossaryText: React.FC<GlossaryTextProps> = ({ text, glossary, className }) => {
  const [openTermKey, setOpenTermKey] = useState<string | null>(null);

  const parsedContent = useMemo(() => {
    if (!glossary || Object.keys(glossary).length === 0) return text;

    const keys = Object.keys(glossary);
    const regex = glossaryRegex(keys);
    const parts: (string | React.ReactNode)[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const matchedText = match[0];
      const matchIndex = match.index;

      if (matchIndex > lastIndex) parts.push(text.substring(lastIndex, matchIndex));

      const originalKey = resolveGlossaryKey(matchedText, keys);
      const termData = originalKey ? glossary[originalKey] : undefined;
      if (!originalKey || !termData) {
        parts.push(matchedText);
        lastIndex = matchIndex + matchedText.length;
        continue;
      }

      const definition = typeof termData === 'string' ? termData : termData.definition;
      const example = typeof termData === 'object' ? termData.example : undefined;
      const introducedIn = typeof termData === 'object' ? termData.introducedIn : undefined;
      const itemKey = `${matchedText}-${matchIndex}`;
      const isOpen = openTermKey === itemKey;
      const displayTitle = originalKey.replace(/_/g, ' ').trim();

      parts.push(
        <Tooltip.Provider key={itemKey} delayDuration={150}>
          <Tooltip.Root open={isOpen} onOpenChange={(open) => setOpenTermKey(open ? itemKey : null)}>
            <Tooltip.Trigger asChild>
              <button
                className="trigger"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setOpenTermKey(isOpen ? null : itemKey);
                }}
              >
                {matchedText}
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className="tooltipContent" sideOffset={6} collisionPadding={12}>
                <span className="termHeader">{displayTitle}</span>
                <span className="termDefinition">{definition}</span>
                {example && <span className="termExample">Example: {example}</span>}
                {introducedIn && (
                  <span className="termExample">First taught in: {lessonTitleById(introducedIn)}</span>
                )}
                <Tooltip.Arrow className="tooltipArrow" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>,
      );

      lastIndex = matchIndex + matchedText.length;
    }

    if (lastIndex < text.length) parts.push(text.substring(lastIndex));
    return parts;
  }, [text, glossary, openTermKey]);

  return <span className={`textContainer ${className || ''}`}>{parsedContent}</span>;
};
