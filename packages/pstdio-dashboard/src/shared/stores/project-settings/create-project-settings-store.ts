import { createStore } from "zustand";
import { createJSONStorage, devtools, persist, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { getStoredAgent } from "@/shared/agent-storage";
import type {
  PersistedProjectSettingsSnapshot,
  ProjectSettingsSnapshot,
  ProjectSettingsState,
  ProjectSettingsStoreOptions,
} from "./types";

const DEFAULT_AGENT = "pstdio.harness-open-code.opencode";
const STORE_NAME = "pstdio-project-settings";
const ACTION_NAME_PREFIX = "projectSettings";
const NEW_SESSION_DRAFT_KEY = "__new__";

const getStoreName = (projectId?: string) => (projectId ? `${STORE_NAME}/projects/${projectId}/values` : STORE_NAME);
const MAX_HISTORY = 20;

const prependUnique = (arr: string[], value: string, max: number) => {
  const filtered = arr.filter((item) => item !== value);
  return [value, ...filtered].slice(0, max);
};

const getPersistedSnapshot = (state: ProjectSettingsState) =>
  ({
    lastSelectedAgent: state.lastSelectedAgent,
    lastSelectedModels: state.lastSelectedModels,
    lastSelectedRepo: state.lastSelectedRepo,
    lastSelectedBranches: state.lastSelectedBranches,
    sessionModalState: state.sessionModalState,
    selectedSessionId: state.selectedSessionId,
    lastNonSessionsPath: state.lastNonSessionsPath,
    chatDraftsBySession: state.chatDraftsBySession,
    createTicketDraft: state.createTicketDraft,
  }) satisfies PersistedProjectSettingsSnapshot;

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
    createTicketDraft: "",
    pendingWorkspaceSessionWorkspaceId: null,
    createTicketRequestKey: 0,
    lastHandledCreateTicketRequestKey: 0,
  }) satisfies ProjectSettingsSnapshot;

export const createProjectSettingsStore = (options?: ProjectSettingsStoreOptions) => {
  const { projectId, initialState } = options ?? {};
  const storeName = getStoreName(projectId);
  const storage = createJSONStorage<PersistedProjectSettingsSnapshot>(() => globalThis.localStorage);
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
                  state.pendingWorkspaceSessionWorkspaceId = null;
                },
                false,
                actionName("setSelectedSessionId"),
              ),
            setPendingWorkspaceSessionWorkspaceId: (workspaceId) =>
              set(
                (state) => {
                  state.pendingWorkspaceSessionWorkspaceId = workspaceId;
                },
                false,
                actionName("setPendingWorkspaceSessionWorkspaceId"),
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
            setCreateTicketDraft: (draft) =>
              set(
                (state) => {
                  state.createTicketDraft = draft.trim() ? draft : "";
                },
                false,
                actionName("setCreateTicketDraft"),
              ),
            clearCreateTicketDraft: () =>
              set(
                (state) => {
                  state.createTicketDraft = "";
                },
                false,
                actionName("clearCreateTicketDraft"),
              ),
            requestCreateTicket: () =>
              set(
                (state) => {
                  state.createTicketRequestKey += 1;
                },
                false,
                actionName("requestCreateTicket"),
              ),
            acknowledgeCreateTicketRequest: (requestKey) =>
              set(
                (state) => {
                  state.lastHandledCreateTicketRequestKey = Math.max(
                    state.lastHandledCreateTicketRequestKey,
                    requestKey,
                  );
                },
                false,
                actionName("acknowledgeCreateTicketRequest"),
              ),
            reset: () => set(getDefaultProjectSettingsSnapshot(), false, actionName("reset")),
          })),
        ),
        { name: storeName },
      ),
      {
        name: storeName,
        storage,
        partialize: getPersistedSnapshot,
        merge: (persistedState, currentState) => ({
          ...currentState,
          ...(persistedState as Partial<PersistedProjectSettingsSnapshot>),
        }),
      },
    ),
  );
};

export type ProjectSettingsStore = ReturnType<typeof createProjectSettingsStore>;
