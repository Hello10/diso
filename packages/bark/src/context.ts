import type { Fields } from './record';

/** A completed (or open) timing span, recorded on the scope's context. */
export interface Span {
  name: string;
  start: number;
  /** Milliseconds; set on end(). */
  duration?: number;
  description?: string;
  fields?: Fields;
}

/**
 * Per-request/interaction state shared by a scope and all its branches:
 * correlation id, accumulated fields, and timing spans.
 */
export interface Context {
  traceId: string;
  fields: Fields;
  spans: Span[];
  /** Epoch ms when the scope started (drives total request duration). */
  start: number;
}

function randomHex(bytes: number): string {
  const crypto = (globalThis as { crypto?: Crypto }).crypto;
  if (crypto?.getRandomValues) {
    const buf = new Uint8Array(bytes);
    crypto.getRandomValues(buf);
    return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Non-crypto fallback (very old runtimes) — correlation ids, not secrets.
  let out = '';
  for (let i = 0; i < bytes * 2; i++) {
    out += Math.floor(Math.random() * 16).toString(16);
  }
  return out;
}

/** W3C trace-context: `00-<32hex trace>-<16hex parent>-<2hex flags>`. */
const TRACEPARENT = /^[0-9a-f]{2}-([0-9a-f]{32})-[0-9a-f]{16}-[0-9a-f]{2}$/;

export function parseTraceparent(header: string | null | undefined): string | null {
  if (!header) {
    return null;
  }
  const match = TRACEPARENT.exec(header.trim());
  return match ? match[1]! : null;
}

export function makeTraceparent(traceId: string): string {
  return `00-${traceId}-${randomHex(8)}-01`;
}

export function createContext(traceId?: string | null): Context {
  return {
    traceId: traceId ?? randomHex(16),
    fields: {},
    spans: [],
    start: Date.now()
  };
}

/** Render spans as a Server-Timing header value: `name;dur=12.3;desc="..."`. */
export function serverTimingHeader(spans: Span[]): string {
  return spans
    .filter((span) => span.duration !== undefined)
    .map((span) => {
      // Header token: keep it simple/safe.
      let out = span.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      out += `;dur=${span.duration}`;
      if (span.description) {
        out += `;desc="${span.description.replace(/"/g, "'")}"`;
      }
      return out;
    })
    .join(', ');
}
