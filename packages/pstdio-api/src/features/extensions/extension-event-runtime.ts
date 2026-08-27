import type {
  CommandInvocation,
  CommandOutcome,
  CommandRef,
  EventRef,
  ExtensionLoggerApi,
  JsonObject,
  Struct,
} from "pstdio-api-contracts/extension-kernel";
import { createCommandRunner } from "pstdio-extensions";
import { apiLogger } from "../../lib/logger";
import { createCommandEnvironment } from "./command-environment";
import type { ExtensionsRouteDeps } from "./deps";

export type ExtensionEventDeps = ExtensionsRouteDeps;

const eventIdFor = (event: EventRef | string) => (typeof event === "string" ? event : event.id);

const extensionEventLogger: ExtensionLoggerApi = {
  info: (message, metadata) => {
    apiLogger.info({ event: "extension.event.log", metadata: metadata ?? {} }, message);
  },
  warn: (message, metadata) => {
    apiLogger.warn({ event: "extension.event.log", metadata: metadata ?? {} }, message);
  },
  error: (message, metadata) => {
    apiLogger.error({ event: "extension.event.log", metadata: metadata ?? {} }, message);
  },
};

export const fireExtensionEvent = async <TPayload extends Struct>(
  deps: ExtensionEventDeps,
  projectId: string,
  event: EventRef<TPayload> | string,
  payload: TPayload,
) => {
  const eventId = eventIdFor(event);
  const snapshot = await deps.extensionRuntimeCatalog.get(projectId);
  const runner = createCommandRunner(snapshot.runtime, {
    logger: extensionEventLogger,
    buildEnvironment: (input) =>
      createCommandEnvironment(deps, snapshot.enabledSources, {
        artifactMounts: snapshot.runtime.artifactMounts,
        extensionId: input.extensionId,
        name: input.name,
        project: snapshot.project,
        projectId: input.projectId,
        repo: input.repo,
        workspaceDir: input.workspaceDir,
        workspaceId: input.workspaceId,
        settings: snapshot.runtime.settings,
      }),
  });

  return runner.dispatchEvent({
    eventId,
    projectId,
    payload: payload as JsonObject,
  });
};

export const fireExtensionEventAsync = <TPayload extends Struct>(
  deps: ExtensionEventDeps,
  projectId: string,
  event: EventRef<TPayload> | string,
  payload: TPayload,
) => {
  const eventId = eventIdFor(event);
  void fireExtensionEvent(deps, projectId, event, payload).catch((err) => {
    apiLogger.warn(
      { err, event: "extension.event.dispatch_failed", event_id: eventId, project_id: projectId },
      "Extension event dispatch failed",
    );
  });
};

const commandIdFor = (command: CommandRef | string) => (typeof command === "string" ? command : command.id);

export const runExtensionCommand = async <TParams extends Struct, TResult>(
  deps: ExtensionEventDeps,
  projectId: string,
  command: CommandRef<TParams, TResult> | string,
  params: TParams,
): Promise<CommandOutcome<TResult>> => {
  const commandId = commandIdFor(command);
  const snapshot = await deps.extensionRuntimeCatalog.get(projectId);
  const runner = createCommandRunner(snapshot.runtime, {
    logger: extensionEventLogger,
    buildEnvironment: (input) =>
      createCommandEnvironment(deps, snapshot.enabledSources, {
        artifactMounts: snapshot.runtime.artifactMounts,
        extensionId: input.extensionId,
        name: input.name,
        project: snapshot.project,
        projectId: input.projectId,
        repo: input.repo,
        workspaceDir: input.workspaceDir,
        workspaceId: input.workspaceId,
        settings: snapshot.runtime.settings,
      }),
  });

  return (await runner.execute({
    commandId,
    projectId,
    params: params as JsonObject,
    source: "api",
  })) as CommandOutcome<TResult>;
};

export const runExtensionHostCommand = async <TParams extends Struct, TResult>(
  deps: ExtensionEventDeps,
  projectId: string,
  command: CommandRef<TParams, TResult> | string,
  params: TParams,
  run: (invocation: CommandInvocation<TParams>) => Promise<TResult> | TResult,
): Promise<CommandOutcome<TResult>> => {
  const commandId = commandIdFor(command);
  const snapshot = await deps.extensionRuntimeCatalog.get(projectId);
  const runner = createCommandRunner(snapshot.runtime, {
    logger: extensionEventLogger,
    buildEnvironment: (input) =>
      createCommandEnvironment(deps, snapshot.enabledSources, {
        artifactMounts: snapshot.runtime.artifactMounts,
        extensionId: input.extensionId,
        name: input.name,
        project: snapshot.project,
        projectId: input.projectId,
        repo: input.repo,
        workspaceDir: input.workspaceDir,
        workspaceId: input.workspaceId,
        settings: snapshot.runtime.settings,
      }),
  });

  return (await runner.executeHostCommand({
    commandId,
    projectId,
    params: params as JsonObject,
    source: "api",
    run: run as (invocation: CommandInvocation) => Promise<TResult> | TResult,
  })) as CommandOutcome<TResult>;
};
