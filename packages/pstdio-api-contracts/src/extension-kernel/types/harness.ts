import type { AgentModel } from "../../agents";
import type {
  AgentCapability,
  HarnessMessagesInput,
  HarnessReattachInput,
  HarnessResumeInput,
  HarnessSession,
  HarnessStartInput,
} from "../../harness";
import type { SessionMessage } from "../../session-messages";
import type { Localizable } from "../l10n";
import type { ExtensionLoggerApi, ExtensionNetApi, ExtensionProcessApi } from "./context";
import type { MaybePromise } from "./json";

export type { AgentModel } from "../../agents";
export type {
  AgentCapability,
  ApprovalRequest,
  ApprovalResponse,
  HarnessApprovalChannel,
  HarnessEventSink,
  HarnessExit,
  HarnessExitStatus,
  HarnessMessagesInput,
  HarnessReattachInput,
  HarnessResumeInput,
  HarnessSession,
  HarnessStartInput,
  JsonPatch,
  QuestionResponse,
  TimeoutStrategy,
} from "../../harness";
export type {
  ErrorPart,
  FilePart,
  LoadingPart,
  PatchPart,
  ReasoningPart,
  SessionMessage,
  SessionMessagePart,
  SessionMessageRole,
  StepFinishPart,
  StepStartPart,
  TextPart,
  TokenUsagePart,
  ToolPart,
  ToolPartActionType,
  ToolPartStatus,
} from "../../session-messages";

/**
 * Host context a harness runs against. A structural subset of ExtensionContextBase,
 * so richer host APIs can be passed without a contract change.
 */
export interface HarnessContext {
  /** Present when the harness runs on behalf of a project session. */
  projectId?: string;
  extensionId: string;
  /** Extension package name. */
  name: string;
  process: ExtensionProcessApi;
  net: ExtensionNetApi;
  logger: ExtensionLoggerApi;
}

export interface HarnessDetectionResult {
  available: boolean;
  version?: string;
  reason?: string;
}

/** Where the harness's agent discovers skills. Paths are relative to the repo (dir) and home (globalDir). */
export interface HarnessSkillsLayout {
  dir: string;
  /** Defaults to `dir` when omitted. */
  globalDir?: string;
}

/**
 * An agent harness contributed by an extension. The host injects the event sink
 * (and approval channel) and owns the session lifecycle: timeouts, persistence,
 * and status transitions are keyed off the returned HarnessSession.
 */
export interface HarnessProvider {
  /** Bare local id (e.g. "claude-code"); the runtime composes `${extensionId}.${id}`. */
  id: string;
  label: Localizable<string>;
  /** Declares skill directories so the host installs project skills for this agent. Absent = no skill setup. */
  skills?: HarnessSkillsLayout;
  capabilities(ctx: HarnessContext): MaybePromise<AgentCapability[]>;
  detect?(ctx: HarnessContext): MaybePromise<HarnessDetectionResult>;
  listModels?(ctx: HarnessContext): MaybePromise<AgentModel[]>;
  start(ctx: HarnessContext, input: HarnessStartInput): MaybePromise<HarnessSession>;
  resume(ctx: HarnessContext, input: HarnessResumeInput): MaybePromise<HarnessSession>;
  /** Re-bind to an orphaned provider session after a host restart. Requires the SessionReattach capability. */
  reattach?(ctx: HarnessContext, input: HarnessReattachInput): MaybePromise<HarnessSession>;
  getMessages?(ctx: HarnessContext, input: HarnessMessagesInput): MaybePromise<SessionMessage[]>;
}
