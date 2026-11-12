// pythonTypes.ts — the shape a Lab run hands back to the page.
//
// A Python error is a result, not a crash: the page prints it the same way it
// prints stdout, so ok is false and error carries the interpreter's message.

export interface RunResult {
  ok: boolean;
  error?: string;
  durationMs: number;
}
