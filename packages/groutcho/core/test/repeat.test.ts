import { describe, it, expect } from 'vitest';

import { Router, type RouteConfig } from '../src/index';

function Page(): void {}

const routes: Record<string, RouteConfig> = {
  Files: { pattern: '/files/:path+', page: Page }, // one-or-more (required)
  Docs: { pattern: '/docs/:slug*', page: Page }, // zero-or-more (optional)
  NotFound: { pattern: '/404', page: Page }
};

function makeRouter(): Router {
  return new Router({
    routes,
    redirects: { NotFound: (match) => (match ? false : 'NotFound') }
  });
}

describe('repeated path params', () => {
  it('matches one-or-more segments and exposes string + array accessors', () => {
    const router = makeRouter();
    const match = router.match('/files/docs/2026/report.pdf');
    expect(match.route?.name).toBe('Files');
    expect(match.params.path).toBe('docs/2026/report.pdf');
    expect(match.params.pathArray).toEqual(['docs', '2026', 'report.pdf']);
    expect(match.redirect).toBeFalsy();
    expect(match.url).toBe('/files/docs/2026/report.pdf');
  });

  it('matches a single segment as a one-element array', () => {
    const match = makeRouter().match('/files/solo');
    expect(match.params.path).toBe('solo');
    expect(match.params.pathArray).toEqual(['solo']);
  });

  it('requires at least one segment for `+`', () => {
    const match = makeRouter().match('/files');
    // No match for `+` with zero segments -> falls through to NotFound.
    expect(match.redirect).toBeTruthy();
    expect(match.url).toBe('/404');
  });

  it('allows zero segments for `*`', () => {
    const match = makeRouter().match('/docs');
    expect(match.route?.name).toBe('Docs');
    expect(match.params.slug).toBeUndefined();
    expect(match.params.slugArray).toBeUndefined();
    expect(match.url).toBe('/docs');
  });

  it('captures multiple segments for `*`', () => {
    const match = makeRouter().match('/docs/guide/setup');
    expect(match.params.slug).toBe('guide/setup');
    expect(match.params.slugArray).toEqual(['guide', 'setup']);
    expect(match.url).toBe('/docs/guide/setup');
  });

  it('builds urls from an array', () => {
    const match = makeRouter().match({
      route: { name: 'Files', params: { path: ['a', 'b', 'c'] } }
    });
    expect(match.url).toBe('/files/a/b/c');
  });

  it('builds urls from a pre-joined string', () => {
    const match = makeRouter().match({
      route: { name: 'Files', params: { path: 'a/b/c' } }
    });
    expect(match.url).toBe('/files/a/b/c');
  });

  it('builds urls from the array accessor key', () => {
    const match = makeRouter().match({
      route: { name: 'Files', params: { pathArray: ['a', 'b'] } }
    });
    expect(match.url).toBe('/files/a/b');
  });

  it('does not leak repeat params into the query string', () => {
    const match = makeRouter().match({
      route: { name: 'Files', params: { path: ['a', 'b'], q: 'hi' } }
    });
    expect(match.url).toBe('/files/a/b?q=hi');
  });

  it('round-trips segments needing url-encoding', () => {
    const router = makeRouter();
    // Array elements are explicit segments: a space encodes to %20, and a slash
    // inside one element encodes to %2F (so it stays a single segment) and
    // round-trips back to the same element.
    const built = router.match({ route: { name: 'Files', params: { path: ['a b', 'c/d'] } } });
    expect(built.url).toBe('/files/a%20b/c%2Fd');
    const back = router.match(built.url);
    expect(back.params.pathArray).toEqual(['a b', 'c/d']);
  });
});
