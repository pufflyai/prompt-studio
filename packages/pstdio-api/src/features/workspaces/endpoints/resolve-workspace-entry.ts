import { createRoute, z } from "@hono/zod-openapi";
import { workspaceResolvedEntrySchema } from "pstdio-api-contracts";
import { createWorkspaceFilesMount, WorkspaceFileAccessError } from "pstdio-extensions";
import type { AppRouteHandler } from "../../../types";
import type { WorkspacesRouteDeps } from "../deps";
import { resolveWorkspaceExecutionTarget } from "../workspace-provider-execution-target";

export const resolveWorkspaceEntryRoute = createRoute({
  method: "get",
  path: "/workspaces/{id}/entry",
  tags: ["Workspaces"],
  description: "Resolve an existing local workspace entry for host file integration.",
  request: { params: z.object({ id: z.string() }), query: z.object({ path: z.string().min(1) }).strict() },
  responses: {
    200: {
      description: "Resolved local entry.",
      content: { "application/json": { schema: workspaceResolvedEntrySchema } },
    },
    404: {
      description: "Entry unavailable.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
  },
});

export const resolveWorkspaceEntryHandler =
  (deps: WorkspacesRouteDeps): AppRouteHandler<typeof resolveWorkspaceEntryRoute> =>
  async (c) => {
    c.req.raw.signal.throwIfAborted();
    const target = await resolveWorkspaceExecutionTarget(deps, c.req.valid("param").id, "files:read");
    if (!target) return c.json({ error: "Local workspace files are unavailable." }, 404);
    try {
      const entry = await createWorkspaceFilesMount(target.root).resolveEntryPath(c.req.valid("query").path);
      c.req.raw.signal.throwIfAborted();
      return c.json(entry, 200);
    } catch (error) {
      if (
        error instanceof WorkspaceFileAccessError ||
        (error instanceof Error && (error.message.includes("escapes mount root") || "code" in error))
      )
        return c.json({ error: "Workspace entry is unavailable." }, 404);
      throw error;
    }
  };
