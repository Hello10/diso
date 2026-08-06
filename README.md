# groutcho

Declarative, framework-agnostic routing. A small matching + redirect **core**
built on the web-standard [`URLPattern`], with a pluggable history seam so it
works standalone in vanilla web, and thin **Lit** and **React** bindings.

| Package | What |
| --- | --- |
| [`@diso.io/groutcho`](packages/core) | Core: `Router`, `Route`, `MatchResult`, `createRouter` store, history |
| [`@diso.io/groutcho-lit`](packages/lit) | Lit `ReactiveController`, context, `<groutcho-outlet>` / `<groutcho-link>` |
| [`@diso.io/groutcho-react`](packages/react) | Hooks (`useMatch`/`useGo`), `RouterProvider`, `Link` |

The core owns **all** matching and redirect logic and never touches the DOM —
only `createBrowserHistory` does — so the same engine runs in the browser, Node,
workers, and React Native (Hermes). The bindings are small adapters over one
shared store.

> This is the **`@hello10/diso`** monorepo. Alongside `packages/*` (the published
> `@diso.io/*` libraries) it holds `apps/*` — the initiative's sites: `diso.io`
> (the docs site, itself built with groutcho) and `diso.mu`. Run the docs site
> with `pnpm site`.

## Concepts

- **Routes** map a name to a `URLPattern` pathname (`/show/:title`,
  `/optional/:opt?`) plus arbitrary metadata (`session`, `role`, a per-route
  `redirect`, and a `page` payload — a component, tag, render fn, whatever your
  layer needs).
- **Redirects** are named functions run against each match. They return where to
  go (a route name, url, or input) or `false`. The engine follows them with
  loop/cycle detection and a `max_redirects` guard.
- **Input is polymorphic**: `match('/show/hi')`, `match('Home')`,
  `match({ route: { name: 'Show', params: { title: 'hi' } } })`,
  `match({ url: '/show/hi' })`.
- **`MatchResult`** carries `{ route, params, url, redirect, original }`.
- **Catch-all params** span multiple segments: `:path+` (one-or-more) or
  `:path*` (zero-or-more). A match exposes both accessors — the raw joined string
  and the split segments — and `buildUrl` accepts either:

  ```ts
  // pattern: '/files/:path+'
  match('/files/docs/2026/report.pdf');
  // params.path      === 'docs/2026/report.pdf'
  // params.pathArray === ['docs', '2026', 'report.pdf']
  buildUrl({ path: ['docs', '2026', 'report.pdf'] }); // -> /files/docs/2026/report.pdf
  buildUrl({ path: 'docs/2026/report.pdf' });         // -> same
  ```

## Core (vanilla)

```ts
import { createRouter } from '@diso.io/groutcho';

const store = createRouter({
  routes: {
    Home: { pattern: '/', page: HomeView },
    Show: { pattern: '/show/:title', page: ShowView },
    Signin: { pattern: '/signin', page: SigninView, session: false },
    Dashboard: { pattern: '/dashboard', page: DashboardView, session: true },
    NotFound: { pattern: '/404', page: NotFoundView }
  },
  redirects: {
    NotFound: (match) => (match ? false : 'NotFound'),
    Session: (match) =>
      match?.route?.session === true && !isSignedIn() ? 'Signin' : false
  }
  // history defaults to the browser; pass `history` to override.
});

store.subscribe((match) => render(match)); // re-render on navigation
render(store.getSnapshot());                // initial

store.go('/show/hello'); // updates history + notifies subscribers
```

`createRouter` returns a store with `getSnapshot()` / `subscribe()` (which plug
straight into React's `useSyncExternalStore` and a Lit controller), plus `go`,
`match`, the underlying `router`, and `destroy`. Use `createMemoryHistory()` for
SSR, tests, or React Native.

## Lit

```ts
import { RouterController } from '@diso.io/groutcho-lit';

class MyApp extends LitElement {
  router = new RouterController(this, { routes, redirects });
  render() {
    const { match } = this.router;
    return html`
      <nav><groutcho-link .store=${this.router.store} to="Home">Home</groutcho-link></nav>
      <groutcho-outlet .store=${this.router.store}></groutcho-outlet>
    `;
  }
}
```

Share one store via `@lit/context` (`routerContext`) so nested
`<groutcho-outlet>` / `<groutcho-link>` resolve it without prop-drilling. A
route `page` that's a function is called as `(match) => TemplateResult`.

## React

```tsx
import { RouterProvider, useMatch, Link } from '@diso.io/groutcho-react';

function App() {
  return (
    <RouterProvider routes={routes} redirects={redirects}>
      <nav><Link to="Home">Home</Link></nav>
      <Outlet />
    </RouterProvider>
  );
}

function Outlet() {
  const match = useMatch();          // re-renders on navigation
  const Page = match.route?.page as React.ComponentType;
  return Page ? <Page {...match.params} /> : null;
}
```

Built on `useSyncExternalStore`. The old `RouterContainer` render-prop still
works (`RouterProvider` accepts `children` as `({ match, store }) => ReactNode`).

## Develop

```bash
pnpm install
pnpm build       # tsup -> ESM + .d.ts for every package
pnpm test        # vitest across all packages
pnpm typecheck
pnpm lint
```

Tooling: pnpm workspaces, TypeScript (strict), tsup, vitest, typescript-eslint.

## Releasing

All three packages version together and publish via **pnpm**, which rewrites the
`workspace:*` core dependency to the real version in each published manifest
(plain `npm publish` would not). Publishing runs `prepublishOnly` (a fresh build)
per package, and `release:*` runs the full `verify` gate first.

```bash
npm login                # one-time

pnpm version:beta        # 4.0.0-beta.0 -> 4.0.0-beta.1 across all packages
pnpm release:beta        # verify (build + typecheck + lint + test), then publish under the `beta` tag
```

Betas are opt-in for consumers: `npm install @diso.io/groutcho@beta` (and
`@diso.io/groutcho-lit@beta` / `@diso.io/groutcho-react@beta`). Inspect a publish first with
`pnpm -r publish --tag beta --no-git-checks --dry-run`.

When cutting a stable release: `pnpm version:minor` (or drop the `-beta.N`
suffix), then `pnpm release` (publishes to the default `latest` tag).

| Script | Does |
| --- | --- |
| `pnpm verify` | build + typecheck + lint + test |
| `pnpm version:beta` | bump the beta prerelease across all packages |
| `pnpm version:minor` / `version:patch` | bump a stable version |
| `pnpm release:beta` | verify, then publish under the `beta` tag |
| `pnpm release` | verify, then publish under `latest` |

## Migrating from v3

v4 is a rewrite. The `Router` / `Route` / `MatchResult` API and behavior are
preserved (the v3 behavioral suite still passes), but:

- **ESM only**, ships TypeScript types.
- **`URLPattern`** replaces `path-to-regexp`. `:param`, `:param?`, repeated path
  params (`:p+` / `:p*`), and query handling all behave as before.
- **Browser/history glue moved into the core** (`createRouter` /
  `createBrowserHistory`) instead of living in the React hook.
- React binding requires **React 18+** and uses `useSyncExternalStore`.

[`URLPattern`]: https://developer.mozilla.org/en-US/docs/Web/API/URLPattern
