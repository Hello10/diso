export { RouterController } from './controller';
export { routerContext } from './context';
export { GroutchoOutlet, GroutchoLink, type RenderPage } from './elements';

// Re-export the core so Lit consumers have a single import surface.
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
