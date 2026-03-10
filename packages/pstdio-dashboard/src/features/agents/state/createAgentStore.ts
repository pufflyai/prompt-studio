import { createStore } from "zustand";
import { devtools, persist, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { getStoredAgent } from "@/features/agents/agent-storage";
import type { AgentStoreHydration, AgentStoreSnapshot, AgentStoreState } from "./types";

const DEFAULT_AGENT = "opencode";
const STORE_NAME = "pstdio-agents";
const ACTION_NAME_PREFIX = "agent";

const getPersistedAgentSnapshot = (state: AgentStoreState) => ({
  selectedAgent: state.selectedAgent,
  selectedModel: state.selectedModel,
});

export const getDefaultAgentSnapshot = () =>
  ({
    selectedAgent: getStoredAgent() ?? DEFAULT_AGENT,
    selectedModel: "",
  }) satisfies AgentStoreSnapshot;

export const createAgentStore = (initial?: AgentStoreHydration) => {
  const initialSnapshot = {
    ...getDefaultAgentSnapshot(),
    ...initial,
  };

  const actionName = (action: string) => `${ACTION_NAME_PREFIX}/${action}`;

  return createStore<AgentStoreState>()(
    persist(
      devtools(
        immer(
          subscribeWithSelector((set) => ({
            ...initialSnapshot,
            setSelectedAgent: (selectedAgent) =>
              set(
                (state) => {
                  state.selectedAgent = selectedAgent;
                  state.selectedModel = "";
                },
                false,
                actionName("setSelectedAgent"),
              ),
            setSelectedModel: (selectedModel) =>
              set(
                (state) => {
                  state.selectedModel = selectedModel;
                },
                false,
                actionName("setSelectedModel"),
              ),
            reset: () => set(getDefaultAgentSnapshot(), false, actionName("reset")),
          })),
        ),
        { name: STORE_NAME },
      ),
      {
        name: STORE_NAME,
        partialize: getPersistedAgentSnapshot,
        merge: (persistedState, currentState) => ({
          ...currentState,
          ...(persistedState as AgentStoreHydration),
        }),
      },
    ),
  );
};

export type AgentStore = ReturnType<typeof createAgentStore>;
