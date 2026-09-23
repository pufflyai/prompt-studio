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

const stringValue = (value: unknown) => (typeof value === "string" && value.length > 0 ? value : undefined);

const resolveEventContext = async <TPayload extends Struct>(
  deps: ExtensionEventDeps,
  projectId: string,
  payload: TPayload,
) => {
  const home = await deps.workspaceService.getDefault(projectId);
  const requestedWorkspaceId = stringValue((payload as { workspaceId?: unknown }).workspaceId);
  const workspace = requestedWorkspaceId ? await deps.workspaceService.get(requestedWorkspaceId) : home;
  if (requestedWorkspaceId && (!workspace || workspace.project_id !== projectId))
    throw new Error("Workspace not found for project.");
  const workspaceDir = workspace?.execution_kind === "local" ? (workspace.root_path ?? undefined) : undefined;
  const trustedPayload = { ...payload, projectId } as JsonObject;
  for (const key of ["workspaceId", "workspace", "workspaceDir", "projectDir", "repoPath", "branch"])
    delete trustedPayload[key];
  if (workspace) {
    trustedPayload.workspaceId = workspace.id;
    trustedPayload.workspace = workspace as unknown as JsonObject;
    trustedPayload.providerId = workspace.provider_id;
    if (workspaceDir) trustedPayload.workspaceDir = workspaceDir;
    if (workspace.branch) trustedPayload.branch = workspace.branch;
  }
  if (home?.root_path) trustedPayload.projectDir = home.root_path;
  return { trustedPayload, workspaceDir, workspaceId: workspace?.id };
};

export const fireExtensionEvent = async <TPayload extends Struct>(
  deps: ExtensionEventDeps,
  projectId: string,
  event: EventRef<TPayload> | string,
  payload: TPayload,
) => {
  const eventId = eventIdFor(event);
  const snapshot = await deps.extensionRuntimeCatalog.get(projectId);
  const context = await resolveEventContext(deps, projectId, payload);
  const runner = createCommandRunner(snapshot.runtime, {
    logger: extensionEventLogger,
    buildEnvironment: (input) =>
      createCommandEnvironment(deps, snapshot.enabledSources, {
        artifactMounts: snapshot.runtime.artifactMounts,
        extensionId: input.extensionId,
        name: input.name,
        project: snapshot.project,
        projectId: input.projectId,
        workspaceDir: context.workspaceDir,
        workspaceId: context.workspaceId,
        eventId,
        settings: snapshot.runtime.settings,
      }),
  });

  return runner.dispatchEvent({
    eventId,
    projectId,
    payload: context.trustedPayload,
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
        workspaceDir: input.workspaceDir,
        workspaceId: input.workspaceId,
        settings: snapshot.runtime.settings,
      }),
  });

  const workspace = await deps.workspaceService.getDefault(projectId);
  return (await runner.execute({
    commandId,
    projectId,
    params: params as JsonObject,
    source: "api",
    workspaceId: workspace?.id,
    workspaceDir: workspace?.execution_kind === "local" ? (workspace.root_path ?? undefined) : undefined,
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
        workspaceDir: input.workspaceDir,
        workspaceId: input.workspaceId,
        settings: snapshot.runtime.settings,
      }),
  });

  const workspace = await deps.workspaceService.getDefault(projectId);
  return (await runner.executeHostCommand({
    commandId,
    projectId,
    params: params as JsonObject,
    source: "api",
    workspaceId: workspace?.id,
    workspaceDir: workspace?.execution_kind === "local" ? (workspace.root_path ?? undefined) : undefined,
    run: run as (invocation: CommandInvocation) => Promise<TResult> | TResult,
  })) as CommandOutcome<TResult>;
};
