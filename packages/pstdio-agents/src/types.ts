export type AgentId = "opencode" | "claude-code" | "fake";

export type SessionMessageRole = "user" | "assistant" | "tool" | "system" | "developer";

export type TextPart = { type: "text"; text: string };

export type ReasoningPart = { type: "reasoning"; text: string };

export type ToolPartActionType = "read" | "write" | "execute" | "network" | "other";

export type ToolPartStatus = "pending" | "running" | "completed" | "failed" | "denied";

export type ToolPart = {
  type: "tool";
  tool: string;
  callId?: string;
  actionType?: ToolPartActionType;
  status?: ToolPartStatus;
  state?: {
    status?: string;
    input?: unknown;
    output?: unknown;
    errorText?: string;
    metadata?: unknown;
  };
};

export type StepStartPart = { type: "step-start"; snapshot?: string };

export type StepFinishPart = {
  type: "step-finish";
  reason?: string;
  snapshot?: string;
  cost?: number;
  tokens?: unknown;
};

export type PatchPart = { type: "patch"; hash?: string; files?: unknown };

export type FilePart = { type: "file"; mediaType?: string; filename?: string; url: string };

export type LoadingPart = { type: "loading" };

export type ErrorPart = {
  type: "error";
  errorType: "timeout" | "crash" | "permission" | "other";
  message?: string;
};

export type TokenUsagePart = {
  type: "token_usage";
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
};

export type SessionMessagePart =
  | TextPart
  | ReasoningPart
  | ToolPart
  | StepStartPart
  | StepFinishPart
  | PatchPart
  | FilePart
  | LoadingPart
  | ErrorPart
  | TokenUsagePart;

export type SessionMessage = {
  id: string;
  role: SessionMessageRole;
  parts: SessionMessagePart[];
  index?: number;
  createdAt?: number;
  modelId?: string;
  providerId?: string;
  tokens?: {
    input?: number;
    output?: number;
    reasoning?: number;
    cache?: { read?: number; write?: number };
  };
};

// --- Raw Log Events ---

export type RawLogEvent =
  | { type: "stdout"; data: string }
  | { type: "stderr"; data: string }
  | { type: "session_id"; sessionId: string }
  | { type: "message_id"; messageId: string }
  | { type: "ready" }
  | { type: "finished" };

// --- Event Store ---

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

// --- Spawned Process ---

export type TimeoutStrategy = "activity" | "provider";

export type SpawnedProcess = {
  sessionId: string;
  stdin: import("node:stream").Writable;
  kill(): void;
  onExit: Promise<{ code: number | null; signal: string | null }>;
  timeoutStrategy?: TimeoutStrategy;
};

// --- Approval System ---

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
