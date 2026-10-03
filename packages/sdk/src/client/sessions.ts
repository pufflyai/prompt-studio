import type {
  ApprovalInput,
  CreateSessionInput,
  CreateSessionResponse,
  DraftHarnessCommandInput,
  FollowUpInput,
  FollowUpResponse,
  HarnessCommandState,
  HarnessOperation,
  ListSessionActivityInput,
  ListSessionActivityResponse,
  ResolveSessionIdInput,
  ResolveSessionIdResponse,
  SessionAttachment,
  SessionConversationResponse,
  SessionConversationSources,
  SessionQueuedMessagesResponse,
} from "pstdio-api-contracts";
import type { Session } from "../resources";
import type { ClientOptions, RequestFn } from "./request";
import { createSessionStreamTransport } from "./session-stream";
import type { SseEvent } from "./sse";

export type ListSessionsInput = {
  status?: string;
  agent?: string;
  workspaceId?: string;
  archived?: boolean;
};

export type SessionClient = {
  getDraftHarnessCommands(
    input: DraftHarnessCommandInput,
    signal?: AbortSignal,
  ): Promise<HarnessCommandState & { harnessId: string }>;
  list(projectId: string, input?: ListSessionsInput): Promise<Session[]>;
  get(sessionId: string): Promise<Session>;
  getHarnessCommands(sessionId: string, signal?: AbortSignal): Promise<HarnessCommandState & { harnessId: string }>;
  invokeHarnessOperation(
    sessionId: string,
    operation: HarnessOperation,
    harnessId?: string,
  ): Promise<{ status: "completed" | "started"; message?: string }>;
  uploadAttachment(
    projectId: string,
    input: { name: string; data: Uint8Array | ArrayBuffer; mimeType?: string | null },
  ): Promise<SessionAttachment>;
  deleteAttachment(projectId: string, fileId: string): Promise<void>;
  create(input: CreateSessionInput): Promise<CreateSessionResponse>;
  archive(sessionId: string): Promise<void>;
  followUp(sessionId: string, input: FollowUpInput): Promise<FollowUpResponse>;
  approve(sessionId: string, input: ApprovalInput): Promise<void>;
  getConversation(sessionId: string, signal?: AbortSignal): Promise<SessionConversationResponse>;
  getConversationSources(sessionId: string, signal?: AbortSignal): Promise<SessionConversationSources>;
  getQueuedMessages(sessionId: string, options?: { signal?: AbortSignal }): Promise<SessionQueuedMessagesResponse>;
  resolveSessionId(input: ResolveSessionIdInput): Promise<ResolveSessionIdResponse>;
  updateStatus(sessionId: string, status: string): Promise<Session>;
  listActivity(sessionId: string, input?: ListSessionActivityInput): Promise<ListSessionActivityResponse>;
  stream(sessionId: string, onEvent: (event: SseEvent) => void, options?: { signal?: AbortSignal }): Promise<void>;
  connectStream(sessionId: string, handlers: SessionStreamHandlers): SessionStreamConnection;
};

export type SessionStreamHandlers = {
  onReady?: (data: unknown) => void;
  onPatch?: (data: unknown) => void;
  onApprovalRequest?: (data: unknown) => void;
  onQueuedMessages?: (data: SessionQueuedMessagesResponse | { error: string }) => void;
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
  if (input.workspaceId) params.append("workspace_id", input.workspaceId);
  if (input.archived) params.append("archived", "true");
  return params.toString();
};

const dispatchSessionStreamEvent = (event: string, data: unknown, handlers: SessionStreamHandlers) => {
  if (event === "ready") {
    handlers.onReady?.(data);
    return;
  }

  if (event === "patch") {
    handlers.onPatch?.(data);
    return;
  }

  if (event === "approval_request") {
    handlers.onApprovalRequest?.(data);
    return;
  }

  if (event === "queued_messages") {
    handlers.onQueuedMessages?.(data as SessionQueuedMessagesResponse | { error: string });
    return;
  }

  if (event === "end") {
    handlers.onEnd?.(data);
  }
};

export const createSessionClient = (request: RequestFn, clientOptions: ClientOptions): SessionClient => {
  const streams = createSessionStreamTransport(request, clientOptions);
  return {
    getDraftHarnessCommands: (input, signal) =>
      request("/v1/sessions/harness-command-state", { method: "POST", body: input, signal }),
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
    getHarnessCommands: (sessionId, signal) => request(`/v1/sessions/${sessionId}/harness-commands`, { signal }),
    invokeHarnessOperation: (sessionId, operation, harnessId) =>
      request(`/v1/sessions/${sessionId}/harness-commands`, { method: "POST", body: { operation, harnessId } }),
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
    getConversation: (sessionId, signal) => request(`/v1/sessions/${sessionId}/conversation`, { signal }),
    getConversationSources: (sessionId, signal) =>
      request(`/v1/sessions/${sessionId}/conversation/sources`, { signal }),
    getQueuedMessages: (sessionId, options) => request(`/v1/sessions/${sessionId}/queued-messages`, options),
    resolveSessionId: (input) => request("/v1/sessions/resolve-session-id", { method: "POST", body: input }),
    updateStatus: (sessionId, status) =>
      request(`/v1/sessions/${sessionId}/status`, { method: "PATCH", body: { status } }),
    stream: (sessionId, onEvent, options = {}) =>
      new Promise<void>((resolve, reject) => {
        const subscription = streams.subscribe(sessionId, {
          onEvent: (event, data) => {
            onEvent({ event, data: JSON.stringify(data) });
            if (event === "end") resolve();
          },
          onError: reject,
        });
        options.signal?.addEventListener(
          "abort",
          () => {
            subscription.close();
            resolve();
          },
          { once: true },
        );
      }),
    connectStream: (sessionId, handlers) =>
      streams.subscribe(sessionId, {
        onEvent: (event, data) => dispatchSessionStreamEvent(event, data, handlers),
        onError: (error) => handlers.onError?.(error),
      }),
  };
};
