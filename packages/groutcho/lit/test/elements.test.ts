import {
	createMemoryHistory,
	createRouter,
	type MatchResult,
	type RouteConfig,
} from "@diso.io/groutcho";
import { html } from "lit";
import { beforeEach, describe, expect, it } from "vitest";

import { GroutchoLink, GroutchoOutlet } from "../src/elements";

const routes: Record<string, RouteConfig> = {
	Home: { pattern: "/", page: () => html`<div id="home">Home</div>` },
	Show: {
		pattern: "/show/:title",
		page: (m: MatchResult) => html`<div id="show">${m.params.title}</div>`,
	},
};

function mount<T extends HTMLElement>(tag: string): T {
	const el = document.createElement(tag) as T;
	document.body.appendChild(el);
	return el;
}

describe("groutcho-lit elements", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
	});

	it("registers the custom elements", () => {
		expect(customElements.get("groutcho-outlet")).toBe(GroutchoOutlet);
		expect(customElements.get("groutcho-link")).toBe(GroutchoLink);
	});

	it("renders the current route page and updates on navigation", async () => {
		const store = createRouter({ routes, history: createMemoryHistory("/") });
		const outlet = mount<GroutchoOutlet>("groutcho-outlet");
		outlet.store = store;
		await outlet.updateComplete;

		expect(outlet.shadowRoot?.querySelector("#home")).toBeTruthy();

		store.go("/show/hi");
		await outlet.updateComplete;

		expect(outlet.shadowRoot?.querySelector("#show")).toBeTruthy();
		expect(outlet.shadowRoot?.textContent).toContain("hi");
	});

	it("navigates when a link is clicked", async () => {
		const store = createRouter({
			routes,
			history: createMemoryHistory("/show/start"),
		});
		const outlet = mount<GroutchoOutlet>("groutcho-outlet");
		outlet.store = store;
		const link = mount<GroutchoLink>("groutcho-link");
		link.store = store;
		link.to = "Home";
		await Promise.all([outlet.updateComplete, link.updateComplete]);

		const anchor = link.shadowRoot?.querySelector("a");
		expect(anchor?.getAttribute("href")).toBe("/");

		anchor?.dispatchEvent(
			new MouseEvent("click", { button: 0, bubbles: true, cancelable: true }),
		);
		await outlet.updateComplete;

		expect(store.getSnapshot().route?.name).toBe("Home");
		expect(outlet.shadowRoot?.querySelector("#home")).toBeTruthy();
	});
});
