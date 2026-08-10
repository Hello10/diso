import type { Route } from "./Route";
import type { InputObject, Params, RouteError } from "./types";

export interface MatchResultInit {
	input: InputObject;
	route?: Route | null;
	url?: string | null;
	params?: Params;
	redirect?: boolean;
}

/**
 * The result of a match: which route (if any) matched, the resolved params and
 * url, whether it represents a redirect, and — for redirects — the `original`
 * match that triggered it.
 *
 * `key` is populated by the store and increments on each successful navigation;
 * it's useful as an effect-dependency when you want to run something on every
 * nav even if the URL/params look the same.
 *
 * `error` is populated by adapters when a page render throws.
 */
export class MatchResult {
	input: InputObject;
	route: Route | null;
	params: Params;
	redirect: boolean;
	original: MatchResult | null;
	url: string;
	key: number;
	error: RouteError | undefined;

	constructor({
		input,
		route = null,
		url = null,
		params = {},
		redirect = false,
	}: MatchResultInit) {
		this.input = input;
		this.route = route;
		this.params = params;
		this.redirect = redirect;
		this.original = null;
		this.key = 0;
		this.error = undefined;
		if (url != null) {
			this.url = url;
		} else if (route) {
			this.url = route.href(params);
		} else {
			throw new Error("MatchResult requires either a url or a route");
		}
	}

	/** Mark this result as a redirect, recording the original match it came from. */
	isRedirect({ original }: { original: MatchResult | false }): void {
		this.redirect = true;
		this.original = original || null;
	}
}
