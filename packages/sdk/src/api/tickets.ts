/** @deprecated Legacy core ticket API. Ticket data is owned by the pstdio tickets extension. */
export type {
  CreateTicketAttemptInput,
  CreateTicketInput,
  ListProjectActivityForTicketsInput,
  ListTicketActivityInput,
  ListTicketActivityResponse,
  TicketAttemptMode,
  UpdateTicketInput,
  UpdateWhenAttemptStatusInput,
  UpdateWhenAttemptStatusResponse,
  UploadTicketFileInput,
} from "pstdio-api-contracts";

import type { Ticket, Workspace } from "../resources";

/** @deprecated Legacy core ticket API. Ticket data is owned by the pstdio tickets extension. */
export type ListTicketsInput = {
  status?: string;
  tag?: string | string[];
  archived?: boolean;
  draft?: boolean;
  parent_id?: string;
  shorthand?: string;
  search?: string;
};

/** @deprecated Legacy core ticket attempts. Ticket attempts are owned by the pstdio tickets extension. */
export type TicketAttemptResponse = {
  mode: "worktree" | "current_branch";
  ticket: Ticket;
  workspace: Workspace;
  session: { id: string; workspace_id: string; title: string; created_at: string; updated_at: string } | null;
};
