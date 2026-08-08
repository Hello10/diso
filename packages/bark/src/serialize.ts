import type { Fields } from './record';

/**
 * A field serializer: turns a known field's raw value (e.g. a `Request`) into
 * plain structured fields. Returning an object under the same key keeps records
 * JSON-safe without the caller thinking about it.
 */
export type FieldSerializer = (value: unknown) => unknown;

/** Request headers worth capturing by default (lowercase). */
const REQUEST_HEADERS = ['content-type', 'user-agent', 'referer', 'accept'];
const RESPONSE_HEADERS = ['content-type', 'content-length', 'cache-control', 'cf-cache-status'];

function pickHeaders(headers: Headers, names: string[]): Fields {
  const out: Fields = {};
  for (const name of names) {
    const value = headers.get(name);
    if (value !== null) {
      out[name] = value;
    }
  }
  return out;
}

/** Serialize a fetch-API Request (Cloudflare-aware: captures select `cf` data). */
export function serializeRequest(value: unknown): unknown {
  if (!(value instanceof Request)) {
    return value;
  }
  const url = new URL(value.url);
  const out: Fields = {
    method: value.method,
    url: value.url,
    path: url.pathname,
    headers: pickHeaders(value.headers, REQUEST_HEADERS)
  };
  // Cloudflare-specific request metadata, when present.
  const cf = (value as { cf?: Record<string, unknown> }).cf;
  if (cf) {
    const { colo, country, city, asn, httpProtocol, tlsVersion } = cf as Fields;
    out.cf = { colo, country, city, asn, httpProtocol, tlsVersion };
  }
  return out;
}

/** Serialize a fetch-API Response. */
export function serializeResponse(value: unknown): unknown {
  if (!(value instanceof Response)) {
    return value;
  }
  return {
    status: value.status,
    statusText: value.statusText,
    headers: pickHeaders(value.headers, RESPONSE_HEADERS)
  };
}

// djb2 — small, stable, dependency-free; enough to group recurring errors.
function hash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
  }
  return h.toString(16);
}

const MAX_CAUSE_DEPTH = 5;

interface SerializedError {
  name: string;
  message: string;
  stack?: string;
  fingerprint: string;
  cause?: unknown;
  [key: string]: unknown;
}

/**
 * Normalize a stack for fingerprinting: keep the top frames, strip line/column
 * numbers and absolute paths so the same logical error groups across builds.
 */
function stackSignature(stack: string | undefined): string {
  if (!stack) {
    return '';
  }
  return stack
    .split('\n')
    .slice(1, 4)
    .map((line) => line.trim().replace(/[(].*?[)]$/, '').replace(/:\d+:\d+/g, ''))
    .join('|');
}

/** Serialize an Error: message/name/stack, own props, cause chain, fingerprint. */
export function serializeError(value: unknown, depth = 0): unknown {
  if (!(value instanceof Error)) {
    return value;
  }
  const out: SerializedError = {
    name: value.name,
    message: value.message,
    stack: value.stack,
    fingerprint: hash(`${value.name}:${value.message}:${stackSignature(value.stack)}`)
  };
  for (const key of Object.getOwnPropertyNames(value)) {
    if (!(key in out) && key !== 'cause') {
      out[key] = (value as unknown as Fields)[key];
    }
  }
  if (value.cause !== undefined && depth < MAX_CAUSE_DEPTH) {
    out.cause = serializeError(value.cause, depth + 1);
  }
  return out;
}

/**
 * The registry: known field keys → serializers, with Cloudflare-sensible
 * defaults. Extend or override with `serializers.set(key, fn)`.
 */
export const serializers = new Map<string, FieldSerializer>([
  ['request', serializeRequest],
  ['response', serializeResponse],
  ['error', (value) => serializeError(value)]
]);

/** Apply registered serializers to any known keys in a fields object. */
export function serializeFields(fields: Fields): Fields {
  let out: Fields | null = null;
  for (const [key, value] of Object.entries(fields)) {
    const serializer = serializers.get(key);
    if (serializer) {
      out ??= { ...fields };
      out[key] = serializer(value);
    }
  }
  return out ?? fields;
}
