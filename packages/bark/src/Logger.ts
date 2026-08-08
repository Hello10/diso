import { installCollectors } from './collectors';
import { configure, emit, getConfig, resetConfig, type BarkConfig } from './config';
import {
  createContext,
  makeTraceparent,
  parseTraceparent,
  serverTimingHeader,
  type Context,
  type Span
} from './context';
import { LEVELS, type Fields, type Level } from './record';
import { serializeFields, serializers } from './serialize';

const NAME_DELIMITER = ':';

/** Handle returned by `span()`. */
export interface SpanHandle {
  end(fields?: Fields): void;
}

/**
 * A Bark scope: created by `Bark.start()` (per request/interaction) or
 * `branch()` (named sub-scope sharing the same context). All records emitted
 * through a scope carry its context fields and traceId.
 */
export class Bark {
  static configure(config: BarkConfig): void {
    configure(config);
  }

  /** The field-serializer registry (`request`, `response`, `error`, …). */
  static serializers = serializers;

  static levels = LEVELS;

  /** Reset global config (primarily for tests). */
  static reset(): void {
    resetConfig();
  }

  /**
   * Start a scope. On the server pass `{ request }` — it is serialized and the
   * `traceparent` header (if any) becomes the traceId. In the browser the first
   * start() also installs the passive collectors (performance + errors).
   */
  static start(fields: Fields = {}, name = 'app'): Bark {
    // Pull the trace id off a raw Request before serialization.
    let traceId: string | null = null;
    const request = fields.request;
    if (request instanceof Request) {
      traceId = parseTraceparent(request.headers.get('traceparent'));
    }

    const context = createContext(traceId);
    const scope = new Bark(name, context);
    scope.set(fields);

    if (typeof document !== 'undefined') {
      installCollectors(scope);
    }
    return scope;
  }

  readonly name: string;
  #context: Context;
  #fields: Fields;

  constructor(name: string, context?: Context, fields: Fields = {}) {
    this.name = name;
    this.#context = context ?? createContext();
    this.#fields = fields;
  }

  get traceId(): string {
    return this.#context.traceId;
  }

  /** A `traceparent` header value for propagating this trace to subrequests. */
  get traceparent(): string {
    return makeTraceparent(this.#context.traceId);
  }

  /** Merge fields into the scope's context (serializing known keys). */
  set(fields: Fields): this {
    this.#context.fields = { ...this.#context.fields, ...serializeFields(fields) };
    return this;
  }

  /** Named sub-scope: `bark.branch('checkout', { cart })`. Shares the context. */
  branch(name: string, fields: Fields = {}): Bark {
    const joined = [this.name, name].join(NAME_DELIMITER);
    return new Bark(joined, this.#context, { ...this.#fields, ...serializeFields(fields) });
  }

  trace(message?: string | Error, fields?: Fields): void {
    this.#emit('trace', message, fields);
  }
  debug(message?: string | Error, fields?: Fields): void {
    this.#emit('debug', message, fields);
  }
  info(message?: string | Error, fields?: Fields): void {
    this.#emit('info', message, fields);
  }
  /** Alias for `info`. */
  log(message?: string | Error, fields?: Fields): void {
    this.#emit('info', message, fields);
  }
  warn(message?: string | Error, fields?: Fields): void {
    this.#emit('warn', message, fields);
  }
  error(message?: string | Error, fields?: Fields): void {
    this.#emit('error', message, fields);
  }
  fatal(message?: string | Error, fields?: Fields): void {
    this.#emit('fatal', message, fields);
  }

  /**
   * Opt-in timing span (wall-clock; on Workers time only advances across I/O).
   * `const s = bark.span('db'); …; s.end()`. Spans feed Server-Timing on finish.
   */
  span(name: string, description?: string): SpanHandle {
    if (!getConfig().timing) {
      return { end: () => {} };
    }
    const span: Span = { name, start: Date.now(), description };
    this.#context.spans.push(span);
    return {
      end: (fields?: Fields) => {
        if (span.duration !== undefined) {
          return; // idempotent
        }
        span.duration = Date.now() - span.start;
        span.fields = fields;
        emit({
          kind: 'timing',
          level: 'debug',
          name: `timing${NAME_DELIMITER}${name}`,
          message: name,
          time: getConfig().time(),
          traceId: this.#context.traceId,
          fields: { duration: span.duration, ...fields }
        });
      }
    };
  }

  /**
   * Opt-in client instrumentation: returns a proxy whose async method calls are
   * timed as spans (`label.method`). Call sites stay untouched.
   */
  instrument<T extends object>(target: T, label = 'client'): T {
    if (!getConfig().timing) {
      return target;
    }
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const scope = this;
    return new Proxy(target, {
      get(obj, prop, receiver) {
        const value = Reflect.get(obj, prop, receiver);
        if (typeof value !== 'function') {
          return value;
        }
        return function (this: unknown, ...args: unknown[]) {
          const result = value.apply(obj, args);
          if (result instanceof Promise) {
            const handle = scope.span(`${label}.${String(prop)}`);
            return result.finally(() => handle.end());
          }
          return result;
        };
      }
    });
  }

  /**
   * Finish the scope: serialize final fields (e.g. `{ response }`), attach
   * Server-Timing (+ optional Timing-Allow-Origin) when a Response is given,
   * emit the request-summary record, and return the (possibly copied) Response.
   */
  finish(fields: Fields = {}): Response | undefined {
    const config = getConfig();
    let response = fields.response instanceof Response ? fields.response : undefined;

    if (response && config.timing) {
      const header = serverTimingHeader(this.#context.spans);
      if (header || config.timingAllowOrigin) {
        response = new Response(response.body, response);
        if (header) {
          response.headers.append('Server-Timing', header);
        }
        if (config.timingAllowOrigin) {
          response.headers.set('Timing-Allow-Origin', config.timingAllowOrigin);
        }
        fields = { ...fields, response };
      }
    }

    this.set(fields);
    const duration = Date.now() - this.#context.start;
    emit({
      kind: 'log',
      level: 'info',
      name: this.name,
      message: 'finish',
      time: config.time(),
      traceId: this.#context.traceId,
      fields: { ...this.#context.fields, duration }
    });
    return response;
  }

  #emit(level: Level, message?: string | Error, fields?: Fields): void {
    const config = getConfig();
    const isError = message instanceof Error;

    let merged: Fields = { ...this.#context.fields, ...this.#fields };
    let text: string | undefined;

    if (isError) {
      merged.error = serializers.get('error')!(message);
      text = message.message;
    } else {
      text = message;
    }
    if (fields) {
      merged = { ...merged, ...serializeFields(fields) };
    }

    emit({
      kind: isError ? 'error' : 'log',
      level,
      name: this.name,
      message: text,
      time: config.time(),
      traceId: this.#context.traceId,
      fields: merged
    });
  }
}
