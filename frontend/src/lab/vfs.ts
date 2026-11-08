// vfs.ts — the Lab's virtual file system.
//
// The browser owns editing; the server only persists. That split is what was
// missing: every keystroke used to rewrite page state (re-rendering the whole
// IDE) and every save was its own request (one Turso write transaction per
// file). The VFS sits between the two:
//
//   Monaco models  →  VFS drafts (a ref, never React state)  →  batched flush
//
// Typing updates a Map and, at most, flips a path clean→dirty once per burst,
// so a burst of keystrokes costs zero re-renders instead of one per
// character. Saving collects every dirty file into ONE batch request, and
// flushes serialize behind a promise chain, so rapid typing can never stack
// up concurrent writes against the same Turso database.
//
// Drafts survive tab closes, file switches and refetches: the VFS only drops
// a draft when its exact text has been acknowledged by the server.

/** Pause after the last keystroke before dirty files flush. */
export const AUTOSAVE_DELAY_MS = 1500;

/** A flush carries at most this many files; more wait for the next pass. */
const MAX_FLUSH_FILES = 100;

export interface VfsFileMeta {
  name: string;
  locked: boolean;
  saved: string;
}

export interface VfsStatus {
  /** Paths with unflushed edits. A new array identity means membership changed. */
  dirty: string[];
  /** A flush is on the wire right now. */
  saving: boolean;
  /** The last flush failure, cleared by the next successful flush or edit. */
  error: string | null;
  /** When the last flush succeeded, for the "Saved 12:03:44" readout. */
  lastSavedAt: number | null;
}

export type VfsSaveBatch = (files: { path: string; content: string }[]) => Promise<{
  saved: string[];
  locked_skipped: string[];
}>;

type VfsListener = (status: VfsStatus) => void;

/** Membership transition of one edit, so callers re-render only on change. */
export type EditTransition = 'became-dirty' | 'became-clean' | 'unchanged';

export class LabVfs {
  private saved = new Map<string, string>();
  private drafts = new Map<string, string>();
  /** Text last sent for paths in flight; a newer draft means "save again". */
  private sent = new Map<string, string>();
  private dirty = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private chain: Promise<void> = Promise.resolve();
  private saving = false;
  private error: string | null = null;
  private lastSavedAt: number | null = null;
  private listeners = new Set<VfsListener>();
  private saveBatch: VfsSaveBatch;

  constructor(saveBatch: VfsSaveBatch) {
    this.saveBatch = saveBatch;
  }

