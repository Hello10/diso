import type { MatchResult } from "./MatchResult";
import type { Route } from "./Route";
import { Router } from "./Router";
import type {
	Component,
	Input,
	RouteError,
	RouterConfig,
	TitleValue,
} from "./types";

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
	/** Go back one entry in the history stack. */
	back(): void;
	/** Go forward one entry in the history stack. */
	forward(): void;
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
		back() {
			window.history.back();
		},
		forward() {
			window.history.forward();
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
	const stack: string[] = [initial];
	let index = 0;
	const listeners = new Set<() => void>();
	const emit = (): void => {
		for (const listener of listeners) listener();
	};
	return {
		location() {
			return stack[index] ?? "/";
		},
		push(url) {
			stack.length = index + 1;
			stack.push(url);
			index += 1;
			emit();
		},
		replace(url) {
			stack[index] = url;
		},
		back() {
			if (index > 0) {
				index -= 1;
				emit();
			}
		},
		forward() {
			if (index < stack.length - 1) {
				index += 1;
				emit();
			}
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

/** Snapshot listener (React's `useSyncExternalStore` shape). Fires with the new match. */
export type StoreListener = (match: MatchResult) => void;
/** Fires on each successful nav with both the previous and the new match. */
export type GoListener = (prev: MatchResult, current: MatchResult) => void;
/** Fires when the title changes (from a nav or an explicit `setTitle`). */
export type TitleListener = (title: string) => void;
/** Fires when an error is set on the current match (typically from an adapter). */
export type ErrorListener = (error: RouteError | undefined) => void;

/**
 * A framework-agnostic router store: wraps a `Router` + a `History`, keeps a
 * current snapshot in sync with the location, and exposes subscribe/getSnapshot
 * for React `useSyncExternalStore` plus richer channels (`onGo`, `onTitle`,
 * `onError`) that adapters wire to effects.
 *
 * Naming: the router action is `go` everywhere. Subscriptions to that action
 * are `onGo`. Never `navigate`.
 */
export interface RouterStore {
	readonly router: Router;
	readonly history: History;
	/** Fallback error UI (from config). Adapters use this when a route has no `errorPage`. */
	readonly errorPage: Component | undefined;
	/** Match without navigating. */
	match(input: Input): MatchResult;
	/** Navigate to input, updating history and notifying subscribers. */
	go(input: Input): MatchResult;
	/** Shortcut for `router.get(name)` — look up a route by name. */
	get(name: string): Route;
	/** Current resolved match for the location. */
	getSnapshot(): MatchResult;
	/** Subscribe to snapshot changes. Returns an unsubscribe. */
	subscribe(listener: StoreListener): () => void;
	/**
	 * Subscribe to nav events. Fires with `(prev, current)` after each
	 * successful navigation. Returns an unsubscribe.
	 */
	onGo(listener: GoListener): () => void;
	/** Current title string. Recomputed from `match.route.title` on each nav. */
	readonly title: string;
	/** Set the title (fires `onTitle`; overrides route title until next nav). */
	setTitle(title: string): void;
	onTitle(listener: TitleListener): () => void;
	/** Set an error on the current match (fires `onError`). Called by adapters. */
	setError(error: RouteError | undefined): void;
	onError(listener: ErrorListener): () => void;
	/** Detach from history and drop all subscribers. */
	destroy(): void;
}

function resolveTitle(match: MatchResult): string {
	const raw = match.route?.title as TitleValue | undefined;
	if (raw === undefined) return "";
	return typeof raw === "function" ? raw(match) : raw;
}

export function createRouter(config: RouterStoreConfig): RouterStore {
	const { history = defaultHistory(), errorPage, ...routerConfig } = config;
	const router = new Router(routerConfig);

	const snapshotListeners = new Set<StoreListener>();
	const goListeners = new Set<GoListener>();
	const titleListeners = new Set<TitleListener>();
	const errorListeners = new Set<ErrorListener>();

	let keySeq = 0;

	function stamp(match: MatchResult): MatchResult {
		keySeq += 1;
		match.key = keySeq;
		return match;
	}

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
		return stamp(match);
	}

	let snapshot = resolve(history.location());
	let title = resolveTitle(snapshot);

	function emitSnapshot(prev: MatchResult): void {
		for (const listener of snapshotListeners) listener(snapshot);
		for (const listener of goListeners) listener(prev, snapshot);
	}

	function emitTitle(): void {
		for (const listener of titleListeners) listener(title);
	}

	function emitError(): void {
		for (const listener of errorListeners) listener(snapshot.error);
	}

	function applyRouteTitle(): void {
		const next = resolveTitle(snapshot);
		if (next !== title) {
			title = next;
			emitTitle();
		}
	}

	function refresh(): void {
		const prev = snapshot;
		snapshot = resolve(history.location());
		applyRouteTitle();
		emitSnapshot(prev);
	}

	const unsubscribeHistory = history.subscribe(refresh);

	const store: RouterStore = {
		router,
		history,
		errorPage,
		match: (input) => router.match(input),
		go(input) {
			const prev = snapshot;
			const match = router.go(input);
			if (match.url && !isExternal(match.url)) {
				// Route through history; its notification drives snapshot + emit once
				// (refresh() will stamp the new match with a fresh key). Return the
				// resulting snapshot so callers see the same object subscribers do.
				history.push(match.url);
				return snapshot;
			}
			if (match.url) {
				// External url: don't pushState cross-origin; record + notify directly.
				snapshot = stamp(match);
				applyRouteTitle();
				emitSnapshot(prev);
			}
			return match;
		},
		get: (name) => router.get(name),
		getSnapshot: () => snapshot,
		subscribe(listener) {
			snapshotListeners.add(listener);
			return () => {
				snapshotListeners.delete(listener);
			};
		},
		onGo(listener) {
			goListeners.add(listener);
			return () => {
				goListeners.delete(listener);
			};
		},
		get title() {
			return title;
		},
		setTitle(next) {
			if (next !== title) {
				title = next;
				emitTitle();
			}
		},
		onTitle(listener) {
			titleListeners.add(listener);
			return () => {
				titleListeners.delete(listener);
			};
		},
		setError(next) {
			if (next !== snapshot.error) {
				// Produce a new snapshot object so `useSyncExternalStore`-shaped
				// subscribers see a reference change and re-render. Preserve the
				// MatchResult prototype for consumers doing `instanceof` checks.
				const updated = Object.assign(
					Object.create(Object.getPrototypeOf(snapshot)),
					snapshot,
					{ error: next },
				);
				snapshot = updated;
				emitError();
				for (const listener of snapshotListeners) listener(snapshot);
			}
		},
		onError(listener) {
			errorListeners.add(listener);
			return () => {
				errorListeners.delete(listener);
			};
		},
		destroy() {
			unsubscribeHistory();
			snapshotListeners.clear();
			goListeners.clear();
			titleListeners.clear();
			errorListeners.clear();
		},
	};

	return store;
}
