import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema, templateResponseSchema } from "../dto";

const createSetTemplateDefaultEnabledRoute = (enabled: boolean) =>
  createRoute({
    method: "post",
    path: `/projects/{projectId}/templates/{name}/${enabled ? "enable" : "disable"}`,
    description: `${enabled ? "Enable" : "Disable"} an extension template default for a project.`,
    tags: ["Templates"],
    request: {
      query: z.object({}).strict(),
      params: z
        .object({
          projectId: z.string().openapi({ description: "Project ID" }),
          name: z.string().openapi({ description: "Extension template name" }),
        })
        .strict(),
    },
    responses: {
      200: {
        description: `Template default ${enabled ? "enabled" : "disabled"}.`,
        content: { "application/json": { schema: templateResponseSchema } },
      },
      404: {
        description: "Extension template not found.",
        content: { "application/json": { schema: notFoundResponseSchema } },
      },
    },
  });

export const enableTemplateDefaultRoute = createSetTemplateDefaultEnabledRoute(true);
export const disableTemplateDefaultRoute = createSetTemplateDefaultEnabledRoute(false);

const createSetTemplateDefaultEnabledHandler =
  (deps: RouteDeps, enabled: boolean): AppRouteHandler<typeof enableTemplateDefaultRoute> =>
  async (c) => {
    const { projectId, name } = c.req.valid("param");
    const template = await deps.templateRegistryService.setDefaultEnabled(projectId, name, enabled);

    if (!template) {
      return c.json({ error: `Extension template not found: ${name}` }, 404);
    }

    return c.json(template, 200);
  };

export const enableTemplateDefaultHandler = (deps: RouteDeps) => createSetTemplateDefaultEnabledHandler(deps, true);
export const disableTemplateDefaultHandler = (deps: RouteDeps) => createSetTemplateDefaultEnabledHandler(deps, false);
