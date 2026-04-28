import type { ExtensionSetupContext } from "./types";

export type HarnessDetectionResult = {
  available: boolean;
  reason?: string;
};

export type HarnessModel = {
  id: string;
};

export type HarnessJsonPatch = {
  op: "add" | "replace" | "remove";
  path: string;
  value?: unknown;
};

export type HarnessEventStore = {
  push(patch: HarnessJsonPatch): void;
  getHistory(): HarnessJsonPatch[];
  subscribe(): AsyncIterable<HarnessJsonPatch>;
  historyPlusStream(): AsyncIterable<HarnessJsonPatch>;
  snapshotAndSubscribe(): { history: HarnessJsonPatch[]; stream: AsyncIterable<HarnessJsonPatch> };
};

export type HarnessApprovalRequest = {
  id: string;
  toolName: string;
  toolInput: unknown;
  toolUseId: string;
};

export type HarnessApprovalResponse = {
  id: string;
  decision: "approve" | "deny" | "timeout";
};

export type HarnessApprovalService = {
  requestApproval(request: HarnessApprovalRequest): Promise<HarnessApprovalResponse>;
  handleResponse(response: HarnessApprovalResponse): void;
  dispose(): void;
};

export type HarnessQuestionResponse = {
  answers: string[][];
};

export type HarnessSpawnedProcess = {
  sessionId: string;
  stdin: import("node:stream").Writable;
  kill(): void;
  onExit: Promise<{ code: number | null; signal: string | null }>;
  timeoutStrategy?: "activity" | "provider";
};

export type HarnessSessionStartInput = {
  prompt: string;
  title?: string;
  model?: string | null;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  eventStore?: HarnessEventStore;
};

export type HarnessSessionStartResult = {
  sessionId: string;
  process?: HarnessSpawnedProcess;
};

export type HarnessSessionMessageInput = {
  sessionId: string;
  prompt: string;
  model?: string | null;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  messageOffset?: number;
  questionResponse?: HarnessQuestionResponse;
};

export type HarnessResumeResult = {
  process?: HarnessSpawnedProcess;
};

export type HarnessSessionMessagesInput = {
  cwd?: string | null;
};

export type HarnessSessionReattachInput = {
  sessionId: string;
  cwd?: string;
};

export type HarnessRun = {
  runId: string;
  onExit?: Promise<{ code: number | null; signal: string | null }>;
};

export type HarnessProviderDefinition = {
  id?: string;
  label: string;
  detect?(ctx: ExtensionSetupContext): Promise<HarnessDetectionResult>;
  listModels?(ctx: ExtensionSetupContext): HarnessModel[] | Promise<HarnessModel[]>;
  start(
    ctx: ExtensionSetupContext,
    input: { workspacePath: string; sessionId: string; prompt?: string },
  ): Promise<HarnessRun>;
  startSession?(ctx: ExtensionSetupContext, input: HarnessSessionStartInput): Promise<HarnessSessionStartResult>;
  resumeSession?(
    ctx: ExtensionSetupContext,
    input: HarnessSessionMessageInput,
    eventStore: HarnessEventStore,
    approvalService?: HarnessApprovalService,
  ): Promise<HarnessResumeResult>;
  reattachSession?(
    ctx: ExtensionSetupContext,
    input: HarnessSessionReattachInput,
    eventStore: HarnessEventStore,
  ): Promise<HarnessResumeResult>;
  getMessages?(ctx: ExtensionSetupContext, sessionId: string, input?: HarnessSessionMessagesInput): Promise<unknown[]>;
  send?(ctx: ExtensionSetupContext, input: { runId: string; message: string }): Promise<void>;
  stop?(ctx: ExtensionSetupContext, input: { runId: string }): Promise<void>;
};

export type WorkspaceTypeProviderDefinition = {
  id?: string;
  label: string;
  create(ctx: ExtensionSetupContext, input: Record<string, unknown>): Promise<Record<string, unknown>>;
  resolve(
    ctx: ExtensionSetupContext,
    workspace: Record<string, unknown>,
  ): Promise<{ rootPath: string; displayPath?: string }>;
  archive?(ctx: ExtensionSetupContext, workspace: Record<string, unknown>): Promise<void>;
  delete?(ctx: ExtensionSetupContext, workspace: Record<string, unknown>): Promise<void>;
};
