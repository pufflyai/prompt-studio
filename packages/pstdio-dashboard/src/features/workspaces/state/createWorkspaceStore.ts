import { createStore } from "zustand";
import { devtools, persist, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { WorkspaceStoreHydration, WorkspaceStoreSnapshot, WorkspaceStoreState } from "./types";

const STORE_NAME = "schub-workspaces";
const ACTION_NAME_PREFIX = "workspace";

const getPersistedWorkspaceSnapshot = (state: WorkspaceStoreState) => ({
  selectedRepositoryId: state.selectedRepositoryId,
  selectedBranch: state.selectedBranch,
});

export const getDefaultWorkspaceSnapshot = () =>
  ({
    selectedRepositoryId: "",
    selectedBranch: "",
  }) satisfies WorkspaceStoreSnapshot;

export const createWorkspaceStore = (initial?: WorkspaceStoreHydration) => {
  const initialSnapshot = {
    ...getDefaultWorkspaceSnapshot(),
    ...initial,
  };

  const actionName = (action: string) => `${ACTION_NAME_PREFIX}/${action}`;

  return createStore<WorkspaceStoreState>()(
    persist(
      devtools(
        immer(
          subscribeWithSelector((set) => ({
            ...initialSnapshot,
            setSelectedRepositoryId: (selectedRepositoryId) =>
              set(
                (state) => {
                  state.selectedRepositoryId = selectedRepositoryId;
                },
                false,
                actionName("setSelectedRepositoryId"),
              ),
            setSelectedBranch: (selectedBranch) =>
              set(
                (state) => {
                  state.selectedBranch = selectedBranch;
                },
                false,
                actionName("setSelectedBranch"),
              ),
            reset: () => set(getDefaultWorkspaceSnapshot(), false, actionName("reset")),
          })),
        ),
        { name: STORE_NAME },
      ),
      {
        name: STORE_NAME,
        version: 3,
        partialize: getPersistedWorkspaceSnapshot,
        migrate: (persisted) => {
          const state = persisted as Record<string, unknown>;
          // Remove all legacy fields
          delete state.workspacePanelMode;
          delete state.panelMode;
          delete state.selectedAgent;
          delete state.selectedModel;
          delete state.selectedExecutor;
          delete state.selectedSessionId;
          delete state.isSessionListOpen;
          delete state.optimisticSession;
          return state as ReturnType<typeof getPersistedWorkspaceSnapshot>;
        },
        merge: (persistedState, currentState) => ({
          ...currentState,
          ...(persistedState as WorkspaceStoreHydration),
        }),
      },
    ),
  );
};

export type WorkspaceStore = ReturnType<typeof createWorkspaceStore>;
