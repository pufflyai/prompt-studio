import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { harnessModelsListResponseSchema, notFoundResponseSchema } from "../dto";
import { toAgentId, toHarnessId } from "../harness-ids";

const harnessIdParamSchema = z
  .object({
    harnessId: z.string().min(1).openapi({ description: "Harness provider identifier" }),
  })
  .strict();

export const listHarnessModelsRoute = createRoute({
  method: "get",
  path: "/harnesses/{harnessId}/models",
  description: "List available models for a specific harness provider.",
  tags: ["Harnesses"],
  request: {
    query: z.object({ project_id: z.string().optional() }).strict(),
    params: harnessIdParamSchema,
  },
  responses: {
    200: {
      description: "List of available models.",
      content: { "application/json": { schema: harnessModelsListResponseSchema } },
    },
    404: {
      description: "Harness not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const listHarnessModelsHandler = (deps: RouteDeps): AppRouteHandler<typeof listHarnessModelsRoute> => {
  return async (c) => {
    const { harnessId } = c.req.valid("param");
    const { project_id } = c.req.valid("query");
    const resolvedHarnessId = toHarnessId(toAgentId(harnessId));
    const resolved = await deps.harnessProviderService.resolve(resolvedHarnessId, project_id);

    if (!resolved) {
      return c.json({ error: `Harness not found: ${resolvedHarnessId}` }, 404);
    }

    const models = await resolved.provider.listModels?.(resolved.context);
    return c.json(models ?? [], 200);
  };
};
