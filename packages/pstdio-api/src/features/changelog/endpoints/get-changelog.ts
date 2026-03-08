import { createRoute, z } from "@hono/zod-openapi";
import { isChangelogServiceError } from "pstdio-storage";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";

const changelogChangeSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  link: z.string().optional(),
});

const changelogEntrySchema = z.object({
  version: z.string(),
  date: z.string(),
  title: z.string(),
  tags: z.array(z.string()).optional(),
  image: z.string().optional(),
  description: z.string().optional(),
  changes: z.array(changelogChangeSchema).optional(),
});

const changelogSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  entries: z.array(changelogEntrySchema),
});

export const getChangelogRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/changelog",
  description: "Get the changelog for a project.",
  tags: ["Changelog"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        projectId: z.string().openapi({ description: "Project ID" }),
      })
      .strict(),
  },
  responses: {
    200: {
      description: "Changelog entries.",
      content: { "application/json": { schema: changelogSchema } },
    },
    404: {
      description: "Changelog not found.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
  },
});

export const getChangelogHandler = (deps: RouteDeps): AppRouteHandler<typeof getChangelogRoute> => {
  return async (c) => {
    const { projectId } = c.req.valid("param");

    try {
      const changelog = await deps.changelogService.getChangelog(projectId);
      return c.json(changelog, 200);
    } catch (err) {
      if (isChangelogServiceError(err)) {
        return c.json({ error: err.message }, 404);
      }
      throw err;
    }
  };
};
