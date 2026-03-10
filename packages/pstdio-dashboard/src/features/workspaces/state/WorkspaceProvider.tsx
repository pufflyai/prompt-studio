import type { ReactNode } from "react";
import { createContext, useContext, useRef } from "react";
import { useStore } from "zustand";
import type { WorkspaceStore } from "./createWorkspaceStore";
import { createWorkspaceStore } from "./createWorkspaceStore";
import type { WorkspaceStoreHydration, WorkspaceStoreState } from "./types";

export const WorkspaceStoreContext = createContext<WorkspaceStore | null>(null);

interface WorkspaceProviderProps {
  children: ReactNode;
  initialState?: WorkspaceStoreHydration;
}

export function WorkspaceProvider(props: WorkspaceProviderProps) {
  const { children, initialState } = props;
  const storeRef = useRef<WorkspaceStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = createWorkspaceStore(initialState);
  }

  const store = storeRef.current!;

  return <WorkspaceStoreContext.Provider value={store}>{children}</WorkspaceStoreContext.Provider>;
}

export const useWorkspaceStoreApi = () => {
  const store = useContext(WorkspaceStoreContext);
  if (!store) {
    throw new Error("Workspace store has not been initialized. Ensure WorkspaceProvider is mounted.");
  }

  return store;
};

export const useWorkspaceStore = <T,>(selector: (state: WorkspaceStoreState) => T) => {
  const store = useWorkspaceStoreApi();
  return useStore(store, selector);
};
