import type { ApprovalInput, CreateSessionInput, FollowUpInput, SessionConversationResponse } from "../api/sessions";
import type { Session } from "../resources";
import type { RequestFn } from "./request";

export type SessionClient = {
  list(projectId: string): Promise<Session[]>;
  get(sessionId: string): Promise<Session>;
  create(input: CreateSessionInput): Promise<Session>;
  archive(sessionId: string): Promise<void>;
  followUp(sessionId: string, input: FollowUpInput): Promise<Session>;
  approve(sessionId: string, input: ApprovalInput): Promise<void>;
  getConversation(sessionId: string): Promise<SessionConversationResponse>;
};

export const createSessionClient = (request: RequestFn): SessionClient => ({
  list: (projectId) => request(`/v1/sessions?project_id=${projectId}`),
  get: (sessionId) => request(`/v1/sessions/${sessionId}`),
  create: (input) => request("/v1/sessions", { method: "POST", body: input }),
  archive: (sessionId) => request(`/v1/sessions/${sessionId}/archive`, { method: "POST" }),
  followUp: (sessionId, input) => request(`/v1/sessions/${sessionId}/follow-up`, { method: "POST", body: input }),
  approve: (sessionId, input) => request(`/v1/sessions/${sessionId}/approve`, { method: "POST", body: input }),
  getConversation: (sessionId) => request(`/v1/sessions/${sessionId}/conversation`),
});
