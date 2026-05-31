import type {
  CommandInvocation,
  CommandOutcome,
  CommandRef,
  EventRef,
  ExtensionLoggerApi,
  JsonObject,
  Struct,
} from "@pstdio/sdk/extensions";
import { createCommandRunner } from "pstdio-extensions";
import { apiLogger } from "../../lib/logger";
import type { ExtensionsRouteDeps } from "./deps";
import { createCommandEnvironment, loadProjectExtensionRuntime } from "./extension-command-runtime";

type ExtensionEventDeps = Pick<
  ExtensionsRouteDeps,
  | "activityEventsService"
  | "attemptStatusService"
  | "extensionService"
  | "extensionSettingsService"
  | "extensionStorageService"
  | "fileService"
  | "repoService"
  | "sessionQueueEntriesService"
  | "sessionService"
  | "settingsService"
  | "statusService"
  | "templateService"
  | "ticketService"
  | "workspaceService"
  | "workspaceSessionService"
>;

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
  const { enabledSources, runtime } = await loadProjectExtensionRuntime(deps as ExtensionsRouteDeps, projectId);
  const runner = createCommandRunner(runtime, {
    logger: extensionEventLogger,
    buildEnvironment: (input) =>
      createCommandEnvironment(deps as ExtensionsRouteDeps, enabledSources, {
        artifactMounts: runtime.artifactMounts,
        extensionId: input.extensionId,
        name: input.name,
        projectId: input.projectId,
        settings: runtime.settings,
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
  const { enabledSources, runtime } = await loadProjectExtensionRuntime(deps as ExtensionsRouteDeps, projectId);
  const runner = createCommandRunner(runtime, {
    logger: extensionEventLogger,
    buildEnvironment: (input) =>
      createCommandEnvironment(deps as ExtensionsRouteDeps, enabledSources, {
        artifactMounts: runtime.artifactMounts,
        extensionId: input.extensionId,
        name: input.name,
        projectId: input.projectId,
        settings: runtime.settings,
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
  const { enabledSources, runtime } = await loadProjectExtensionRuntime(deps as ExtensionsRouteDeps, projectId);
  const runner = createCommandRunner(runtime, {
    logger: extensionEventLogger,
    buildEnvironment: (input) =>
      createCommandEnvironment(deps as ExtensionsRouteDeps, enabledSources, {
        artifactMounts: runtime.artifactMounts,
        extensionId: input.extensionId,
        name: input.name,
        projectId: input.projectId,
        settings: runtime.settings,
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
