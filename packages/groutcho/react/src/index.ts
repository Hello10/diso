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
	RouterStoreConfig,
} from "@diso.io/groutcho";
// Re-export the core so React consumers have a single import surface.
export {
	createBrowserHistory,
	createMemoryHistory,
	createRouter,
	MatchResult,
	Route,
	Router,
} from "@diso.io/groutcho";
export { RouterContext } from "./context";
export { useGo, useMatch, useRouter, useRouterStore } from "./hooks";
export { Link, type LinkProps } from "./Link";
export {
	RouterContainer,
	RouterProvider,
	type RouterProviderProps,
	type RouterRenderArgs,
} from "./Provider";
