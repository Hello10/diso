export { RouterContext } from './context';
export { useRouter, useRouterStore, useMatch, useGo } from './hooks';
export {
  RouterProvider,
  RouterContainer,
  type RouterProviderProps,
  type RouterRenderArgs
} from './Provider';
export { Link, type LinkProps } from './Link';

// Re-export the core so React consumers have a single import surface.
export {
  createRouter,
  createBrowserHistory,
  createMemoryHistory,
  Router,
  Route,
  MatchResult
} from '@diso.io/groutcho';
export type {
  History,
  Input,
  InputObject,
  Params,
  RedirectResult,
  RedirectTest,
  RouteConfig,
  RouteInput,
  RouteRedirect,
  RouterConfig,
  RouterStore,
  RouterStoreConfig
} from '@diso.io/groutcho';
