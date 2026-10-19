import type { CommandExecuteBody, CommandExecuteResponse, JsonObject, JsonValue } from "pstdio-api-contracts";
import { createCommandRunner, createReadBoundary } from "pstdio-extensions";
import { z } from "zod";
import { withStorageObservation } from "../../services/shared-files/storage-observation";
import { createCommandEnvironment } from "./command-environment";
import type { ExtensionsRouteDeps } from "./deps";
import { createExtensionLogger } from "./extension-logger";
import { localExecutionBoundaries } from "./local-conflicts";

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
  input: {
    projectId: string;
    commandId: string;
    body: CommandExecuteBody;
    signal?: AbortSignal;
    onChunk?: (chunk: JsonValue) => Promise<void>;
  },
) => {
  const { body, commandId, projectId } = input;
  const snapshot = await createReadBoundary(input.signal)(() => deps.extensionRuntimeCatalog.get(projectId));
  const command = snapshot.runtime.commands.find((candidate) => candidate.id === commandId);
  const handler = command ?? snapshot.runtime.privateHandlers.find((candidate) => candidate.id === commandId);
  if (!handler) throw new ExtensionCommandNotFoundError(commandId);
  if (body.source === "automation" && !command?.automation) {
    return {
      commandId,
      extensionId: handler.extensionId,
      eventIds: [],
      outcome: {
        ok: false as const,
        status: "rejected" as const,
        code: "automation_scope_denied",
        reason: "Command is no longer exposed to automation.",
      },
    };
  }

  const workspace = body.workspaceId
    ? await createReadBoundary(input.signal)(() => deps.workspaceService.get(body.workspaceId!))
    : await createReadBoundary(input.signal)(() => deps.workspaceService.getDefault(projectId));
  if (body.workspaceId && (!workspace || workspace.project_id !== projectId))
    throw new CommandWorkspaceNotFoundError(body.workspaceId);
  const eventIds = new Set<string>();
  const runner = createCommandRunner(snapshot.runtime, {
    ...localExecutionBoundaries(deps),
    createLogger: createExtensionLogger,
    onDidDispatchEvent: (eventId) => eventIds.add(eventId),
    buildEnvironment: (environment) =>
      createCommandEnvironment(deps, snapshot.enabledSources, {
        ...environment,
        artifactMounts: snapshot.runtime.artifactMounts,
        project: snapshot.project,
        settings: snapshot.runtime.settings,
      }),
  });
  const versions = body.metadata?.fileStorageVersions;
  const expected = versions === undefined ? undefined : z.record(z.string(), z.string()).parse(versions);
  const execute = () =>
    runner.execute({
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
      onChunk: input.onChunk,
    });
  const observed = expected
    ? await withStorageObservation(expected, execute)
    : { value: await execute(), versions: undefined, conflicted: false };
  let outcome: typeof observed.value & { data?: CommandExecuteResponse["outcome"]["data"] } = observed.value;
  if (observed.conflicted)
    outcome = {
      ok: false,
      status: "error",
      reason:
        "This file changed in another environment. Your draft is kept here and its saved version is retained as a conflict.",
    };
  if (observed.versions && outcome.ok)
    outcome = {
      ...outcome,
      data: { ...outcome.data, fileStorageVersions: { ...expected, ...observed.versions } },
    };
  if (body.source !== "dashboard") {
    for (const eventId of eventIds)
      deps.eventBus.emit("extension_events", "set", { id: crypto.randomUUID(), projectId, eventId });
  }
  return { commandId, extensionId: handler.extensionId, eventIds: [...eventIds], outcome };
};
