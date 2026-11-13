// runSettings.ts — the dates and trading costs a Lab run uses.
//
// The defaults mirror the engine: a two-year window to the latest bar, a 0.1%
// fee, 0.05% slippage, no spread, no participation cap and no borrow cost.
// The dialog keeps its values as strings so a half-typed number does not snap
// back; these helpers convert them once, when the run starts.

const STORAGE_KEY = 'sltp.lab.runSettings';

export interface LabRunSettings {
  start: string;
  /** Empty means "run to the latest bar". */
  end: string;
  dividends: boolean;
  feePct: string;
  slippagePct: string;
  spreadPct: string;
  participationPct: string;
  borrowPct: string;
}

/** What the Python worker receives. Rates are fractions, dates are ISO. */
export interface EngineRunSettings {
  start: string;
  end: string | null;
  dividends: boolean;
  fee_rate: number;
  slippage_pct: number;
  spread_pct: number;
  max_participation: number | null;
  borrow_rate: number;
}

/** The engine's own costs, in the units the fields show (percent). */
export function defaultLabRunSettings(): LabRunSettings {
  const start = new Date();
  start.setDate(start.getDate() - 730);
  return {
    start: localDate(start),
    end: '',
    dividends: true,
    feePct: '0.1',
    slippagePct: '0.05',
    spreadPct: '0',
    participationPct: '',
    borrowPct: '0',
  };
}

export function toEngineSettings(settings: LabRunSettings): EngineRunSettings {
  const fraction = (value: string) => {
    const number = Number(value.trim() || '0');
    return Number.isFinite(number) && number > 0 ? number / 100 : 0;
  };
  const participation = settings.participationPct.trim();
  return {
    start: settings.start,
    end: settings.end || null,
    dividends: settings.dividends,
    fee_rate: fraction(settings.feePct),
    slippage_pct: fraction(settings.slippagePct),
    spread_pct: fraction(settings.spreadPct),
    max_participation: participation ? Number(participation) / 100 : null,
    borrow_rate: fraction(settings.borrowPct),
  };
}

/** The last settings used on this device, or the engine defaults. */
export function readLabRunSettings(): LabRunSettings {
  const defaults = defaultLabRunSettings();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const saved = JSON.parse(raw) as Partial<LabRunSettings> | null;
    if (!saved || typeof saved !== 'object') return defaults;
    return {
      ...defaults,
      ...saved,
      dividends: typeof saved.dividends === 'boolean' ? saved.dividends : defaults.dividends,
    };
  } catch {
    return defaults;
  }
}

/** Remembers the settings for the next run and the next visit. */
export function saveLabRunSettings(settings: LabRunSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Private browsing or a full quota: the run still uses the values in memory.
  }
}

/** A problem the user can fix, or null when the values are usable. */
export function validateLabRunSettings(settings: LabRunSettings): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(settings.start)) return 'Pick a start date.';
  if (settings.end && !/^\d{4}-\d{2}-\d{2}$/.test(settings.end)) {
    return 'Pick a valid end date, or clear it to run to the latest bar.';
  }
  if (settings.end && settings.end < settings.start) {
    return 'The end date must be after the start date.';
  }
  for (const [label, value] of [
    ['Fee', settings.feePct],
    ['Slippage', settings.slippagePct],
    ['Spread', settings.spreadPct],
    ['Borrow rate', settings.borrowPct],
  ] as const) {
    if (value.trim() === '') continue;
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return `${label} must be zero or more.`;
  }
  const participation = settings.participationPct.trim();
  if (participation !== '') {
    const number = Number(participation);
    if (!Number.isFinite(number) || number <= 0 || number > 100) {
      return 'Max participation must be above 0 and at most 100%.';
    }
  }
  return null;
}

function localDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
