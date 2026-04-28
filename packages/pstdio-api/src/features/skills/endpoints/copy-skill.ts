import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { conflictResponseSchema, copySkillBodySchema, notFoundResponseSchema, skillResponseSchema } from "../dto";

export const copySkillRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/skills/{name}/copy",
  description: "Copy an extension skill default into a project-owned skill.",
  tags: ["Skills"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
        name: z.string().openapi({ description: "Extension skill name" }),
      })
      .strict(),
    body: {
      content: { "application/json": { schema: copySkillBodySchema } },
    },
  },
  responses: {
    201: {
      description: "Skill copied.",
      content: { "application/json": { schema: skillResponseSchema } },
    },
    404: {
      description: "Extension skill not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
    409: {
      description: "Project skill already exists.",
      content: { "application/json": { schema: conflictResponseSchema } },
    },
  },
});

export const copySkillHandler = (deps: RouteDeps): AppRouteHandler<typeof copySkillRoute> => {
  return async (c) => {
    const { projectId, name } = c.req.valid("param");
    const body = c.req.valid("json");
    const result = await deps.skillRegistryService.copyDefault(projectId, name, body);

    if ("error" in result) {
      if (result.error === "conflict") {
        return c.json({ error: `Skill already exists: ${body.name}` }, 409);
      }

      return c.json({ error: `Extension skill not found: ${name}` }, 404);
    }

    return c.json(result.skill, 201);
  };
};
