import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { onboardingInfoSchema, onboardingStateSchema, updateOnboardingSchema } from "pstdio-api-contracts";
import type { AppBindings } from "../../types";
import type { RouteDeps } from "../deps";
import { detectOnboardingHarnesses } from "./detect-harnesses";

export const createOnboardingRoutes = (deps: Pick<RouteDeps, "onboarding">) => {
  const routes = new OpenAPIHono<AppBindings>();
  routes.openapi(
    createRoute({
      method: "get",
      path: "/onboarding",
      tags: ["Setup"],
      responses: {
        200: {
          description: "First-launch choices and detected harnesses.",
          content: { "application/json": { schema: onboardingInfoSchema } },
        },
      },
    }),
    async (c) => {
      const state = await deps.onboarding.read();
      return c.json(
        {
          state,
          detectedHarnesses: state.completed || state.hidden ? [] : await detectOnboardingHarnesses(),
          platform: process.platform,
        },
        200,
      );
    },
  );
  routes.openapi(
    createRoute({
      method: "patch",
      path: "/onboarding",
      tags: ["Setup"],
      request: { body: { required: true, content: { "application/json": { schema: updateOnboardingSchema } } } },
      responses: {
        200: {
          description: "Saved setup; installation continues in the background.",
          content: { "application/json": { schema: onboardingStateSchema } },
        },
      },
    }),
    async (c) => c.json(await deps.onboarding.update(c.req.valid("json")), 200),
  );
  return routes;
};
