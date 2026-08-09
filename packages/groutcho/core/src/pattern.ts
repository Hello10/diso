import { URLPattern as URLPatternPolyfill } from "urlpattern-polyfill";

import type { Params } from "./types";

// Prefer a native URLPattern when the runtime provides one (browsers, Node >= 24),
// otherwise fall back to the pure-JS polyfill. Resolved once at module load.
const URLPatternImpl: typeof URLPatternPolyfill =
	(globalThis as { URLPattern?: typeof URLPatternPolyfill }).URLPattern ??
	URLPatternPolyfill;

export type Matcher = InstanceType<typeof URLPatternImpl>;

/** Named param descriptor parsed from a pattern's `:name` token + modifier. */
export interface ParamKey {
	name: string;
	/** `?` (optional single) or `*` (zero-or-more) — may be absent from the url. */
	optional: boolean;
	/** `+` (one-or-more) or `*` (zero-or-more) — spans multiple path segments. */
	repeat: boolean;
}

// Matches `:name` with an optional `?` / `+` / `*` modifier (URLPattern group
// syntax we support for reverse routing). Ident chars mirror URLPattern's rules.
const IDENT = "[A-Za-z_$][A-Za-z0-9_$]*";
const TOKEN = new RegExp(`:(${IDENT})([?+*])?`, "g");
// A repeatable/optional token together with its preceding slash: `/…:name?` etc.
const SLASH_TOKEN = new RegExp(`/:(${IDENT})([?*])`, "g");

/** The companion array-accessor key for a repeat param (`path` -> `pathArray`). */
export function arrayKey(name: string): string {
	return `${name}Array`;
}

export function makeMatcher(pattern: string): Matcher {
	return new URLPatternImpl({ pathname: pattern });
}

/** Test whether a pathname matches the matcher. */
export function testPath(matcher: Matcher, pathname: string): boolean {
	return matcher.test({ pathname });
}

/** Exec a pathname against the matcher, returning its named groups or null. */
export function matchPath(
	matcher: Matcher,
	pathname: string,
): Record<string, string | undefined> | null {
	const result = matcher.exec({ pathname });
	return result ? result.pathname.groups : null;
}

/** Parse the named params declared by a pattern, in order. */
export function patternParamNames(pattern: string): ParamKey[] {
	const keys: ParamKey[] = [];
	for (const match of pattern.matchAll(TOKEN)) {
		const modifier = match[2];
		keys.push({
			name: match[1] ?? "",
			optional: modifier === "?" || modifier === "*",
			repeat: modifier === "+" || modifier === "*",
		});
	}
	return keys;
}

function isEmpty(value: unknown): boolean {
	return (
		value === undefined ||
		value === null ||
		value === "" ||
		(Array.isArray(value) && value.length === 0)
	);
}

/** Encode a single path segment. */
function encodeSingle(value: unknown): string {
	return encodeURIComponent(String(value));
}

/**
 * Encode a value into a path fragment. Repeat params accept an array of segments
 * or a pre-joined `a/b/c` string; either way each segment is encoded and joined
 * with `/`.
 */
function encodeValue(value: unknown, repeat: boolean): string {
	if (!repeat) {
		return encodeSingle(value);
	}
	const segments = Array.isArray(value) ? value : String(value).split("/");
	return segments.map(encodeSingle).join("/");
}

export interface CompiledPath {
	path: string;
	/** Names of params consumed by the path (the rest belong in the query). */
	consumed: Set<string>;
}

/**
 * Reverse-router: build a concrete path from a pattern + params. URLPattern can
 * match but not build, so we compile `:name` tokens ourselves. Optional/repeat
 * tokens (with their leading slash) are dropped when the param is absent.
 * Repeat params read either `name` or its `nameArray` companion.
 */
export function compilePath(pattern: string, params: Params): CompiledPath {
	const consumed = new Set<string>();

	function take(name: string, repeat: boolean): unknown {
		consumed.add(name);
		if (repeat) {
			consumed.add(arrayKey(name));
			return params[name] !== undefined ? params[name] : params[arrayKey(name)];
		}
		return params[name];
	}

	// Optional segments first, consuming the preceding slash: `/optional/:opt?`,
	// `/files/:path*`. `?` is a single optional; `*` is an optional repeat.
	let path = pattern.replace(
		SLASH_TOKEN,
		(_all, name: string, modifier: string) => {
			const repeat = modifier === "*";
			const value = take(name, repeat);
			if (isEmpty(value)) {
				return "";
			}
			return `/${encodeValue(value, repeat)}`;
		},
	);

	// Remaining required tokens: `:name` and one-or-more `:name+`.
	path = path.replace(TOKEN, (_all, name: string, modifier?: string) => {
		const repeat = modifier === "+";
		const value = take(name, repeat);
		if (isEmpty(value)) {
			if (modifier === "?" || modifier === "*") {
				return "";
			}
			throw new Error(
				`Missing required param "${name}" for pattern "${pattern}"`,
			);
		}
		return encodeValue(value, repeat);
	});

	return { path, consumed };
}
