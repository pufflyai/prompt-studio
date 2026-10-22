import type {
  ActivityPage,
  ApprovalInput,
  CombineQueuedFollowUpsInput,
  CreateSessionInput,
  DraftHarnessCommandInput,
  FollowUpInput,
  HarnessCommandState,
  HarnessOperation,
  ListSessionActivityInput,
  ListSessionActivityResponse,
  PendingQueuedFollowUpsResponse,
  QueuedFollowUpUpdateResponse,
  QueuedSteeringResult,
  ResolveSessionIdInput,
  ResolveSessionIdResponse,
  SessionAttachment,
  SessionAttachmentDetails,
  SessionConversationResponse,
  SessionConversationSources,
  SessionCreateRequest,
  SessionCreateResponse,
  SessionDetails,
  SessionFollowUpRequest,
  SessionFollowUpResponse,
  SessionQueuedMessagesResponse,
  SteerQueuedFollowUpInput,
  UpdateQueuedFollowUpInput,
} from "pstdio-api-contracts";
import type { Session } from "../resources";
import type { ClientOptions, RequestFn } from "./request";
import { createSessionQueryClient } from "./session-query";
import { retainSessionResources } from "./session-resource-retention";
import { createSessionStreamTransport } from "./session-stream";
import type { SseEvent } from "./sse";

/** @deprecated Use ExtensionSessionQuery from @pstdio/sdk/extensions with query or iterate. */
export type ListSessionsInput = {
  status?: string;
  agent?: string;
  workspaceId?: string;
  archived?: boolean;
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  anchorType?: string;
  anchorId?: string;
};

