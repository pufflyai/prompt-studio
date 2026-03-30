import { createRoute, z } from "@hono/zod-openapi";
import { listBranches } from "pstdio-wt";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema } from "../dto";

const branchResponseSchema = z.object({
  name: z.string(),
  is_current: z.boolean(),
  is_remote: z.boolean(),
  last_commit_date: z.string(),
});

export const listRepoBranchesRoute = createRoute({
  method: "get",
  path: "/repos/{repoId}/branches",
  description: "List branches for a repository.",
  tags: ["Projects"],
  request: {
    params: z
      .object({
        repoId: z.string().openapi({ description: "Repository ID" }),
      })
      .strict(),
  },
  responses: {
    200: {
      description: "List of branches.",
      content: { "application/json": { schema: z.array(branchResponseSchema) } },
    },
    404: {
      description: "Repository not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const listRepoBranchesHandler = (deps: RouteDeps): AppRouteHandler<typeof listRepoBranchesRoute> => {
  return async (c) => {
    const { repoId } = c.req.valid("param");

    const repo = await deps.repoService.get(repoId);
    if (!repo) {
      return c.json({ error: "Repository not found" }, 404);
    }

    const branches = await listBranches(repo.path);

    return c.json(
      branches.map((b) => ({
        name: b.name,
        is_current: b.isCurrent,
        is_remote: b.isRemote,
        last_commit_date: b.lastCommitDate,
      })),
      200,
    );
  };
};
