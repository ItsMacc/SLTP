// tickerSidecar.ts — per-ticker binary cache derived from the era files.
//
// Parquet decode is the slow step (seconds of JS decompress + decode per
// file); reading typed arrays is the fast one (a memcpy). So after a
// chunk's symbol series is parsed once, it is stored here as a compact
// binary blob and every later visit reads the blob instead of the parquet.
//
// Layout (little-endian, matching the file's own dtypes — OHLCV are
// float32 in the source, Date is int32 days-since-epoch, so nothing is
// widened or narrowed):
//   u32 magic 'SLTP', u32 format (1), u32 row count,
//   int32[rows] dates, float32[rows * 5] open/high/low/close/volume.
// ~24 bytes a bar: a 7,000-bar history is under 200KB, and only tickers
// the visitor actually views ever take space. A dataset version bump
// orphans the previous version's directory, which is wiped on next use.

import type { Bar } from '../components/Chart';
import { getFile, putFile, removeDir } from './opfsCache';

const MAGIC = 0x534c5450; // 'SLTP'
const FORMAT = 1;
const HEADER_BYTES = 12;
const ROW_BYTES = 4 + 5 * 4;
const DAY_MS = 86_400_000;

const safe = (value: string): string => value.replace(/[^A-Za-z0-9]/g, '_');

const keyFor = (version: string, chunkKey: string, symbol: string): string =>
  `BARS/${safe(version)}/${safe(chunkKey)}/${safe(symbol)}.bin`;

const VERSION_MARKER = 'BARS/__version.txt';

let checkedVersion: string | null = null;

/** Wipes a previous dataset version's sidecars, once per page session. */
async function ensureCurrentVersion(version: string): Promise<void> {
  if (checkedVersion === version) return;
  checkedVersion = version;
  try {
    const marker = await getFile(VERSION_MARKER);
    const current = marker ? (await marker.text()).trim() : null;
    if (current === version) return;
    await removeDir('BARS');
    await putFile(VERSION_MARKER, new Blob([version], { type: 'text/plain' }));
  } catch {
    /* a stale sidecar is harmless — the parquet path still answers */
  }
}

function dayToISO(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/** The full sorted series for one chunk+symbol, or null on any miss. */
export async function readTickerSidecar(
  version: string,
  chunkKey: string,
  symbol: string,
): Promise<Bar[] | null> {
  try {
    await ensureCurrentVersion(version);
    const file = await getFile(keyFor(version, chunkKey, symbol));
    if (!file) return null;
    const buf = await file.arrayBuffer();
    if (buf.byteLength < HEADER_BYTES) return null;
    const view = new DataView(buf);
    if (view.getUint32(0, true) !== MAGIC || view.getUint32(4, true) !== FORMAT) return null;
    const count = view.getUint32(8, true);
    if (buf.byteLength !== HEADER_BYTES + count * ROW_BYTES) return null;
    const dates = new Int32Array(buf, HEADER_BYTES, count);
    const values = new Float32Array(buf, HEADER_BYTES + count * 4, count * 5);
    const out: Bar[] = new Array(count);
    for (let i = 0; i < count; i += 1) {
      out[i] = {
        date: dayToISO(dates[i]!),
        open: values[i * 5]!,
        high: values[i * 5 + 1]!,
        low: values[i * 5 + 2]!,
        close: values[i * 5 + 3]!,
        volume: values[i * 5 + 4]!,
      };
    }
    return out;
  } catch {
    return null;
  }
}

/** Stores the full sorted series. Failures are silent — parquet answers. */
export async function writeTickerSidecar(
  version: string,
  chunkKey: string,
  symbol: string,
  rows: Bar[],
): Promise<void> {
  try {
    await ensureCurrentVersion(version);
    const buf = new ArrayBuffer(HEADER_BYTES + rows.length * ROW_BYTES);
    const view = new DataView(buf);
    view.setUint32(0, MAGIC, true);
    view.setUint32(4, FORMAT, true);
    view.setUint32(8, rows.length, true);
    const dates = new Int32Array(buf, HEADER_BYTES, rows.length);
    const values = new Float32Array(buf, HEADER_BYTES + rows.length * 4, rows.length * 5);
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i]!;
      dates[i] = Math.round(Date.parse(`${row.date}T00:00:00Z`) / DAY_MS);
      values[i * 5] = row.open;
      values[i * 5 + 1] = row.high;
      values[i * 5 + 2] = row.low;
      values[i * 5 + 3] = row.close;
      values[i * 5 + 4] = row.volume;
    }
    await putFile(keyFor(version, chunkKey, symbol), new Blob([buf]));
  } catch {
    /* a missing sidecar just means parsing again next time */
  }
}
