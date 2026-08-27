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
  const repos = await deps.repoService.listByProject(projectId);
  const requestedWorkspaceId = stringValue((payload as { workspaceId?: unknown }).workspaceId);
  const workspace = requestedWorkspaceId ? await deps.workspaceService.get(requestedWorkspaceId) : null;
  if (requestedWorkspaceId && (!workspace || workspace.project_id !== projectId)) {
    throw new Error(`Workspace not found for project: ${requestedWorkspaceId}`);
  }

  const providerParams = workspace?.provider_params_json as Record<string, unknown> | undefined;
  const providerRef = workspace?.provider_ref_json as { data?: Record<string, unknown> } | null | undefined;
  const repoId = stringValue(providerParams?.repo_id) ?? stringValue(providerRef?.data?.repo_id);
  const requestedRepoPath = stringValue((payload as { repoPath?: unknown }).repoPath);
  const repo =
    (repoId ? repos.find((candidate) => candidate.id === repoId) : undefined) ??
    (requestedRepoPath ? repos.find((candidate) => candidate.path === requestedRepoPath) : undefined);
  const rootWorkspace = workspace?.provider_id === "pstdio.root";
  const workspaceDir =
    workspace?.execution_kind === "local"
      ? (workspace.worktree_path ?? (rootWorkspace ? repo?.path : undefined))
      : undefined;

  const trustedPayload = { ...payload, projectId } as JsonObject;
  delete trustedPayload.workspaceId;
  delete trustedPayload.workspace;
  delete trustedPayload.workspaceDir;
  delete trustedPayload.repoPath;
  delete trustedPayload.branch;
  if (workspace) {
    trustedPayload.workspaceId = workspace.id;
    trustedPayload.workspace = workspace as unknown as JsonObject;
    if (workspaceDir) trustedPayload.workspaceDir = workspaceDir;
    if (workspace.branch) trustedPayload.branch = workspace.branch;
  }
  if (repo) trustedPayload.repoPath = repo.path;

  return { repo, trustedPayload, workspaceDir, workspaceId: workspace?.id };
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
        repo: context.repo ? { projectId, repoId: context.repo.id, path: context.repo.path } : undefined,
        workspaceDir: context.workspaceDir,
        workspaceId: context.workspaceId,
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
