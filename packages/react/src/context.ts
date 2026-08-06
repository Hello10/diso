import { createContext } from 'react';
import type { RouterStore } from '@diso.io/groutcho';

/** Context carrying the current {@link RouterStore}. Provided by `RouterProvider`. */
export const RouterContext = createContext<RouterStore | null>(null);
