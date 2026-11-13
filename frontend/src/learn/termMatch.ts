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

/**
 * Common words such as "high" and "share" are only useful glossary links in
 * one sense. These checks keep the ordinary sense as plain text.
 */
export function isFalsePositiveLink(
  key: string,
  matched: string,
  text: string,
  index: number,
): boolean {
  const lowerKey = key.toLowerCase();
  const after = text.slice(index + matched.length, index + matched.length + 32).trimStart().toLowerCase();
  const before = text.slice(Math.max(0, index - 32), index).toLowerCase();

  if (lowerKey === 'high' || lowerKey === 'low') {
    if (/(inflation|growth|volume|risk|cost|costs|margin|price|rate|rates|reading|score|volatility|turnover|exposure|leverage|demand)\s+$/.test(before)) {
      return true;
    }
    if (/(stays|remains|looks|seems|sits|trades|is|are|was|were)\s+$/.test(before)) {
      return true;
    }
    return !(
      /^(of|to|and|or|was|is|are|were|at|in|for|from|that|which|level|point|can|could|may|might|will|would|has|had)\b/.test(after)
      || /\b(day|new|old|52-week|all-time|session|swing|prior|previous|recent|next)\s*$/.test(before)
      || /\d+-day\s+$/.test(before)
      || /^[.,;:]/.test(after)
    );
  }

  if (lowerKey === 'long' || lowerKey === 'short') {
    if (/^(time|run|term|while|enough|list|test|period|sample|rise|fall|way|before|after|since|as|story|version|calm|trade list)\b/.test(after)) {
      return true;
    }
    return !/^(position|trade|investor|side|exposure|interest|squeeze|covering|seller|selling|sale|and|or|has|have|had|is|are|was|were|can|cannot|may|might|will|would|does|did|needs)\b/.test(after);
  }

  if (lowerKey === 'open' || lowerKey === 'close') {
    if (/(can|could|will|would|may|might|should|must|to|it|does|did|be|is|are|was|were|stay|stays|remain|remains|already)\s+$/.test(before)) {
      return true;
    }
    if (/^(position|positions|gain|profit|loss|risk|trade|trades|orders)\b/.test(after)) {
      return true;
    }
    const plural = matched.toLowerCase().endsWith('s');
    if (plural) {
      return !(
        /(the|a|daily|weekly|rising|falling|higher|lower|consecutive|recent|five|three|two|many|on|uses|use|from|between)\s+$/.test(before)
        || /^(suggest|are|were|and|or)\b/.test(after)
      );
    }

    return !(
      /(the|at|next|daily|day|today|market|previous|prior|opening|closing|signal|strong|weak|final|same|prior|previous|uses|use|on|from|between)\s+$/.test(before)
      || /^[.,;:]/.test(after)
      || /^(price|print|auction|gap|high|low|range|signal|position|positions|gain|profit|loss|risk|trade|trades|above|below|outside|to|and|of|or|-based)\b/.test(after)
    );
  }

  if (lowerKey === 'order') {
    return (
      /^of\b/.test(after)
      || /finding\s+$/.test(before)
      || /not the\s+$/.test(before)
      || /(fixed|same|random|reverse|alphabetical|chronological)\s+$/.test(before)
      || /^(matters|mattered|changes|is random|in which)\b/.test(after)
      || /^:\s*(the\s+)?sequence\b/.test(after)
    );
  }

  if (lowerKey === 'share' && matched.toLowerCase() === 'share') {
    if (/(each|per|every|one)\s+$/.test(before)) return false;
    return /^(of|in|the|same|a|its|their|our|your|his|her)\b/.test(after);
  }

  if (lowerKey === 'support') {
    return !(
      /^(is|level|zone|line|area|at|becomes|holds|broken|break|or)\b/.test(after)
      || /(at|below|above|test|tests|tested|hold|holds|break|breaks|find|finds)\s+$/.test(before)
    );
  }

  if (lowerKey === 'range') {
    return /^of\b/.test(after) && !/(price|trading|sideways|daily|52-week|day's|tight|wide)\s+$/.test(before);
  }

  return false;
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
