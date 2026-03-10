import type { CodingAgent } from "@/features/agents/agent-storage";

export interface AgentStoreSnapshot {
  selectedAgent: CodingAgent;
  selectedModel: string;
}

export interface AgentStoreState extends AgentStoreSnapshot {
  setSelectedAgent: (selectedAgent: CodingAgent) => void;
  setSelectedModel: (selectedModel: string) => void;
  reset: () => void;
}

export type AgentStoreHydration = Partial<AgentStoreSnapshot>;
