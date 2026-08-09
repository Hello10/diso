import type {
	Input,
	MatchResult,
	RouterStore,
	RouterStoreConfig,
} from "@diso.io/groutcho";
import { createRouter } from "@diso.io/groutcho";
import { useCallback, useContext, useRef, useSyncExternalStore } from "react";

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
