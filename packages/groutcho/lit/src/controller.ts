import type {
	Input,
	MatchResult,
	RouterStore,
	RouterStoreConfig,
} from "@diso.io/groutcho";
import { createRouter } from "@diso.io/groutcho";
import type { ReactiveController, ReactiveControllerHost } from "lit";

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
	#unsubscribe?: () => void;
	#ownsStore: boolean;

	constructor(
		host: ReactiveControllerHost,
		source: RouterStore | RouterStoreConfig,
	) {
		this.#host = host;
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

	/** Navigate. Bound so it can be passed as a handler. */
	go = (input: Input): MatchResult => this.store.go(input);

	hostConnected(): void {
		this.#unsubscribe = this.store.subscribe(() => this.#host.requestUpdate());
	}

	hostDisconnected(): void {
		this.#unsubscribe?.();
		this.#unsubscribe = undefined;
		// Only tear down a store this controller created.
		if (this.#ownsStore) {
			this.store.destroy();
		}
	}
}
