import type { MatchResult, RouteConfig, RedirectTest } from '@diso.io/groutcho-lit';
import { html, type TemplateResult } from 'lit';

/** A doc page: renders a section for the current match. */
type Page = (match: MatchResult) => TemplateResult;

function pkg(name: string, tagline: string, install: string, body: TemplateResult): TemplateResult {
  return html`
    <article>
      <h1>${name}</h1>
      <p class="tagline">${tagline}</p>
      <pre><code>npm install ${install}</code></pre>
      ${body}
    </article>
  `;
}

const Home: Page = () => html`
  <article>
    <h1>diso.io</h1>
    <p class="tagline">Distributed social tools for a federated web — art, music, and personal sites.</p>
    <p>
      Libraries live under the <code>@diso.io</code> scope. This site is itself built with
      <a href="/groutcho" data-route>groutcho</a> — every section below is a route.
    </p>
    <ul class="cards">
      <li><a href="/groutcho" data-route><strong>groutcho</strong><span>framework-agnostic router core</span></a></li>
      <li><a href="/groutcho-lit" data-route><strong>groutcho-lit</strong><span>Lit bindings</span></a></li>
      <li><a href="/groutcho-react" data-route><strong>groutcho-react</strong><span>React bindings</span></a></li>
    </ul>
  </article>
`;

const Groutcho: Page = () =>
  pkg(
    '@diso.io/groutcho',
    'Declarative, framework-agnostic routing on the web-standard URLPattern.',
    '@diso.io/groutcho',
    html`
      <p>
        A small matching + redirect core with a pluggable history store. The matching engine never
        touches the DOM, so it runs in the browser, Node, workers, and React Native.
      </p>
      <pre><code>import { createRouter } from '@diso.io/groutcho';

const store = createRouter({
  routes: { Home: { pattern: '/', page: HomeView } }
});
store.subscribe(render);
store.go('/');</code></pre>
    `
  );

const GroutchoLit: Page = () =>
  pkg(
    '@diso.io/groutcho-lit',
    'Lit bindings: a ReactiveController, context, and router elements.',
    '@diso.io/groutcho-lit lit @lit/context',
    html`
      <p>This very site is routed by <code>RouterController</code> with <code>&lt;groutcho-link&gt;</code> nav.</p>
      <pre><code>class MyApp extends LitElement {
  router = new RouterController(this, { routes });
  render() {
    return html\`&lt;groutcho-outlet .store=\${this.router.store}&gt;&lt;/groutcho-outlet&gt;\`;
  }
}</code></pre>
    `
  );

const GroutchoReact: Page = () =>
  pkg(
    '@diso.io/groutcho-react',
    'React bindings built on useSyncExternalStore.',
    '@diso.io/groutcho-react react',
    html`
      <pre><code>import { RouterProvider, useMatch } from '@diso.io/groutcho-react';

function Outlet() {
  const match = useMatch();
  const Page = match.route?.page;
  return Page ? &lt;Page {...match.params} /&gt; : null;
}</code></pre>
    `
  );

const NotFound: Page = () => html`
  <article>
    <h1>404</h1>
    <p>No page here. <a href="/" data-route>Back home</a>.</p>
  </article>
`;

export const routes: Record<string, RouteConfig> = {
  Home: { pattern: '/', page: Home },
  Groutcho: { pattern: '/groutcho', page: Groutcho },
  GroutchoLit: { pattern: '/groutcho-lit', page: GroutchoLit },
  GroutchoReact: { pattern: '/groutcho-react', page: GroutchoReact },
  NotFound: { pattern: '/404', page: NotFound }
};

export const redirects: Record<string, RedirectTest> = {
  NotFound: (match) => (match ? false : 'NotFound')
};
