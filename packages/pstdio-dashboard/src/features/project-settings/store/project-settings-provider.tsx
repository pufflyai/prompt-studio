import type { ReactNode } from "react";
import { createContext, useContext, useRef } from "react";
import { useStore } from "zustand";
import type { ProjectSettingsStore } from "./create-project-settings-store";
import { createProjectSettingsStore } from "./create-project-settings-store";
import type { ProjectSettingsHydration, ProjectSettingsState } from "./types";

export const ProjectSettingsStoreContext = createContext<ProjectSettingsStore | null>(null);

interface ProjectSettingsProviderProps {
  children: ReactNode;
  projectId?: string;
  initialState?: ProjectSettingsHydration;
}

export function ProjectSettingsProvider(props: ProjectSettingsProviderProps) {
  const { children, projectId, initialState } = props;
  const storeRef = useRef<ProjectSettingsStore | null>(null);
  const projectIdRef = useRef<string | undefined>(projectId);

  if (!storeRef.current || projectIdRef.current !== projectId) {
    projectIdRef.current = projectId;
    storeRef.current = createProjectSettingsStore({ projectId, initialState });
  }

  const store = storeRef.current!;

  return <ProjectSettingsStoreContext.Provider value={store}>{children}</ProjectSettingsStoreContext.Provider>;
}

export const useProjectSettingsStoreApi = () => {
  const store = useContext(ProjectSettingsStoreContext);
  if (!store) {
    throw new Error("ProjectSettings store has not been initialized. Ensure ProjectSettingsProvider is mounted.");
  }

  return store;
};

export const useProjectSettingsStore = <T,>(selector: (state: ProjectSettingsState) => T) => {
  const store = useProjectSettingsStoreApi();
  return useStore(store, selector);
};
