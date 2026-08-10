import {
	createMemoryHistory,
	type RedirectTest,
	type RouteConfig,
} from "@diso.io/groutcho";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	Link,
	NavLink,
	RouterOutlet,
	RouterProvider,
	useError,
	useGo,
	useMatch,
	useOnGo,
	useRoute,
	useTitle,
} from "../src/index";

const routes: Record<string, RouteConfig> = {
	Home: { pattern: "/", page: "Home", title: "Home" },
	Show: {
		pattern: "/show/:title",
		page: "Show",
		title: (m) => `Show: ${m.params.title}`,
	},
	Signin: { pattern: "/signin", page: "Signin", session: false },
	Dashboard: { pattern: "/dashboard", page: "Dashboard", session: true },
	NotFound: { pattern: "/404", page: "NotFound" },
};

const redirects: Record<string, RedirectTest> = {
	NotFound: (match) => (match ? false : "NotFound"),
	Session: (match) => {
		if (match === false || !match.route) return false;
		return match.route.session === true ? "Signin" : false;
	},
};

function CurrentRoute() {
	const match = useMatch();
	return <div data-testid="route">{match.route?.name}</div>;
}

afterEach(cleanup);

describe("groutcho-react", () => {
	it("renders the current route via useMatch", () => {
		render(
			<RouterProvider
				routes={routes}
				redirects={redirects}
				history={createMemoryHistory("/show/hi")}
			>
				<CurrentRoute />
			</RouterProvider>,
		);
		expect(screen.getByTestId("route").textContent).toBe("Show");
	});

	it("supports the render-prop (RouterContainer back-compat) shape", () => {
		render(
			<RouterProvider
				routes={routes}
				redirects={redirects}
				history={createMemoryHistory("/")}
			>
				{({ match }) => <div data-testid="rp">{match.route?.name}</div>}
			</RouterProvider>,
		);
		expect(screen.getByTestId("rp").textContent).toBe("Home");
	});

	it("navigates and re-renders when a Link is clicked", () => {
		render(
			<RouterProvider
				routes={routes}
				redirects={redirects}
				history={createMemoryHistory("/")}
			>
				<CurrentRoute />
				<Link to="Show" params={{ title: "wow" }}>
					go
				</Link>
			</RouterProvider>,
		);
		expect(screen.getByTestId("route").textContent).toBe("Home");

		const link = screen.getByText("go") as HTMLAnchorElement;
		expect(link.getAttribute("href")).toBe("/show/wow");

		fireEvent.click(link);
		expect(screen.getByTestId("route").textContent).toBe("Show");
	});

	it("follows redirects from the store on initial render", () => {
		render(
			<RouterProvider
				routes={routes}
				redirects={redirects}
				history={createMemoryHistory("/dashboard")}
			>
				<CurrentRoute />
			</RouterProvider>,
		);
		// Dashboard requires a session (none) -> redirected to Signin.
		expect(screen.getByTestId("route").textContent).toBe("Signin");
	});

	it("useOnGo fires with (prev, current) on navigation", () => {
		const cb = vi.fn();
		function Watcher() {
			useOnGo(cb);
			return null;
		}
		function Nav() {
			const go = useGo();
			return (
				<button type="button" onClick={() => go("/show/a")}>
					jump
				</button>
			);
		}
		render(
			<RouterProvider
				routes={routes}
				redirects={redirects}
				history={createMemoryHistory("/")}
			>
				<Watcher />
				<Nav />
			</RouterProvider>,
		);
		fireEvent.click(screen.getByText("jump"));
		expect(cb).toHaveBeenCalledTimes(1);
		const [prev, current] = cb.mock.calls[0]!;
		expect(prev.route?.name).toBe("Home");
		expect(current.route?.name).toBe("Show");
	});

	it("useRoute exposes href building", () => {
		let captured = "";
		function Reader() {
			const route = useRoute("Show");
			captured = route.href({ title: "abc" });
			return null;
		}
		render(
			<RouterProvider
				routes={routes}
				redirects={redirects}
				history={createMemoryHistory("/")}
			>
				<Reader />
			</RouterProvider>,
		);
		expect(captured).toBe("/show/abc");
	});

	it("mirrors store.title to document.title (manageTitle default)", () => {
		render(
			<RouterProvider
				routes={routes}
				redirects={redirects}
				history={createMemoryHistory("/show/hi")}
			>
				<CurrentRoute />
			</RouterProvider>,
		);
		expect(document.title).toBe("Show: hi");
	});

	it("useTitle overrides route title until next nav", () => {
		function Dynamic() {
			useTitle("Dynamic");
			return null;
		}
		function Nav() {
			const go = useGo();
			return (
				<button type="button" onClick={() => go("/show/next")}>
					jump
				</button>
			);
		}
		render(
			<RouterProvider
				routes={routes}
				redirects={redirects}
				history={createMemoryHistory("/")}
			>
				<Dynamic />
				<Nav />
			</RouterProvider>,
		);
		expect(document.title).toBe("Dynamic");
		fireEvent.click(screen.getByText("jump"));
		expect(document.title).toBe("Show: next");
	});

	it("NavLink applies activeClass for the matched route name", () => {
		render(
			<RouterProvider
				routes={routes}
				redirects={redirects}
				history={createMemoryHistory("/")}
			>
				<NavLink to="Home">home</NavLink>
				<NavLink to="Show" params={{ title: "x" }}>
					show
				</NavLink>
			</RouterProvider>,
		);
		expect(screen.getByText("home").className).toContain("active");
		expect(screen.getByText("show").className).not.toContain("active");
	});

	it("NavLink applies activeClass for a matching path", () => {
		render(
			<RouterProvider
				routes={routes}
				redirects={redirects}
				history={createMemoryHistory("/show/hi")}
			>
				<NavLink to="/show/hi">exact</NavLink>
				<NavLink to="/show">prefix</NavLink>
				<NavLink to="/show" activeExact>
					prefix-exact
				</NavLink>
			</RouterProvider>,
		);
		expect(screen.getByText("exact").className).toContain("active");
		expect(screen.getByText("prefix").className).toContain("active");
		expect(screen.getByText("prefix-exact").className).not.toContain("active");
	});

	it("error boundary surfaces render throws via useError + errorPage", async () => {
		function Boom(): ReactNode {
			throw new Error("kaboom");
		}
		function Err(): ReactNode {
			const err = useError();
			return <div data-testid="err">{err?.message ?? ""}</div>;
		}
		const routesWithBoom: Record<string, RouteConfig> = {
			Home: {
				pattern: "/",
				page: Boom,
				errorPage: () => <div data-testid="fallback">boom!</div>,
			},
		};
		render(
			<RouterProvider
				routes={routesWithBoom}
				history={createMemoryHistory("/")}
			>
				<RouterOutlet />
				<Err />
			</RouterProvider>,
		);
		expect(screen.getByTestId("fallback").textContent).toBe("boom!");
		// setError fires from componentDidCatch which schedules an async update.
		await screen.findByText("kaboom");
	});

	it("auto-renders page + layout chain when no children are given", () => {
		function AppShell({ children }: { children?: ReactNode }) {
			return <div data-testid="shell">shell:{children}</div>;
		}
		function SectionShell({ children }: { children?: ReactNode }) {
			return <div data-testid="section">section:{children}</div>;
		}
		function Page({ match }: { match: { params: { title: string } } }) {
			return <span data-testid="page">page:{match.params.title}</span>;
		}
		const layered: Record<string, RouteConfig> = {
			Home: {
				pattern: "/:title",
				page: Page,
				layout: [AppShell, SectionShell],
			},
		};
		render(
			<RouterProvider
				routes={layered}
				history={createMemoryHistory("/hello")}
			/>,
		);
		expect(screen.getByTestId("shell").textContent).toContain(
			"shell:section:page:hello",
		);
	});

	it("layout instance persists across sibling nav (same layout identity)", () => {
		let shellMounts = 0;
		function Shell({ children }: { children?: ReactNode }) {
			const [id] = useState(() => {
				shellMounts += 1;
				return `id-${shellMounts}`;
			});
			return (
				<div>
					<span data-testid="shell-id">{id}</span>
					{children}
				</div>
			);
		}
		function A() {
			const go = useGo();
			return (
				<button type="button" onClick={() => go("/b")}>
					jump
				</button>
			);
		}
		function B() {
			return <span data-testid="page">B</span>;
		}
		const layered: Record<string, RouteConfig> = {
			A: { pattern: "/", page: A, layout: Shell },
			B: { pattern: "/b", page: B, layout: Shell },
		};
		render(
			<RouterProvider routes={layered} history={createMemoryHistory("/")} />,
		);
		const idBefore = screen.getByTestId("shell-id").textContent;
		fireEvent.click(screen.getByText("jump"));
		expect(screen.getByTestId("page").textContent).toBe("B");
		// Same Shell component identity across sibling routes → React keeps the
		// instance mounted; useState value survives the swap.
		expect(screen.getByTestId("shell-id").textContent).toBe(idBefore);
	});
});
