import type { Session } from "../resources";

export type CreateSessionInput = {
  project_id: string;
  title: string;
  prompt?: string;
  template?: string;
  vars?: Record<string, string>;
  agent?: string;
  workspace_id?: string;
  model?: string;
  original_session_id?: string;
};

export type FollowUpInput = {
  prompt?: string;
  template?: string;
  vars?: Record<string, string>;
  agent?: string;
  model?: string;
  summary_from_session_id?: string;
  summary_format?: "brief" | "detailed";
  summary_role?: "assistant" | "all";
};

export type ApprovalInput = {
  id: string;
  decision: "approve" | "deny";
};

export type SessionConversationResponse = {
  session: Session;
  messages: unknown[];
};
