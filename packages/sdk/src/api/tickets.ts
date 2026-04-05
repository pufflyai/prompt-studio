import type { Ticket, Workspace } from "../resources";

export type CreateTicketInput = {
  project_id: string;
  content?: string;
  user_prompt?: string;
  file_id?: string;
  parent_id?: string;
  draft?: boolean;
  tag_ids?: string[];
  status_id?: string;
};

export type ListTicketsInput = {
  status?: string;
  tag?: string | string[];
  archived?: boolean;
  draft?: boolean;
  parent_id?: string;
  shorthand?: string;
  search?: string;
};

export type UpdateTicketInput = {
  content?: string;
  display_title?: string;
  user_prompt?: string;
  file_id?: string;
  parent_id?: string;
  status_id?: string;
  draft?: boolean;
  archived?: boolean;
  tag_ids?: string[];
};

export type UploadTicketFileInput = {
  file_name: string;
  content_base64: string;
  mime_type?: string;
};

export type TicketAttemptMode = "worktree" | "current_branch";

export type CreateTicketAttemptInput = {
  agent?: string;
  branch?: string;
  repo_id?: string;
  repo_path?: string;
  mode?: TicketAttemptMode;
  model?: string;
  prompt?: string | null;
  base?: string;
  start_session?: boolean;
};

export type TicketAttemptResponse = {
  mode: TicketAttemptMode;
  ticket: Ticket;
  workspace: Workspace;
  session: { id: string; workspace_id: string; title: string; created_at: string; updated_at: string } | null;
};

export type UpdateWhenAttemptStatusInput = {
  all_attempts_status: string;
  set_status: string;
};

export type UpdateWhenAttemptStatusResponse = {
  updated: boolean;
};
