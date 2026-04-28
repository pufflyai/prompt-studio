import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { harnessInfoListResponseSchema } from "../dto";

export const listHarnessInfoRoute = createRoute({
  method: "get",
  path: "/harnesses/info",
  description: "List known harness providers with availability status.",
  tags: ["Harnesses"],
  request: {
    query: z.object({ project_id: z.string().optional() }).strict(),
  },
  responses: {
    200: {
      description: "List of known harness providers with availability.",
      content: { "application/json": { schema: harnessInfoListResponseSchema } },
    },
  },
});

export const listHarnessInfoHandler = (deps: RouteDeps): AppRouteHandler<typeof listHarnessInfoRoute> => {
  return async (c) => {
    const { project_id } = c.req.valid("query");
    const providers = await deps.harnessProviderService.list(project_id);
    const harnesses = await Promise.all(
      providers.map(async (resolved) => {
        const availability = await deps.harnessProviderService.detect(resolved);
        return {
          id: resolved.provider.id,
          name: resolved.provider.label,
          extension_id: resolved.provider.extensionId,
          availability,
        };
      }),
    );

    return c.json(harnesses, 200);
  };
};
