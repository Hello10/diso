import { describe, it, expect, vi } from 'vitest';

import { createRouter, createMemoryHistory, type RouteConfig, type RedirectTest } from '../src/index';

function Page(): void {}

const routes: Record<string, RouteConfig> = {
  Home: { pattern: '/', page: Page },
  Show: { pattern: '/show/:title', page: Page },
  Signin: { pattern: '/signin', page: Page, session: false },
  Dashboard: { pattern: '/dashboard', page: Page, session: true },
  NotFound: { pattern: '/404', page: Page }
};

const redirects: Record<string, RedirectTest> = {
  NotFound: (match) => (match ? false : 'NotFound'),
  Session: (match) => {
    if (!match || !match.route) return false;
    const requireSession = match.route.session === true;
    return requireSession ? 'Signin' : false;
  }
};

describe('createRouter (memory history)', () => {
  it('resolves the initial location', () => {
    const store = createRouter({ routes, redirects, history: createMemoryHistory('/show/hi') });
    const match = store.getSnapshot();
    expect(match.route?.name).toBe('Show');
    expect(match.params.title).toBe('hi');
  });

  it('navigates via go(), updating history and snapshot', () => {
    const history = createMemoryHistory('/');
    const store = createRouter({ routes, redirects, history });
    store.go({ url: '/show/wow' });
    expect(history.location()).toBe('/show/wow');
    expect(store.getSnapshot().route?.name).toBe('Show');
  });

  it('notifies subscribers on navigation', () => {
    const store = createRouter({ routes, redirects, history: createMemoryHistory('/') });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.go('/show/x');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]![0].route.name).toBe('Show');
    unsubscribe();
    store.go('/');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('reflects an in-app redirect in history via replace', () => {
    const history = createMemoryHistory('/dashboard');
    const store = createRouter({ routes, redirects, history });
    const match = store.getSnapshot();
    expect(match.redirect).toBe(true);
    expect(match.url).toBe('/signin');
    expect(history.location()).toBe('/signin');
  });

  it('re-resolves when history changes externally', () => {
    const history = createMemoryHistory('/');
    const store = createRouter({ routes, redirects, history });
    const listener = vi.fn();
    store.subscribe(listener);
    history.push('/show/pop');
    expect(store.getSnapshot().route?.name).toBe('Show');
    expect(listener).toHaveBeenCalled();
  });

  it('destroy() detaches subscribers and history', () => {
    const history = createMemoryHistory('/');
    const store = createRouter({ routes, redirects, history });
    const listener = vi.fn();
    store.subscribe(listener);
    store.destroy();
    history.push('/show/gone');
    expect(listener).not.toHaveBeenCalled();
  });
});
