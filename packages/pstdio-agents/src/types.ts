import type { AgentCapability, AgentModel, ApprovalService, EventStore, QuestionResponse } from "pstdio-api-contracts";

// The agent data contract (SessionMessage + parts, JsonPatch, EventStore, approvals,
// capabilities) lives in pstdio-api-contracts; only the Node-coupled AgentService
// surface remains here.
export type {
  AgentCapability,
  AgentModel,
  ApprovalRequest,
  ApprovalResponse,
  ApprovalService,
  ErrorPart,
  EventStore,
  FilePart,
  JsonPatch,
  LoadingPart,
  PatchPart,
  QuestionResponse,
  ReasoningPart,
  SessionMessage,
  SessionMessagePart,
  SessionMessageRole,
  StepFinishPart,
  StepStartPart,
  TextPart,
  TimeoutStrategy,
  TokenUsagePart,
  ToolPart,
  ToolPartActionType,
  ToolPartStatus,
} from "pstdio-api-contracts";

import type { SessionMessage, TimeoutStrategy } from "pstdio-api-contracts";

export type AgentId = "opencode" | "claude-code" | "fake";

export type SessionStartInput = {
  prompt: string;
  title?: string;
  model?: string | null;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  eventStore?: EventStore;
};

export type SessionStartResult = {
  sessionId: string;
  process?: SpawnedProcess;
};

export type SessionMessageInput = {
  sessionId: string;
  prompt: string;
  model?: string | null;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  messageOffset?: number;
  questionResponse?: QuestionResponse;
};

export type SessionMessagesInput = {
  cwd?: string | null;
};

export type AvailabilityInfo = {
  type: "INSTALLED" | "NOT_FOUND";
};

export type SessionReattachInput = {
  sessionId: string;
  cwd?: string;
};

// --- Session Management ---

export type SessionListEntry = {
  id: string;
  title: string;
  directory: string;
  updatedAt: string;
};

export type SessionExport = {
  session: SessionListEntry;
  messages: SessionMessage[];
};

export type LaunchInput = {
  prompt: string;
  title?: string;
  model?: string | null;
  cwd?: string;
};

export type LaunchResult = {
  pid?: number;
  sessionId?: string;
};

// --- Raw Log Events ---

export type RawLogEvent =
  | { type: "stdout"; data: string }
  | { type: "stderr"; data: string }
  | { type: "session_id"; sessionId: string }
  | { type: "message_id"; messageId: string }
  | { type: "ready" }
  | { type: "finished" };

// --- Spawned Process ---

export type SpawnedProcess = {
  sessionId: string;
  stdin: import("node:stream").Writable;
  kill(): void;
  onExit: Promise<{ code: number | null; signal: string | null }>;
  timeoutStrategy?: TimeoutStrategy;
};

export type ResumeResult = {
  process?: SpawnedProcess;
};

// --- Agent Service ---

export type AgentService = {
  id: AgentId;
  name: string;

  capabilities(): AgentCapability[];
  checkAvailability(): AvailabilityInfo;
  listModels(): AgentModel[];

  // session lifecycle (tracked, interactive)
  startSession(input: SessionStartInput): Promise<SessionStartResult>;
  resumeSession(
    input: SessionMessageInput,
    eventStore: EventStore,
    approvalService?: ApprovalService,
  ): Promise<ResumeResult>;
  reattachSession?(input: SessionReattachInput, eventStore: EventStore): Promise<ResumeResult>;
  getMessages(sessionId: string, input?: SessionMessagesInput): Promise<SessionMessage[]>;

  // session management
  listSessions(input?: { cwd?: string }): Promise<SessionListEntry[]>;
  exportSession(sessionId: string): Promise<SessionExport>;
  launchSession(input: LaunchInput): Promise<LaunchResult>;
  setSessionTitle?(sessionId: string, title: string): Promise<void>;
};

export type AgentRegistry = {
  get(id: AgentId): AgentService | null;
  list(): AgentService[];
  checkAll(): Partial<Record<AgentId, AvailabilityInfo>>;
};
