import { createRoute, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import type { JsonObject } from "pstdio-api-contracts";
import { type CommandExecuteBody, commandExecuteBodySchema, commandExecuteResponseSchema } from "pstdio-api-contracts";
import { createCommandRunner } from "pstdio-extensions";
import { ProjectNotFoundError } from "../../../services/extension-service";
import type { AppBindings, AppRouteHandler } from "../../../types";
import { createCommandEnvironment } from "../command-environment";
import type { ExtensionsRouteDeps } from "../deps";

const errorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  commandId: z.string().optional(),
});

// Where a command's `ctx.workspaceFiles` mounts. A worktree-backed workspace runs in its own
// tree; a root/current-branch workspace spans every linked repo, so it mounts the repo the
// command was invoked for (body.repo), falling back to the first linked repo only when the
// request carries no repo context.
export const resolveCommandWorkspaceDir = (input: {
  worktreePath: string | null;
  repos: { id: string; path: string }[];
  repoId?: string;
}) => {
  if (input.worktreePath) return input.worktreePath;
  const invoked = input.repoId ? input.repos.find((repo) => repo.id === input.repoId) : undefined;
  return invoked?.path ?? input.repos[0]?.path;
};

export const executeExtensionCommandRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/extensions/commands/{commandId}/execute",
  description: "Execute a command from an enabled project extension.",
  tags: ["Extensions"],
  request: {
    params: z
      .object({
        commandId: z.string().openapi({ description: "Extension command ID" }),
        projectId: z.string().openapi({ description: "Project ID" }),
      })
      .strict(),
    body: {
      content: { "application/json": { schema: commandExecuteBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Command executed.",
      content: { "application/json": { schema: commandExecuteResponseSchema } },
    },
    404: {
      description: "Project or command not found.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

export const executeExtensionCommandHandler = (
  deps: ExtensionsRouteDeps,
): AppRouteHandler<typeof executeExtensionCommandRoute> => {
  const handler = async (c: Context<AppBindings>) => {
    const { commandId, projectId } = c.req.param();
    const body = (await c.req.json()) as CommandExecuteBody;

    try {
      const snapshot = await deps.extensionRuntimeCatalog.get(projectId);
      const handler =
        snapshot.runtime.commands.find((candidate) => candidate.id === commandId) ??
        snapshot.runtime.privateHandlers.find((candidate) => candidate.id === commandId);
      if (!handler) {
        return c.json({ error: `Command "${commandId}" is not registered`, code: "command_not_found", commandId }, 404);
      }

      // A command invoked from inside a worktree-backed workspace identifies it by id;
      // resolve the worktree path so the env (ctx.workspaceFiles) and ctx.workspaceId match.
      // The workspace must belong to this route's project, or a caller could mount another
      // project's worktree by passing a foreign workspace id.
      let workspaceDir: string | undefined;
      if (body.workspaceId) {
        const workspace = await deps.workspaceService.get(body.workspaceId);
        if (!workspace || workspace.project_id !== projectId) {
          return c.json(
            { error: `Workspace "${body.workspaceId}" was not found in this project`, code: "workspace_not_found" },
            404,
          );
        }
        const repos = await deps.repoService.listByProject(projectId);
        workspaceDir = resolveCommandWorkspaceDir({
          worktreePath: workspace.worktree_path,
          repos,
          repoId: body.repo?.repoId,
        });
      }

      const eventIds = new Set<string>();
      const runner = createCommandRunner(snapshot.runtime, {
        onDidDispatchEvent: (eventId) => eventIds.add(eventId),
        buildEnvironment: (input) =>
          createCommandEnvironment(deps, snapshot.enabledSources, {
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

      const outcome = await runner.execute({
        commandId,
        projectId,
        workspaceId: body.workspaceId,
        workspaceDir,
        params: body.params as JsonObject | undefined,
        resource: body.resource as never,
        attachment: body.attachment as never,
        repo: body.repo as never,
        slot: body.slot as never,
        source: body.source ?? "api",
        metadata: body.metadata as JsonObject | undefined,
      });

      if (body.source !== "dashboard") {
        for (const eventId of eventIds) {
          deps.eventBus.emit("extension_events", "set", {
            id: crypto.randomUUID(),
            projectId,
            eventId,
          });
        }
      }

      return c.json({ commandId, extensionId: handler.extensionId, eventIds: [...eventIds], outcome }, 200);
    } catch (error) {
      if (error instanceof ProjectNotFoundError) return c.json({ error: error.message }, 404);
      throw error;
    }
  };

  return handler as AppRouteHandler<typeof executeExtensionCommandRoute>;
};
