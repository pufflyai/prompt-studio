import { createContext, useContext } from "react";
export const FloatingMenuContext = createContext<{ id?: string; select(id?: string): void }>({ select: () => {} });
export const useFloatingMenu = () => useContext(FloatingMenuContext);
