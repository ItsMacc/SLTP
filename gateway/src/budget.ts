// budget.ts — the one counter every market read passes through.
//
// A Durable Object is single-threaded per instance, and `reserve` is the whole
// check-and-increment in one turn, so two people pulling at the same instant
// cannot both slip under a ceiling: the second reservation sees the first.
// There is no queue to manage, because there is nothing to wait for — the
// decision is a comparison.
//
// The count lives in memory and is flushed to storage every FLUSH_EVERY
// reservations. Losing an eviction's worth of counts (at most 49) is smaller
// than the gap between the two ceilings, so the month can never overshoot in
// any way that matters. Reads the edge cache answers never get here.

import {
  EXISTING_LIMIT,
  HARD_LIMIT,
  decide,
  nextReset,
  windowId,
  type Decision,
} from './policy.ts';

/** Persist every Nth reservation: cheap, and at most this many are at risk. */
const FLUSH_EVERY = 50;

interface Storage {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
}

interface State {
  storage: Storage;
  blockConcurrencyWhile<T>(fn: () => Promise<T>): Promise<T>;
}

interface Stored {
  window: string;
  used: number;
}

export interface Reservation extends Decision {
  used: number;
  resetsAt: string;
}

export class Budget {
  private state: State;
  private window = '';
  private used = 0;
  private unflushed = 0;

  constructor(state: State) {
    this.state = state;
    // Load before the first request is delivered, so no reservation is
    // decided against an empty counter.
    state.blockConcurrencyWhile(async () => {
      const stored = await state.storage.get<Stored>('window');
      if (stored) {
        this.window = stored.window;
        this.used = stored.used;
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/status') {
      this.roll(new Date());
      return this.json(this.snapshot(new Date()));
    }
    if (url.pathname === '/release' && request.method === 'POST') {
      // A read that was reserved but never reached R2 (a 404, a thrown fetch).
      if (this.used > 0) {
        this.used -= 1;
        this.unflushed += 1;
        if (this.unflushed >= FLUSH_EVERY) await this.flush();
      }
      return this.json({ used: this.used });
    }
    if (url.pathname !== '/reserve' || request.method !== 'POST') {
      return this.json({ error: 'not found' }, 404);
    }

    const body = (await request.json().catch(() => ({}))) as { new?: unknown };
    const isNewDevice = body.new === true;
    const now = new Date();
    this.roll(now);

    const decision = decide(this.used, isNewDevice);
    if (decision.allowed) {
      this.used += 1;
      this.unflushed += 1;
      if (this.unflushed >= FLUSH_EVERY) await this.flush();
    }

    const reservation: Reservation = {
      ...decision,
      used: this.used,
      resetsAt: nextReset(now).toISOString(),
    };
    return this.json(reservation);
  }

  /** A new billing window starts at zero; the old count is not carried over. */
  private roll(now: Date): void {
    const id = windowId(now);
    if (this.window === id) return;
    this.window = id;
    this.used = 0;
    this.unflushed = 0;
    void this.state.storage.put('window', { window: id, used: 0 } satisfies Stored);
  }

  private async flush(): Promise<void> {
    this.unflushed = 0;
    await this.state.storage.put('window', { window: this.window, used: this.used } satisfies Stored);
  }

  private snapshot(now: Date) {
    return {
      window: windowId(now),
      used: this.used,
      existingLimit: EXISTING_LIMIT,
      hardLimit: HARD_LIMIT,
      resetsAt: nextReset(now).toISOString(),
    };
  }

  private json(value: unknown, status = 200): Response {
    return new Response(JSON.stringify(value), {
      status,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
}
