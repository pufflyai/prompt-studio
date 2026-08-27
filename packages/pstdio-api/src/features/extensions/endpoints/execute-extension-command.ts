import { createRoute, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import { type CommandExecuteBody, commandExecuteBodySchema, commandExecuteResponseSchema } from "pstdio-api-contracts";
import { ProjectNotFoundError } from "../../../services/extension-service";
import type { AppBindings, AppRouteHandler } from "../../../types";
import type { ExtensionsRouteDeps } from "../deps";
import {
  CommandWorkspaceNotFoundError,
  ExtensionCommandNotFoundError,
  executeProjectExtensionCommand,
} from "../execute-project-extension-command";

export { resolveCommandWorkspaceDir } from "../execute-project-extension-command";

const errorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  commandId: z.string().optional(),
});

// Where a command's `ctx.workspaceFiles` mounts. A worktree-backed workspace runs in its own
// tree; a root/current-branch workspace spans every linked repo, so it mounts the repo the
// command was invoked for (body.repo), falling back to the first linked repo only when the
// request carries no repo context.
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
      return c.json(await executeProjectExtensionCommand(deps, { projectId, commandId, body }), 200);
    } catch (error) {
      if (error instanceof ProjectNotFoundError) return c.json({ error: error.message }, 404);
      if (error instanceof ExtensionCommandNotFoundError) {
        return c.json({ error: error.message, code: "command_not_found", commandId: error.commandId }, 404);
      }
      if (error instanceof CommandWorkspaceNotFoundError) {
        return c.json({ error: error.message, code: "workspace_not_found" }, 404);
      }
      throw error;
    }
  };

  return handler as AppRouteHandler<typeof executeExtensionCommandRoute>;
};
