import type { MatchResult } from "./MatchResult";

/** Arbitrary route/query params. Values are strings (or string[] for repeats). */
export type Params = Record<string, unknown>;

/**
 * Opaque component reference. Core doesn't render anything — adapters (react,
 * lit, etc.) interpret whatever the app stores under `page`, `layout`, and
 * `errorPage`. Kept as `unknown` so core stays framework-agnostic.
 */
export type Component = unknown;

/**
 * A route-defined title. Either a fixed string, or a function that derives one
 * from the current match (e.g. `(m) => `Album: ${m.params.slug}``).
 */
export type TitleValue = string | ((match: MatchResult) => string);

/**
 * Structured error surfaced through a match. Adapters populate this when a page
 * render throws (see react/lit `<Outlet>` equivalents). `useError` / `onError`
 * read it.
 */
export interface RouteError {
	message: string;
	cause?: unknown;
	status?: number;
}

/** A route reference by name, optionally with params. */
export interface RouteInput {
	name: string;
	params?: Params;
}

/**
 * The object form of router input. Either a `url`, a `route` reference, or a
 * name shorthand — plus any arbitrary "extra" keys that redirect logic can read
 * (these are threaded through redirects but ignored by matching).
 */
export interface InputObject {
	url?: string;
	route?: RouteInput;
	name?: string;
	params?: Params;
	[key: string]: unknown;
}

/** Anything accepted by `Router.match`/`go`: a string or an input object. */
export type Input = string | InputObject;

/**
 * What a redirect returns: a new input to follow, or a falsy value meaning
 * "no redirect".
 */
export type RedirectResult = Input | false | null | undefined;

/** Per-route redirect: receives the current match, returns where to go (or false). */
export type RouteRedirect = (match: MatchResult) => RedirectResult;

/**
 * Global redirect test: receives the current match (or `false` when nothing
 * matched, e.g. for a NotFound rule), returns where to go (or false).
 */
export type RedirectTest = (match: MatchResult | false) => RedirectResult;

export interface RouteConfig {
	/** Set automatically from the routes map key; may be provided directly too. */
	name?: string;
	/** URLPattern pathname pattern, e.g. `/show/:title` or `/optional/:opt?`. */
	pattern: string;
	/** Arbitrary payload associated with the route (component, handler, etc). */
	page: Component;
	/** Optional per-route redirect. */
	redirect?: RouteRedirect;
	/**
	 * Route title. String or `(match) => string`. When the router navigates to
	 * this route the store applies it via `setTitle`; adapters mirror it to
	 * `document.title`. Runtime overrides via `store.setTitle` (see React
	 * `useTitle`) win until the next navigation.
	 */
	title?: TitleValue;
	/**
	 * Layout component (or ordered chain, outermost first) wrapping `page`.
	 * Adapters render `layouts.reduceRight((child, L) => <L>{child}</L>, page)`.
	 * Sibling routes sharing the same layout component identity get instance
	 * persistence via the adapter's reconciliation.
	 */
	layout?: Component | Component[];
	/** Per-route error UI. Adapters render this when the page render throws. */
	errorPage?: Component;
	/** Arbitrary route metadata (e.g. `session`, `role`) readable by redirects. */
	[key: string]: unknown;
}

export interface RouterConfig {
	routes: Record<string, RouteConfig>;
	redirects?: Record<string, RedirectTest>;
	max_redirects?: number;
	/** Fallback error UI. Adapters use this when a route has no `errorPage`. */
	errorPage?: Component;
}
