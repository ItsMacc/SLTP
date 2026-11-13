// GlossaryView.tsx — Every term, searchable, with the lesson that teaches it.

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { LEARN_GLOSSARY } from '../../learn/learnGlossary';
import { lessonById } from '../../learn/curriculum';
import type { Lesson } from '../../learn/types';

export function GlossaryView({ onOpenLesson }: { onOpenLesson: (lesson: Lesson) => void }) {
  const [query, setQuery] = useState('');
  const entries = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return Object.entries(LEARN_GLOSSARY)
      .filter(([term, data]) => {
        if (!needle) return true;
        return term.toLowerCase().includes(needle) || data.definition.toLowerCase().includes(needle);
      })
      .sort(([a], [b]) => a.localeCompare(b));
  }, [query]);

  return (
    <div className="learn-view learn-view--wide">
      <p className="learn-kicker">Reference</p>
      <h1 className="learn-level-title">Glossary</h1>
      <p className="learn-lead">Every term the course uses, with the lesson that teaches it first.</p>
      <label className="learn-search">
        <Search size={18} aria-hidden="true" />
        <span className="learn-visually-hidden">Search the glossary</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search a term"
        />
      </label>
      <div className="learn-glossary-grid">
        {entries.map(([term, data]) => {
          const lesson = data.introducedIn ? lessonById(data.introducedIn) : undefined;
          const clickable = Boolean(lesson && lesson.status === 'live');
          return (
            <article className="learn-glossary-entry" key={term}>
              <h2>{term}</h2>
              <p>{data.definition}</p>
              {data.example && <p className="learn-glossary-example">Example: {data.example}</p>}
              {lesson && (
                <button
                  type="button"
                  className="learn-text-link learn-glossary-link"
                  onClick={() => {
                    if (clickable && lesson) onOpenLesson(lesson);
                  }}
                  disabled={!clickable}
                >
                  First taught in {lesson.num}. {lesson.title}
                </button>
              )}
            </article>
          );
        })}
      </div>
      {!entries.length && <p className="learn-section-note">No term matches that search.</p>}
    </div>
  );
}
