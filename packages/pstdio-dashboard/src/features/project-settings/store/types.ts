import type { CodingAgent } from "@/features/agents/agent-storage";

export type SessionModalState = "bubble" | "closed" | "attached";

export interface ProjectSettingsSnapshot {
  lastSelectedAgent: CodingAgent;
  lastSelectedModels: string[];
  lastSelectedRepo: string;
  lastSelectedBranches: string[];
  sessionModalState: SessionModalState;
  selectedSessionId: string | null;
  lastNonSessionsPath: string | null;
  chatDraftsBySession: Record<string, string>;
  createTicketDraft: string;
}

export interface ProjectSettingsState extends ProjectSettingsSnapshot {
  setLastSelectedAgent: (agent: CodingAgent) => void;
  setLastSelectedModel: (model: string) => void;
  setLastSelectedRepo: (repoId: string) => void;
  setLastSelectedBranch: (branch: string) => void;
  setSessionModalState: (state: SessionModalState) => void;
  setSelectedSessionId: (sessionId: string | null) => void;
  setLastNonSessionsPath: (path: string | null) => void;
  setSessionDraft: (sessionId: string | null, draft: string) => void;
  clearSessionDraft: (sessionId: string | null) => void;
  setCreateTicketDraft: (draft: string) => void;
  clearCreateTicketDraft: () => void;
  reset: () => void;
}

export type ProjectSettingsHydration = Partial<ProjectSettingsSnapshot>;

export interface ProjectSettingsStoreOptions {
  projectId?: string;
  initialState?: ProjectSettingsHydration;
}
