import type { Route } from "./Route";
import type { InputObject, Params } from "./types";

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
 */
export class MatchResult {
	input: InputObject;
	route: Route | null;
	params: Params;
	redirect: boolean;
	original: MatchResult | null;
	url: string;

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
		if (url != null) {
			this.url = url;
		} else if (route) {
			this.url = route.buildUrl(params);
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
