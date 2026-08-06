# @diso.io/groutcho-lit

[Lit](https://lit.dev) bindings for [`groutcho`](../core): a `ReactiveController`,
a `@lit/context` context, and `<groutcho-outlet>` / `<groutcho-link>` elements.

```bash
npm install @diso.io/groutcho-lit lit @lit/context
```

```ts
import { LitElement, html } from 'lit';
import { RouterController } from '@diso.io/groutcho-lit';

class MyApp extends LitElement {
  router = new RouterController(this, { routes, redirects });

  render() {
    const { match } = this.router;
    return html`
      <nav>
        <groutcho-link .store=${this.router.store} to="Home">Home</groutcho-link>
        <groutcho-link .store=${this.router.store} to="/show/hi">Show</groutcho-link>
      </nav>
      <groutcho-outlet .store=${this.router.store}></groutcho-outlet>
    `;
  }
}
```

- **`RouterController`** — binds an element to a store (or a config), re-rendering
  on navigation. Exposes `.match` and `.go`.
- **`routerContext`** — provide one store, consume it in nested elements.
- **`<groutcho-outlet>`** — renders `match.route.page` (called as
  `(match) => TemplateResult` when it's a function; override with `.renderPage`).
- **`<groutcho-link>`** — an `<a>` that navigates via the router; modifier/middle
  clicks fall through.

Re-exports the `groutcho` core for a single import surface. See the
[monorepo README](../../../README.md).
