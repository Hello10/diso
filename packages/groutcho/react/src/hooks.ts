import type {
	GoListener,
	Input,
	MatchResult,
	Route,
	RouteError,
	RouterStore,
	RouterStoreConfig,
} from "@diso.io/groutcho";
import { createRouter } from "@diso.io/groutcho";
import {
	useCallback,
	useContext,
	useEffect,
	useRef,
	useSyncExternalStore,
} from "react";

import { RouterContext } from "./context";

/**
 * Create a router store that persists across renders. Prefer using
 * `RouterProvider`; use this directly only when managing the store yourself.
 */
export function useRouterStore(config: RouterStoreConfig): RouterStore {
	const ref = useRef<RouterStore | null>(null);
	if (ref.current === null) {
		ref.current = createRouter(config);
	}
	return ref.current;
}

/** The current router store from context. Throws outside a `RouterProvider`. */
export function useRouter(): RouterStore {
	const store = useContext(RouterContext);
	if (!store) {
		throw new Error("useRouter must be used within a <RouterProvider>");
	}
	return store;
}

/**
 * Subscribe to the current match. Re-renders on navigation via
 * `useSyncExternalStore`. Uses the provided store or the context store.
 */
export function useMatch(store?: RouterStore): MatchResult {
	const context = useContext(RouterContext);
	const resolved = store ?? context;
	if (!resolved) {
		throw new Error(
			"useMatch must be used within a <RouterProvider> or given a store",
		);
	}
	return useSyncExternalStore(
		resolved.subscribe,
		resolved.getSnapshot,
		resolved.getSnapshot,
	);
}

/** A stable `go` function for the context store. */
export function useGo(): (input: Input) => MatchResult {
	const store = useRouter();
	return useCallback((input: Input) => store.go(input), [store]);
}

/**
 * Subscribe an effect to navigation. The callback fires with `(prev, current)`
 * after each successful nav. The callback is captured in a ref, so you can pass
 * an inline function without re-subscribing every render.
 */
export function useOnGo(listener: GoListener): void {
	const store = useRouter();
	const ref = useRef(listener);
	ref.current = listener;
	useEffect(
		() => store.onGo((prev, current) => ref.current(prev, current)),
		[store],
	);
}

/**
 * Look up a route by name. Routes are static per router — no subscription. Use
 * `.href(params)` on the returned route to build a URL.
 */
export function useRoute(name: string): Route {
	return useRouter().get(name);
}

/**
 * Imperatively set the current title. Fires on mount and on `title` changes.
 * Does not restore on unmount — the next navigation resets the title from
 * `route.title`.
 */
export function useTitle(title: string): void {
	const store = useRouter();
	useEffect(() => {
		store.setTitle(title);
	}, [store, title]);
}

/**
 * Read the error attached to the current match (populated by adapters when a
 * page render throws). Re-renders on nav via `useMatch`.
 */
export function useError(): RouteError | undefined {
	return useMatch().error;
}
