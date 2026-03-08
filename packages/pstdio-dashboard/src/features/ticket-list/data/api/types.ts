import type { TicketListItem } from "pstdio-api/dto";
import type { TicketStatus, TicketStatusColor } from "@/features/ticket-list/types";

export type ApiTicketSubTicket = {
  id: string;
  shorthand: string;
  title: string;
  status_id: string | null;
};

export type ApiTicket = TicketListItem & {
  tag_ids?: string[] | null;
  attempts?: ApiTicketAttempt[] | null;
  sub_tickets?: ApiTicketSubTicket[] | null;
};

export type ApiTicketAttempt = {
  id: string;
  label: string;
  status: "active" | "merged" | "rejected";
  shorthand: string | null;
  session_id: string;
  updated_at: string;
  worktree_path: string | null;
};

export type ApiTicketFile = {
  id: string;
  file_name: string;
  file_kind: string;
  mime_type: string | null;
  size_bytes: number;
  created_at: string;
};

export type ApiWorkspaceArtifact = {
  id: string;
  file_id: string;
  file_name: string;
  file_kind: string;
  relative_path: string;
  mime_type: string | null;
  size_bytes: number;
  created_at: string;
};

export type ApiTicketFilesResponse = {
  files: ApiTicketFile[];
  artifacts: ApiWorkspaceArtifact[];
};

export type ApiFileDiff = {
  filePath: string;
  change: "added" | "deleted" | "modified" | "renamed" | "copied" | "permissionChange";
  additions: number;
  deletions: number;
  oldContent: string;
  newContent: string;
  oldPath?: string;
  newPath?: string;
};

export type ApiTicketAttemptDiff = {
  workspace_id: string;
  mode: "unstaged" | "staged" | "all";
  diff_text: string;
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
  complexity?: "low" | "medium" | "high" | null;
  dependsOn?: string | null;
  status?: TicketStatus | null;
  parentId?: string | null;
};

export type CreateTicketAndStartInput = {
  projectId: string;
  content?: string | null;
  complexity?: "low" | "medium" | "high" | null;
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
  color: TicketStatusColor;
};

export type TicketAttemptMode = "worktree" | "current_branch";

export type CreateTicketAttemptInput = {
  ticketId: string;
  agent?: string | null;
  branch?: string | null;
  repoId?: string | null;
  mode?: TicketAttemptMode;
  model?: string | null;
  prompt?: string | null;
};

export type CreateTicketAttemptResult = {
  ticketId: string;
  sessionId: string;
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
  session: { id: string; workspace_id: string; title: string; created_at: string; updated_at: string };
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

export type MergeTicketAttemptResult =
  | { status: "merged"; filesChanged: number; commitMessage: string }
  | { status: "conflict"; conflictFiles: string[] };

export type SwitchToTicketAttemptResult = {
  status: "switched";
  ticketLabel: string;
  attemptLabel: string;
  previewBranch: string;
  needsInstall: boolean;
  installWarning?: string;
};

export type SwitchBackTicketAttemptResult = {
  status: "restored";
  ticketLabel: string;
  attemptLabel: string;
  originalBranch: string;
};

export type TicketAttemptSwapStatus = {
  swapped: boolean;
  ticketLabel?: string;
  attemptLabel?: string;
};
