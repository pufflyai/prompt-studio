import { createRoute, z } from "@hono/zod-openapi";
import { ExtensionCommandNotFoundError } from "../../../services/extension-command-service";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";

const resourceRefSchema = z
  .object({
    type: z.string(),
    id: z.string(),
    projectId: z.string().optional(),
    label: z.string().optional(),
    extensionId: z.string().optional(),
    role: z.enum(["primary", "context", "source", "result"]).optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  })
  .strict();

const executeExtensionCommandInputSchema = z
  .object({
    params: z.record(z.string(), z.any()).optional(),
    target: resourceRefSchema.optional(),
  })
  .strict();

const executeExtensionCommandResultSchema = z.object({
  result: z.any().optional(),
});

const errorResponseSchema = z.object({
  error: z.string(),
});

export const executeExtensionCommandRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/extension-commands/{commandId}/execute",
  description: "Execute an extension command.",
  tags: ["Extension Commands"],
  request: {
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
        commandId: z.string().openapi({ description: "Extension command ID" }),
      })
      .strict(),
    body: { content: { "application/json": { schema: executeExtensionCommandInputSchema } } },
  },
  responses: {
    200: {
      description: "Extension command executed successfully.",
      content: { "application/json": { schema: executeExtensionCommandResultSchema } },
    },
    400: {
      description: "Extension command failed.",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "Project or extension command not found.",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
});

export const executeExtensionCommandHandler = (
  deps: RouteDeps,
): AppRouteHandler<typeof executeExtensionCommandRoute> => {
  return async (c) => {
    const { projectId, commandId } = c.req.valid("param");
    const { params, target } = c.req.valid("json");

    const project = await deps.projectService.get(projectId);
    if (!project) {
      return c.json({ error: `Project not found: ${projectId}` }, 404);
    }

    try {
      const result = await deps.extensionCommandService.execute({
        projectId,
        commandId,
        params,
        target,
      });

      return c.json({ result }, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Extension command execution failed";
      if (error instanceof ExtensionCommandNotFoundError) {
        return c.json({ error: message }, 404);
      }

      return c.json({ error: message }, 400);
    }
  };
};
