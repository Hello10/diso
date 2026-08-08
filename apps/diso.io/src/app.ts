import { createBrowserHistory, RouterController, type MatchResult } from '@diso.io/groutcho-lit';
import { LitElement, css, html, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';

import { redirects, routes } from './routes';

@customElement('diso-app')
export class DisoApp extends LitElement {
  private router = new RouterController(this, {
    routes,
    redirects,
    history: createBrowserHistory()
  });

  static override styles = css`
    :host {
      display: block;
      min-height: 100vh;
      color: #16161a;
      background: #fafafa;
      font: 16px/1.6 system-ui, sans-serif;
    }
    header {
      display: flex;
      align-items: baseline;
      gap: 1.5rem;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid #e5e5e5;
      position: sticky;
      top: 0;
      background: #fafafaee;
      backdrop-filter: blur(6px);
    }
    .brand {
      font-weight: 700;
      font-size: 1.1rem;
      color: #16161a;
      text-decoration: none;
    }
    nav {
      display: flex;
      gap: 1rem;
    }
    nav groutcho-link::part(a),
    nav a {
      color: #555;
      text-decoration: none;
    }
    main {
      max-width: 44rem;
      margin: 0 auto;
      padding: 2rem 1.5rem 4rem;
    }
    footer {
      max-width: 44rem;
      margin: 0 auto;
      padding: 1.5rem;
      color: #888;
      border-top: 1px solid #e5e5e5;
      font-size: 0.9rem;
    }
    footer a,
    a {
      color: #5b3df5;
    }
    h1 {
      font-size: 1.8rem;
      margin: 0 0 0.25rem;
    }
    .tagline {
      color: #555;
      margin-top: 0;
    }
    pre {
      background: #16161a;
      color: #f5f5f5;
      padding: 1rem;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 0.85rem;
    }
    .cards {
      list-style: none;
      padding: 0;
      display: grid;
      gap: 0.75rem;
    }
    .cards a {
      display: flex;
      flex-direction: column;
      padding: 0.9rem 1rem;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      text-decoration: none;
      background: #fff;
    }
    .cards span {
      color: #777;
      font-size: 0.9rem;
    }
  `;

  override connectedCallback(): void {
    super.connectedCallback();
    // Intercept internal anchor clicks (composed events cross the shadow
    // boundary) so plain <a href="/…"> links navigate via the router too.
    window.addEventListener('click', this.#onClick);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('click', this.#onClick);
  }

  #onClick = (event: MouseEvent): void => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    const anchor = event
      .composedPath()
      .find((el): el is HTMLAnchorElement => el instanceof HTMLAnchorElement);
    const href = anchor?.getAttribute('href');
    if (!href || !href.startsWith('/')) {
      return; // external or non-navigational
    }
    event.preventDefault();
    this.router.go(href);
  };

  override render(): unknown {
    const { store } = this.router;
    return html`
      <header>
        <a class="brand" href="/">diso.io</a>
        <nav>
          <groutcho-link .store=${store} to="Groutcho">groutcho</groutcho-link>
          <groutcho-link .store=${store} to="GroutchoLit">groutcho-lit</groutcho-link>
          <groutcho-link .store=${store} to="GroutchoReact">groutcho-react</groutcho-link>
          <groutcho-link .store=${store} to="Bark">bark</groutcho-link>
        </nav>
      </header>
      <main>${this.#renderPage()}</main>
      <footer>by <a href="https://hello10.com">Hello10</a></footer>
    `;
  }

  // Render the current route's page inline (in this element's shadow root) so
  // the shared page styles above apply. Still fully driven by the router: the
  // RouterController re-renders this on every navigation.
  #renderPage(): unknown {
    const { match } = this.router;
    const page = match.route?.page;
    return typeof page === 'function' ? (page as (m: MatchResult) => unknown)(match) : nothing;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'diso-app': DisoApp;
  }
}
