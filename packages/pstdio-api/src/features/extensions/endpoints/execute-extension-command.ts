import { createRoute, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import { type CommandExecuteBody, commandExecuteBodySchema, commandExecuteResponseSchema } from "pstdio-api-contracts";
import { createCommandRunner } from "pstdio-extensions";
import { ProjectNotFoundError } from "../../../services/extension-service";
import type { AppBindings, AppRouteHandler } from "../../../types";
import type { ExtensionsRouteDeps } from "../deps";
import { createCommandEnvironment, loadProjectExtensionRuntime } from "../extension-command-runtime";

const errorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  commandId: z.string().optional(),
});

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
      const { enabledSources, runtime } = await loadProjectExtensionRuntime(deps, projectId);
      const command = runtime.commands.find((candidate) => candidate.id === commandId);
      if (!command) {
        return c.json({ error: `Command "${commandId}" is not registered`, code: "command_not_found", commandId }, 404);
      }

      const runner = createCommandRunner(runtime, {
        buildEnvironment: (input) =>
          createCommandEnvironment(deps, enabledSources, {
            extensionId: input.extensionId,
            name: input.name,
            projectId: input.projectId,
            settings: runtime.settings,
          }),
      });

      const outcome = await runner.execute({
        commandId,
        projectId,
        params: body.params as never,
        resource: body.resource as never,
        attachment: body.attachment as never,
        repo: body.repo as never,
        slot: body.slot as never,
        source: body.source ?? "api",
        metadata: body.metadata as never,
      });

      return c.json({ commandId, extensionId: command.extensionId, outcome }, 200);
    } catch (error) {
      if (error instanceof ProjectNotFoundError) return c.json({ error: error.message }, 404);
      throw error;
    }
  };

  return handler as AppRouteHandler<typeof executeExtensionCommandRoute>;
};
