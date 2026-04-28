import { type ClientOptions, createRequest, type RequestFn } from "@pstdio/sdk/client";
import { PLANNER_EXTENSION_ID } from "../contract";

export type PullPlannerTicketsInput = {
  ticket_id?: string;
  force?: boolean;
  repo_path?: string;
};

export type PullPlannerTicketsResponse = {
  pulled_ticket_shorthands: string[];
  downloaded_file_count: number;
  messages: string[];
};

export type PushPlannerTicketInput = {
  ticket_id: string;
  status?: string;
  tags?: string[];
  repo_path?: string;
};

export type PushPlannerTicketResponse = {
  ticket_id: string;
  uploaded_file_count: number;
  messages: string[];
};

export type PlannerTicketCommandResult = {
  id: string;
  projectId: string;
  shorthand: string;
  createdAt: string;
  updatedAt?: string;
  draft: boolean;
  archived?: boolean;
  fileId: string | null;
  parentId: string | null;
  userPrompt: string | null;
  dependsOn: string | null;
  parallelizable: string | null;
  blockedReason: string | null;
  tagNames: string[];
  content?: string;
  displayTitle?: string | null;
  statusId?: string | null;
};

export type PlannerTicketFileCommandResult = {
  id: string;
  fileId: string;
  fileName: string;
  mimeType: string | null;
};

export type CreatePlannerTicketInput = {
  shorthand: string;
  content: string;
  title?: string;
  draft?: boolean;
  parent_id?: string | null;
  user_prompt?: string | null;
  status?: string;
  status_id?: string | null;
  tags?: string[];
  tag_ids?: string[];
};

export type UpdatePlannerTicketInput = {
  ticket_id: string;
  blocked_reason?: string | null;
  content?: string;
  display_title?: string | null;
  draft?: boolean;
  archived?: boolean;
  file_id?: string | null;
  parent_id?: string | null;
  user_prompt?: string | null;
  status?: string;
  status_id?: string | null;
  tags?: string[];
  tag_ids?: string[];
};

export type UploadPlannerTicketFileInput = {
  ticket_id: string;
  file_name: string;
  relative_path?: string;
  content_base64: string;
  mime_type?: string | null;
};

export type DeletePlannerTicketInput = {
  ticket_id: string;
};

export type DeletePlannerTicketResponse = {
  ticketId: string;
  deleted: boolean;
};

export type PlannerClient = {
  pullTickets(projectId: string, input: PullPlannerTicketsInput): Promise<PullPlannerTicketsResponse>;
  pushTicket(projectId: string, input: PushPlannerTicketInput): Promise<PushPlannerTicketResponse>;
  createTicket(projectId: string, input: CreatePlannerTicketInput): Promise<PlannerTicketCommandResult>;
  updateTicket(projectId: string, input: UpdatePlannerTicketInput): Promise<PlannerTicketCommandResult>;
  uploadTicketFile(projectId: string, input: UploadPlannerTicketFileInput): Promise<PlannerTicketFileCommandResult>;
  archiveTicket(projectId: string, input: DeletePlannerTicketInput): Promise<PlannerTicketCommandResult>;
  deleteTicket(projectId: string, input: DeletePlannerTicketInput): Promise<DeletePlannerTicketResponse>;
};

const plannerCommand = (key: string) => `${PLANNER_EXTENSION_ID}.${key}`;

const executePlannerCommand = <TResult>(request: RequestFn, projectId: string, key: string, params: unknown) =>
  request(`/v1/projects/${projectId}/extension-commands/${plannerCommand(key)}/execute`, {
    method: "POST",
    body: { params },
  }).then((response) => (response as { result: TResult }).result);

export const createPlannerClientFromRequest = (request: RequestFn): PlannerClient => ({
  pullTickets: (projectId, input) =>
    executePlannerCommand<PullPlannerTicketsResponse>(request, projectId, "pullTickets", input),
  pushTicket: (projectId, input) =>
    executePlannerCommand<PushPlannerTicketResponse>(request, projectId, "pushTicket", input),
  createTicket: (projectId, input) =>
    executePlannerCommand<PlannerTicketCommandResult>(request, projectId, "createTicket", input),
  updateTicket: (projectId, input) =>
    executePlannerCommand<PlannerTicketCommandResult>(request, projectId, "updateTicket", input),
  uploadTicketFile: (projectId, input) =>
    executePlannerCommand<PlannerTicketFileCommandResult>(request, projectId, "uploadTicketFile", input),
  archiveTicket: (projectId, input) =>
    executePlannerCommand<PlannerTicketCommandResult>(request, projectId, "archiveTicket", input),
  deleteTicket: (projectId, input) =>
    executePlannerCommand<DeletePlannerTicketResponse>(request, projectId, "deleteTicket", input),
});

export const createPlannerClient = (options: ClientOptions = {}) =>
  createPlannerClientFromRequest(createRequest(options));
