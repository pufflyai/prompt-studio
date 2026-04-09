import { readFileSync } from "node:fs";
import { createRoute, z } from "@hono/zod-openapi";
import type { ActionTriggerContext, TargetType } from "@pstdio/sdk/plugins";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";

const actionParamValueSchema = z.union([z.string(), z.record(z.string(), z.string())]);

const executeActionInputSchema = z.object({
  target_type: z.enum(["ticket", "workspace", "session"]),
  target_id: z.string(),
  params: z.record(z.string(), actionParamValueSchema).optional(),
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
  return deps.workspaceService.get(targetId);
};

const resolvePrompts = async (deps: RouteDeps, projectId: string) => {
  const templates = await deps.templateService.list(projectId);
  const promptTemplates = templates.filter((template) => template.template_type === "prompt");

  const promptEntries = await Promise.all(
    promptTemplates.map(async (template) => {
      const file = await deps.fileService.get(template.file_id);
      if (!file) return null;

      try {
        return [template.name, readFileSync(file.storage_path, "utf8")] as const;
      } catch {
        return null;
      }
    }),
  );

  return Object.fromEntries(promptEntries.filter((entry) => entry !== null));
};

export const executeActionHandler = (deps: RouteDeps): AppRouteHandler<typeof executeActionRoute> => {
  return async (c) => {
    const { projectId, actionKey } = c.req.valid("param");
    const { target_type, target_id, params: paramValues } = c.req.valid("json");

    const runtime = await deps.pluginService.getForProject(projectId);
    const action = runtime.actions.get(actionKey);

    if (!action) {
      return c.json({ error: "Action not found" }, 404);
    }

    const target = await resolveTarget(deps, target_type, target_id);
    const prompts = await resolvePrompts(deps, projectId);

    const ctx = {
      client: runtime.client,
      projectId,
      prompts,
      params: paramValues ?? {},
      targetType: target_type,
      targetId: target_id,
      target,
    } as ActionTriggerContext;

    try {
      const result = await action.trigger(ctx);
      const sessionId = result?.session_id;

      return c.json({ status: "success" as const, ...(sessionId ? { session_id: sessionId } : {}) }, 200);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Action execution failed";
      return c.json({ status: "error" as const, message }, 200);
    }
  };
};
