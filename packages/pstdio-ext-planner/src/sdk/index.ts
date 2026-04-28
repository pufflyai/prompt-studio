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

export type PlannerClient = {
  pullTickets(projectId: string, input: PullPlannerTicketsInput): Promise<PullPlannerTicketsResponse>;
  pushTicket(projectId: string, input: PushPlannerTicketInput): Promise<PushPlannerTicketResponse>;
};

const plannerCommand = (key: string) => `${PLANNER_EXTENSION_ID}.${key}`;

export const createPlannerClientFromRequest = (request: RequestFn): PlannerClient => ({
  pullTickets: (projectId, input) =>
    request(`/v1/projects/${projectId}/extension-commands/${plannerCommand("pullTickets")}/execute`, {
      method: "POST",
      body: { params: input },
    }).then((response) => (response as { result: PullPlannerTicketsResponse }).result),
  pushTicket: (projectId, input) =>
    request(`/v1/projects/${projectId}/extension-commands/${plannerCommand("pushTicket")}/execute`, {
      method: "POST",
      body: { params: input },
    }).then((response) => (response as { result: PushPlannerTicketResponse }).result),
});

export const createPlannerClient = (options: ClientOptions = {}) =>
  createPlannerClientFromRequest(createRequest(options));