export type SessionClient = ReturnType<typeof createSessionQueryClient> & {
  getDraftHarnessCommands(
    input: DraftHarnessCommandInput,
    signal?: AbortSignal,
  ): Promise<HarnessCommandState & { harnessId: string }>;
  /** @deprecated Use query for one page or iterate for all matching sessions. */
  list(projectId: string, input?: ListSessionsInput): Promise<Session[]>;
  get(sessionId: string): Promise<Session & SessionDetails>;
  getHarnessCommands(sessionId: string, signal?: AbortSignal): Promise<HarnessCommandState & { harnessId: string }>;
  invokeHarnessOperation(
    sessionId: string,
    operation: HarnessOperation,
    harnessId?: string,
  ): Promise<{ status: "completed" | "started"; message?: string }>;
  uploadAttachment(
    projectId: string,
    input: { name: string; data: Uint8Array | ArrayBuffer; mimeType?: string | null },
  ): Promise<SessionAttachment & SessionAttachmentDetails>;
  deleteAttachment(projectId: string, fileId: string): Promise<void>;
  create(projectId: string, input: Omit<SessionCreateRequest, "projectId">): Promise<SessionCreateResponse>;
  /** @deprecated Pass projectId first and use camelCase input. */
  create(input: CreateSessionInput): Promise<SessionCreateResponse>;
  archive(sessionId: string): Promise<void>;
  delete(sessionId: string): Promise<void>;
  followUp(sessionId: string, input: SessionFollowUpRequest | FollowUpInput): Promise<SessionFollowUpResponse>;
  approve(sessionId: string, input: ApprovalInput): Promise<void>;
  getConversation(sessionId: string, signal?: AbortSignal): Promise<SessionConversationResponse>;
  /** @deprecated No maintained client caller. Use `GET /v1/sessions/{id}/conversation/sources` for this operation; the convenience method is removed in 0.45. */
  getConversationSources(sessionId: string, signal?: AbortSignal): Promise<SessionConversationSources>;
  getQueuedMessages(sessionId: string, options?: { signal?: AbortSignal }): Promise<SessionQueuedMessagesResponse>;
  steerQueuedFollowUp(
    sessionId: string,
    queuePosition: number,
    input: SteerQueuedFollowUpInput,
  ): Promise<QueuedSteeringResult>;
  getQueuedFollowUps(sessionId: string): Promise<PendingQueuedFollowUpsResponse>;
  updateQueuedFollowUp(
    sessionId: string,
    queuePosition: number,
    input: UpdateQueuedFollowUpInput,
  ): Promise<QueuedFollowUpUpdateResponse>;
  combineQueuedFollowUps(
    sessionId: string,
    queuePosition: number,
    input: CombineQueuedFollowUpsInput,
  ): Promise<QueuedFollowUpUpdateResponse>;
  removeQueuedFollowUp(sessionId: string, queuePosition: number, expectedRevision?: string): Promise<{ ok: true }>;
  moveQueuedFollowUp(
    sessionId: string,
    queuePosition: number,
    input: {
      direction: "up" | "down";
      expectedRevision?: string;
      steps?: number;
      expectedOrder?: { queuePosition: number; revision: string }[];
    },
  ): Promise<{ ok: true; queuePosition: number }>;
  resolveSessionId(input: ResolveSessionIdInput): Promise<ResolveSessionIdResponse>;
  updateStatus(sessionId: string, status: string): Promise<Session & SessionDetails>;
  rename(sessionId: string, title: string): Promise<Session & SessionDetails>;
  /** @deprecated No maintained client caller. Use `GET /v1/sessions/{id}/activity` for this operation; the convenience method is removed in 0.45. */
  listActivity(
    sessionId: string,
    input?: ListSessionActivityInput,
  ): Promise<ListSessionActivityResponse & ActivityPage>;
  stream(sessionId: string, onEvent: (event: SseEvent) => void, options?: { signal?: AbortSignal }): Promise<void>;
  connectStream(sessionId: string, handlers: SessionStreamHandlers): SessionStreamConnection;
  /** Keep a session's idle tool resources while a tab or other consumer is open. Close to release interest. */
  retainResources(sessionId: string): SessionStreamConnection;
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
  const params = new URLSearchParams({ projectId });
  if (input.status) params.append("status", input.status);
  if (input.agent) params.append("agent", input.agent);
  if (input.workspaceId) params.append("workspace_id", input.workspaceId);
  if (input.archived) params.append("archived", "true");
  if (input.createdFrom) params.append("created_from", input.createdFrom);
  if (input.createdTo) params.append("created_to", input.createdTo);
  if (input.updatedFrom) params.append("updated_from", input.updatedFrom);
  if (input.anchorType) params.append("anchor_type", input.anchorType);
  if (input.anchorId) params.append("anchor_id", input.anchorId);
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

export const createSessionClient = (
  request: RequestFn,
  clientOptions: ClientOptions,
  streams = createSessionStreamTransport(request, clientOptions),
): SessionClient => {
  return {
    ...createSessionQueryClient(request),
    retainResources: (sessionId) => retainSessionResources(streams, sessionId),
    getDraftHarnessCommands: (input, signal) =>
      request("/v1/sessions/harness-command-state", { method: "POST", body: input, signal }),
    listActivity: (sessionId, input = {}) => {
      const params = new URLSearchParams();
      if (input.eventType) params.append("eventType", input.eventType);
      else if (input.event_type) params.append("event_type", input.event_type);
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
    create: (projectOrInput: string | CreateSessionInput, input?: Omit<SessionCreateRequest, "projectId">) =>
      request("/v1/sessions", {
        method: "POST",
        body: typeof projectOrInput === "string" ? { ...input, projectId: projectOrInput } : projectOrInput,
      }),
    archive: (sessionId) => request(`/v1/sessions/${sessionId}/archive`, { method: "POST" }),
    delete: (sessionId) => request(`/v1/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" }),
    followUp: (sessionId, input) => request(`/v1/sessions/${sessionId}/follow-up`, { method: "POST", body: input }),
    approve: (sessionId, input) => request(`/v1/sessions/${sessionId}/approve`, { method: "POST", body: input }),
    getConversation: (sessionId, signal) => request(`/v1/sessions/${sessionId}/conversation`, { signal }),
    getConversationSources: (sessionId, signal) =>
      request(`/v1/sessions/${sessionId}/conversation/sources`, { signal }),
    getQueuedMessages: (sessionId, options) => request(`/v1/sessions/${sessionId}/queued-messages`, options),
    steerQueuedFollowUp: (sessionId, queuePosition, input) =>
      request(`/v1/sessions/${sessionId}/queued-follow-ups/${queuePosition}/steer`, { method: "POST", body: input }),
    getQueuedFollowUps: (sessionId) => request(`/v1/sessions/${sessionId}/queued-follow-ups`),
    updateQueuedFollowUp: (sessionId, queuePosition, input) =>
      request(`/v1/sessions/${sessionId}/queued-follow-ups/${queuePosition}`, { method: "PATCH", body: input }),
    combineQueuedFollowUps: (sessionId, queuePosition, input) =>
      request(`/v1/sessions/${sessionId}/queued-follow-ups/${queuePosition}/combine`, { method: "POST", body: input }),
    removeQueuedFollowUp: (id, position, expectedRevision = "") =>
      request(
        `/v1/sessions/${encodeURIComponent(id)}/queued-follow-ups/${position}?expectedRevision=${encodeURIComponent(expectedRevision)}`,
        { method: "DELETE" },
      ),
    moveQueuedFollowUp: (id, position, body) =>
      request(`/v1/sessions/${encodeURIComponent(id)}/queued-follow-ups/${position}/move`, { method: "POST", body }),
    resolveSessionId: (input) => request("/v1/sessions/resolve-session-id", { method: "POST", body: input }),
    updateStatus: (sessionId, status) =>
      request(`/v1/sessions/${sessionId}/status`, { method: "PATCH", body: { status } }),
    rename: (sessionId, title) => request(`/v1/sessions/${sessionId}/title`, { method: "PATCH", body: { title } }),
    stream: (sessionId, onEvent, options = {}) =>
      new Promise<void>((resolve, reject) => {
        const subscription = streams.subscribe(sessionId, {
          onEvent: (event, data) => {
            onEvent({
              event,
              data: JSON.stringify(data),
            });
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
