import { createContext, useContext } from "react";
export const FloatingMenuContext = createContext<{
  ids: readonly string[];
  setOpen(id: string, open: boolean, peers?: readonly string[]): void;
}>({ ids: [], setOpen: () => {} });
export const useFloatingMenu = () => useContext(FloatingMenuContext);
