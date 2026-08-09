import { MatchResult } from "./MatchResult";
import {
	arrayKey,
	compilePath,
	type Matcher,
	makeMatcher,
	matchPath,
	type ParamKey,
	patternParamNames,
	testPath,
} from "./pattern";
import type { InputObject, Params, RouteConfig, RouteRedirect } from "./types";

const REQUIRED_PARAMS = ["name", "pattern", "page"] as const;
const RESERVED_PARAMS = ["is", "match", "buildUrl"];

/** Convert a URLSearchParams into params, arraying repeated keys. */
function searchToParams(search: URLSearchParams): Params {
	const params: Params = {};
	for (const key of new Set(search.keys())) {
		const all = search.getAll(key);
		params[key] = all.length > 1 ? all : all[0];
	}
	return params;
}

export class Route {
	name!: string;
	pattern!: string;
	page: unknown;
	redirect?: RouteRedirect;
	// Arbitrary route metadata (e.g. `session`, `role`) copied from config.
	[key: string]: unknown;

	#matcher: Matcher;
	#paramKeys: ParamKey[];

	constructor(config: RouteConfig) {
		for (const param of REQUIRED_PARAMS) {
			if (!(param in config)) {
				throw new Error(`Missing route param ${param}`);
			}
		}

		// Copy all config onto the route, guarding against clobbering methods.
		for (const [key, value] of Object.entries(config)) {
			if (RESERVED_PARAMS.includes(key)) {
				throw new Error(`Invalid route param ${key}`);
			}
			(this as Record<string, unknown>)[key] = value;
		}

		this.#matcher = makeMatcher(this.pattern);
		this.#paramKeys = patternParamNames(this.pattern);
	}

	/** Match against a url input or a route input. */
	match(input: InputObject): MatchResult | false {
		return input.url ? this.#matchUrl(input) : this.#matchRoute(input);
	}

	/**
	 * Test whether this route matches. A `/`-containing string is matched against
	 * the pattern; otherwise it's compared to the route name.
	 */
	is(test: string): boolean {
		if (test.indexOf("/") !== -1) {
			return testPath(this.#matcher, new URL(test, "http://x/").pathname);
		}
		return this.name === test;
	}

	buildUrl(params: Params = {}): string {
		const { path, consumed } = compilePath(this.pattern, params);
		const query = new URLSearchParams();
		for (const [key, value] of Object.entries(params)) {
			if (consumed.has(key) || value === undefined || value === null) {
				continue;
			}
			if (Array.isArray(value)) {
				for (const item of value) {
					query.append(key, String(item));
				}
			} else {
				query.append(key, String(value));
			}
		}
		const qs = query.toString();
		return qs ? `${path}?${qs}` : path;
	}

	#matchUrl(input: InputObject): MatchResult | false {
		const url = input.url as string;
		const parsed = new URL(url, "http://x/");
		const groups = matchPath(this.#matcher, parsed.pathname);
		if (!groups) {
			return false;
		}
		const routeParams = this.#groupParams(groups);
		const queryParams = searchToParams(parsed.searchParams);
		const params = { ...routeParams, ...queryParams };
		return new MatchResult({ route: this, input, params });
	}

	// Matches if the name matches and all required (non-optional) params present.
	#matchRoute(input: InputObject): MatchResult | false {
		const route = input.route;
		if (!route || route.name !== this.name) {
			return false;
		}
		const params = route.params ?? {};
		// A required param is present if its name is set — or, for a repeat param,
		// either its name or its `nameArray` accessor.
		const hasAll = this.#paramKeys
			.filter((key) => !key.optional)
			.every(
				(key) =>
					key.name in params || (key.repeat && arrayKey(key.name) in params),
			);
		if (!hasAll) {
			return false;
		}
		return new MatchResult({ route: this, input, params });
	}

	#groupParams(groups: Record<string, string | undefined>): Params {
		const params: Params = {};
		for (const { name, optional, repeat } of this.#paramKeys) {
			const raw = groups[name];
			const defined = raw !== undefined && raw !== "";
			if (repeat) {
				// Repeat params span multiple segments. Expose both the raw joined
				// string (`path`) and the split, decoded segments (`pathArray`).
				if (defined) {
					const segments = raw
						.split("/")
						.map((segment) => decodeURIComponent(segment));
					params[name] = segments.join("/");
					params[arrayKey(name)] = segments;
				} else if (!optional) {
					params[name] = raw;
					params[arrayKey(name)] = [];
				}
			} else if (defined) {
				params[name] = decodeURIComponent(raw);
			} else if (!optional) {
				params[name] = raw;
			}
		}
		return params;
	}
}
