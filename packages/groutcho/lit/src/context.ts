import type { RouterStore } from "@diso.io/groutcho";
import { createContext } from "@lit/context";

/**
 * Context for sharing a {@link RouterStore} down the DOM tree. Provide it from a
 * root element and consume it in `<groutcho-outlet>` / `<groutcho-link>` or your
 * own components.
 */
export const routerContext = createContext<RouterStore>(
	Symbol("groutcho-router"),
);
