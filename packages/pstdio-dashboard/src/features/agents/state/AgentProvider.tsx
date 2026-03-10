import type { ReactNode } from "react";
import { createContext, useContext, useRef } from "react";
import { useStore } from "zustand";
import type { AgentStore } from "./createAgentStore";
import { createAgentStore } from "./createAgentStore";
import type { AgentStoreHydration, AgentStoreState } from "./types";

export const AgentStoreContext = createContext<AgentStore | null>(null);

interface AgentProviderProps {
  children: ReactNode;
  initialState?: AgentStoreHydration;
}

export function AgentProvider(props: AgentProviderProps) {
  const { children, initialState } = props;
  const storeRef = useRef<AgentStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = createAgentStore(initialState);
  }

  const store = storeRef.current!;

  return <AgentStoreContext.Provider value={store}>{children}</AgentStoreContext.Provider>;
}

export const useAgentStoreApi = () => {
  const store = useContext(AgentStoreContext);
  if (!store) {
    throw new Error("Agent store has not been initialized. Ensure AgentProvider is mounted.");
  }

  return store;
};

export const useAgentStore = <T,>(selector: (state: AgentStoreState) => T) => {
  const store = useAgentStoreApi();
  return useStore(store, selector);
};
