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
// Re-export the core so Lit consumers have a single import surface.
export {
	createBrowserHistory,
	createMemoryHistory,
	createRouter,
	MatchResult,
	Route,
	Router,
} from "@diso.io/groutcho";
export { routerContext } from "./context";
export {
	RouterController,
	type RouterControllerOptions,
	type ScrollBehavior,
} from "./controller";
export {
	DisoLink,
	DisoNavLink,
	DisoOutlet,
	type LayoutFn,
	type RenderPage,
} from "./elements";
