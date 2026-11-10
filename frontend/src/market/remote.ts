// remote.ts — where the browser's market data comes from.
//
// Today the R2 bucket is public, so era files download with a plain GET and
// no credentials exist anywhere in this bundle. When the bucket goes private,
// only resolveFileUrl changes: it will ask our own server to mint a
// short-lived URL per file, and the keys stay on the server. Nothing that
// reads, caches or queries data needs to change with it.

/** Public reader for the sltp-market-data bucket (mirrors sltp.data.remote). */
export const R2_BASE_URL =
  'https://pub-8fe125f9d291408d9a41fa5228a663e2.r2.dev';

/** Small file naming which chunks exist and what data version they belong to. */
export const MANIFEST_KEY = 'META/manifest.json';

export interface ManifestFile {
  key: string;
  bytes: number;
  rows: number;
  row_groups: number;
  first_session: string | null;
  last_session: string | null;
}

export interface Manifest {
  version: string;
  files: ManifestFile[];
}

/** The published dataset version, e.g. "2026-11-06". A few bytes. */
export async function fetchManifest(): Promise<Manifest> {
  const res = await fetch(`${R2_BASE_URL}/${MANIFEST_KEY}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Manifest fetch failed (${res.status})`);
  const manifest = (await res.json()) as Manifest;
  if (!manifest?.version || !Array.isArray(manifest.files)) {
    throw new Error('Manifest had an unexpected shape');
  }
  return manifest;
}

/**
 * The URL the browser downloads one file from. Public bucket: the file's own
 * address. Private bucket (future): ask our server for a short-lived signed
 * URL for this key — the R2 credentials never leave the server, and the
 * caller below keeps working unchanged.
 */
export async function resolveFileUrl(key: string): Promise<string> {
  return `${R2_BASE_URL}/${key}`;
}
