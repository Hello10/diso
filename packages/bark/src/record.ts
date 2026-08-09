export const LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;

export type Level = (typeof LEVELS)[number];

/** Arbitrary structured fields attached to scopes and records. */
export type Fields = Record<string, unknown>;

/** What kind of record this is — logs, timing spans, and errors share one pipe. */
export type RecordKind = 'log' | 'timing' | 'error';

/**
 * The one record shape everything emits: logs, timings, and errors are all
 * `BarkRecord`s flowing through the same sink, correlated by `traceId`.
 */
export interface BarkRecord {
  kind: RecordKind;
  level: Level;
  /** Logger/scope name (`:`-joined through `branch()`); used for filtering. */
  name: string;
  message?: string;
  /** ISO timestamp. */
  time: string;
  /** Correlation id for the request/interaction this record belongs to. */
  traceId?: string;
  /** Merged context + call-site fields (serialized). */
  fields: Fields;
}

/** Formats a record into the argument list passed to the sink. */
export type Formatter = (record: BarkRecord) => unknown[];

/** Receives formatted output. Default writes to console. */
export type Sink = (record: BarkRecord, formatted: unknown[]) => void;
