import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema, skillResponseSchema } from "../dto";

const createSetSkillDefaultEnabledRoute = (enabled: boolean) =>
  createRoute({
    method: "post",
    path: `/projects/{projectId}/skills/{name}/${enabled ? "enable" : "disable"}`,
    description: `${enabled ? "Enable" : "Disable"} an extension skill default for a project.`,
    tags: ["Skills"],
    request: {
      query: z.object({}).strict(),
      params: z
        .object({
          projectId: z.string().openapi({ description: "Project ID" }),
          name: z.string().openapi({ description: "Extension skill name" }),
        })
        .strict(),
    },
    responses: {
      200: {
        description: `Skill default ${enabled ? "enabled" : "disabled"}.`,
        content: { "application/json": { schema: skillResponseSchema } },
      },
      404: {
        description: "Extension skill not found.",
        content: { "application/json": { schema: notFoundResponseSchema } },
      },
    },
  });

export const enableSkillDefaultRoute = createSetSkillDefaultEnabledRoute(true);
export const disableSkillDefaultRoute = createSetSkillDefaultEnabledRoute(false);

const createSetSkillDefaultEnabledHandler =
  (deps: RouteDeps, enabled: boolean): AppRouteHandler<typeof enableSkillDefaultRoute> =>
  async (c) => {
    const { projectId, name } = c.req.valid("param");
    const skill = await deps.skillRegistryService.setDefaultEnabled(projectId, name, enabled);

    if (!skill) {
      return c.json({ error: `Extension skill not found: ${name}` }, 404);
    }

    return c.json(skill, 200);
  };

export const enableSkillDefaultHandler = (deps: RouteDeps) => createSetSkillDefaultEnabledHandler(deps, true);
export const disableSkillDefaultHandler = (deps: RouteDeps) => createSetSkillDefaultEnabledHandler(deps, false);
