// Transport-neutral harness contract: the host injects an event sink (and, for
// providers with the Approvals capability, an approval channel) and consumes a
// neutral HarnessSession handle. Providers never control persistence or status;
// they emit JSON patches and settle `done`.

export type JsonPatch = {
  op: "add" | "replace" | "remove";
  path: string;
  value?: unknown;
};

export type EventStore = {
  push(patch: JsonPatch): void;
  getHistory(): JsonPatch[];
  subscribe(): AsyncIterable<JsonPatch>;
  historyPlusStream(): AsyncIterable<JsonPatch>;
  snapshotAndSubscribe(): { history: JsonPatch[]; stream: AsyncIterable<JsonPatch> };
};

export type AgentCapability = "SessionFork" | "ContextUsage" | "Approvals" | "SessionReattach";

export type QuestionResponse = {
  answers: string[][];
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

/** "activity": the host kills the session when no events arrive for a while; "provider": the provider self-terminates. */
export type TimeoutStrategy = "activity" | "provider";

export type HarnessEventSink = {
  push(patch: JsonPatch): void;
};

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
  timeoutStrategy?: TimeoutStrategy;
  /** Observability only. */
  pid?: number;
};

export type HarnessStartInput = {
  prompt: string;
  /** Host session id (correlation / env injection). */
  sessionId: string;
  cwd?: string;
  model?: string | null;
  attachments?: HarnessAttachment[];
  events: HarnessEventSink;
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
  events: HarnessEventSink;
};

export type HarnessMessagesInput = {
  agentSessionId: string;
  cwd?: string;
};
