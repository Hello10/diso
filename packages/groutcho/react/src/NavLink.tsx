import type { ReactNode } from "react";

import { useMatch } from "./hooks";
import { Link, type LinkProps } from "./Link";

export interface NavLinkProps extends LinkProps {
	/** Class applied to the `<a>` when this link's `to` matches the current route. */
	activeClass?: string;
	/**
	 * Match strictly against the current pathname (path routes) or the route
	 * name (name routes). When `false` (the default) a `to` that's a path is a
	 * prefix match, and a route-name `to` matches only exact route.
	 */
	activeExact?: boolean;
}

function computeActive(
	to: string | undefined,
	currentUrl: string,
	currentRouteName: string | undefined,
	exact: boolean,
): boolean {
	if (!to) return false;
	if (to.includes("/")) {
		// Path-shaped `to`.
		const path = currentUrl.split("?")[0] ?? currentUrl;
		return exact ? path === to : path === to || path.startsWith(`${to}/`);
	}
	// Route-name `to`.
	return currentRouteName === to;
}

/**
 * A `<Link>` that adds an `activeClass` when the current route matches. Match
 * semantics:
 * - `to="/foo"` (path): active when the current pathname is `/foo` or a
 *   sub-path `/foo/...`. Set `activeExact` to require exact equality.
 * - `to="RouteName"`: active when the currently matched route has that name.
 */
export function NavLink({
	to,
	activeClass = "active",
	activeExact = false,
	className,
	children,
	...rest
}: NavLinkProps): ReactNode {
	const match = useMatch();
	const active = computeActive(to, match.url, match.route?.name, activeExact);
	const combined = active
		? className
			? `${className} ${activeClass}`
			: activeClass
		: className;
	return (
		<Link to={to} className={combined} {...rest}>
			{children}
		</Link>
	);
}
