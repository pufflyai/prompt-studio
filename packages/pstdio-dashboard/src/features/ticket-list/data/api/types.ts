import type { TicketStatus, TicketStatusColor } from "@/features/ticket-list/types";
import type { ApiFileDiff, ApiWorkspaceArtifact } from "@/shared/api-types";
import type { PlannerTicket } from "./planner";

export type { ApiFileDiff, ApiWorkspaceArtifact };

export type ApiTicket = PlannerTicket;

export type ApiTicketFile = {
  id: string;
  file_name: string;
  file_kind: string;
  mime_type: string | null;
  size_bytes: number;
  created_at: string;
};

export type ApiTicketFilesResponse = {
  files: ApiTicketFile[];
  artifacts: ApiWorkspaceArtifact[];
};

export type ApiTicketAttemptDiff = {
  workspace_id: string;
  base_ref: string;
  head_ref: string;
  files: ApiFileDiff[];
  totals: {
    additions: number;
    deletions: number;
    file_count: number;
  };
};

export type CreateProjectTicketInput = {
  projectId: string;
  content?: string | null;
  tagIds?: string[];
  dependsOn?: string | null;
  status?: TicketStatus | null;
  parentId?: string | null;
};

export type CreateTicketAndStartInput = {
  projectId: string;
  content?: string | null;
  dependsOn?: string | null;
  statusId?: string | null;
  agent?: string | null;
  branch?: string | null;
  repoId?: string | null;
};

export type CreateProjectTicketStatusInput = {
  name: string;
  color: TicketStatusColor;
};

export type CreateProjectTicketTagInput = {
  name: string;
  type: "single_select" | "multi_select";
  options?: { name: string; color: string }[];
};

export type CreateTagOptionInput = {
  name: string;
  color: string;
  icon?: string;
  description?: string;
};

export type UpdateTagOptionInput = {
  name?: string;
  color?: string;
  sort_order?: number;
  icon?: string | null;
  description?: string | null;
};

export type TicketAttemptMode = "worktree" | "current_branch";

export type CreateTicketAttemptInput = {
  projectId: string;
  ticketId: string;
  agent?: string | null;
  branch?: string | null;
  repoId?: string | null;
  mode?: TicketAttemptMode;
  model?: string | null;
  prompt?: string | null;
  startSession?: boolean;
};

export type CreateTicketAttemptResult = {
  ticketId: string;
  sessionId: string | null;
  workspaceId: string;
  workspaceShorthand: string;
};

export type ApiCreateTicketAttemptResponse = {
  mode: TicketAttemptMode;
  ticket: ApiTicket;
  workspace: {
    id: string;
    project_id: string;
    ticket_id: string | null;
    name: string;
    workspace_shorthand: string;
    created_at: string;
    updated_at: string;
  };
  session: { id: string; workspace_id: string; title: string; created_at: string; updated_at: string } | null;
};

export type ApiCreateTicketAndStartResponse = {
  ticket: ApiTicket;
  workspace: {
    id: string;
    project_id: string;
    ticket_id: string | null;
    name: string;
    created_at: string;
    updated_at: string;
  };
  session: { id: string; workspace_id: string; title: string; created_at: string; updated_at: string };
};

export type CreateTicketAndStartResult = {
  ticketId: string;
  sessionId: string;
  workspaceId: string;
};
