import { createRoute, z } from "@hono/zod-openapi";
import type { ActionTriggerContext, TargetType } from "@pstdio/sdk/plugins";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";

const executeActionInputSchema = z.object({
  target_type: z.enum(["ticket", "workspace", "session"]),
  target_id: z.string(),
});

const actionResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("success"), session_id: z.string().optional() }),
  z.object({ status: z.literal("error"), message: z.string() }),
]);

export const executeActionRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/actions/{actionKey}/execute",
  description: "Execute a plugin action.",
  tags: ["Actions"],
  request: {
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
        actionKey: z.string().openapi({ description: "Namespaced action key (e.g. plugin/action)" }),
      })
      .strict(),
    body: { content: { "application/json": { schema: executeActionInputSchema } } },
  },
  responses: {
    200: {
      description: "Action executed successfully.",
      content: { "application/json": { schema: actionResultSchema } },
    },
    404: {
      description: "Action not found.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
  },
});

const resolveTarget = async (deps: RouteDeps, targetType: TargetType, targetId: string) => {
  if (targetType === "ticket") {
    return deps.ticketService.get(targetId);
  }
  if (targetType === "session") {
    return deps.sessionService.get(targetId);
  }
  return null;
};

const resolvePrompts = async (_deps: RouteDeps, _projectId: string) => {
  // TODO: resolve template content from file storage once available
  const prompts: Record<string, string> = {};
  return prompts;
};

export const executeActionHandler = (deps: RouteDeps): AppRouteHandler<typeof executeActionRoute> => {
  return async (c) => {
    const { projectId, actionKey } = c.req.valid("param");
    const { target_type, target_id } = c.req.valid("json");

    const { registry, client } = await deps.pluginService.getForProject(projectId);
    const action = registry.getAction(actionKey);

    if (!action) {
      return c.json({ error: "Action not found" }, 404);
    }

    const target = await resolveTarget(deps, target_type, target_id);
    const prompts = await resolvePrompts(deps, projectId);

    const ctx = {
      client,
      projectId,
      prompts,
      targetType: target_type,
      targetId: target_id,
      target,
    } as ActionTriggerContext;

    try {
      await action.trigger(ctx);
      return c.json({ status: "success" as const }, 200);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Action execution failed";
      return c.json({ status: "error" as const, message }, 200);
    }
  };
};
