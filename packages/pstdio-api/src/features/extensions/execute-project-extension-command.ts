import type { CommandExecuteBody, JsonObject } from "pstdio-api-contracts";
import type { RepoContext } from "pstdio-api-contracts/extension-kernel";
import { createCommandRunner } from "pstdio-extensions";
import { createCommandEnvironment } from "./command-environment";
import { resolveWorkspaceRepoId } from "./command-environment/repos";
import type { ExtensionsRouteDeps } from "./deps";

export class ExtensionCommandNotFoundError extends Error {
  constructor(readonly commandId: string) {
    super(`Command "${commandId}" is not registered`);
  }
}

export class CommandWorkspaceNotFoundError extends Error {
  constructor(readonly workspaceId: string) {
    super(`Workspace "${workspaceId}" was not found in this project`);
  }
}

export class CommandRepoNotFoundError extends Error {
  constructor(readonly repoId: string) {
    super(`Repo "${repoId}" was not found in this project`);
  }
}

export class CommandWorkspaceRepoMismatchError extends Error {
  constructor(
    readonly workspaceId: string,
    readonly repoId: string,
  ) {
    super(`Workspace "${workspaceId}" does not belong to repo "${repoId}"`);
  }
}

export const resolveCommandWorkspaceDir = (input: {
  worktreePath: string | null;
  repos: { id: string; path: string }[];
  repoId?: string;
  executionKind?: "local" | "remote";
}) => {
  if (input.executionKind === "remote") return undefined;
  if (input.worktreePath) return input.worktreePath;
  const invoked = input.repoId ? input.repos.find((repo) => repo.id === input.repoId) : undefined;
  return invoked?.path ?? input.repos[0]?.path;
};

const resolveCommandInvocationContext = async (
  deps: ExtensionsRouteDeps,
  projectId: string,
  body: CommandExecuteBody,
) => {
  const repos = body.repo || body.workspaceId ? await deps.repoService.listByProject(projectId) : [];
  const registeredRepo = body.repo
    ? repos.find((candidate) => candidate.id === body.repo?.repoId && body.repo.projectId === projectId)
    : undefined;
  if (body.repo && !registeredRepo) throw new CommandRepoNotFoundError(body.repo.repoId);

  if (!body.workspaceId) {
    const repo: RepoContext | undefined = registeredRepo
      ? { projectId, repoId: registeredRepo.id, path: registeredRepo.path, role: "selected" }
      : undefined;
    return { repo, workspaceDir: undefined };
  }

  const workspace = await deps.workspaceService.get(body.workspaceId);
  if (!workspace || workspace.project_id !== projectId) throw new CommandWorkspaceNotFoundError(body.workspaceId);

  const workspaceRepoId = resolveWorkspaceRepoId(workspace);
  if (body.repo && workspace.worktree_path && workspaceRepoId !== body.repo.repoId) {
    throw new CommandWorkspaceRepoMismatchError(body.workspaceId, body.repo.repoId);
  }

  const workspaceDir = resolveCommandWorkspaceDir({
    worktreePath: workspace.worktree_path,
    repos,
    repoId: workspaceRepoId ?? body.repo?.repoId,
    executionKind: workspace.execution_kind,
  });
  const repo: RepoContext | undefined = registeredRepo
    ? { projectId, repoId: registeredRepo.id, path: workspaceDir ?? registeredRepo.path, role: "workspace" }
    : undefined;
  return { repo, workspaceDir };
};

export const executeProjectExtensionCommand = async (
  deps: ExtensionsRouteDeps,
  input: { projectId: string; commandId: string; body: CommandExecuteBody; signal?: AbortSignal },
) => {
  const { body, commandId, projectId } = input;
  const snapshot = await deps.extensionRuntimeCatalog.get(projectId);
  const handler =
    snapshot.runtime.commands.find((candidate) => candidate.id === commandId) ??
    snapshot.runtime.privateHandlers.find((candidate) => candidate.id === commandId);
  if (!handler) throw new ExtensionCommandNotFoundError(commandId);

  const invocation = await resolveCommandInvocationContext(deps, projectId, body);

  const eventIds = new Set<string>();
  const runner = createCommandRunner(snapshot.runtime, {
    onDidDispatchEvent: (eventId) => eventIds.add(eventId),
    buildEnvironment: (environment) =>
      createCommandEnvironment(deps, snapshot.enabledSources, {
        extensionId: environment.extensionId,
        name: environment.name,
        project: snapshot.project,
        projectId: environment.projectId,
        repo: environment.repo,
        workspaceDir: environment.workspaceDir,
        workspaceId: environment.workspaceId,
        settings: snapshot.runtime.settings,
      }),
  });

  const outcome = await runner.execute({
    commandId,
    projectId,
    workspaceId: body.workspaceId,
    workspaceDir: invocation.workspaceDir,
    params: body.params as JsonObject | undefined,
    resource: body.resource as never,
    attachment: body.attachment as never,
    repo: invocation.repo,
    slot: body.slot as never,
    source: body.source ?? "api",
    metadata: body.metadata as JsonObject | undefined,
    signal: input.signal,
  });

  if (body.source !== "dashboard") {
    for (const eventId of eventIds) {
      deps.eventBus.emit("extension_events", "set", { id: crypto.randomUUID(), projectId, eventId });
    }
  }

  return { commandId, extensionId: handler.extensionId, eventIds: [...eventIds], outcome };
};
