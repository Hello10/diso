import {
	createMemoryHistory,
	type RedirectTest,
	type RouteConfig,
} from "@diso.io/groutcho";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Link, RouterProvider, useMatch } from "../src/index";

const routes: Record<string, RouteConfig> = {
	Home: { pattern: "/", page: "Home" },
	Show: { pattern: "/show/:title", page: "Show" },
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
});
