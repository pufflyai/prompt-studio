// Transport-neutral harness contract: the host injects an event sink (and, for
// providers with the Approvals capability, an approval channel) and consumes a
// neutral HarnessSession handle. Providers never control persistence or status;
// they emit JSON patches and settle `done`.

import type { HarnessEventSink, JsonPatch } from "./conversation-events";
import type { WorkspaceExecutionTarget } from "./extension-kernel/types/extension";
import type { SessionMessage } from "./session-messages";

export type { HarnessEventSink, JsonPatch } from "./conversation-events";

export type EventSubscriptionOptions = { conversationSnapshot?: () => JsonPatch; activityOnly?: boolean };

export type EventStore = {
  push(patch: JsonPatch): void;
  getHistory(): JsonPatch[];
  subscribe(options?: EventSubscriptionOptions): AsyncIterable<JsonPatch>;
  historyPlusStream(): AsyncIterable<JsonPatch>;
  snapshotAndSubscribe(): { history: JsonPatch[]; stream: AsyncIterable<JsonPatch> };
};

/** Features a harness opts into. `Attachments` means the harness accepts `attachments` on start, resume and steering. */
export const AGENT_CAPABILITIES = [
  "SessionFork",
  "ContextUsage",
  "Approvals",
  "SessionReattach",
  "Attachments",
] as const;

export type AgentCapability = (typeof AGENT_CAPABILITIES)[number];

export type QuestionResponse = {
  /**
   * One list of chosen labels per question, in the order the questions were asked. A label the
   * agent did not offer is the person's own typed answer, so a harness that validates answers
   * against its offered options has to add it to them before replying.
   *
   * An empty list means the person skipped the question rather than answering it. An answered
   * form always carries one entry per question, so the two can never be confused.
   */
  answers: string[][];
  /** Shared question tool call being answered, when the caller has its identity. */
  callId?: string;
};

/** A stale or declined answer. Other harness failures remain server errors. */
export type HarnessQuestionReplyError = Error & { readonly questionRejected: true };

export type HarnessQuestionOption = {
  label: string;
  description?: string;
};

export type HarnessQuestion = {
  question: string;
  options?: HarnessQuestionOption[];
  /** The person may pick more than one option. */
  multiple?: boolean;
};

export type HarnessQuestionRequest = {
  id: string;
  toolUseId: string;
  questions: HarnessQuestion[];
};

/**
 * Host channel a harness uses to ask the person something. The host sets the session to
 * `awaiting_input` while an ask is open, and resolves the ask with the answer. An ask has no
 * timeout; it rejects when the session ends.
 */
export type HarnessQuestionChannel = {
  ask(request: HarnessQuestionRequest): Promise<QuestionResponse>;
};

/** Host side of the question channel. Plain text answers all open asks; a call ID selects its tool use. */
export type QuestionService = HarnessQuestionChannel & {
  answer(response: QuestionResponse | string): boolean;
  hasPending(callId?: string): boolean;
  dispose(): void;
};

export type ApprovalRequest = {
  id: string;
  toolName: string;
  toolInput: unknown;
  toolUseId: string;
};

export type ApprovalResponse = {
  id: string;
  decision: "approve" | "deny" | "timeout";
};

export type ApprovalService = {
  requestApproval(request: ApprovalRequest): Promise<ApprovalResponse>;
  handleResponse(response: ApprovalResponse): void;
  dispose(): void;
};

/** Work the provider keeps running after its turn ends, such as a background command or subagent. */
export type HarnessBackgroundTask = {
  id: string;
  description: string;
};

/**
 * Host channel for a provider whose run stays open between turns. While a turn is idle, the host
 * shows the conversation as waiting and delivers queued follow-ups through `steer`.
 */
export type HarnessTurnChannel = {
  /** The turn ended but the run stays open for these tasks. Call again when the list changes. */
  idle(input: { backgroundTasks: HarnessBackgroundTask[] }): void;
  /** A new turn started, either from delivered input or from a finished task waking the provider. */
  busy(): void;
};

/** "activity": the host kills the session when no events arrive for a while; "provider": the provider self-terminates. */
export type TimeoutStrategy = "activity" | "provider";

export type HarnessAttachment = {
  fileId: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number;
  localPath: string;
  url: string;
};

export type HarnessApprovalChannel = {
  requestApproval(request: ApprovalRequest): Promise<ApprovalResponse>;
};

export type HarnessParamValue = string | boolean;
export type HarnessParams = Record<string, HarnessParamValue>;

export type HarnessWorkspaceContext = {
  workspaceId: string;
  executionTarget: WorkspaceExecutionTarget;
};

export type HarnessExitStatus = "completed" | "failed" | "cancelled" | "disconnected";

export type HarnessExit = {
  status: HarnessExitStatus;
};

export type HarnessSession = {
  /** Provider-side session id, used to resume/reattach later. */
  agentSessionId?: string;
  /** Settles exactly once; the host keys status transitions and persistence off it. */
  done: Promise<HarnessExit>;
  /** Called by the host on cancel or on its own activity timeout. */
  stop(): void | Promise<void>;
  /** Replies in place. Reject invalid answers with HarnessQuestionReplyError. */
  replyQuestion?(response: QuestionResponse): Promise<void>;
  /** Accept live input without starting a new run. Emit one user message with deliveryId before returning accepted. Native history must preserve that identity for recovery. A thrown transport error is uncertain, never a definite rejection. */
  steer?(input: HarnessSteeringInput): Promise<HarnessSteeringResult>;
  timeoutStrategy?: TimeoutStrategy;
  /** Observability only. */
  pid?: number;
};

export type HarnessStartInput = {
  prompt: string;
  /** Host session id (correlation / env injection). */
  sessionId: string;
  cwd?: string;
  workspace?: HarnessWorkspaceContext;
  model?: string | null;
  params?: HarnessParams;
  attachments?: HarnessAttachment[];
  events: HarnessEventSink;
  /** Channel for asking the person something. Present on start and on resume. */
  questions?: HarnessQuestionChannel;
  /** Report turns that end while the run stays open. Present on start and on resume. */
  turns?: HarnessTurnChannel;
  /** Aborted when the host cancels the request that started or resumed this session. */
  signal?: AbortSignal;
};

export type HarnessResumeInput = HarnessStartInput & {
  agentSessionId: string;
  /** Index offset so resumed streams align message patches with existing history. */
  messageOffset?: number;
  questionResponse?: QuestionResponse;
  approvals?: HarnessApprovalChannel;
};

export type HarnessReattachInput = {
  sessionId: string;
  agentSessionId: string;
  cwd?: string;
  workspace?: HarnessWorkspaceContext;
  events: HarnessEventSink;
  /** Aborted when the host stops orphan recovery, including during shutdown. */
  signal?: AbortSignal;
};

export type HarnessMessagesInput = {
  agentSessionId: string;
  cwd?: string;
  workspace?: HarnessWorkspaceContext;
};

export type HarnessRecoveryInput = {
  knownMessages: readonly SessionMessage[];
  nativeMessages: readonly SessionMessage[];
  cwd?: string;
  workspace?: HarnessWorkspaceContext;
};

export type HarnessRecoveryResult =
  | { kind: "recovered"; messages: SessionMessage[] }
  | { kind: "conflict"; category: string };

/** Input to the captured running owner. Its saved model and params must already match that run. */
export interface HarnessSteeringInput {
  deliveryId: string;
  prompt: string;
  attachments: HarnessAttachment[];
  signal?: AbortSignal;
}

export type HarnessSteeringResult =
  | { status: "accepted" }
  | { status: "rejected"; reason: string }
  | { status: "uncertain"; reason: string };
