import type {
	Input,
	MatchResult,
	Params,
	RouterStore,
} from "@diso.io/groutcho";
import { consume } from "@lit/context";
import { html, LitElement, nothing, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";

import { routerContext } from "./context";

/** How an outlet turns a match into renderable content. */
export type RenderPage = (match: MatchResult) => unknown;

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

/**
 * Renders the page for the current match. By default a route's `page` is called
 * as `(match) => unknown` when it's a function, otherwise rendered directly.
 * Override rendering with the `.renderPage` property.
 *
 * ```html
 * <groutcho-outlet .store=${store}></groutcho-outlet>
 * ```
 */
@customElement("groutcho-outlet")
export class GroutchoOutlet extends RouterElement {
	/** Optional custom renderer; overrides the default page handling. */
	@property({ attribute: false }) renderPage?: RenderPage;

	override render(): unknown {
		const router = this.router;
		if (!router) {
			return nothing;
		}
		const match = router.getSnapshot();
		if (this.renderPage) {
			return this.renderPage(match);
		}
		const page = match.route?.page;
		if (typeof page === "function") {
			return (page as RenderPage)(match);
		}
		return (page as unknown) ?? nothing;
	}
}

/**
 * An `<a>` that navigates via the router instead of reloading. Set `to` to a url
 * or route name (with optional `.params`), or pass a full `.input`.
 * Modifier/middle clicks fall through to default browser behavior.
 *
 * ```html
 * <groutcho-link to="Home">Home</groutcho-link>
 * <groutcho-link to="/show/hi">Show</groutcho-link>
 * ```
 */
@customElement("groutcho-link")
export class GroutchoLink extends RouterElement {
	/** A url or route name to navigate to. */
	@property() to = "";

	/** Params used with a route-name `to` (and to build the href). */
	@property({ attribute: false }) params?: Params;

	/** A full input object; takes precedence over `to`/`params`. */
	@property({ attribute: false }) input?: Input;

	private get target(): Input {
		if (this.input !== undefined) {
			return this.input;
		}
		if (this.params && this.to && !this.to.includes("/")) {
			return { route: { name: this.to, params: this.params } };
		}
		return this.to;
	}

	private href(): string {
		const router = this.router;
		if (!router) {
			return this.to || "#";
		}
		try {
			return router.match(this.target).url;
		} catch {
			return this.to || "#";
		}
	}

	private onClick = (event: MouseEvent): void => {
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
		if (!router) {
			return;
		}
		event.preventDefault();
		router.go(this.target);
	};

	override render(): TemplateResult {
		return html`<a href=${this.href()} @click=${this.onClick}><slot></slot></a>`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		"groutcho-outlet": GroutchoOutlet;
		"groutcho-link": GroutchoLink;
	}
}
