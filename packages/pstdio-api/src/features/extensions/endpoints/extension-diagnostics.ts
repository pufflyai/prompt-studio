import { join } from "node:path";
import { createRoute, z } from "@hono/zod-openapi";
import { extensionDiagnosticsResponseSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { ExtensionsRouteDeps } from "../deps";
import { checkExtensionsRoot, resolvePstdioHome } from "../install-extension-source";

export const extensionDiagnosticsRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/extensions/diagnostics",
  tags: ["Extensions"],
  request: {
    params: z.object({ projectId: z.string() }).strict(),
    query: z.object({ scope: z.enum(["user", "repo"]).optional() }).strict(),
  },
  responses: {
    200: {
      description: "Checks of this host's installed roots.",
      content: { "application/json": { schema: extensionDiagnosticsResponseSchema } },
    },
    404: {
      description: "Project not found.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
    409: {
      description: "Project has no local folder.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
  },
});
export const extensionDiagnosticsHandler =
  (deps: ExtensionsRouteDeps): AppRouteHandler<typeof extensionDiagnosticsRoute> =>
  async (c) => {
    const { projectId } = c.req.valid("param");
    const { scope } = c.req.valid("query");
    const workspace = await deps.workspaceService.getDefault(projectId);
    if (!workspace) return c.json({ error: "Project not found." }, 404);
    const projectFolder = workspace.execution_kind === "local" ? workspace.root_path : null;
    if (scope === "repo" && !projectFolder) return c.json({ error: "This project has no local folder." }, 409);
    const roots = [];
    if (scope !== "repo") {
      const path = join(resolvePstdioHome({ env: process.env }), "extensions");
      roots.push({ scope: "user" as const, path, check: await checkExtensionsRoot(path) });
    }
    if (scope !== "user" && projectFolder) {
      const path = join(projectFolder, ".pstdio", "extensions");
      roots.push({ scope: "repo" as const, path, check: await checkExtensionsRoot(path) });
    }
    return c.json({ roots }, 200);
  };
