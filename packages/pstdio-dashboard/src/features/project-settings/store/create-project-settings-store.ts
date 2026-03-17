import { createStore } from "zustand";
import { devtools, persist, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { getStoredAgent } from "@/features/agents/agent-storage";
import type { ProjectSettingsSnapshot, ProjectSettingsState, ProjectSettingsStoreOptions } from "./types";

const DEFAULT_AGENT = "opencode";
const STORE_NAME = "pstdio-project-settings";
const ACTION_NAME_PREFIX = "projectSettings";
const NEW_SESSION_DRAFT_KEY = "__new__";

const getStoreName = (projectId?: string) => (projectId ? `${STORE_NAME}/projects/${projectId}/values` : STORE_NAME);
const MAX_HISTORY = 20;

const prependUnique = (arr: string[], value: string, max: number) => {
  const filtered = arr.filter((item) => item !== value);
  return [value, ...filtered].slice(0, max);
};

const getPersistedSnapshot = (state: ProjectSettingsState) => ({
  lastSelectedAgent: state.lastSelectedAgent,
  lastSelectedModels: state.lastSelectedModels,
  lastSelectedRepo: state.lastSelectedRepo,
  lastSelectedBranches: state.lastSelectedBranches,
  sessionModalState: state.sessionModalState,
  selectedSessionId: state.selectedSessionId,
  chatDraftsBySession: state.chatDraftsBySession,
});

export const getDefaultProjectSettingsSnapshot = () =>
  ({
    lastSelectedAgent: getStoredAgent() ?? DEFAULT_AGENT,
    lastSelectedModels: [],
    lastSelectedRepo: "",
    lastSelectedBranches: [],
    sessionModalState: "bubble",
    selectedSessionId: null,
    lastNonSessionsPath: null,
    chatDraftsBySession: {},
  }) satisfies ProjectSettingsSnapshot;

export const createProjectSettingsStore = (options?: ProjectSettingsStoreOptions) => {
  const { projectId, initialState } = options ?? {};
  const storeName = getStoreName(projectId);
  const initialSnapshot = {
    ...getDefaultProjectSettingsSnapshot(),
    ...initialState,
  };

  const actionName = (action: string) => `${ACTION_NAME_PREFIX}/${action}`;

  return createStore<ProjectSettingsState>()(
    persist(
      devtools(
        immer(
          subscribeWithSelector((set) => ({
            ...initialSnapshot,
            setLastSelectedAgent: (agent) =>
              set(
                (state) => {
                  state.lastSelectedAgent = agent;
                },
                false,
                actionName("setLastSelectedAgent"),
              ),
            setLastSelectedModel: (model) =>
              set(
                (state) => {
                  if (!model) return;
                  state.lastSelectedModels = prependUnique(state.lastSelectedModels, model, MAX_HISTORY);
                },
                false,
                actionName("setLastSelectedModel"),
              ),
            setLastSelectedRepo: (repoId) =>
              set(
                (state) => {
                  state.lastSelectedRepo = repoId;
                },
                false,
                actionName("setLastSelectedRepo"),
              ),
            setLastSelectedBranch: (branch) =>
              set(
                (state) => {
                  if (!branch) return;
                  state.lastSelectedBranches = prependUnique(state.lastSelectedBranches, branch, MAX_HISTORY);
                },
                false,
                actionName("setLastSelectedBranch"),
              ),
            setSessionModalState: (modalState) =>
              set(
                (state) => {
                  state.sessionModalState = modalState;
                },
                false,
                actionName("setSessionModalState"),
              ),
            setSelectedSessionId: (sessionId) =>
              set(
                (state) => {
                  state.selectedSessionId = sessionId;
                },
                false,
                actionName("setSelectedSessionId"),
              ),
            setLastNonSessionsPath: (path) =>
              set(
                (state) => {
                  state.lastNonSessionsPath = path;
                },
                false,
                actionName("setLastNonSessionsPath"),
              ),
            setSessionDraft: (sessionId, draft) =>
              set(
                (state) => {
                  const key = sessionId ?? NEW_SESSION_DRAFT_KEY;
                  if (!draft.trim()) {
                    delete state.chatDraftsBySession[key];
                    return;
                  }
                  state.chatDraftsBySession[key] = draft;
                },
                false,
                actionName("setSessionDraft"),
              ),
            clearSessionDraft: (sessionId) =>
              set(
                (state) => {
                  const key = sessionId ?? NEW_SESSION_DRAFT_KEY;
                  delete state.chatDraftsBySession[key];
                },
                false,
                actionName("clearSessionDraft"),
              ),
            reset: () => set(getDefaultProjectSettingsSnapshot(), false, actionName("reset")),
          })),
        ),
        { name: storeName },
      ),
      {
        name: storeName,
        partialize: getPersistedSnapshot,
        merge: (persistedState, currentState) => ({
          ...currentState,
          ...(persistedState as Partial<ProjectSettingsSnapshot>),
        }),
      },
    ),
  );
};

export type ProjectSettingsStore = ReturnType<typeof createProjectSettingsStore>;
