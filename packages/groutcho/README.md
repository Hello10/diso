# groutcho

Declarative, framework-agnostic routing for the `@diso.io` scope — a small
matching + redirect **core** on the web-standard [`URLPattern`], with a pluggable
history seam so it works standalone in vanilla web, plus thin **Lit** and
**React** bindings.

| Package | Folder | What |
| --- | --- | --- |
| [`@diso.io/groutcho`](core) | `core/` | Core: `Router`, `Route`, `MatchResult`, `createRouter` store, history |
| [`@diso.io/groutcho-lit`](lit) | `lit/` | Lit `ReactiveController`, context, `<groutcho-outlet>` / `<groutcho-link>` |
| [`@diso.io/groutcho-react`](react) | `react/` | Hooks (`useMatch`/`useGo`), `RouterProvider`, `Link` |

The core owns all matching and redirect logic and never touches the DOM (only
`createBrowserHistory` does), so the same engine runs in the browser, Node,
workers, and React Native. The bindings are small adapters over one shared store.

See each subpackage's README for usage, or the [monorepo README](../../README.md)
for concepts, the release flow, and the v3 → v4 migration notes.

[`URLPattern`]: https://developer.mozilla.org/en-US/docs/Web/API/URLPattern
