import { describe, expect, it } from 'vitest';

import { makeMatcher, parseRules } from '../src/matcher';

function matcher(config: string | string[]) {
  return makeMatcher(parseRules(config));
}

describe('matcher', () => {
  it('matches name|level rules with wildcards', () => {
    const enabled = matcher('foo:bar*|error');
    expect(enabled('error', 'foo:bar')).toBe(true);
    expect(enabled('error', 'foo:barf')).toBe(true);
    expect(enabled('fatal', 'foo:bar')).toBe(true);
    expect(enabled('warn', 'foo:bar')).toBe(false); // below threshold
    expect(enabled('error', 'foo')).toBe(false); // name mismatch
  });

  it('treats a bare level as *|level', () => {
    const enabled = matcher('info');
    expect(enabled('info', 'anything')).toBe(true);
    expect(enabled('debug', 'anything')).toBe(false);
  });

  it('treats a bare name as name|error', () => {
    const enabled = matcher('api');
    expect(enabled('error', 'api')).toBe(true);
    expect(enabled('warn', 'api')).toBe(false);
  });

  it('supports multiple comma/space separated rules', () => {
    const enabled = matcher('foo|info, ping:pong|trace');
    expect(enabled('info', 'foo')).toBe(true);
    expect(enabled('trace', 'ping:pong')).toBe(true);
    expect(enabled('trace', 'foo')).toBe(false);
  });

  it('excludes names with a - prefix regardless of level', () => {
    const enabled = matcher('*|trace,-ping:pong:pork');
    expect(enabled('fatal', 'ping:pong:pork')).toBe(false);
    expect(enabled('trace', 'ping:pong')).toBe(true);
  });

  it('does not treat an exclude as an include (quirk fix)', () => {
    const rules = parseRules('-foo');
    expect(rules.includes).toHaveLength(0);
    expect(rules.excludes).toHaveLength(1);
  });

  it('throws on invalid level', () => {
    expect(() => parseRules('*|bogus')).toThrow(/Invalid level/);
  });

  it('throws on exclude with level', () => {
    expect(() => parseRules('-foo|error')).toThrow(/Exclude/);
  });

  it('accepts an array of rules', () => {
    const enabled = matcher(['a|info', 'b|debug']);
    expect(enabled('info', 'a')).toBe(true);
    expect(enabled('debug', 'b')).toBe(true);
    expect(enabled('debug', 'a')).toBe(false);
  });

  it('memoizes without changing results', () => {
    const enabled = matcher('*|info');
    expect(enabled('info', 'x')).toBe(true);
    expect(enabled('info', 'x')).toBe(true);
    expect(enabled('trace', 'x')).toBe(false);
    expect(enabled('trace', 'x')).toBe(false);
  });
});
