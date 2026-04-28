import { createRoute, z } from "@hono/zod-openapi";
import { ExtensionActionNotFoundError } from "../../../services/extension-action-service";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";

const actionParamValueSchema = z.union([
  z.string(),
  z.boolean(),
  z.number(),
  z.record(z.string(), z.unknown()),
  z.null(),
]);
const actionTargetTypeSchema = z.string().min(1);

const executeActionInputSchema = z.object({
  target_type: actionTargetTypeSchema,
  target_id: z.string(),
  params: z.record(z.string(), actionParamValueSchema).optional(),
});

const actionResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("success"), session_id: z.string().optional(), message: z.string().optional() }),
  z.object({ status: z.literal("error"), message: z.string() }),
]);

export const executeActionRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/actions/{actionKey}/execute",
  description: "Execute an extension command action.",
  tags: ["Actions"],
  request: {
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
        actionKey: z.string().openapi({ description: "Extension command action key" }),
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

export const executeActionHandler = (deps: RouteDeps): AppRouteHandler<typeof executeActionRoute> => {
  return async (c) => {
    const { projectId, actionKey } = c.req.valid("param");
    const { target_type, target_id, params: paramValues } = c.req.valid("json");

    try {
      const result = await deps.extensionActionService.execute({
        projectId,
        actionKey,
        targetType: target_type,
        targetId: target_id,
        params: paramValues,
      });
      const resultRecord = result && typeof result === "object" ? (result as Record<string, unknown>) : undefined;
      const sessionId = typeof resultRecord?.session_id === "string" ? resultRecord.session_id : undefined;
      const message = typeof resultRecord?.message === "string" ? resultRecord.message : undefined;

      return c.json(
        {
          status: "success" as const,
          ...(sessionId ? { session_id: sessionId } : {}),
          ...(message ? { message } : {}),
        },
        200,
      );
    } catch (err) {
      if (err instanceof ExtensionActionNotFoundError) {
        return c.json({ error: "Action not found" }, 404);
      }

      const message = err instanceof Error ? err.message : "Action execution failed";
      return c.json({ status: "error" as const, message }, 200);
    }
  };
};
