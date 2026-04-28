import type { Ticket, TicketDetail, TicketFile, TicketListItem, Workspace } from "../resources";
import { executePlannerCommand, listPlannerCollection, toPlannerTicketListItem } from "./planner";
import type { RequestFn } from "./request";

export type ListTicketsInput = {
  status?: string;
  tag?: string | string[];
  archived?: boolean;
  draft?: boolean;
  parent_id?: string;
  shorthand?: string;
  search?: string;
};

export type CreateTicketInput = {
  project_id: string;
  content?: string;
  draft?: boolean;
  parent_id?: string | null;
  status_id?: string | null;
  tag_ids?: string[];
  user_prompt?: string | null;
};

export type UpdateTicketInput = {
  content?: string;
  display_title?: string | null;
  draft?: boolean;
  archived?: boolean;
  parent_id?: string | null;
  status_id?: string | null;
  tag_ids?: string[];
  user_prompt?: string | null;
};

export type CreateTicketAttemptInput = {
  repo_id?: string;
  branch?: string;
  prompt?: string;
  agent?: string;
  model?: string;
  start_session?: boolean;
};

export type TicketAttemptResponse = {
  mode: "worktree" | "current_branch";
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

export type UploadTicketFileInput = {
  file_name: string;
  content_base64: string;
  mime_type?: string | null;
};

export type TicketClient = {
  list(projectId: string, input?: ListTicketsInput): Promise<TicketListItem[]>;
  get(ticketId: string): Promise<TicketDetail>;
  create(input: CreateTicketInput): Promise<Ticket>;
  update(ticketId: string, input: UpdateTicketInput): Promise<Ticket>;
  delete(ticketId: string): Promise<void>;
  createAttempt(ticketId: string, input: CreateTicketAttemptInput): Promise<TicketAttemptResponse>;
  updateWhenAttemptStatus(
    ticketId: string,
    input: UpdateWhenAttemptStatusInput,
  ): Promise<UpdateWhenAttemptStatusResponse>;
  listFiles(ticketId: string): Promise<TicketFile[]>;
  getFileContent(ticketId: string, fileId: string): Promise<Uint8Array>;
  uploadFile(ticketId: string, input: UploadTicketFileInput): Promise<TicketFile>;
  deleteFile(ticketId: string, fileId: string): Promise<void>;
};

const unsupported = (method: string) => {
  throw new Error(`client.tickets.${method} requires planner/generic APIs with a project id.`);
};

export const createTicketClient = (request: RequestFn): TicketClient => ({
  list: async (projectId, input = {}) => {
    const rows = (await listPlannerCollection(request, projectId, "tickets")).map(toPlannerTicketListItem);
    return rows
      .filter((ticket) => (input.archived === undefined ? true : ticket.archived === input.archived))
      .filter((ticket) => (input.draft === undefined ? true : ticket.draft === input.draft))
      .filter((ticket) => (input.shorthand ? ticket.shorthand === input.shorthand : true))
      .filter((ticket) => (input.parent_id ? ticket.parent_id === input.parent_id : true));
  },
  get: async () => unsupported("get"),
  create: async (input) => {
    const result = await executePlannerCommand(request, input.project_id, "createTicket", {
      content: input.content ?? "",
      draft: input.draft ?? false,
      parent_id: input.parent_id ?? null,
      status_id: input.status_id ?? null,
      tag_ids: input.tag_ids,
      user_prompt: input.user_prompt ?? null,
    });
    return toPlannerTicketListItem({
      id: "",
      project_id: input.project_id,
      item_id: "",
      value_json: result,
      created_at: "",
      updated_at: "",
    });
  },
  update: async () => unsupported("update"),
  delete: async () => unsupported("delete"),
  createAttempt: async () => unsupported("createAttempt"),
  updateWhenAttemptStatus: async () => unsupported("updateWhenAttemptStatus"),
  listFiles: async () => unsupported("listFiles"),
  getFileContent: async () => unsupported("getFileContent"),
  uploadFile: async () => unsupported("uploadFile"),
  deleteFile: async () => unsupported("deleteFile"),
});
