# @diso.io/groutcho-react

[React](https://react.dev) bindings for [`groutcho`](../core): hooks, a provider,
and a `Link`. Built on `useSyncExternalStore` (React 18+).

```bash
npm install @diso.io/groutcho-react react
```

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
  const match = useMatch(); // re-renders on navigation
  const Page = match.route?.page as React.ComponentType;
  return Page ? <Page {...match.params} /> : null;
}
```

- **`RouterProvider`** — creates/holds a store and provides it. `children` may be
  a render-prop `({ match, store }) => ReactNode` (back-compat with the v3
  `RouterContainer`, which is re-exported as an alias).
- **`useMatch(store?)`** — current match; subscribes for re-render.
- **`useRouter()`** / **`useGo()`** — the store, and a stable `go`.
- **`Link`** — an `<a>` that navigates via the router; modifier/middle clicks
  fall through.

Re-exports the `groutcho` core for a single import surface. See the
[monorepo README](../../../README.md).
