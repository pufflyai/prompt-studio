import type { WorkbenchAttachmentTarget } from "../workbench-targets";
import type { ContributionRef } from "./contribution-identity";
import type { JsonObject, JsonValue, Struct } from "./json";
import type { RepoContext, ResourceRef } from "./resources";
import type { SlotInvocationContext } from "./slots";

export type CommandSource = "cli" | "dashboard" | "api" | "schedule" | "event" | "automation" | "command-panel";

export interface CommandRef<TParams extends Struct = Struct, TResult = unknown> extends ContributionRef<"command"> {
  params?: TParams;
  result?: TResult;
}

export interface CommandTarget<TParams extends Struct = Struct> {
  command: CommandRef<TParams, unknown>;
  params?: TParams;
}

export interface SerializedError {
  name?: string;
  message: string;
  stack?: string;
  cause?: JsonValue;
}

export interface WorkbenchAttachmentInvocationContext {
  target: WorkbenchAttachmentTarget;
  mode?: string;
  projectId?: string;
  resource?: ResourceRef;
}

export interface CommandInvocation<TParams extends Struct = Struct> {
  params: TParams;
  resource?: ResourceRef;
  repoId?: string;
  repoPath?: string;
  attachment?: WorkbenchAttachmentInvocationContext;
  slot?: SlotInvocationContext;
  metadata?: JsonObject;
}

export interface CommandContinue {
  type: "continue";
}

export interface CommandPatchParams<TParams extends Struct = Struct> {
  type: "patchParams";
  params: Partial<TParams>;
}

export interface CommandReplaceParams<TParams extends Struct = Struct> {
  type: "replaceParams";
  params: TParams;
}

export interface CommandReplaceInvocation<TParams extends Struct = Struct> {
  type: "replaceInvocation";
  invocation: CommandInvocation<TParams>;
}

export interface CommandReject {
  type: "reject";
  code?: string;
  reason: string;
  data?: JsonObject;
}

export type CommandMiddlewareResult<TParams extends Struct = Struct> =
  // biome-ignore lint/suspicious/noConfusingVoidType: middleware handlers may return nothing
  | void
  | CommandContinue
  | CommandPatchParams<TParams>
  | CommandReplaceParams<TParams>
  | CommandReplaceInvocation<TParams>
  | CommandReject;

export interface CommandNotice {
  type: "info" | "success" | "warning" | "error";
  title?: string;
  message: string;
  metadata?: JsonObject;
}

export interface CommandDiagnostic {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
  extensionId?: string;
  commandId?: string;
  metadata?: JsonObject;
}

export type CommandOutcome<TResult = unknown> =
  | {
      ok: true;
      status: "success";
      value: TResult;
      notices?: CommandNotice[];
      diagnostics?: CommandDiagnostic[];
    }
  | {
      ok: false;
      status: "rejected";
      code?: string;
      reason: string;
      data?: JsonObject;
      notices?: CommandNotice[];
      diagnostics?: CommandDiagnostic[];
    }
  | {
      ok: false;
      status: "error";
      code?: string;
      reason: string;
      error?: SerializedError;
      notices?: CommandNotice[];
      diagnostics?: CommandDiagnostic[];
    };

export interface CommandHelpersApi {
  execute<TParams extends Struct = Struct, TResult = unknown>(
    command: CommandRef<TParams, TResult>,
    invocation: CommandInvocation<TParams>,
  ): Promise<CommandOutcome<TResult>>;

  continue(): CommandContinue;
  patchParams<TParams extends Struct = Struct>(params: Partial<TParams>): CommandPatchParams<TParams>;
  replaceParams<TParams extends Struct = Struct>(params: TParams): CommandReplaceParams<TParams>;
  replaceInvocation<TParams extends Struct = Struct>(
    invocation: CommandInvocation<TParams>,
  ): CommandReplaceInvocation<TParams>;
  reject(input: Omit<CommandReject, "type">): CommandReject;
}

export interface CommandRequestedEvent<TParams extends Struct = Struct> {
  commandId: string;
  invocationId: string;
  source?: CommandSource;
  params: TParams;
  resource?: ResourceRef;
  repo?: RepoContext;
}

export interface CommandStartedEvent<TParams extends Struct = Struct> extends CommandRequestedEvent<TParams> {}

export interface CommandCompletedEvent<TParams extends Struct = Struct, TResult = unknown>
  extends CommandStartedEvent<TParams> {
  result: TResult;
  elapsedMs: number;
}

export interface CommandRejectedEvent<TParams extends Struct = Struct> extends CommandRequestedEvent<TParams> {
  code?: string;
  reason: string;
  data?: JsonObject;
}

export interface CommandFailedEvent<TParams extends Struct = Struct> extends CommandRequestedEvent<TParams> {
  code?: string;
  reason: string;
  error?: SerializedError;
  elapsedMs: number;
}

export type CommandLifecyclePhase = "requested" | "started" | "completed" | "rejected" | "failed";

export type CommandLifecycleEventPayload<
  TPhase extends CommandLifecyclePhase,
  TParams extends Struct = Struct,
  TResult = unknown,
> = TPhase extends "requested"
  ? CommandRequestedEvent<TParams>
  : TPhase extends "started"
    ? CommandStartedEvent<TParams>
    : TPhase extends "completed"
      ? CommandCompletedEvent<TParams, TResult>
      : TPhase extends "rejected"
        ? CommandRejectedEvent<TParams>
        : CommandFailedEvent<TParams>;
