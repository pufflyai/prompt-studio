import { createRoute, z } from "@hono/zod-openapi";
import { extensionSkillContentSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema } from "../dto";
import { findExtensionSkill, readExtensionSkillFiles } from "../registry/extension-content";

export const getExtensionSkillContentRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/skills/extension/{extensionId}/{skillKey}/content",
  description: "Read the read-only file contents of an extension-provided skill default.",
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
  },
  responses: {
    200: {
      description: "Extension skill content.",
      content: { "application/json": { schema: extensionSkillContentSchema } },
    },
    404: {
      description: "Extension skill not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
    422: {
      description: "Extension skill asset is unreadable.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const getExtensionSkillContentHandler =
  (deps: RouteDeps): AppRouteHandler<typeof getExtensionSkillContentRoute> =>
  async (c) => {
    const { extensionId, skillKey } = c.req.valid("param");
    const lookup = await findExtensionSkill(deps, extensionId, skillKey);
    if (!lookup.ok) {
      const status = lookup.assetMissing ? 422 : 404;
      return c.json(
        {
          error: lookup.assetMissing
            ? `Extension skill asset is missing or unreadable: ${extensionId}.${skillKey}`
            : `Extension skill not found: ${extensionId}.${skillKey}`,
        },
        status,
      );
    }
    try {
      const files = await readExtensionSkillFiles(lookup.resolved);
      return c.json(
        {
          extensionId,
          skillKey,
          title: lookup.resolved.record.contribution.title,
          files,
        },
        200,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ error: `Cannot read extension skill asset: ${message}` }, 422);
    }
  };
