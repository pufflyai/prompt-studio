import type { CommandExecuteBody, JsonObject } from "pstdio-api-contracts";
import { createCommandRunner } from "pstdio-extensions";
import { createCommandEnvironment } from "./command-environment";
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
export const resolveCommandWorkspaceDir = (workspace: { root_path: string | null; execution_kind: string }) =>
  workspace.execution_kind === "local" ? (workspace.root_path ?? undefined) : undefined;

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
  const workspace = body.workspaceId
    ? await deps.workspaceService.get(body.workspaceId)
    : await deps.workspaceService.getDefault(projectId);
  if (body.workspaceId && (!workspace || workspace.project_id !== projectId))
    throw new CommandWorkspaceNotFoundError(body.workspaceId);
  const eventIds = new Set<string>();
  const runner = createCommandRunner(snapshot.runtime, {
    onDidDispatchEvent: (eventId) => eventIds.add(eventId),
    buildEnvironment: (environment) =>
      createCommandEnvironment(deps, snapshot.enabledSources, {
        ...environment,
        artifactMounts: snapshot.runtime.artifactMounts,
        project: snapshot.project,
        settings: snapshot.runtime.settings,
      }),
  });
  const outcome = await runner.execute({
    commandId,
    projectId,
    workspaceId: workspace?.id,
    workspaceDir: workspace ? resolveCommandWorkspaceDir(workspace) : undefined,
    params: body.params as JsonObject | undefined,
    resource: body.resource as never,
    attachment: body.attachment as never,
    slot: body.slot as never,
    source: body.source ?? "api",
    metadata: body.metadata as JsonObject | undefined,
    signal: input.signal,
  });
  if (body.source !== "dashboard") {
    for (const eventId of eventIds)
      deps.eventBus.emit("extension_events", "set", { id: crypto.randomUUID(), projectId, eventId });
  }
  return { commandId, extensionId: handler.extensionId, eventIds: [...eventIds], outcome };
};
