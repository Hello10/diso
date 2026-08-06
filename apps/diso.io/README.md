# diso.io

Docs site for the `@diso.io/*` libraries. Built with Vite + Lit, and **routed by
`@diso.io/groutcho-lit`** — the site dogfoods groutcho. Each package has its own
route, so `diso.io/groutcho-lit` opens that section directly.

```bash
pnpm --filter diso-io dev      # or: pnpm site   (from the repo root)
pnpm --filter diso-io build
```

Routes: `/` (home), `/groutcho`, `/groutcho-lit`, `/groutcho-react`, `/404`.

Deep links work in dev (Vite's SPA fallback). For production hosting, serve
`index.html` for unknown paths (SPA fallback) so client routing can resolve them.
