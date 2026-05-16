import { createRoute, z } from "@hono/zod-openapi";
import { settingsSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { SettingsRouteDeps } from "../deps";

export const getSettingsRoute = createRoute({
  method: "get",
  path: "/settings",
  description: "Get global Prompt Studio settings.",
  tags: ["Settings"],
  request: {
    query: z.object({}).strict(),
  },
  responses: {
    200: {
      description: "Global settings.",
      content: { "application/json": { schema: settingsSchema } },
    },
  },
});

export const getSettingsHandler = (deps: SettingsRouteDeps): AppRouteHandler<typeof getSettingsRoute> => {
  return async (c) => c.json(await deps.settingsService.get(), 200);
};
