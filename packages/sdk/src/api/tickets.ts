export type {
  CreateTicketAttemptInput,
  CreateTicketInput,
  TicketAttemptMode,
  UpdateTicketInput,
  UpdateWhenAttemptStatusInput,
  UpdateWhenAttemptStatusResponse,
  UploadTicketFileInput,
} from "pstdio-api-contracts";

import type { Ticket, Workspace } from "../resources";

export type ListTicketsInput = {
  status?: string;
  tag?: string | string[];
  archived?: boolean;
  draft?: boolean;
  parent_id?: string;
  shorthand?: string;
  search?: string;
};

export type TicketAttemptResponse = {
  mode: "worktree" | "current_branch";
  ticket: Ticket;
  workspace: Workspace;
  session: { id: string; workspace_id: string; title: string; created_at: string; updated_at: string } | null;
};
