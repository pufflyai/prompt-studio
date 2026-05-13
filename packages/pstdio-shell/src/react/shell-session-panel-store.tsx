import type { ReactNode } from "react";
import { createContext, useContext, useRef } from "react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

export type ShellSessionPanelMode = "bubble" | "closed" | "attached";

interface ShellSessionPanelState {
  mode: ShellSessionPanelMode;
  setMode: (mode: ShellSessionPanelMode) => void;
}

interface ShellSessionPanelProviderProps {
  children: ReactNode;
  initialMode?: ShellSessionPanelMode;
}

export const createShellSessionPanelStore = (initialMode: ShellSessionPanelMode = "bubble") =>
  createStore<ShellSessionPanelState>()((set) => ({
    mode: initialMode,
    setMode: (mode) => set({ mode }),
  }));

export type ShellSessionPanelStore = ReturnType<typeof createShellSessionPanelStore>;

const ShellSessionPanelStoreContext = createContext<ShellSessionPanelStore | null>(null);

export const ShellSessionPanelProvider = (props: ShellSessionPanelProviderProps) => {
  const { children, initialMode } = props;
  const storeRef = useRef<ShellSessionPanelStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = createShellSessionPanelStore(initialMode);
  }

  return (
    <ShellSessionPanelStoreContext.Provider value={storeRef.current}>{children}</ShellSessionPanelStoreContext.Provider>
  );
};

export const useShellSessionPanelStore = <T,>(selector: (state: ShellSessionPanelState) => T) => {
  const store = useContext(ShellSessionPanelStoreContext);
  if (!store) {
    throw new Error("Shell session panel store has not been initialized. Ensure ShellSessionPanelProvider is mounted.");
  }

  return useStore(store, selector);
};
