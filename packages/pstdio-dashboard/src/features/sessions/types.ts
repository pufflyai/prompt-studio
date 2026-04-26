export type SessionStatus = "in_progress" | "awaiting_input" | "completed" | "failed" | "cancelled" | "disconnected";

export interface Session {
  id: string;
  projectId: string | null;
  agentSessionId: string | null;
  title: string;
  status: SessionStatus;
  archived: boolean;
  agent: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionPromptAttachment {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
}
