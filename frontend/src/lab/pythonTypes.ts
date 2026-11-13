import type { LabLogEntry } from './backtestTypes';

// pythonTypes.ts — the shape a Lab run hands back to the page.
//
// A Python error is a result, not a crash: the page prints it the same way it
// prints stdout, so ok is false and error carries the interpreter's message.

export interface RunResult {
  ok: boolean;
  error?: string;
  durationMs: number;
  /** A normalized backtest payload when the file produced a strategy result. */
  result?: unknown;
  /** Everything the run printed, kept apart from the report. */
  logs?: LabLogEntry[];
  /** A quiet message for a run that had nothing to backtest. */
  notice?: string;
}
