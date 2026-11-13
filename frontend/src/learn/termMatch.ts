// termMatch.ts — One matcher for glossary tooltips and the term ledger.
// Terms match case-insensitively, allow flexible spaces and underscores, and
// accept a plural suffix. Longest terms win, so "stock market" beats "stock".

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normaliseTerm(value: string): string {
  return value.replace(/[_ ]+/g, ' ').trim().toLowerCase();
}

function termBody(key: string): string {
  return escapeRegExp(key).replace(/[_ ]+/g, '[_ ]+');
}

/** The pattern for one key, including its regular plural forms. */
export function keyPattern(key: string): string {
  const body = termBody(key);
  const lower = key.toLowerCase();
  const variants = [body];
  if (lower.endsWith('y') && !/[aeiou]y$/.test(lower)) {
    variants.push(`${body.slice(0, -1)}ies`);
  }
  return `(?:${variants.join('|')})(?:s|es)?`;
}

/** A global regex for a glossary, longest term first. */
export function glossaryRegex(keys: string[]): RegExp {
  const sorted = [...keys].sort((a, b) => b.length - a.length);
  return new RegExp(`\\b(${sorted.map(keyPattern).join('|')})\\b`, 'gi');
}

/** Resolve a matched string, including a plural, back to its glossary key. */
export function resolveGlossaryKey(matched: string, keys: string[]): string | null {
  const normalized = normaliseTerm(matched);
  const lookup = new Map(keys.map((key) => [normaliseTerm(key), key]));
  const candidates = [
    normalized,
    normalized.replace(/ies$/, 'y'),
    normalized.replace(/es$/, ''),
    normalized.replace(/s$/, ''),
  ];
  for (const candidate of candidates) {
    const hit = lookup.get(candidate);
    if (hit) return hit;
  }
  return null;
}

/** Every glossary key that appears in a piece of text. */
export function glossaryKeysIn(text: string, keys: string[]): string[] {
  const regex = glossaryRegex(keys);
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const key = resolveGlossaryKey(match[0], keys);
    if (key) found.add(key);
  }
  return [...found];
}
