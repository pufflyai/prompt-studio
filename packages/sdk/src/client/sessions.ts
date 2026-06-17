import type {
  ApprovalInput,
  CreateSessionInput,
  FollowUpInput,
  FollowUpResponse,
  ListSessionActivityInput,
  ListSessionActivityResponse,
  ResolveSessionIdInput,
  ResolveSessionIdResponse,
  SessionAttachment,
  SessionConversationResponse,
} from "pstdio-api-contracts";
import type { Session } from "../resources";
import {
  type ClientOptions,
  createRequestHeaders,
  type RequestFn,
  resolveBaseUrl,
  resolveClientUrl,
  resolveFetch,
} from "./request";
import { readSseStream, type SseEvent } from "./sse";

export type ListSessionsInput = {
  status?: string;
  agent?: string;
  archived?: boolean;
};

export type SessionClient = {
  list(projectId: string, input?: ListSessionsInput): Promise<Session[]>;
  get(sessionId: string): Promise<Session>;
  uploadAttachment(
    projectId: string,
    input: { name: string; data: Uint8Array | ArrayBuffer; mimeType?: string | null },
  ): Promise<SessionAttachment>;
  deleteAttachment(projectId: string, fileId: string): Promise<void>;
  create(input: CreateSessionInput): Promise<Session>;
  archive(sessionId: string): Promise<void>;
  followUp(sessionId: string, input: FollowUpInput): Promise<FollowUpResponse>;
  approve(sessionId: string, input: ApprovalInput): Promise<void>;
  getConversation(sessionId: string): Promise<SessionConversationResponse>;
  resolveSessionId(input: ResolveSessionIdInput): Promise<ResolveSessionIdResponse>;
  updateStatus(sessionId: string, status: string): Promise<Session>;
  listActivity(sessionId: string, input?: ListSessionActivityInput): Promise<ListSessionActivityResponse>;
  stream(sessionId: string, onEvent: (event: SseEvent) => void, options?: { signal?: AbortSignal }): Promise<void>;
  connectStream(
    sessionId: string,
    handlers: SessionStreamHandlers,
    options?: { attempt?: number },
  ): SessionStreamConnection;
};

export type SessionStreamHandlers = {
  onReady?: (data: unknown) => void;
  onPatch?: (data: unknown) => void;
  onApprovalRequest?: (data: unknown) => void;
  onEnd?: (data: unknown) => void;
  onError?: (error: unknown) => void;
};

export type SessionStreamConnection = {
  close: () => void;
};

const buildSessionsQuery = (projectId: string, input: ListSessionsInput = {}) => {
  const params = new URLSearchParams({ project_id: projectId });
  if (input.status) params.append("status", input.status);
  if (input.agent) params.append("agent", input.agent);
  if (input.archived) params.append("archived", "true");
  return params.toString();
};

const buildSessionStreamPath = (sessionId: string, attempt?: number) => {
  const path = `/v1/sessions/${sessionId}/stream`;
  return attempt === undefined ? path : `${path}?attempt=${attempt}`;
};

const parseEventData = (data: string) => {
  if (data.length === 0) return null;
  return JSON.parse(data) as unknown;
};

const streamSessionEvents = async (
  clientOptions: ClientOptions,
  path: string,
  onEvent: (event: SseEvent) => void,
  options: { signal?: AbortSignal } = {},
) => {
  const response = await resolveFetch(clientOptions)(resolveClientUrl(resolveBaseUrl(clientOptions), path), {
    headers: Object.fromEntries(createRequestHeaders(clientOptions).entries()),
    signal: options.signal,
  });
  if (!response.ok || !response.body) throw new Error(`Connection failed: ${response.status}`);
  await readSseStream(response.body, onEvent, { signal: options.signal });
};

const dispatchSessionStreamEvent = (event: SseEvent, handlers: SessionStreamHandlers) => {
  if (event.event === "ready") {
    handlers.onReady?.(parseEventData(event.data));
    return;
  }

  if (event.event === "patch") {
    handlers.onPatch?.(parseEventData(event.data));
    return;
  }

  if (event.event === "approval_request") {
    handlers.onApprovalRequest?.(parseEventData(event.data));
    return;
  }

  if (event.event === "end") {
    handlers.onEnd?.(parseEventData(event.data));
  }
};

export const createSessionClient = (request: RequestFn, clientOptions: ClientOptions): SessionClient => ({
  listActivity: (sessionId, input = {}) => {
    const params = new URLSearchParams();
    if (input.event_type) params.append("event_type", input.event_type);
    if (input.from) params.append("from", input.from);
    if (input.to) params.append("to", input.to);
    if (input.cursor) params.append("cursor", input.cursor);
    if (input.limit !== undefined) params.append("limit", String(input.limit));
    const query = params.toString();
    return request(`/v1/sessions/${sessionId}/activity${query ? `?${query}` : ""}`);
  },
  list: (projectId, input) => request(`/v1/sessions?${buildSessionsQuery(projectId, input)}`),
  get: (sessionId) => request(`/v1/sessions/${sessionId}`),
  uploadAttachment: (projectId, input) =>
    request(`/v1/projects/${encodeURIComponent(projectId)}/session-attachments`, {
      method: "POST",
      body: input.data,
      headers: {
        "content-type": input.mimeType || "application/octet-stream",
        "x-file-name": encodeURIComponent(input.name),
      },
    }),
  deleteAttachment: (projectId, fileId) =>
    request(`/v1/projects/${encodeURIComponent(projectId)}/session-attachments/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
    }),
  create: (input) => request("/v1/sessions", { method: "POST", body: input }),
  archive: (sessionId) => request(`/v1/sessions/${sessionId}/archive`, { method: "POST" }),
  followUp: (sessionId, input) => request(`/v1/sessions/${sessionId}/follow-up`, { method: "POST", body: input }),
  approve: (sessionId, input) => request(`/v1/sessions/${sessionId}/approve`, { method: "POST", body: input }),
  getConversation: (sessionId) => request(`/v1/sessions/${sessionId}/conversation`),
  resolveSessionId: (input) => request("/v1/sessions/resolve-session-id", { method: "POST", body: input }),
  updateStatus: (sessionId, status) =>
    request(`/v1/sessions/${sessionId}/status`, { method: "PATCH", body: { status } }),
  stream: (sessionId, onEvent, options = {}) =>
    streamSessionEvents(clientOptions, buildSessionStreamPath(sessionId), onEvent, options),
  connectStream: (sessionId, handlers, options = {}) => {
    const abortController = new AbortController();
    let closed = false;

    void streamSessionEvents(
      clientOptions,
      buildSessionStreamPath(sessionId, options.attempt),
      (event) => dispatchSessionStreamEvent(event, handlers),
      { signal: abortController.signal },
    ).catch((error: unknown) => {
      if (closed || (error as Error).name === "AbortError") return;
      handlers.onError?.(error);
    });

    return {
      close: () => {
        closed = true;
        abortController.abort();
      },
    };
  },
});
