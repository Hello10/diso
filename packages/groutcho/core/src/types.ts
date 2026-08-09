import type { MatchResult } from "./MatchResult";

/** Arbitrary route/query params. Values are strings (or string[] for repeats). */
export type Params = Record<string, unknown>;

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
	page: unknown;
	/** Optional per-route redirect. */
	redirect?: RouteRedirect;
	/** Arbitrary route metadata (e.g. `session`, `role`) readable by redirects. */
	[key: string]: unknown;
}

export interface RouterConfig {
	routes: Record<string, RouteConfig>;
	redirects?: Record<string, RedirectTest>;
	max_redirects?: number;
}
