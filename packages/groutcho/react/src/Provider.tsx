import type {
	Component,
	History,
	MatchResult,
	RedirectTest,
	RouteConfig,
	RouterStore,
} from "@diso.io/groutcho";
import { createRouter } from "@diso.io/groutcho";
import {
	type ComponentType,
	createElement,
	Component as ReactComponent,
	type ReactNode,
	useContext,
	useEffect,
	useRef,
} from "react";

import { RouterContext } from "./context";
import { useMatch } from "./hooks";

export type ScrollBehavior =
	| "top"
	| "preserve"
	| "restore"
	| ((prev: MatchResult, current: MatchResult) => void);

export interface RouterRenderArgs {
	match: MatchResult;
	store: RouterStore;
}

export interface RouterProviderProps {
	/** An existing store to use. If omitted, one is created from the config below. */
	store?: RouterStore;
	routes?: Record<string, RouteConfig>;
	redirects?: Record<string, RedirectTest>;
	max_redirects?: number;
	/** History implementation (defaults to browser when a DOM is present). */
	history?: History;
	/** Global fallback error UI (used when the matched route has no `errorPage`). */
	errorPage?: Component;
	/**
	 * Mirror `store.title` to `document.title`. Defaults to `true`. Set `false`
	 * for SSR or when the host page manages the title itself.
	 */
	manageTitle?: boolean;
	/**
	 * How to reset scroll after each nav. Defaults to `"top"`. Custom function
	 * lets you inspect `(prev, current)` and scroll however you want (e.g. keep
	 * scroll for same-section nav).
	 */
	scrollBehavior?: ScrollBehavior;
	/**
	 * Children, or a render-prop called with the current `{ match, store }` that
	 * re-renders on navigation (back-compat with the old `RouterContainer`).
	 *
	 * When omitted, the provider renders the matched route's `page` wrapped in
	 * its `layout` chain — the typical "app shell" usage.
	 */
	children?: ReactNode | ((args: RouterRenderArgs) => ReactNode);
}

function RenderProp({
	store,
	children,
}: {
	store: RouterStore;
	children: (args: RouterRenderArgs) => ReactNode;
}) {
	const match = useMatch(store);
	return <>{children({ match, store })}</>;
}

interface ErrorBoundaryProps {
	store: RouterStore;
	fallback: Component | undefined;
	children: ReactNode;
	/** Reset key: when this changes the boundary re-tries rendering children. */
	resetKey: unknown;
}

interface ErrorBoundaryState {
	error: Error | null;
}

class PageErrorBoundary extends ReactComponent<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	override state: ErrorBoundaryState = { error: null };

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { error };
	}

	override componentDidCatch(error: Error): void {
		this.props.store.setError({ message: error.message, cause: error });
	}

	override componentDidUpdate(prev: ErrorBoundaryProps): void {
		if (prev.resetKey !== this.props.resetKey && this.state.error) {
			this.setState({ error: null });
			this.props.store.setError(undefined);
		}
	}

	override render(): ReactNode {
		if (this.state.error) {
			const fallback = this.props.fallback;
			if (fallback == null) return null;
			if (typeof fallback === "function") {
				return createElement(fallback as ComponentType);
			}
			return fallback as ReactNode;
		}
		return this.props.children;
	}
}

function normalizeLayouts(
	layout: RouteConfig["layout"] | undefined,
): ComponentType<{ children?: ReactNode }>[] {
	if (!layout) return [];
	const arr = Array.isArray(layout) ? layout : [layout];
	return arr.filter(Boolean) as ComponentType<{ children?: ReactNode }>[];
}

function renderMatch(match: MatchResult): ReactNode {
	const route = match.route;
	if (!route) return null;
	const page = route.page as ComponentType<Record<string, unknown>> | null;
	if (!page) return null;
	const pageEl = createElement(page, {
		...(match.params as Record<string, unknown>),
		match,
	});
	const layouts = normalizeLayouts(route.layout as RouteConfig["layout"]);
	return layouts.reduceRight<ReactNode>(
		(child, Layout) => createElement(Layout, null, child),
		pageEl,
	);
}

/**
 * Renders whatever the current match resolves to: the route's `page` wrapped in
 * its `layout` chain (outermost first), inside an error boundary that
 * surfaces render errors via `store.setError` and falls back to the route's
 * `errorPage` (or the provider's `errorPage`).
 */
function MatchRenderer({ store }: { store: RouterStore }): ReactNode {
	const match = useMatch(store);
	const routeErrorPage = match.route?.errorPage as Component | undefined;
	return (
		<PageErrorBoundary
			store={store}
			fallback={routeErrorPage ?? store.errorPage}
			resetKey={match.key}
		>
			{renderMatch(match)}
		</PageErrorBoundary>
	);
}

function useTitleMirror(store: RouterStore, enabled: boolean): void {
	useEffect(() => {
		if (!enabled || typeof document === "undefined") return;
		document.title = store.title;
		return store.onTitle((title) => {
			document.title = title;
		});
	}, [store, enabled]);
}

function useScrollBehavior(store: RouterStore, behavior: ScrollBehavior): void {
	useEffect(() => {
		if (typeof window === "undefined") return;
		return store.onGo((prev, current) => {
			if (typeof behavior === "function") {
				behavior(prev, current);
				return;
			}
			if (behavior === "top") {
				window.scrollTo(0, 0);
			}
			// "preserve" / "restore": no-op for now. "restore" wiring would need
			// per-key scroll positions kept in memory; add when a real app needs it.
		});
	}, [store, behavior]);
}

/**
 * Provides a router store to the tree. Supply `store`, or `routes`/`redirects`/
 * `history` to have one created (once). Children may be a render-prop, explicit
 * ReactNode, or omitted — in which case the matched route's `page` (+ layouts,
 * + error boundary) is rendered automatically.
 */
export function RouterProvider(props: RouterProviderProps) {
	const {
		store: provided,
		children,
		routes,
		redirects,
		max_redirects,
		history,
		errorPage,
		manageTitle = true,
		scrollBehavior = "top",
	} = props;

	const ref = useRef<RouterStore | null>(provided ?? null);
	if (ref.current === null) {
		if (!routes) {
			throw new Error("RouterProvider requires either a `store` or `routes`");
		}
		ref.current = createRouter({
			routes,
			redirects,
			max_redirects,
			history,
			errorPage,
		});
	}
	const store = ref.current;

	useTitleMirror(store, manageTitle);
	useScrollBehavior(store, scrollBehavior);

	let content: ReactNode;
	if (children === undefined) {
		content = <MatchRenderer store={store} />;
	} else if (typeof children === "function") {
		content = <RenderProp store={store}>{children}</RenderProp>;
	} else {
		content = children;
	}

	return (
		<RouterContext.Provider value={store}>{content}</RouterContext.Provider>
	);
}

/** Back-compat alias for the v3 `RouterContainer` render-prop component. */
export const RouterContainer = RouterProvider;

/**
 * Standalone matched-page renderer. Use this if you passed `children` to
 * `RouterProvider` (which suppresses auto-rendering) and want to place the
 * matched page somewhere inside your own layout.
 */
export function RouterOutlet() {
	const store = useContext(RouterContext);
	if (!store) {
		throw new Error("RouterOutlet must be used within a <RouterProvider>");
	}
	return <MatchRenderer store={store} />;
}
