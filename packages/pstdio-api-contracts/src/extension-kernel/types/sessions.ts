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

export interface ExtensionSessionUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
}

export interface ExtensionSessionSummary {
  id: string;
  title: string;
  status: SessionStatus;
  archived: boolean;
  agent: string | null;
  last_selected_model: string | null;
  workspace_id: string | null;
  original_session_id: string | null;
  created_at: string;
  updated_at: string;
  /** Start and end of the latest run only. */
  last_request_started: string | null;
  last_request_ended: string | null;
  anchors_json: ResourceAnchor[];
  /** Totals at the last conversation save. Null when no usage was recorded. */
  usage: ExtensionSessionUsage | null;
}

export interface ExtensionSessionQuery {
  status?: SessionStatus[];
  agent?: string;
  workspaceId?: string;
  anchor?: Pick<ResourceRef, "type" | "id">;
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
  /** Newest first: created_at descending, then id descending. */
  items: ExtensionSessionSummary[];
  nextCursor: string | null;
}

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
  get(id: string): Promise<{
    id: string;
    title: string;
    status?: string;
    original_session_id?: string | null;
    cwd?: string | null;
    updated_at?: string | null;
    anchors_json?: ResourceAnchor[];
    archived?: boolean;
    agent?: string | null;
    last_selected_model?: string | null;
    workspace_id?: string | null;
    created_at?: string | null;
    last_request_started?: string | null;
    last_request_ended?: string | null;
    usage?: ExtensionSessionUsage | null;
  } | null>;

  query(input?: ExtensionSessionQuery): Promise<ExtensionSessionPage>;

  /** @deprecated Use query() for filters, paging and session details. */
  list(): Promise<
    Array<{
      id: string;
      title: string;
      status: SessionStatus;
      agent?: string | null;
      last_request_started?: string | null;
      last_request_ended?: string | null;
      updated_at?: string | null;
      anchors_json?: ResourceAnchor[];
    }>
  >;

  /** @deprecated Use query({ workspaceId }). query() orders newest first. */
  listByWorkspace(workspaceId: string): Promise<
    Array<{
      id: string;
      title: string;
      status: SessionStatus;
      agent?: string | null;
      created_at?: string | null;
      updated_at?: string | null;
      anchors_json?: ResourceAnchor[];
    }>
  >;

  create(input: {
    title: string;
    prompt?: string;
    harness?: ExtensionHarnessInput;
    workspaceId?: string;
    anchors?: ResourceAnchor[];
    attachments?: SessionAttachmentRef[];
    originalSessionId?: string;
  }): Promise<ExtensionSessionResource>;

  followup(input: { sessionId: string; prompt?: string; attachments?: SessionAttachmentRef[] }): Promise<void>;

  addAnchors(sessionId: string, anchors: ResourceAnchor[]): Promise<void>;
  removeAnchors(sessionId: string, refs: ResourceRef[]): Promise<void>;
}

export interface ExtensionHarnessInput {
  harnessId: string;
  model?: string;
  /** Run params the harness declares for the model, such as reasoning effort. They override the project's defaults. */
  params?: Record<string, string | boolean>;
}
