import type { ReactNode } from "react";
import { create } from "zustand";

interface WorkspaceState {
  selectedAgent: string;
  selectedModel: string;
  setSelectedAgent: (agent: string) => void;
  setSelectedModel: (model: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  selectedAgent: "",
  selectedModel: "",
  setSelectedAgent: (agent) => set({ selectedAgent: agent }),
  setSelectedModel: (model) => set({ selectedModel: model }),
}));

export const WorkspaceProvider = (props: { children: ReactNode }) => {
  return <>{props.children}</>;
};
