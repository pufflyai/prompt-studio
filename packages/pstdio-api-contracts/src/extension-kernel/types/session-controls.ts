import type { ActivityPage } from "../../activity";
import type { ApprovalRequest, JsonPatch } from "../../harness";
import type { HarnessCommandState, HarnessOperation, HarnessOperationResponse } from "../../harness-commands";
import type { MoveQueuedFollowUpInput } from "../../queued-follow-ups";
import type {
  ApprovalInput,
  ListSessionActivityInput,
  SessionAttachmentDetails,
  SessionConversationSources,
  SessionDetails,
  SessionQueuedMessagesResponse,
  SessionStatus,
} from "../../sessions";
import type { ExtensionHarnessInput, ExtensionSession } from "./sessions";

export type ExtensionSessionStreamEvent =
  | { event: "ready"; data: { sessionId: string } }
  | { event: "patch"; data: JsonPatch }
  | { event: "approval_request"; data: ApprovalRequest }
  | { event: "queued_messages"; data: SessionQueuedMessagesResponse | { error: string } }
  | { event: "end"; data: { status: string } };

export interface ExtensionSessionControlsApi {
  getConversation(sessionId: string): Promise<{
    session: SessionDetails;
    messages: SessionQueuedMessagesResponse["messages"];
  }>;
  getConversationSources(sessionId: string): Promise<SessionConversationSources>;
  getQueuedMessages(sessionId: string): Promise<SessionQueuedMessagesResponse>;
  /** Streams a snapshot, live patches, approvals, and queue changes until the run ends or the signal aborts. */
  stream(
    sessionId: string,
    onEvent: (event: ExtensionSessionStreamEvent) => void | Promise<void>,
    options?: { signal?: AbortSignal },
  ): Promise<void>;
  /** Keep idle harness resources until close() or the invoking command ends. */
  retainResources(sessionId: string): Promise<{ close(): void }>;
  approve(sessionId: string, input: ApprovalInput): Promise<void>;
  rename(sessionId: string, title: string): Promise<ExtensionSession>;
  archive(sessionId: string): Promise<ExtensionSession>;
  delete(sessionId: string): Promise<void>;
  /** Uses the host's status transition rules. Use stop() to cancel execution. */
  updateStatus(sessionId: string, status: Exclude<SessionStatus, "queued">): Promise<ExtensionSession>;
  listActivity(sessionId: string, input?: ListSessionActivityInput): Promise<ActivityPage>;
  removeQueuedFollowUp(sessionId: string, queuePosition: number, expectedRevision?: string): Promise<void>;
  moveQueuedFollowUp(
    sessionId: string,
    queuePosition: number,
    input: MoveQueuedFollowUpInput,
  ): Promise<{ queuePosition: number }>;
  getDraftHarnessCommands(input: {
    harness: ExtensionHarnessInput;
    workspaceId?: string;
  }): Promise<HarnessCommandState & { harnessId: string }>;
  getHarnessCommands(sessionId: string): Promise<HarnessCommandState & { harnessId: string }>;
  invokeHarnessOperation(
    sessionId: string,
    operation: HarnessOperation,
    expectedHarnessId?: string,
  ): Promise<HarnessOperationResponse>;
  resolveSessionId(input: { harnessId: string; agentSessionId: string; cwd?: string }): Promise<string | null>;
  uploadAttachment(input: {
    name: string;
    data: Uint8Array | ArrayBuffer;
    mimeType?: string | null;
  }): Promise<SessionAttachmentDetails>;
  readAttachment(fileId: string): Promise<Uint8Array>;
  deleteAttachment(fileId: string): Promise<void>;
}
