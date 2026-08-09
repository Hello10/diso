import { beforeEach, describe, expect, it } from "vitest";

import {
	type RedirectTest,
	Route,
	type RouteConfig,
	Router,
} from "../src/index";

function Page(): void {}

const routes: Record<string, RouteConfig> = {
	Home: { pattern: "/", page: Page, session: true },
	NoParams: { pattern: "/show", page: Page },
	OneParam: { pattern: "/show/:title", page: Page },
	TwoParam: { pattern: "/show/:foo/barf/:barf", page: Page },
	OptionalParam: { pattern: "/optional/:optional?", page: Page },
	Signin: { pattern: "/signin", page: Page, session: false },
	Dashboard: { pattern: "/dashboard", page: Page, session: true },
	AdminDerp: { pattern: "/admin/derp", page: Page, role: "admin" },
	NotFound: { pattern: "/404", page: Page },
	Multi1: { pattern: "/multi1", page: Page },
	Multi2: { pattern: "/multi2", page: Page },
	Multi3: { pattern: "/multi3", page: Page },
	Self: { pattern: "/self", page: Page },
	HasRedirect: {
		pattern: "/redirect/:derp",
		page: Page,
		redirect({ params }) {
			return params.derp === "randyquaid" ? false : "Home";
		},
	},
	InputRedirect: {
		pattern: "/inputredirect",
		page: Page,
		redirect({ input }) {
			return input.homer ? "InputRedirect2" : false;
		},
	},
	InputRedirect2: {
		pattern: "/inputredirect2",
		page: Page,
		redirect({ input }) {
			return input.homer ? "Home" : false;
		},
	},
	Endless: {
		pattern: "/endless/:count?",
		page: Page,
		redirect({ params }) {
			const count = (params.count as number | undefined) ?? 0;
			return `/endless/${count + 1}`;
		},
	},
	BadRedirect: {
		pattern: "/badredirect",
		page: Page,
		redirect() {
			return "/thisdoesnotexistok";
		},
	},
};

