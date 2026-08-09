import type { MatchResult } from "./MatchResult";
import { Router } from "./Router";
import type { Input, RouterConfig } from "./types";

/**
 * Pluggable history/location seam. The core never touches `window` directly —
 * only `createBrowserHistory` does — so the matching engine and store run in any
 * JS runtime (browser, Node, workers, React Native) with an appropriate history.
 */
export interface History {
	/** Current location as a root-relative url (pathname + search + hash). */
	location(): string;
	/** Navigate, pushing a new entry. */
	push(url: string): void;
	/** Navigate, replacing the current entry (used for redirects). */
	replace(url: string): void;
	/** Subscribe to external location changes (e.g. back/forward). Returns an unsubscribe. */
	subscribe(listener: () => void): () => void;
}

function isExternal(url: string): boolean {
	return /^[a-z][a-z0-9+.-]*:\/\//i.test(url);
}

/** Browser history backed by `window.location` + `popstate`. */
export function createBrowserHistory(): History {
	const listeners = new Set<() => void>();
	const notify = (): void => {
		for (const listener of listeners) listener();
	};
	return {
		location() {
			const { pathname, search, hash } = window.location;
			return `${pathname}${search}${hash}`;
		},
		push(url) {
			// pushState does not fire popstate, so notify subscribers ourselves.
			window.history.pushState({}, "", url);
			notify();
		},
		replace(url) {
			// replace is used for redirect reflection — silent, to avoid re-resolving.
			window.history.replaceState({}, "", url);
		},
		subscribe(listener) {
			if (listeners.size === 0) {
				window.addEventListener("popstate", notify);
			}
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
				if (listeners.size === 0) {
					window.removeEventListener("popstate", notify);
				}
			};
		},
	};
}

/** In-memory history for SSR, tests, and non-DOM runtimes. */
export function createMemoryHistory(initial = "/"): History {
	let current = initial;
	const listeners = new Set<() => void>();
	const emit = (): void => {
		for (const listener of listeners) listener();
	};
	return {
		location() {
			return current;
		},
		push(url) {
			current = url;
			emit();
		},
		replace(url) {
			current = url;
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
}

function defaultHistory(): History {
	const hasDom =
		typeof window !== "undefined" && !!window.history && !!window.location;
	return hasDom ? createBrowserHistory() : createMemoryHistory();
}

export interface RouterStoreConfig extends RouterConfig {
	/** History implementation. Defaults to browser when a DOM is present, else memory. */
	history?: History;
}

export type StoreListener = (match: MatchResult) => void;

/**
 * A framework-agnostic router store: wraps a `Router` + a `History`, keeps a
 * current snapshot in sync with the location, and exposes a
 * subscribe/getSnapshot pair that plugs directly into React's
 * `useSyncExternalStore` or a Lit `ReactiveController`.
 */
export interface RouterStore {
	readonly router: Router;
	readonly history: History;
	/** Match without navigating. */
	match(input: Input): MatchResult;
	/** Navigate to input, updating history and notifying subscribers. */
	go(input: Input): MatchResult;
	/** Current resolved match for the location. */
	getSnapshot(): MatchResult;
	/** Subscribe to snapshot changes. Returns an unsubscribe. */
	subscribe(listener: StoreListener): () => void;
	/** Detach from history and drop all subscribers. */
	destroy(): void;
}

export function createRouter(config: RouterStoreConfig): RouterStore {
	const { history = defaultHistory(), ...routerConfig } = config;
	const router = new Router(routerConfig);
	const listeners = new Set<StoreListener>();

	function resolve(url: string): MatchResult {
		const match = router.match({ url });
		// Reflect an in-app redirect target in the address bar without a new entry.
		if (
			match?.redirect &&
			match.url &&
			!isExternal(match.url) &&
			match.url !== url
		) {
			history.replace(match.url);
		}
		return match;
	}

	let snapshot = resolve(history.location());

	function emit(): void {
		for (const listener of listeners) listener(snapshot);
	}

	function refresh(): void {
		snapshot = resolve(history.location());
		emit();
	}

	const unsubscribeHistory = history.subscribe(refresh);

	return {
		router,
		history,
		match: (input) => router.match(input),
		go(input) {
			const match = router.go(input);
			if (match.url && !isExternal(match.url)) {
				// Route through history; its notification drives snapshot + emit once.
				history.push(match.url);
			} else if (match.url) {
				// External url: don't pushState cross-origin; record + notify directly.
				snapshot = match;
				emit();
			}
			return match;
		},
		getSnapshot: () => snapshot,
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		destroy() {
			unsubscribeHistory();
			listeners.clear();
		},
	};
}
