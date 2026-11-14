// index.ts — the only reader of the market bucket.
//
// Once public access is off, every object leaves through this Worker, which is
// what makes a server-side ceiling possible at all: a public r2.dev URL cannot
// be capped from the browser, because nothing of ours sits in the path.
//
//   GET /v/<data-version>/<key>   one object, e.g. MARKET_DAILY/...parquet
//   GET /__gate/status            the counter, for the paused banner
//
// The cache answers first. A cache hit costs no R2 read and is served even when
// the window is closed, because it cannot move the number the ceiling guards.
// A miss asks the Durable Object to reserve one read, and only then touches R2.
//
// `?new=1` marks a device with an empty cache (its very first sync). Those
// requests may spend the reserve above EXISTING_LIMIT; everything else stops
// there. The flag is a hint, not a permission: lying about it only lets a
// client into a reserve that the hard ceiling still closes.
//
// Deploy, once the bucket is private and a domain exists:
//   npx wrangler deploy --config gateway/wrangler.jsonc
// Add a route such as `data.sltp.example/*` to that config and point
// R2_BASE_URL in frontend/src/store/sync.ts at it. Nothing here needs the
// bucket's public URL.

import { Budget } from './budget.ts';
import { pauseMessage } from './policy.ts';

export { Budget };

interface R2ObjectBody {
  body: ReadableStream<Uint8Array> | null;
  size: number;
  etag: string;
  httpMetadata?: { contentType?: string };
}

interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  head(key: string): Promise<{ size: number; etag: string } | null>;
}

interface BudgetStub {
  fetch(input: string, init?: RequestInit): Promise<Response>;
}

interface BudgetNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): BudgetStub;
}

interface Env {
  BUCKET: R2Bucket;
  BUDGET: BudgetNamespace;
}

interface Reservation {
  allowed: boolean;
  reason: 'existing' | 'hard' | null;
  limit: number;
  used: number;
  resetsAt: string;
}

/** One counter for the whole account: all versions, all files. */
const BUDGET_ID = 'r2-ops';
// `live` is the unversioned alias the Python engine uses for its small metadata
// files (META/version.txt, the catalog); the web app pins a data version.
const VERSION = /^\d{4}-\d{2}-\d{2}$|^live$/;
const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

// `caches.default` is Cloudflare's, not part of lib.dom's CacheStorage shape.
const EDGE = (caches as unknown as { default: Cache }).default;

const CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD, OPTIONS',
  'access-control-allow-headers': 'if-none-match',
  'access-control-expose-headers': 'etag, x-data-usage',
};

function json(value: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      ...CORS,
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extra,
    },
  });
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(CORS)) headers.set(name, value);
  return new Response(response.body, { status: response.status, headers });
}

function budget(env: Env): BudgetStub {
  return env.BUDGET.get(env.BUDGET.idFromName(BUDGET_ID));
}

async function reserve(env: Env, isNewDevice: boolean): Promise<Reservation> {
  const res = await budget(env).fetch('https://budget/reserve', {
    method: 'POST',
    body: JSON.stringify({ new: isNewDevice }),
  });
  if (!res.ok) throw new Error(`budget unavailable (${res.status})`);
  return (await res.json()) as Reservation;
}

/** A reserved read that never reached R2 is given back. */
async function release(env: Env): Promise<void> {
  try {
    await budget(env).fetch('https://budget/release', { method: 'POST' });
  } catch {
    // Losing one count is smaller than the reserve between the ceilings.
  }
}

function paused(reservation: Reservation): Response {
  const reason = reservation.reason === 'hard' ? 'hard' : 'existing';
  const retryAfter = Math.max(
    1,
    Math.ceil((Date.parse(reservation.resetsAt) - Date.now()) / 1000),
  );
  return json(
    {
      paused: true,
      reason,
      message: pauseMessage(reason, reservation.resetsAt),
      used: reservation.used,
      limit: reservation.limit,
      resetsAt: reservation.resetsAt,
    },
    503,
    { 'retry-after': String(retryAfter) },
  );
}

async function status(env: Env): Promise<Response> {
  const res = await budget(env).fetch('https://budget/status');
  return new Response(res.body, {
    status: res.status,
    headers: { ...CORS, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/** Bar chunks never change under one data version; the manifest and the
    unversioned alias do, because the next daily update replaces them. */
function cacheControl(key: string, version: string): string {
  if (version === 'live') return 'public, max-age=60';
  if (key.endsWith('META/manifest.json')) return 'public, max-age=30';
  if (key.endsWith('.parquet')) return 'public, max-age=31536000, immutable';
  return 'public, max-age=300';
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    const url = new URL(request.url);
    if (url.pathname === '/__gate/status') {
      try {
        return await status(env);
      } catch {
        return json({ error: 'gate unavailable' }, 503);
      }
    }

    // The manifest has to be reachable before the client knows a version, so it
    // sits outside /v/; everything it names is versioned from then on.
    let version: string;
    let encodedKey: string;
    const match = /^\/v\/([^/]+)\/(.+)$/.exec(url.pathname);
    if (url.pathname === '/manifest.json') {
      version = 'live';
      encodedKey = 'META/manifest.json';
    } else if (match) {
      version = match[1];
      encodedKey = match[2];
      if (!VERSION.test(version)) return json({ error: 'unknown data version' }, 404);
    } else {
      return json({ error: 'not found' }, 404);
    }

    const key = decodeURIComponent(encodedKey);
    if (!SAFE_KEY.test(key) || key.includes('..')) return json({ error: 'bad key' }, 400);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return json({ error: 'method not allowed' }, 405, { allow: 'GET, HEAD' });
    }

    // The cache key drops the `new` flag so a returning device and a first-time
    // device share the same edge copy.
    const cacheKey = new Request(`https://bucket.local/v/${version}/${encodedKey}`, { method: 'GET' });
    if (request.method === 'GET') {
      const hit = await EDGE.match(cacheKey);
      if (hit) {
        return withCors(
          new Response(hit.body, {
            status: hit.status,
            headers: { ...Object.fromEntries(hit.headers), 'x-data-usage': 'cached' },
          }),
        );
      }
    }

    let reservation: Reservation;
    try {
      reservation = await reserve(env, url.searchParams.get('new') === '1');
    } catch {
      return json({ paused: true, reason: 'unavailable', message: 'Market data is briefly unavailable.' }, 503);
    }
    if (!reservation.allowed) return paused(reservation);

    let size = 0;
    let etag = '';
    let body: ReadableStream<Uint8Array> | null = null;
    let contentType = 'application/octet-stream';
    try {
      if (request.method === 'HEAD') {
        const head = await env.BUCKET.head(key);
        if (!head) {
          await release(env);
          return json({ error: 'not found' }, 404);
        }
        size = head.size;
        etag = head.etag;
      } else {
        const object = await env.BUCKET.get(key);
        if (!object) {
          await release(env);
          return json({ error: 'not found' }, 404);
        }
        size = object.size;
        etag = object.etag;
        body = object.body;
        contentType = object.httpMetadata?.contentType ?? contentType;
      }
    } catch (error) {
      await release(env);
      throw error;
    }

    const headers = new Headers(CORS);
    headers.set('content-type', contentType);
    headers.set('content-length', String(size));
    headers.set('etag', etag);
    headers.set('cache-control', cacheControl(key, version));
    headers.set('x-data-usage', String(reservation.used));

    const response = new Response(body, { status: 200, headers });

    if (request.method === 'GET') {
      try {
        await EDGE.put(cacheKey, response.clone());
      } catch {
        // A body too large or a cache hiccup is not a failed download.
      }
    }
    return response;
  },
};
