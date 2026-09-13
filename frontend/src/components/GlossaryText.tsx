import React, { useMemo, useState } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { type GlossaryTerm } from '../types/strategy';
import './GlossaryText.css';

interface GlossaryTextProps {
  text: string;
  glossary?: Record<string, string | GlossaryTerm>;
  className?: string;
}

export const GlossaryText: React.FC<GlossaryTextProps> = ({ text, glossary, className }) => {
  const [openTermKey, setOpenTermKey] = useState<string | null>(null);

  const parsedContent = useMemo(() => {
    if (!glossary || Object.keys(glossary).length === 0) {
      return text;
    }

    // 1. Build a normalized lookup map (converts underscores and spaces to single spaces)
    const termMap: Record<string, string> = {};
    Object.keys(glossary).forEach((key) => {
      const normalizedKey = key.replace(/[_ ]+/g, ' ').trim().toLowerCase();
      termMap[normalizedKey] = key;
    });

    // 2. Sort terms by length descending so longer phrases match first (e.g. "bear market" before "market")
    const sortedKeys = Object.keys(glossary).sort((a, b) => b.length - a.length);

    // 3. Build Regex matching spaces and underscores flexibly
    const regexPattern = sortedKeys
      .map((key) =>
        key
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
          .replace(/[_ ]+/g, '[_ ]+')             // Match spaces or underscores
      )
      .join('|');

    const regex = new RegExp(`\\b(${regexPattern})\\b`, 'gi');

    const parts: (string | React.ReactNode)[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const matchedText = match[0];
      const matchIndex = match.index;

      if (matchIndex > lastIndex) {
        parts.push(text.substring(lastIndex, matchIndex));
      }

      // Lookup original glossary key using normalized matched text
      const normalizedMatched = matchedText.replace(/[_ ]+/g, ' ').trim().toLowerCase();
      const originalKey = termMap[normalizedMatched] || matchedText;
      const termData = glossary[originalKey];

      const definition = typeof termData === 'string' ? termData : termData?.definition;
      const example = typeof termData === 'object' ? termData?.example : undefined;
      const itemKey = `${matchedText}-${matchIndex}`;
      const isOpen = openTermKey === itemKey;

      // Clean header title for tooltip
      const displayTitle = originalKey.replace(/_/g, ' ').trim();

      parts.push(
        <Tooltip.Provider key={itemKey} delayDuration={150}>
          <Tooltip.Root 
            open={isOpen} 
            onOpenChange={(open) => setOpenTermKey(open ? itemKey : null)}
          >
            <Tooltip.Trigger asChild>
              <button 
                className="trigger" 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
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
                {example && <span className="termExample">Ex: {example}</span>}
                <Tooltip.Arrow className="tooltipArrow" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      );

      lastIndex = matchIndex + matchedText.length;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts;
  }, [text, glossary, openTermKey]);

  return <span className={`textContainer ${className || ''}`}>{parsedContent}</span>;
};