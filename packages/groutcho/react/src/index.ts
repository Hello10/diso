export type {
	Component,
	ErrorListener,
	GoListener,
	History,
	Input,
	InputObject,
	Params,
	RedirectResult,
	RedirectTest,
	RouteConfig,
	RouteError,
	RouteInput,
	RouteRedirect,
	RouterConfig,
	RouterStore,
	RouterStoreConfig,
	StoreListener,
	TitleListener,
	TitleValue,
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
export {
	useError,
	useGo,
	useMatch,
	useOnGo,
	useRoute,
	useRouter,
	useRouterStore,
	useTitle,
} from "./hooks";
export { Link, type LinkProps } from "./Link";
export { NavLink, type NavLinkProps } from "./NavLink";
export {
	RouterContainer,
	RouterOutlet,
	RouterProvider,
	type RouterProviderProps,
	type RouterRenderArgs,
	type ScrollBehavior,
} from "./Provider";
