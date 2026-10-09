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

export interface ExtensionSessionResource {
  type: "session";
  id: string;
  title: string;
  status: SessionStatus;
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
  } | null>;

  list(): Promise<
    Array<{
      id: string;
      title: string;
      status: SessionStatus;
      last_request_started?: string | null;
      last_request_ended?: string | null;
      updated_at?: string | null;
      anchors_json?: ResourceAnchor[];
    }>
  >;

  /** Sessions linked to a workspace (via the workspace-session join), oldest first. */
  listByWorkspace(workspaceId: string): Promise<
    Array<{
      id: string;
      title: string;
      status: SessionStatus;
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