  subscribe(listener: VfsListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getStatus(): VfsStatus {
    return {
      dirty: [...this.dirty],
      saving: this.saving,
      error: this.error,
      lastSavedAt: this.lastSavedAt,
    };
  }

  private emit(): void {
    const status = this.getStatus();
    for (const listener of this.listeners) listener(status);
  }

  /** The text the editor should show: the draft when dirty, else the saved. */
  getText(path: string): string {
    return this.drafts.get(path) ?? this.saved.get(path) ?? '';
  }

  /** The last server-acknowledged text, for publishing saves into UI state. */
  savedText(path: string): string | undefined {
    return this.saved.get(path);
  }

  isDirty(path: string): boolean {
    return this.dirty.has(path);
  }

  get dirtyCount(): number {
    return this.dirty.size;
  }

  /** Reconciles a server snapshot. Dirty drafts always win over new saved text. */
  setSaved(files: VfsFileMeta[]): void {
    const seen = new Set<string>();
    let changed = false;
    for (const file of files) {
      seen.add(file.name);
      if (this.saved.get(file.name) !== file.saved) {
        this.saved.set(file.name, file.saved);
        changed = true;
      }
      const draft = this.drafts.get(file.name);
      if (draft !== undefined && draft === file.saved) {
        this.drafts.delete(file.name);
        if (this.dirty.delete(file.name)) changed = true;
      }
    }
    for (const name of [...this.saved.keys()]) {
      if (!seen.has(name)) {
        this.saved.delete(name);
        // A dirty draft outlives a server-side delete: the next flush
        // recreates the file, which is the least surprising outcome for
        // text the user wrote but never saved.
        if (!this.dirty.has(name)) this.drafts.delete(name);
        changed = true;
      }
    }
    if (changed) this.emit();
  }

  /** Records one edit. Returns the membership transition for render decisions. */
  edit(path: string, text: string): EditTransition {
    if (text === this.saved.get(path)) {
      if (!this.dirty.has(path)) {
        this.drafts.delete(path);
        return 'unchanged';
      }
      this.drafts.delete(path);
      this.dirty.delete(path);
      this.scheduleFlush();
      this.emit();
      return 'became-clean';
    }
    const wasDirty = this.dirty.has(path);
    this.drafts.set(path, text);
    this.dirty.add(path);
    if (!wasDirty) this.emit();
    this.scheduleFlush();
    return wasDirty ? 'unchanged' : 'became-dirty';
  }

  /** Moves all VFS state across a rename. */
  renamePath(from: string, to: string): void {
    const saved = this.saved.get(from);
    if (saved !== undefined) {
      this.saved.delete(from);
      this.saved.set(to, saved);
    }
    const draft = this.drafts.get(from);
    if (draft !== undefined) {
      this.drafts.delete(from);
      this.drafts.set(to, draft);
    }
    if (this.dirty.delete(from)) this.dirty.add(to);
    const inFlight = this.sent.get(from);
    if (inFlight !== undefined) {
      this.sent.delete(from);
      this.sent.set(to, inFlight);
    }
    this.emit();
  }

  /** Drops all VFS state for a deleted path. */
  removePath(path: string): void {
    this.saved.delete(path);
    this.drafts.delete(path);
    this.dirty.delete(path);
    this.emit();
  }

  /** Records a path the server just created. Text typed during the flight is
      newer than the server's empty file, so it stays dirty. */
  addClean(path: string, text = ''): void {
    this.saved.set(path, text);
    if (this.drafts.get(path) === text) {
      this.drafts.delete(path);
      this.dirty.delete(path);
    } else if (this.drafts.has(path)) {
      this.dirty.add(path);
    }
    this.emit();
  }

  /** Flushes now: the manual-save path. A no-op when nothing is dirty. */
  flushNow(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    return this.enqueueFlush();
  }

  /** Clears a terminal save failure once its files are clean or retried. */
  clearError(): void {
    if (!this.error) return;
    this.error = null;
    this.emit();
  }

  private scheduleFlush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.dirty.size === 0) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.enqueueFlush();
    }, AUTOSAVE_DELAY_MS);
  }

  private enqueueFlush(): Promise<void> {
    const job = this.chain.then(() => this.flush());
    this.chain = job.catch(() => undefined);
    return job;
  }

  private async flush(): Promise<void> {
    const batch: { path: string; content: string }[] = [];
    for (const path of this.dirty) {
      if (this.sent.has(path)) continue;
      const text = this.drafts.get(path);
      if (text === undefined || text === this.saved.get(path)) {
        this.drafts.delete(path);
        this.dirty.delete(path);
        continue;
      }
      batch.push({ path, content: text });
      if (batch.length >= MAX_FLUSH_FILES) break;
    }
    if (batch.length === 0) {
      if (this.dirty.size > 0) this.scheduleFlush();
      return;
    }
    for (const file of batch) this.sent.set(file.path, file.content);
    this.saving = true;
    this.emit();
    try {
      const result = await this.saveBatch(batch);
      const acknowledged = new Set(result.saved);
      const rejected = new Set(result.locked_skipped ?? []);
      for (const file of batch) {
        this.sent.delete(file.path);
        if (rejected.has(file.path)) {
          // Locked on the server: the draft can never land, so the saved
          // text wins and the path goes clean instead of retrying forever.
          this.drafts.delete(file.path);
          this.dirty.delete(file.path);
          continue;
        }
        if (!acknowledged.has(file.path)) continue;
        this.saved.set(file.path, file.content);
        // Edited mid-flight: the draft is newer than what just saved.
        if (this.drafts.get(file.path) === file.content) {
          this.drafts.delete(file.path);
          this.dirty.delete(file.path);
        }
      }
      this.error = null;
      this.lastSavedAt = Date.now();
    } catch (err) {
      for (const file of batch) this.sent.delete(file.path);
      this.error = err instanceof Error ? err.message : 'Could not save those files.';
    } finally {
      this.saving = false;
      this.emit();
      if (this.dirty.size > 0 && !this.error) this.scheduleFlush();
    }
  }
}
