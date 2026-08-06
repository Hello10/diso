# @diso.io/groutcho

Declarative, framework-agnostic router core: `URLPattern` matching, a redirect
engine with loop detection, and a pluggable history store. No DOM dependency in
the matching engine — only `createBrowserHistory` touches `window`.

```bash
npm install @diso.io/groutcho
```

```ts
import { createRouter, createMemoryHistory } from '@diso.io/groutcho';

const store = createRouter({
  routes: {
    Home: { pattern: '/', page: 'Home' },
    Show: { pattern: '/show/:title', page: 'Show' }
  },
  redirects: {
    NotFound: (match) => (match ? false : 'NotFound')
  }
  // history: createMemoryHistory('/')   // for SSR / tests / React Native
});

store.subscribe((match) => console.log(match.route?.name, match.params));
store.go('/show/hi');
```

**Exports:** `createRouter`, `createBrowserHistory`, `createMemoryHistory`,
`Router`, `Route`, `MatchResult`, `logger`, and all types.

See the [monorepo README](../../README.md) for concepts and the Lit/React
bindings.
