import { describe, expect, it } from 'vitest';

import { serializeError, serializeFields, serializeRequest, serializeResponse, serializers } from '../src/serialize';

interface SerializedErrorShape {
  name: string;
  message: string;
  stack?: string;
  fingerprint: string;
  cause?: SerializedErrorShape;
  [key: string]: unknown;
}

describe('serialize', () => {
  it('serializes a Request: method, url, path, select headers', () => {
    const req = new Request('https://api.diso.io/things?q=1', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-secret': 'nope' }
    });
    const out = serializeRequest(req) as Record<string, unknown>;
    expect(out.method).toBe('POST');
    expect(out.path).toBe('/things');
    expect((out.headers as Record<string, string>)['content-type']).toBe('application/json');
    expect((out.headers as Record<string, string>)['x-secret']).toBeUndefined();
  });

  it('serializes a Response: status + select headers', () => {
    const res = new Response('{}', {
      status: 201,
      headers: { 'content-type': 'application/json' }
    });
    const out = serializeResponse(res) as Record<string, unknown>;
    expect(out.status).toBe(201);
    expect((out.headers as Record<string, string>)['content-type']).toBe('application/json');
  });

  it('serializes an Error with stack, own props, and cause chain', () => {
    const root = new Error('root cause');
    const err = new Error('top', { cause: root }) as Error & { code: string };
    err.code = 'E_TOP';
    const out = serializeError(err) as SerializedErrorShape;
    expect(out.message).toBe('top');
    expect(out.code).toBe('E_TOP');
    expect(typeof out.stack).toBe('string');
    expect(out.cause?.message).toBe('root cause');
    expect(typeof out.fingerprint).toBe('string');
  });

  it('fingerprints identical errors identically, different errors differently', () => {
    function boom(): Error {
      return new Error('same thing');
    }
    const a = serializeError(boom()) as SerializedErrorShape;
    const b = serializeError(boom()) as SerializedErrorShape;
    const c = serializeError(new TypeError('other')) as SerializedErrorShape;
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(a.fingerprint).not.toBe(c.fingerprint);
  });

  it('caps the cause chain depth', () => {
    let err = new Error('bottom');
    for (let i = 0; i < 10; i++) {
      err = new Error(`layer ${i}`, { cause: err });
    }
    let depth = 0;
    let cursor = serializeError(err) as SerializedErrorShape | undefined;
    while (cursor?.cause) {
      cursor = cursor.cause;
      depth++;
    }
    expect(depth).toBeLessThanOrEqual(6);
  });

  it('serializeFields applies registered serializers and custom ones', () => {
    serializers.set('user', (value) => ({ id: (value as { id: string }).id }));
    try {
      const out = serializeFields({
        error: new Error('x'),
        user: { id: 'u1', password: 'nope' },
        plain: 1
      });
      expect((out.error as SerializedErrorShape).message).toBe('x');
      expect(out.user).toEqual({ id: 'u1' });
      expect(out.plain).toBe(1);
    } finally {
      serializers.delete('user');
    }
  });
});
