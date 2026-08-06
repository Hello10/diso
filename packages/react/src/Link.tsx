import type { Input, Params } from '@diso.io/groutcho';
import { type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react';

import { useRouter } from './hooks';

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  /** A url or route name to navigate to. */
  to?: string;
  /** Params used with a route-name `to` (and to build the href). */
  params?: Params;
  /** A full input object; takes precedence over `to`/`params`. */
  input?: Input;
  children?: ReactNode;
}

function isModifiedEvent(event: MouseEvent): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

/**
 * An `<a>` that navigates via the router instead of reloading the page.
 * Modifier/middle clicks fall through to default browser behavior.
 */
export function Link({ to = '', params, input, onClick, children, ...rest }: LinkProps) {
  const store = useRouter();

  const target: Input =
    input ?? (params && to && !to.includes('/') ? { route: { name: to, params } } : to);

  let href = to || '#';
  try {
    href = store.match(target).url;
  } catch {
    href = to || '#';
  }

  function handleClick(event: MouseEvent<HTMLAnchorElement>): void {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || isModifiedEvent(event)) {
      return;
    }
    event.preventDefault();
    store.go(target);
  }

  return (
    <a href={href} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
