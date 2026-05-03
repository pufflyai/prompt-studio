import { createRoute, z } from "@hono/zod-openapi";
import { copyExtensionSkillInputSchema, skillSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { conflictResponseSchema, notFoundResponseSchema } from "../dto";
import { copyExtensionSkill } from "../registry/copy-extension-skill";

export const copyExtensionSkillRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/skills/extension/{extensionId}/{skillKey}/copy",
  description: "Copy an extension skill default into a project-owned editable skill.",
  tags: ["Skills"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
        extensionId: z.string().openapi({ description: "Extension ID" }),
        skillKey: z.string().openapi({ description: "Extension skill key" }),
      })
      .strict(),
    body: {
      content: { "application/json": { schema: copyExtensionSkillInputSchema.strict().optional() } },
    },
  },
  responses: {
    201: {
      description: "Extension skill copied to project-owned variation.",
      content: { "application/json": { schema: skillSchema } },
    },
    404: {
      description: "Extension skill not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
    409: {
      description: "Project skill name conflict.",
      content: { "application/json": { schema: conflictResponseSchema } },
    },
    422: {
      description: "Extension skill asset is unreadable.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const copyExtensionSkillHandler =
  (deps: RouteDeps): AppRouteHandler<typeof copyExtensionSkillRoute> =>
  async (c) => {
    const { projectId, extensionId, skillKey } = c.req.valid("param");
    const body = c.req.valid("json") ?? {};
    const result = await copyExtensionSkill(deps, {
      projectId,
      extensionId,
      skillKey,
      name: body.name,
    });

    if (!result.ok) {
      if (result.error === "extension_skill_not_found") {
        return c.json({ error: result.message }, 404);
      }
      if (result.error === "name_conflict") {
        return c.json({ error: result.message }, 409);
      }
      return c.json({ error: result.message }, 422);
    }

    return c.json(result.skill, 201);
  };