describe("groutcho", () => {
	describe("Route", () => {
		describe("constructor", () => {
			it("should require all route params", () => {
				expect(
					() =>
						new Route({ name: "wow", pattern: "/" } as unknown as RouteConfig),
				).toThrow();
			});

			it("should error on specific method name route params", () => {
				expect(
					() =>
						new Route({
							name: "wow",
							pattern: "/",
							page: Page,
							match: "derp",
						} as unknown as RouteConfig),
				).toThrow();
			});
		});

		describe(".is", () => {
			it("should test match", () => {
				const route = new Route({
					name: "Derp",
					pattern: "/derp/:derp",
					page: Page,
				});
				expect(route.is("/derp/wow")).toBe(true);
				expect(route.is("Derp")).toBe(true);
				expect(route.is("Woof")).toBe(false);
				expect(route.is("/dooof")).toBe(false);
			});
		});
	});

	describe("Router", () => {
		let router: Router;
		let signedIn: boolean;
		let role: string | null;

		const session = {
			signedIn: () => signedIn,
			hasRole: (r: string) => r === role,
		};

		beforeEach(() => {
			signedIn = true;
			role = null;

			const redirects: Record<string, RedirectTest> = {
				NotFound: (match) => (match ? false : "NotFound"),
				Session: (match) => {
					if (match === false || !match.route) return false;
					const { route } = match;
					const hasSession = route.session !== undefined;
					const requireSession = hasSession && route.session;
					const requireNoSession = hasSession && !route.session;
					const signed = session.signedIn();
					if (requireSession && !signed) return "Signin";
					if (requireNoSession && signed) return "Home";
					return false;
				},
				Role: (match) => {
					if (match === false || !match.route) return false;
					const routeRole = match.route.role as string | undefined;
					const shouldRedirect = routeRole && !session.hasRole(routeRole);
					return shouldRedirect ? "Home" : false;
				},
				Multi: (match) => {
					if (match === false || !match.route) return false;
					const isMulti = /Multi/;
					const { name } = match.route;
					if (!name.match(isMulti)) return false;
					let num = parseInt(name.replace(isMulti, ""), 10);
					if (num < 3) {
						num++;
						return `Multi${num}`;
					}
					return false;
				},
				Self: (match) => {
					if (match === false || !match.route) return false;
					return match.route.name === "Self" ? "Self" : false;
				},
			};

			router = new Router({ routes, redirects });
		});

		describe(".getRouteByName", () => {
			it("should get a route by name", () => {
				const route = router.getRouteByName("TwoParam");
				expect(route.name).toBe("TwoParam");
			});

			it("should throw on missing route", () => {
				expect(() =>
					router.getRouteByName("MissingAndPresumedScared"),
				).toThrow();
			});
		});

		describe(".match", () => {
			it("should throw on bad input format", () => {
				expect(() => router.match(10 as never)).toThrow(/Invalid input/);
			});

			it("should handle missing route", () => {
				const match = router.match({ route: { name: "barf", params: {} } });
				expect(match.redirect).toBeTruthy();
				expect(match.url).toBe("/404");
			});

			it("should handle missing param", () => {
				const match = router.match({
					route: { name: "OneParam", params: { barf: "barf" } },
				});
				expect(match.redirect).toBeTruthy();
				expect(match.url).toBe("/404");
			});

			it("should handle empty route", () => {
				const match = router.match({ route: { name: "Home", params: {} } });
				expect(match.route).toBeTruthy();
				expect(match.redirect).toBeFalsy();
				expect(match.route!.name).toBe("Home");
				expect(match.url).toBe("/");
			});

			it("should handle matched path route", () => {
				const original = "/show/derp";
				const match = router.match({ url: original });
				expect(match.route).toBeTruthy();
				expect(match.redirect).toBeFalsy();
				expect(match.route!.name).toBe("OneParam");
				expect(match.url).toBe(original);
			});

			it("should handle no param route", () => {
				const match = router.match({ route: { name: "NoParams", params: {} } });
				expect(match.route).toBeTruthy();
				expect(match.redirect).toBeFalsy();
				expect(match.route!.name).toBe("NoParams");
				expect(match.url).toBe("/show");
			});

			it("should handle one param route", () => {
				const match = router.match({
					route: { name: "OneParam", params: { title: "barf" } },
				});
				expect(match.route).toBeTruthy();
				expect(match.redirect).toBeFalsy();
				expect(match.route!.name).toBe("OneParam");
				expect(match.url).toBe("/show/barf");
			});

			it("should handle optional params", () => {
				let match = router.match("/optional");
				expect(match.route).toBeTruthy();
				expect(match.params.optional).toBeFalsy();

				match = router.match({ route: { name: "OptionalParam" } });
				expect(match.route).toBeTruthy();

				match = router.match("/optional/barf");
				expect(match.route).toBeTruthy();
				expect(match.redirect).toBeFalsy();
				expect(match.params.optional).toBe("barf");
			});

			it("should handle extra params by adding them to the query", () => {
				const match = router.match({
					route: {
						name: "TwoParam",
						params: { foo: "d", barf: "b", donk: "ed", honk: "y" },
					},
				});
				expect(match.route).toBeTruthy();
				expect(match.redirect).toBeFalsy();
				const parsed = new URL(match.url, "http://x/");
				expect(parsed.pathname).toBe("/show/d/barf/b");
				expect(parsed.searchParams.get("donk")).toBe("ed");
				expect(parsed.searchParams.get("honk")).toBe("y");
			});

			it("should handle extra query params by keeping them in the query", () => {
				const show = "/show?derp=true";
				let match = router.match({ url: show });
				expect(match.route).toBeTruthy();
				expect(match.redirect).toBeFalsy();
				expect(match.url).toBe(show);

				const showBarf = "/show/honk?barf=pizza&derp=true&honk=10";
				match = router.match({ url: showBarf });
				expect(match.route).toBeTruthy();
				expect(match.url).toBe(showBarf);
			});

			it("should handle repeated query params", () => {
				const show = "/show?derp=1&derp=2";
				const match = router.match({ url: show });
				expect(match.route).toBeTruthy();
				expect(match.redirect).toBeFalsy();
				expect(match.params.derp).toEqual(["1", "2"]);
				expect(match.url).toBe(show);
			});

			it("should handle redirecting when session is required", () => {
				signedIn = false;
				const match = router.match({ url: "/dashboard" });
				expect(match.route).toBeTruthy();
				expect(match.redirect).toBeTruthy();
				expect(match.url).toBe("/signin");
			});

			it("should handle redirecting when no session is required", () => {
				signedIn = true;
				const match = router.match({ url: "/signin" });
				expect(match.route).toBeTruthy();
				expect(match.redirect).toBeTruthy();
				expect(match.url).toBe("/");
			});

			it("should throw on endless redirect loop", () => {
				expect(() => router.match("/endless")).toThrow(
					/Number of redirects exceeded/,
				);
			});

			it("should handle bad redirect", () => {
				expect(() => router.match("/badredirect")).toThrow(
					/No match for redirect result/,
				);
			});

			it("should handle custom redirects and no session", () => {
				signedIn = false;
				role = null;
				const match = router.match({ url: "/admin/derp" });
				expect(match.route).toBeTruthy();
				expect(match.redirect).toBeTruthy();
				expect(match.url).toBe("/signin");
			});

			it("should handle custom redirects when no redirect needed", () => {
				signedIn = true;
				role = "admin";
				const derp = "/admin/derp";
				const match = router.match({ url: derp });
				expect(match.route).toBeTruthy();
				expect(match.redirect).toBeFalsy();
				expect(match.url).toBe(derp);
			});

			it("should handle custom redirects when redirect needed", () => {
				signedIn = true;
				role = "user";
				const match = router.match({ url: "/admin/derp" });
				expect(match.route).toBeTruthy();
				expect(match.redirect).toBeTruthy();
				expect(match.url).toBe("/");
			});

			it("should handle multiple redirects", () => {
				const match = router.match({ url: "/multi1" });
				expect(match.redirect).toBeTruthy();
				expect(match.url).toBe("/multi3");
			});

			it("should not redirect to self indefinitely", () => {
				const url = "/self";
				const match = router.match({ url });
				expect(match.redirect).toBeTruthy();
				expect(match.url).toBe(url);
			});

			it("should handle string arg as url", () => {
				const match = router.match("/");
				expect(match.route).toBeTruthy();
				expect(match.redirect).toBeFalsy();
				expect(match.route!.name).toBe("Home");
				expect(match.url).toBe("/");
			});

			it("should handle string arg as absolute url", () => {
				const wonky = "http://wonky.gov";
				const match = router.match(wonky);
				expect(match.redirect).toBeTruthy();
				expect(match.route).toBeNull();
				expect(match.url).toBe(wonky);
			});

			it("should handle string arg as route name", () => {
				const match = router.match("Home");
				expect(match.route).toBeTruthy();
				expect(match.redirect).toBeFalsy();
				expect(match.route!.name).toBe("Home");
				expect(match.url).toBe("/");
			});

			it("should handle object arg with name property as route", () => {
				const match = router.match({ name: "Home" });
				expect(match.route).toBeTruthy();
				expect(match.redirect).toBeFalsy();
				expect(match.route!.name).toBe("Home");
				expect(match.url).toBe("/");
			});

			it("should handle redirect defined within route", () => {
				let url = "/redirect/randyquaid";
				let match = router.match(url);
				expect(match.route).toBeTruthy();
				expect(match.route!.name).toBe("HasRedirect");
				expect(match.redirect).toBeFalsy();
				expect(match.url).toBe(url);

				url = "/redirect/dennisquaid";
				match = router.match(url);
				expect(match.redirect).toBeTruthy();
				expect(match.url).toBe("/");
			});

			it("should handle input redirect check", () => {
				const url = "/inputredirect";
				let match = router.match({ url });
				expect(match.route).toBeTruthy();
				expect(match.route!.name).toBe("InputRedirect");
				expect(match.redirect).toBeFalsy();
				expect(match.url).toBe(url);

				const homer = "Simpson";
				match = router.match({ url, homer });
				expect(match.route).toBeTruthy();
				expect(match.route!.name).toBe("Home");
				expect(match.redirect).toBeTruthy();
				expect(match.original!.input.homer).toBe(homer);
			});
		});

		describe(".go", () => {
			let went: boolean;
			let match: MatchResultShape | null;

			type MatchResultShape = ReturnType<Router["match"]>;

			beforeEach(() => {
				went = false;
				match = null;
				router.onGo((m) => {
					went = true;
					match = m;
				});
			});

			it("should handle calling listeners when route changes", () => {
				const showderp = "/show/derp";
				router.go({ url: showderp });
				expect(went).toBe(true);
				expect(match!.url).toBe(showderp);
			});

			it("should handle missing route", () => {
				router.go({ url: "/derp/derp" });
				expect(went).toBe(true);
				expect(match!.redirect).toBeTruthy();
				expect(match!.url).toBe("/404");
			});

			it("should handle redirect", () => {
				signedIn = false;
				router.go({ url: "/dashboard" });
				expect(match!.redirect).toBeTruthy();
				expect(match!.url).toBe("/signin");
			});

			it("should handle url", () => {
				const quaid = "https://quaid.gov";
				router.go({ url: quaid });
				expect(went).toBe(true);
				expect(match!.url).toBe(quaid);
			});
		});
	});
});
