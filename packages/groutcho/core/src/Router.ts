import { logger } from "./logger";
import { MatchResult } from "./MatchResult";
import { Route } from "./Route";
import type {
	Input,
	InputObject,
	RedirectResult,
	RedirectTest,
	RouteConfig,
	RouterConfig,
} from "./types";

function omit(
	obj: Record<string, unknown>,
	keys: string[],
): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(obj)) {
		if (!keys.includes(key)) {
			out[key] = value;
		}
	}
	return out;
}

interface RedirectEntry {
	name: string;
	test: RedirectTest;
}

interface CheckRedirectsArgs {
	original: MatchResult | false;
	extra: Record<string, unknown>;
	previous?: MatchResult | false | null;
	current?: MatchResult | false | null;
	num_redirects?: number;
	history?: Array<MatchResult | false>;
}

export class Router {
	routes: Route[] = [];
	redirects: RedirectEntry[] = [];
	max_redirects: number;

	constructor({ routes, redirects = {}, max_redirects = 10 }: RouterConfig) {
		this.max_redirects = max_redirects;
		this.addRoutes(routes);
		for (const [name, test] of Object.entries(redirects)) {
			this.redirects.push({ name, test });
		}
		logger.debug("Constructed router", this);
	}

	addRoutes(routes: Record<string, RouteConfig>): void {
		for (const [name, config] of Object.entries(routes)) {
			config.name = name;
			const route = new Route(config);
			logger.debug("Adding route", route);
			this.routes.push(route);
		}
	}

	/** Lookup a route by name. Throws if none is registered under that name. */
	get(name: string): Route {
		const route = this.find({ name });
		if (!route) {
			const msg = `No route named ${name}`;
			logger.error(msg);
			throw new Error(msg);
		}
		return route;
	}

	/** Find a route by arbitrary field equality. Returns undefined when none match. */
	find(query: Record<string, unknown>): Route | undefined {
		return this.routes.find((route) =>
			Object.entries(query).every(
				([key, value]) => (route as Record<string, unknown>)[key] === value,
			),
		);
	}

	/**
	 * Match input against the routes, following any redirects.
	 * Returns the resolved (possibly redirect) MatchResult.
	 */
	match(input: Input): MatchResult {
		const normalized = this.normalizeInput(input);
		const extra = omit(normalized, ["route", "url"]);
		const original = this.#match(normalized);
		const redirect = this.#checkRedirects({ original, extra });
		logger.debug("match", { input: normalized, original, redirect });
		if (redirect) {
			redirect.isRedirect({ original });
			return redirect;
		}
		// With no redirect, return the original match. When nothing matched and no
		// NotFound-style rule is configured this is `false`; callers that want a
		// guaranteed match should add such a rule.
		return original as MatchResult;
	}

	normalizeInput(input: Input): InputObject {
		if (typeof input === "string") {
			if (input.indexOf("/") !== -1) {
				return { url: input };
			}
			return { route: { name: input } };
		}
		if (input !== null && typeof input === "object") {
			if (input.name) {
				return { route: input as { name: string } };
			}
			return input;
		}
		const error = new Error("Invalid input") as Error & { input?: unknown };
		error.input = input;
		throw error;
	}

	/**
	 * Resolve an input. Kept as an alias for {@link match} so `Router` can be used
	 * directly in tests without going through a store. The store's `go` (in
	 * history.ts) is what apps use — it updates history and notifies listeners.
	 */
	go(input: Input): MatchResult {
		return this.match(input);
	}

	#match(input: InputObject): MatchResult | false {
		logger.debug("Attempting to match route", input);
		const { url } = input;
		// A full external url is treated as a redirect out of the app.
		if (url && /^https?:\/\//.test(url)) {
			return new MatchResult({ redirect: true, input, url });
		}

		let match: MatchResult | false = false;
		for (const route of this.routes) {
			match = route.match(input);
			if (match) {
				break;
			}
		}
		return match;
	}

	#checkRedirects(args: CheckRedirectsArgs): MatchResult | false {
		const { original, extra } = args;
		let {
			previous = null,
			current = null,
			num_redirects = 0,
			history = [],
		} = args;
		logger.debug("Checking redirects", {
			original,
			extra,
			previous,
			current,
			num_redirects,
			history,
		});

		const { max_redirects } = this;
		if (num_redirects >= max_redirects) {
			const msg = `Number of redirects exceeded max_redirects (${max_redirects})`;
			logger.error(msg);
			throw new Error(msg);
		}

		const deepEqual = (a: unknown, b: unknown): boolean =>
			JSON.stringify(a) === JSON.stringify(b);

		// If current is the same route+params as previous, we've looped — stop.
		if (current && previous) {
			const sameRoute = current.route === previous.route;
			const sameParams = deepEqual(current.params, previous.params);
			if (sameRoute && sameParams) {
				logger.debug("Route is same as previous", { current, previous });
				return previous;
			}
		}

		if (!current) {
			current = original;
			history = [original];
		}

		// `current` may be `false` (no match); narrow to null so chaining is legal.
		const matched = current === false ? null : current;
		if (matched?.redirect) {
			return matched;
		}

		let next: RedirectResult = false;
		if (matched?.route?.redirect) {
			next = matched.route.redirect(matched);
		}

		if (!next) {
			for (const { test } of this.redirects) {
				next = test(current);
				if (next) {
					break;
				}
			}
		}

		if (next) {
			logger.debug("Got redirect", { current, next });
			previous = current;
			const normalizedNext = this.normalizeInput(next as Input);
			current = this.#match({ ...normalizedNext, ...extra });
			if (!current) {
				const error = new Error("No match for redirect result") as Error & {
					redirect?: unknown;
				};
				error.redirect = normalizedNext;
				throw error;
			}
			history.push(current);
			num_redirects++;
			return this.#checkRedirects({
				original,
				previous,
				current,
				num_redirects,
				history,
				extra,
			});
		}

		if (num_redirects > 0) {
			return current;
		}
		return false;
	}
}
