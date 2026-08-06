import { createRouter } from '@diso.io/groutcho';
import type { History, MatchResult, RouteConfig, RedirectTest, RouterStore } from '@diso.io/groutcho';
import { useRef, type ReactNode } from 'react';

import { RouterContext } from './context';
import { useMatch } from './hooks';

export interface RouterRenderArgs {
  match: MatchResult;
  store: RouterStore;
}

export interface RouterProviderProps {
  /** An existing store to use. If omitted, one is created from the config below. */
  store?: RouterStore;
  routes?: Record<string, RouteConfig>;
  redirects?: Record<string, RedirectTest>;
  max_redirects?: number;
  /** History implementation (defaults to browser when a DOM is present). */
  history?: History;
  /**
   * Children, or a render-prop called with the current `{ match, store }` that
   * re-renders on navigation (back-compat with the old `RouterContainer`).
   */
  children?: ReactNode | ((args: RouterRenderArgs) => ReactNode);
}

function RenderProp({
  store,
  children
}: {
  store: RouterStore;
  children: (args: RouterRenderArgs) => ReactNode;
}) {
  const match = useMatch(store);
  return <>{children({ match, store })}</>;
}

/**
 * Provides a router store to the tree. Supply `store`, or `routes`/`redirects`/
 * `history` to have one created (once). Children may be a render-prop.
 */
export function RouterProvider(props: RouterProviderProps) {
  const { store: provided, children, routes, redirects, max_redirects, history } = props;

  const ref = useRef<RouterStore | null>(provided ?? null);
  if (ref.current === null) {
    if (!routes) {
      throw new Error('RouterProvider requires either a `store` or `routes`');
    }
    ref.current = createRouter({ routes, redirects, max_redirects, history });
  }
  const store = ref.current;

  return (
    <RouterContext.Provider value={store}>
      {typeof children === 'function' ? (
        <RenderProp store={store}>{children}</RenderProp>
      ) : (
        children
      )}
    </RouterContext.Provider>
  );
}

/** Back-compat alias for the v3 `RouterContainer` render-prop component. */
export const RouterContainer = RouterProvider;
