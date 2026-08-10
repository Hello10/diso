import {
	createMemoryHistory,
	createRouter,
	type MatchResult,
	type RouteConfig,
} from "@diso.io/groutcho";
import { html, LitElement } from "lit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RouterController } from "../src/controller";
import {
	DisoLink,
	DisoNavLink,
	DisoOutlet,
	type LayoutFn,
} from "../src/elements";

const routes: Record<string, RouteConfig> = {
	Home: {
		pattern: "/",
		page: () => html`<div id="home">Home</div>`,
		title: "Home",
	},
	Show: {
		pattern: "/show/:title",
		page: (m: MatchResult) => html`<div id="show">${m.params.title}</div>`,
		title: (m) => `Show: ${m.params.title}`,
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

	it("registers the diso-* custom elements", () => {
		expect(customElements.get("diso-outlet")).toBe(DisoOutlet);
		expect(customElements.get("diso-link")).toBe(DisoLink);
		expect(customElements.get("diso-nav-link")).toBe(DisoNavLink);
	});

	it("renders the current route page and updates on navigation", async () => {
		const store = createRouter({ routes, history: createMemoryHistory("/") });
		const outlet = mount<DisoOutlet>("diso-outlet");
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
		const outlet = mount<DisoOutlet>("diso-outlet");
		outlet.store = store;
		const link = mount<DisoLink>("diso-link");
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

	it("nav-link applies activeClass when the current route matches by name", async () => {
		const store = createRouter({ routes, history: createMemoryHistory("/") });
		const link = mount<DisoNavLink>("diso-nav-link");
		link.store = store;
		link.to = "Home";
		await link.updateComplete;
		expect(link.shadowRoot?.querySelector("a")?.className).toContain("active");

		store.go("/show/x");
		await link.updateComplete;
		expect(link.shadowRoot?.querySelector("a")?.className).not.toContain(
			"active",
		);
	});

	it("nav-link applies activeClass by pathname prefix (and activeExact opts out)", async () => {
		const store = createRouter({
			routes,
			history: createMemoryHistory("/show/hi"),
		});
		const prefix = mount<DisoNavLink>("diso-nav-link");
		prefix.store = store;
		prefix.to = "/show";
		const exact = mount<DisoNavLink>("diso-nav-link");
		exact.store = store;
		exact.to = "/show";
		exact.activeExact = true;
		await Promise.all([prefix.updateComplete, exact.updateComplete]);

		expect(prefix.shadowRoot?.querySelector("a")?.className).toContain(
			"active",
		);
		expect(exact.shadowRoot?.querySelector("a")?.className).not.toContain(
			"active",
		);
	});

	it("outlet composes layouts around the page (outermost first)", async () => {
		const AppShell: LayoutFn = (_m, children) =>
			html`<div id="shell">shell:${children}</div>`;
		const SectionShell: LayoutFn = (_m, children) =>
			html`<div id="section">section:${children}</div>`;
		const layered: Record<string, RouteConfig> = {
			Home: {
				pattern: "/",
				page: () => html`<span id="page">page</span>`,
				layout: [AppShell, SectionShell],
			},
		};
		const store = createRouter({
			routes: layered,
			history: createMemoryHistory("/"),
		});
		const outlet = mount<DisoOutlet>("diso-outlet");
		outlet.store = store;
		await outlet.updateComplete;
		const text = outlet.shadowRoot?.querySelector("#shell")?.textContent ?? "";
		expect(text).toContain("shell:section:page");
	});

	it("outlet renders route.errorPage when the page throws", async () => {
		const boomer: Record<string, RouteConfig> = {
			Home: {
				pattern: "/",
				page: () => {
					throw new Error("kaboom");
				},
				errorPage: () => html`<div id="err">boom!</div>`,
			},
		};
		const store = createRouter({
			routes: boomer,
			history: createMemoryHistory("/"),
		});
		const outlet = mount<DisoOutlet>("diso-outlet");
		outlet.store = store;
		await outlet.updateComplete;
		// setError produced a new snapshot; re-render happens on next tick
		await outlet.updateComplete;
		expect(outlet.shadowRoot?.querySelector("#err")).toBeTruthy();
		expect(store.getSnapshot().error?.message).toBe("kaboom");
	});
});

describe("RouterController", () => {
	class Host extends LitElement {
		router = new RouterController(this, {
			routes,
			history: createMemoryHistory("/"),
		});
		override render() {
			return html`<span>${this.router.match.route?.name}</span>`;
		}
	}
	customElements.define("test-host", Host);

	beforeEach(() => {
		document.body.innerHTML = "";
	});

	it("get(name) returns the route with .href()", async () => {
		const host = mount<Host>("test-host");
		await host.updateComplete;
		expect(host.router.get("Show").href({ title: "abc" })).toBe("/show/abc");
	});

	it("mirrors title to document.title by default", async () => {
		const host = mount<Host>("test-host");
		await host.updateComplete;
		expect(document.title).toBe("Home");
		host.router.go("/show/hi");
		await host.updateComplete;
		expect(document.title).toBe("Show: hi");
	});

	it("onGo fires on navigation", async () => {
		const host = mount<Host>("test-host");
		await host.updateComplete;
		const cb = vi.fn();
		host.router.onGo(cb);
		host.router.go("/show/a");
		expect(cb).toHaveBeenCalledTimes(1);
	});
});
