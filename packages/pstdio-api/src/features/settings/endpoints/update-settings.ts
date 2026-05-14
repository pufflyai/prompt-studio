import { createRoute } from "@hono/zod-openapi";
import { settingsSchema, updateSettingsInputSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { SettingsRouteDeps } from "../deps";

export const updateSettingsRoute = createRoute({
  method: "patch",
  path: "/settings",
  description: "Update global Prompt Studio settings.",
  tags: ["Settings"],
  request: {
    body: {
      content: { "application/json": { schema: updateSettingsInputSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Updated global settings.",
      content: { "application/json": { schema: settingsSchema } },
    },
  },
});

export const updateSettingsHandler = (deps: SettingsRouteDeps): AppRouteHandler<typeof updateSettingsRoute> => {
  return async (c) => c.json(await deps.settingsService.update(c.req.valid("json")), 200);
};
