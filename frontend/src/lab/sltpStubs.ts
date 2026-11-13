// sltpStubs.ts — the SLTP engine as a virtual library for Pyright.
//
// The browser has no installed packages, so Pyright's import step would find
// nothing for `from sltp import Order` or `import numpy as np`. These trees
// fill that gap: the sltp stubs are generated from the pinned runtime the
// server runs (see stubs/sltp and the regeneration note below), and the
// numpy pack is numpy's own shipped type stubs. Both land in the worker under
// /typings, which is Pyright's default stub path, so absolute imports resolve
// exactly the way they do against the real server environment.
//
// Regenerating: with the backend's pinned environment active, run
// `stubgen -p sltp -o <tmp>` and copy the result over stubs/sltp, then
// re-apply the explicit re-exports in stubs/sltp/__init__.pyi (the runtime
// resolves its public names lazily, which a stub cannot see through). Zip
// the installed numpy's *.pyi files with package-relative paths into
// stubs/numpy-stubs.zip. Keep both in step with backend/requirements.txt.
import numpyStubsUrl from './stubs/numpy-stubs.zip?url';

/** A Pyright file tree: folders nest, .pyi files are text, zips are packs. */
export type StubTree = { [key: string]: StubTree | string | ArrayBuffer };

// Every generated stub, bundled as text at build time (about 100KB).
const sltpModules = import.meta.glob<string>('./stubs/sltp/**/*.pyi', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** The sltp package as a nested stub tree, built once and reused. */
let sltpCache: StubTree | null = null;

export function sltpStubTree(): StubTree {
  if (sltpCache) return sltpCache;
  const root: StubTree = {};
  for (const [path, text] of Object.entries(sltpModules)) {
    const parts = path.replace('./stubs/sltp/', '').split('/');
    let node = root;
    for (const part of parts.slice(0, -1)) {
      const child = node[part];
      if (typeof child !== 'object' || child === null || child instanceof ArrayBuffer) {
        node[part] = {};
      }
      node = node[part] as StubTree;
    }
    node[parts[parts.length - 1]] = text;
  }
  sltpCache = root;
  return root;
}

// numpy's stubs (about 280KB zipped) are fetched once, on demand, and then
// reused for every project. Mounting needs the raw bytes (see createUserFiles
// in the worker), so this resolves to an ArrayBuffer, not text.
let numpyCache: ArrayBuffer | null = null;
let numpyFailed = false;

export async function numpyStubPack(): Promise<ArrayBuffer | null> {
  // The worker clones what it is sent, so the cached bytes stay intact.
  if (numpyCache) return numpyCache;
  if (numpyFailed) return null;
  try {
    // Bounded: a stalled request would otherwise hold up every worker start,
    // since the stubs are mounted before Pyright is handed the project.
    const response = await fetch(numpyStubsUrl, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`numpy stubs fetch failed: ${response.status}`);
    numpyCache = await response.arrayBuffer();
    return numpyCache;
  } catch {
    numpyFailed = true;
    return null;
  }
}

/** True when any project file imports numpy. Reads saved text only. */
export function usesNumpy(files: Record<string, string>): boolean {
  return Object.values(files).some((text) => /^\s*(import numpy|from numpy)/m.test(text));
}
