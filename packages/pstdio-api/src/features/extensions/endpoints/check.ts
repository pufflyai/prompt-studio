import { createRoute } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { runExtensionsCheck } from "../check-extensions";
import { extensionsCheckOpenApiResponseSchema, extensionsCheckQuerySchema } from "../dto";

export const checkExtensionsRoute = createRoute({
  method: "get",
  path: "/extensions/check",
  description: "Discover installed extensions and report registry diagnostics.",
  tags: ["Extensions"],
  request: {
    query: extensionsCheckQuerySchema,
  },
  responses: {
    200: {
      description: "Extensions check report.",
      content: { "application/json": { schema: extensionsCheckOpenApiResponseSchema } },
    },
  },
});

export const checkExtensionsHandler = (deps: RouteDeps): AppRouteHandler<typeof checkExtensionsRoute> => {
  return async (c) => {
    const response = await runExtensionsCheck(deps.extensionService);
    return c.json(response, 200);
  };
};
