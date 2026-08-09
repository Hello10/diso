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
export { RouterController } from "./controller";
export { GroutchoLink, GroutchoOutlet, type RenderPage } from "./elements";
