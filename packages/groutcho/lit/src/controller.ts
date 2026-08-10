import type {
	ErrorListener,
	GoListener,
	Input,
	MatchResult,
	Route,
	RouterStore,
	RouterStoreConfig,
	TitleListener,
} from "@diso.io/groutcho";
import { createRouter } from "@diso.io/groutcho";
import type { ReactiveController, ReactiveControllerHost } from "lit";

export type ScrollBehavior =
	| "top"
	| "preserve"
	| "restore"
	| ((prev: MatchResult, current: MatchResult) => void);

export interface RouterControllerOptions {
	/**
	 * Mirror `store.title` to `document.title`. Defaults to `true`. Turn off for
	 * SSR or when the host page owns the title.
	 */
	manageTitle?: boolean;
	/**
	 * How to reset scroll after each nav. Defaults to `"top"`. A function lets
	 * you inspect `(prev, current)` and scroll however you want.
	 */
	scrollBehavior?: ScrollBehavior;
}

function isStore(value: RouterStore | RouterStoreConfig): value is RouterStore {
	return typeof (value as RouterStore).getSnapshot === "function";
}

/**
 * Lit ReactiveController that binds a host element to a groutcho router store.
 * Pass an existing {@link RouterStore} (e.g. shared via context) or a config to
 * create one. The host re-renders whenever the current match changes.
 *
 * ```ts
 * class MyApp extends LitElement {
 *   router = new RouterController(this, { routes, redirects });
 *   render() {
 *     const { match } = this.router;
 *     return html`<h1>${match.route?.name}</h1>`;
 *   }
 * }
 * ```
 */
export class RouterController implements ReactiveController {
	readonly store: RouterStore;

	#host: ReactiveControllerHost;
	#unsubscribers: Array<() => void> = [];
	#ownsStore: boolean;
	#options: RouterControllerOptions;

	constructor(
		host: ReactiveControllerHost,
		source: RouterStore | RouterStoreConfig,
		options: RouterControllerOptions = {},
	) {
		this.#host = host;
		this.#options = options;
		if (isStore(source)) {
			this.store = source;
			this.#ownsStore = false;
		} else {
			this.store = createRouter(source);
			this.#ownsStore = true;
		}
		host.addController(this);
	}

	/** The current match snapshot. */
	get match(): MatchResult {
		return this.store.getSnapshot();
	}

	/** Current title (mirrors `store.title`). */
	get title(): string {
		return this.store.title;
	}

	/** Navigate. Bound so it can be passed as a handler. */
	go = (input: Input): MatchResult => this.store.go(input);

	/** Look up a route by name (shorthand for `store.get`). */
	get(name: string): Route {
		return this.store.get(name);
	}

	/** Imperative title setter (mirrors `store.setTitle`). */
	setTitle(title: string): void {
		this.store.setTitle(title);
	}

	/** Subscribe to nav events. Returns an unsubscribe. */
	onGo(listener: GoListener): () => void {
		return this.store.onGo(listener);
	}

	/** Subscribe to title changes. Returns an unsubscribe. */
	onTitle(listener: TitleListener): () => void {
		return this.store.onTitle(listener);
	}

	/** Subscribe to error changes. Returns an unsubscribe. */
	onError(listener: ErrorListener): () => void {
		return this.store.onError(listener);
	}

	hostConnected(): void {
		this.#unsubscribers.push(
			this.store.subscribe(() => this.#host.requestUpdate()),
		);

		if (
			this.#options.manageTitle !== false &&
			typeof document !== "undefined"
		) {
			document.title = this.store.title;
			this.#unsubscribers.push(
				this.store.onTitle((title) => {
					document.title = title;
				}),
			);
		}

		const behavior = this.#options.scrollBehavior ?? "top";
		if (typeof window !== "undefined") {
			this.#unsubscribers.push(
				this.store.onGo((prev, current) => {
					if (typeof behavior === "function") {
						behavior(prev, current);
						return;
					}
					if (behavior === "top") {
						window.scrollTo(0, 0);
					}
					// "preserve" / "restore": no-op for now.
				}),
			);
		}
	}

	hostDisconnected(): void {
		for (const off of this.#unsubscribers) off();
		this.#unsubscribers = [];
		// Only tear down a store this controller created.
		if (this.#ownsStore) {
			this.store.destroy();
		}
	}
}
