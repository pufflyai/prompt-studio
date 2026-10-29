import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { onboardingInfoSchema, onboardingStateSchema, updateOnboardingSchema } from "pstdio-api-contracts";
import type { AppBindings } from "../../types";
import type { RouteDeps } from "../deps";
import { detectOnboardingHarnesses } from "./detect-harnesses";
import { getInstalledOnboardingSources } from "./installed-extensions";

export const createOnboardingRoutes = (
  deps: Pick<RouteDeps, "onboarding"> & {
    installedExtensionSourcesService: Pick<RouteDeps["installedExtensionSourcesService"], "list">;
    projectService: Pick<RouteDeps["projectService"], "get">;
  },
) => {
  const routes = new OpenAPIHono<AppBindings>();
  routes.openapi(
    createRoute({
      method: "get",
      path: "/onboarding",
      tags: ["Setup"],
      responses: {
        200: {
          description: "Saved setup choices and detected harnesses.",
          content: { "application/json": { schema: onboardingInfoSchema } },
        },
      },
    }),
    async (c) => {
      const state = await deps.onboarding.read();
      return c.json(
        {
          state,
          installedExtensions: [
            ...new Set(
              (await getInstalledOnboardingSources(deps.installedExtensionSourcesService)).map(
                (source) => source.extension_id,
              ),
            ),
          ],
          detectedHarnesses: state.hidden ? [] : await detectOnboardingHarnesses(),
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
      request: {
        query: z.object({ project_id: z.string().uuid().optional() }).strict(),
        body: { required: true, content: { "application/json": { schema: updateOnboardingSchema } } },
      },
      responses: {
        404: {
          description: "Project not found.",
          content: { "application/json": { schema: z.object({ error: z.string() }) } },
        },
        200: {
          description: "Saved setup; installation continues in the background.",
          content: { "application/json": { schema: onboardingStateSchema } },
        },
      },
    }),
    async (c) => {
      const { project_id: projectId } = c.req.valid("query");
      if (projectId && !(await deps.projectService.get(projectId))) return c.json({ error: "Project not found" }, 404);
      return c.json(await deps.onboarding.update(c.req.valid("json"), projectId), 200);
    },
  );
  return routes;
};
