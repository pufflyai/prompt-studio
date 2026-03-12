import type { CodingAgent } from "@/features/agents/agent-storage";

export type SessionModalState = "bubble" | "closed" | "attached";

export interface ProjectSettingsSnapshot {
  lastSelectedAgent: CodingAgent;
  lastSelectedModels: string[];
  lastSelectedRepo: string;
  lastSelectedBranches: string[];
  sessionModalState: SessionModalState;
  selectedSessionId: string | null;
}

export interface ProjectSettingsState extends ProjectSettingsSnapshot {
  setLastSelectedAgent: (agent: CodingAgent) => void;
  setLastSelectedModel: (model: string) => void;
  setLastSelectedRepo: (repoId: string) => void;
  setLastSelectedBranch: (branch: string) => void;
  setSessionModalState: (state: SessionModalState) => void;
  setSelectedSessionId: (sessionId: string | null) => void;
  reset: () => void;
}

export type ProjectSettingsHydration = Partial<ProjectSettingsSnapshot>;

export interface ProjectSettingsStoreOptions {
  projectId?: string;
  initialState?: ProjectSettingsHydration;
}
