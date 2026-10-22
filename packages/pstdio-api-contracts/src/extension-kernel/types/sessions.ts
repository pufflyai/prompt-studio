import type {
  CombineQueuedFollowUpsInput,
  PendingQueuedFollowUpsResponse,
  QueuedFollowUpRequest,
  QueuedSteeringResult,
  SteerQueuedFollowUpInput,
  UpdateQueuedFollowUpInput,
} from "../../queued-follow-ups";
import type { SessionAttachmentRef, SessionStatus } from "../../sessions";
import type { ResourceAnchor, ResourceRef } from "./resources";

export type SessionExitCause =
  | "completed"
  | "user_stop"
  | "request_aborted"
  | "worker_lost"
  | "host_shutdown"
  | "timeout"
  | "failed"
  | "unknown";
export interface SessionRunSnapshot {
  status: string;
  startedAt: string | null;
  endedAt: string | null;
}

export interface SessionExit {
  cause: SessionExitCause;
  startedAt: string | null;
  endedAt: string;
}

export interface ExtensionSessionUsage {
  /** @deprecated Use inputTokens. */
  input_tokens: number;
  /** @deprecated Use outputTokens. */
  output_tokens: number;
  /** @deprecated Use cacheReadTokens. */
  cache_read_tokens: number;
  /** @deprecated Use cacheWriteTokens. */
  cache_write_tokens: number;
}

export interface ExtensionSession {
  /** The device that owns execution. Present on synced personal sessions. */
  device?: { ownerId: string; id: string; name: string };
  id: string;
  title: string;
  status: SessionStatus;
  archived: boolean;
  agent: string | null;
  cwd: string | null;
  lastSelectedModel: string | null;
  workspaceId: string | null;
  originalSessionId: string | null;
  createdAt: string;
  updatedAt: string;
  lastRequestStarted: string | null;
  lastRequestEnded: string | null;
  /** Available when reading a session by ID. */
  lastExit?: SessionExit | null;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
  } | null;
}

/** @deprecated Use ExtensionSession. Snake-case fields are removed in 0.45. */
export interface ExtensionSessionSummary {
  id: string;
  title: string;
  status: SessionStatus;
  archived: boolean;
  agent: string | null;
  /** @deprecated Use lastSelectedModel. */
  last_selected_model: string | null;
  /** @deprecated Use workspaceId. */
  workspace_id: string | null;
  /** @deprecated Use originalSessionId. */
  original_session_id: string | null;
  /** @deprecated Use createdAt. */
  created_at: string;
  /** @deprecated Use updatedAt. */
  updated_at: string;
  /** @deprecated Use lastRequestStarted. */
  last_request_started: string | null;
  /** @deprecated Use lastRequestEnded. */
  last_request_ended: string | null;
  /** @deprecated Read links through resources. */
  anchors_json: ResourceAnchor[];
  /** Totals at the last conversation save. Null when no usage was recorded. */
  usage: ExtensionSessionUsage | null;
}

export interface ExtensionSessionQuery {
  status?: SessionStatus[];
  agent?: string;
  workspaceId?: string;
  anchor?: Pick<ResourceRef, "type" | "id" | "extensionId" | "projectId">;
  /** Default created. Both orders use id descending to break ties. */
  orderBy?: "created" | "lastActivity";
  /** Inclusive ISO timestamp bounds. */
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  includeArchived?: boolean;
  /** Default 50. Clamped to 1..200. */
  limit?: number;
  cursor?: string;
}

export interface ExtensionSessionPage {
  /** Newest first by the requested order, then id descending. */
  items: (ExtensionSession & ExtensionSessionSummary)[];
  nextCursor: string | null;
}

/** @deprecated Use ExtensionSession. */
export interface ExtensionSessionResource {
  type: "session";
  id: string;
  title: string;
  status: SessionStatus;
  agent?: string | null;
}

export interface ExtensionSessionsApi {
  getQueuedFollowUps(sessionId: string): Promise<PendingQueuedFollowUpsResponse>;
  updateQueuedFollowUp(
    sessionId: string,
    queuePosition: number,
    input: UpdateQueuedFollowUpInput,
  ): Promise<QueuedFollowUpRequest>;
  combineQueuedFollowUps(
    sessionId: string,
    queuePosition: number,
    input: CombineQueuedFollowUpsInput,
  ): Promise<QueuedFollowUpRequest>;
  steerQueuedFollowUp(
    sessionId: string,
    queuePosition: number,
    input: SteerQueuedFollowUpInput,
  ): Promise<QueuedSteeringResult>;
  get(id: string): Promise<
    | (ExtensionSession &
        ExtensionSessionSummary & {
          /** @deprecated Use lastExit. */
          last_exit?: SessionExit | null;
        })
    | null
  >;

  query(input?: ExtensionSessionQuery): Promise<ExtensionSessionPage>;

  create(input: {
    title: string;
    prompt?: string;
    harness?: ExtensionHarnessInput;
    workspaceId?: string;
    anchors?: ResourceAnchor[];
    attachments?: SessionAttachmentRef[];
    originalSessionId?: string;
  }): Promise<ExtensionSession & ExtensionSessionSummary & ExtensionSessionResource>;

  followup(input: {
    sessionId: string;
    prompt?: string;
    attachments?: SessionAttachmentRef[];
    /** Refuse automatic continuation if execution changed. */
    expectedRun?: SessionRunSnapshot;
  }): Promise<void>;

  /** @deprecated Use resources.addAnchors with a session reference. */
  addAnchors(sessionId: string, anchors: ResourceAnchor[]): Promise<void>;
  /** @deprecated Use resources.removeAnchors with a session reference. */
  removeAnchors(sessionId: string, refs: ResourceRef[]): Promise<void>;
}

export interface ExtensionHarnessInput {
  harnessId: string;
  model?: string;
  /** Run params the harness declares for the model, such as reasoning effort. They override the project's defaults. */
  params?: Record<string, string | boolean>;
}
