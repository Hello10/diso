import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import Bark, { parseTraceparent, type BarkRecord } from '../src/index';

describe('Bark.start / finish (server)', () => {
  let records: BarkRecord[];

  beforeEach(() => {
    records = [];
    Bark.reset();
    Bark.configure({
      level: '*|trace',
      sink: (record) => records.push(record)
    });
  });

  afterEach(() => {
    Bark.reset();
  });

  it('start({ request }) serializes the request and adopts its traceparent', () => {
    const traceId = 'a'.repeat(32);
    const req = new Request('https://api.diso.io/things', {
      headers: { traceparent: `00-${traceId}-${'b'.repeat(16)}-01` }
    });
    const bark = Bark.start({ request: req });

    expect(bark.traceId).toBe(traceId);
    bark.info('hi');
    const fields = records[0]!.fields;
    expect((fields.request as { path: string }).path).toBe('/things');
  });

  it('generates a traceId without a traceparent, and emits a valid one', () => {
    const bark = Bark.start();
    expect(bark.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(parseTraceparent(bark.traceparent)).toBe(bark.traceId);
  });

  it('finish({ response }) attaches Server-Timing from spans and returns the response', async () => {
    const bark = Bark.start();
    const span = bark.span('db', 'primary query');
    await new Promise((resolve) => setTimeout(resolve, 5));
    span.end();

    const res = bark.finish({ response: Response.json({ ok: true }) })!;
    const header = res.headers.get('Server-Timing')!;
    expect(header).toMatch(/^db;dur=\d+;desc="primary query"$/);
    expect(await res.json()).toEqual({ ok: true });

    // request summary record with total duration
    const summary = records.at(-1)!;
    expect(summary.message).toBe('finish');
    expect(typeof summary.fields.duration).toBe('number');
    expect((summary.fields.response as { status: number }).status).toBe(200);
  });

  it('sets Timing-Allow-Origin when configured', () => {
    Bark.configure({ timingAllowOrigin: '*' });
    const bark = Bark.start();
    const res = bark.finish({ response: new Response('x') })!;
    expect(res.headers.get('Timing-Allow-Origin')).toBe('*');
  });

  it('span() emits a timing record correlated to the scope', () => {
    const bark = Bark.start();
    bark.span('kv').end({ hit: true });
    const timing = records.find((record) => record.kind === 'timing')!;
    expect(timing.name).toBe('timing:kv');
    expect(timing.traceId).toBe(bark.traceId);
    expect(timing.fields.hit).toBe(true);
    expect(typeof timing.fields.duration).toBe('number');
  });

  it('span end is idempotent', () => {
    const bark = Bark.start();
    const span = bark.span('once');
    span.end();
    span.end();
    expect(records.filter((record) => record.kind === 'timing')).toHaveLength(1);
  });

  it('instrument() times async method calls without changing results', async () => {
    const bark = Bark.start();
    const db = bark.instrument(
      {
        async query(sql: string) {
          return `rows:${sql}`;
        },
        sync(x: number) {
          return x * 2;
        }
      },
      'db'
    );

    expect(await db.query('SELECT 1')).toBe('rows:SELECT 1');
    expect(db.sync(2)).toBe(4); // sync calls pass through untimed

    const timing = records.find((record) => record.kind === 'timing')!;
    expect(timing.name).toBe('timing:db.query');
  });

  it('configure({ timing: false }) no-ops spans and skips the header', () => {
    Bark.configure({ timing: false });
    const bark = Bark.start();
    bark.span('db').end();
    const res = bark.finish({ response: new Response('x') })!;
    expect(res.headers.get('Server-Timing')).toBeNull();
    expect(records.some((record) => record.kind === 'timing')).toBe(false);
  });

  it('works Workers-shaped: explicit config, json lines, no env reliance', () => {
    const lines: string[] = [];
    Bark.reset();
    Bark.configure({
      level: 'info',
      format: 'json',
      sink: (_record, formatted) => lines.push(formatted[0] as string)
    });

    const bark = Bark.start({ request: new Request('https://x.dev/api') }, 'worker');
    bark.set({ userId: 'u42' });
    bark.info('handled');
    bark.finish({ response: new Response('ok') });

    expect(lines.length).toBeGreaterThanOrEqual(2);
    for (const line of lines) {
      const parsed = JSON.parse(line) as BarkRecord;
      expect(parsed.traceId).toBe(bark.traceId);
      expect(parsed.fields.userId).toBe('u42');
    }
  });
});
