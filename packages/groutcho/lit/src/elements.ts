import type {
	Component,
	Input,
	MatchResult,
	Params,
	Route,
	RouteConfig,
	RouterStore,
} from "@diso.io/groutcho";
import { consume } from "@lit/context";
import { html, LitElement, nothing, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";

import { routerContext } from "./context";

// Naming: element tags use the `diso-` namespace shared by all `@diso.io/*`
// libraries. Do not use per-library prefixes (no `<groutcho-*>`).

/** How an outlet turns a match into renderable content. */
export type RenderPage = (match: MatchResult) => unknown;

/**
 * Layout function shape. Receives the current match and the inner content
 * (already-rendered page or nested layout). Layouts compose outermost-first.
 */
export type LayoutFn = (match: MatchResult, children: unknown) => unknown;

/**
 * Base class shared by the router elements: resolves a store from an explicit
 * `.store` property or the router context, and re-renders on navigation.
 */
abstract class RouterElement extends LitElement {
	/** Explicit store; takes precedence over the context store. */
	@property({ attribute: false }) store?: RouterStore;

	@consume({ context: routerContext, subscribe: true })
	@property({ attribute: false })
	contextStore?: RouterStore;

	#unsubscribe?: () => void;
	#subscribed?: RouterStore;

	protected get router(): RouterStore | undefined {
		return this.store ?? this.contextStore;
	}

	override connectedCallback(): void {
		super.connectedCallback();
		this.#sync();
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		this.#unsubscribe?.();
		this.#unsubscribe = undefined;
		this.#subscribed = undefined;
	}

	protected override willUpdate(changed: Map<PropertyKey, unknown>): void {
		if (changed.has("store") || changed.has("contextStore")) {
			this.#sync();
		}
	}

	#sync(): void {
		const next = this.router;
		if (next === this.#subscribed) {
			return;
		}
		this.#unsubscribe?.();
		this.#subscribed = next;
		this.#unsubscribe = next?.subscribe(() => this.requestUpdate());
	}
}

function callPage(page: Component, match: MatchResult): unknown {
	if (typeof page === "function") {
		return (page as RenderPage)(match);
	}
	return (page as unknown) ?? nothing;
}

function walkLayouts(
	route: Route | null,
	inner: unknown,
	match: MatchResult,
): unknown {
	const layout = route?.layout as RouteConfig["layout"] | undefined;
	if (!layout) return inner;
	const chain = Array.isArray(layout) ? layout : [layout];
	// Outermost first: fold right so index 0 wraps everything else. Layouts are
	// `(match, children) => unknown` — see `LayoutFn`.
	return chain.reduceRight<unknown>(
		(child, L) => (L as LayoutFn)(match, child),
		inner,
	);
}

/**
 * Renders the page for the current match, walking `route.layout` if present.
 * Layout functions receive the match plus a `children` slot; typical usage:
 *
 * ```ts
 * const Layout = (m) => html`<nav>...</nav>${m.children}`;
 * ```
 *
 * ```html
 * <diso-outlet .store=${store}></diso-outlet>
 * ```
 */
@customElement("diso-outlet")
export class DisoOutlet extends RouterElement {
	/** Optional custom renderer; overrides the default page handling. */
	@property({ attribute: false }) renderPage?: RenderPage;

	override render(): unknown {
		const router = this.router;
		if (!router) {
			return nothing;
		}
		const match = router.getSnapshot();
		// If the current match carries an error, render the route's or the
		// store's errorPage instead of the page.
		if (match.error) {
			const errPage =
				(match.route?.errorPage as Component | undefined) ?? router.errorPage;
			if (errPage) return callPage(errPage, match);
		}
		if (this.renderPage) {
			return this.renderPage(match);
		}
		try {
			const inner = callPage(match.route?.page as Component, match);
			return walkLayouts(match.route, inner, match);
		} catch (error) {
			router.setError({
				message: error instanceof Error ? error.message : String(error),
				cause: error,
			});
			const errPage =
				(match.route?.errorPage as Component | undefined) ?? router.errorPage;
			return errPage ? callPage(errPage, match) : nothing;
		}
	}
}

interface AnchorTargetProps {
	to?: string;
	params?: Params;
	input?: Input;
}

function buildInput(el: AnchorTargetProps): Input {
	if (el.input !== undefined) {
		return el.input;
	}
	if (el.params && el.to && !el.to.includes("/")) {
		return { route: { name: el.to, params: el.params } };
	}
	return el.to ?? "";
}

function buildHref(router: RouterStore | undefined, target: Input): string {
	if (!router) return typeof target === "string" ? target || "#" : "#";
	try {
		return router.match(target).url;
	} catch {
		return typeof target === "string" ? target || "#" : "#";
	}
}

/**
 * An `<a>` that navigates via the router instead of reloading. Set `to` to a url
 * or route name (with optional `.params`), or pass a full `.input`.
 * Modifier/middle clicks fall through to default browser behavior.
 *
 * ```html
 * <diso-link to="Home">Home</diso-link>
 * <diso-link to="/show/hi">Show</diso-link>
 * ```
 */
@customElement("diso-link")
export class DisoLink extends RouterElement {
	/** A url or route name to navigate to. */
	@property() to = "";

	/** Params used with a route-name `to` (and to build the href). */
	@property({ attribute: false }) params?: Params;

	/** A full input object; takes precedence over `to`/`params`. */
	@property({ attribute: false }) input?: Input;

	protected get target(): Input {
		return buildInput(this);
	}

	protected href(): string {
		return buildHref(this.router, this.target);
	}

	protected onClick = (event: MouseEvent): void => {
		if (
			event.defaultPrevented ||
			event.button !== 0 ||
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey
		) {
			return;
		}
		const router = this.router;
		if (!router) return;
		event.preventDefault();
		router.go(this.target);
	};

	override render(): TemplateResult {
		return html`<a href=${this.href()} @click=${this.onClick}><slot></slot></a>`;
	}
}

/**
 * A `<diso-link>` that applies `activeClass` to its `<a>` when the current
 * match refers to the same route (name-shaped `to`) or matches the pathname
 * (path-shaped `to`). Use `activeExact` to require exact path equality rather
 * than a prefix match.
 *
 * ```html
 * <diso-nav-link to="Home" active-class="on">Home</diso-nav-link>
 * ```
 */
@customElement("diso-nav-link")
export class DisoNavLink extends DisoLink {
	/** Class name added to the `<a>` when active. Defaults to `"active"`. */
	@property({ attribute: "active-class" }) activeClass = "active";

	/** Match strictly against the current pathname / route-name (no prefix). */
	@property({ attribute: "active-exact", type: Boolean }) activeExact = false;

	private isActive(match: MatchResult): boolean {
		if (!this.to) return false;
		if (this.to.includes("/")) {
			const path = (match.url ?? "").split("?")[0] ?? "";
			return this.activeExact
				? path === this.to
				: path === this.to || path.startsWith(`${this.to}/`);
		}
		return match.route?.name === this.to;
	}

	override render(): TemplateResult {
		const router = this.router;
		const match = router?.getSnapshot();
		const active = match ? this.isActive(match) : false;
		return html`<a
			href=${this.href()}
			class=${active ? this.activeClass : ""}
			@click=${this.onClick}
			><slot></slot></a>`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		"diso-outlet": DisoOutlet;
		"diso-link": DisoLink;
		"diso-nav-link": DisoNavLink;
	}
}
