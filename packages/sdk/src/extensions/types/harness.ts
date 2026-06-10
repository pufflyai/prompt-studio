import type {
  AgentCapability,
  AgentModel,
  HarnessMessagesInput,
  HarnessReattachInput,
  HarnessResumeInput,
  HarnessSession,
  HarnessStartInput,
  SessionMessage,
} from "pstdio-api-contracts";
import type { Localizable } from "../l10n";
import type { ExtensionLoggerApi, ExtensionNetApi, ExtensionProcessApi } from "./context";
import type { MaybePromise } from "./json";

export type {
  AgentCapability,
  AgentModel,
  ApprovalRequest,
  ApprovalResponse,
  ErrorPart,
  FilePart,
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

/**
 * An agent harness contributed by an extension. The host injects the event sink
 * (and approval channel) and owns the session lifecycle: timeouts, persistence,
 * and status transitions are keyed off the returned HarnessSession.
 */
export interface HarnessProvider {
  /** Bare local id (e.g. "claude-code"); the runtime composes `${extensionId}.${id}`. */
  id: string;
  label: Localizable<string>;
  capabilities(ctx: HarnessContext): MaybePromise<AgentCapability[]>;
  detect?(ctx: HarnessContext): MaybePromise<HarnessDetectionResult>;
  listModels?(ctx: HarnessContext): MaybePromise<AgentModel[]>;
  start(ctx: HarnessContext, input: HarnessStartInput): MaybePromise<HarnessSession>;
  resume(ctx: HarnessContext, input: HarnessResumeInput): MaybePromise<HarnessSession>;
  /** Re-bind to an orphaned provider session after a host restart. Requires the SessionReattach capability. */
  reattach?(ctx: HarnessContext, input: HarnessReattachInput): MaybePromise<HarnessSession>;
  getMessages?(ctx: HarnessContext, input: HarnessMessagesInput): MaybePromise<SessionMessage[]>;
}
