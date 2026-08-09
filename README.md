# diso

Distributed social tools for a federated web — art, music, and personal sites.
Built by [Hello10](https://hello10.com).

> **Status: work in progress.** APIs and packages are settling; published
> versions are betas. The sites at [diso.io](https://diso.io) and diso.mu are
> under construction.

## What's here

This is the `@hello10/diso` monorepo. Libraries publish under the **`@diso.io`**
npm scope; each package family has its own README with full docs.

| Package | What |
| --- | --- |
| [`groutcho`](packages/groutcho) | Declarative, framework-agnostic routing — URLPattern core with Lit and React bindings (`@diso.io/groutcho`, `-lit`, `-react`) |
| [`bark`](packages/bark) | Unified observability — logs, timing, and errors as correlated records across browser and Cloudflare Workers (`@diso.io/bark`) |

| App | What |
| --- | --- |
| [`apps/diso.io`](apps/diso.io) | Docs site for the `@diso.io/*` libraries — each package is a route (`diso.io/groutcho`, `diso.io/bark`); built with groutcho itself |
| [`apps/diso.mu`](apps/diso.mu) | Placeholder |

## Develop

```bash
pnpm install
pnpm build       # all packages (tsup -> ESM + .d.ts)
pnpm test        # all package test suites (vitest)
pnpm typecheck
pnpm lint
pnpm site        # run the diso.io docs site locally
```

Stack: pnpm workspaces · TypeScript (strict) · tsup · vitest · typescript-eslint.

## Release

Libraries version and publish together per family via **pnpm** (which rewrites
`workspace:*` deps — don't publish with plain npm):

```bash
pnpm version:beta    # bump prerelease across packages
pnpm release:beta    # verify (build + typecheck + lint + test), publish @beta
pnpm release         # verify, publish @latest (stable)
```

Betas are opt-in for consumers: `npm install @diso.io/<pkg>@beta`.
