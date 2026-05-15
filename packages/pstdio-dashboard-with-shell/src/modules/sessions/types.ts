export type SessionStatus = "in_progress" | "awaiting_input" | "completed" | "failed" | "cancelled" | "disconnected";

export interface Session {
  id: string;
  projectId: string | null;
  agentSessionId: string | null;
  title: string;
  status: SessionStatus;
  archived: boolean;
  agent: string | null;
  lastSelectedModel: string | null;
  createdAt: string;
  updatedAt: string;
}
