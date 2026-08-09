import type { RouterStore } from "@diso.io/groutcho";
import { createContext } from "react";

/** Context carrying the current {@link RouterStore}. Provided by `RouterProvider`. */
export const RouterContext = createContext<RouterStore | null>(null);
