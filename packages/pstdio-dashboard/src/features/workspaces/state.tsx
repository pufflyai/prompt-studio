import type { ReactNode } from "react";
import { create } from "zustand";

type WorkspacePanelMode = "hidden" | "floating" | "docked";

interface OptimisticSession {
  prompt: string;
  index: number;
}

interface WorkspaceState {
  selectedAgent: string;
  selectedModel: string;
  selectedRepositoryId: string;
  selectedBranch: string;
  workspacePanelMode: WorkspacePanelMode;
  optimisticSession: OptimisticSession | null;
  activeSessionId: string | null;

  setSelectedAgent: (agent: string) => void;
  setSelectedModel: (model: string) => void;
  setSelectedRepositoryId: (repoId: string) => void;
  setSelectedBranch: (branch: string) => void;
  setWorkspacePanelMode: (mode: WorkspacePanelMode) => void;
  startOptimisticSession: (prompt: string, index: number) => void;
  resolveOptimisticSession: (sessionId: string) => void;
  clearOptimisticSession: () => void;
  openWithSession: (sessionId: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  selectedAgent: "",
  selectedModel: "",
  selectedRepositoryId: "",
  selectedBranch: "",
  workspacePanelMode: "hidden",
  optimisticSession: null,
  activeSessionId: null,

  setSelectedAgent: (agent) => set({ selectedAgent: agent }),
  setSelectedModel: (model) => set({ selectedModel: model }),
  setSelectedRepositoryId: (repoId) => set({ selectedRepositoryId: repoId }),
  setSelectedBranch: (branch) => set({ selectedBranch: branch }),
  setWorkspacePanelMode: (mode) => set({ workspacePanelMode: mode }),
  startOptimisticSession: (prompt, index) => set({ optimisticSession: { prompt, index } }),
  resolveOptimisticSession: (sessionId) => set({ optimisticSession: null, activeSessionId: sessionId }),
  clearOptimisticSession: () => set({ optimisticSession: null }),
  openWithSession: (sessionId) => set({ activeSessionId: sessionId, workspacePanelMode: "floating" }),
}));

export const WorkspaceProvider = (props: { children: ReactNode }) => {
  return <>{props.children}</>;
};
