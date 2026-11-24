import { join } from "node:path";
import { createRoute, z } from "@hono/zod-openapi";
import { apiLogger } from "../../../lib/logger";
import type { AppRouteHandler } from "../../../types";
import { resolvePstdioHome } from "../../extensions/install-extension-source";
import { removeProjectAfterProvisioning } from "../../workspaces/provision-coordinator";
import { cleanupProjectArtifacts } from "../cleanup-project";
import type { ProjectsRouteDeps } from "../deps";
import { notFoundResponseSchema } from "../dto";
import { withFolderCreation } from "../project-folder";

export const removeProjectRoute = createRoute({
  method: "delete",
  path: "/projects/{id}",
  description: "Delete project data and provider-owned resources. Preserve user-selected folders.",
  tags: ["Projects"],
  request: {
    query: z.object({}).strict(),
    params: z
      .object({
        id: z.string().openapi({ description: "Project ID" }),
      })
      .strict(),
  },
  responses: {
    204: {
      description: "Project deleted.",
    },
    404: {
      description: "Project not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
    409: {
      description: "The project syncs with the account. Make it local first.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const removeProjectHandler = (deps: ProjectsRouteDeps): AppRouteHandler<typeof removeProjectRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");

    const project = await deps.projectService.get(id);
    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    // Every device of the account gets every cloud project, so the next account refresh would bring it back.
    await deps.accountService.refresh();
    const account = await deps.accountService.status();
    const teamAccountId = account.teamProjectOwners?.[id];
    if ((account.login === null && account.signInRequired) || (account.login && !account.cloudProjectsLoaded))
      return c.json({ error: "Connect to Cloud so this device can check which projects it syncs." }, 409);
    if (account.cloudProjects.includes(id) || account.teamProjects?.[id])
      return c.json(
        { error: "This project syncs with your Cloud account. Make it local in Cloud settings before deleting it." },
        409,
      );

    if (teamAccountId && !(await deps.accountService.catalogProjects(teamAccountId)).membershipKnown)
      return c.json(
        { error: "Connect to the owning Cloud team to check this project's copy before deleting it." },
        409,
      );

    const home = await deps.workspaceService.getDefault(id);
    return withFolderCreation(home?.root_path ?? null, async () => {
      const removeConnectionSecrets = await removeProjectAfterProvisioning(deps, id, async () => {
        await cleanupProjectArtifacts(deps, id, {
          removeProjectStorage: deps.fileService.removeProjectStorage,
        });
        const removeSecrets = await deps.extensionConnectionService.prepareProjectRemoval(id);
        await deps.projectService.delete(id);
        return removeSecrets;
      });
      // The project's own extensions were installed from its folder. Without an instance they would
      // stay installed, watched and rebuilt for every later project in this runtime. A project in the
      // home folder shares that folder with the user's installed extensions, which it does not own.
      const folderExtensions = home?.root_path ? join(home.root_path, ".pstdio", "extensions") : null;
      if (folderExtensions && folderExtensions !== join(resolvePstdioHome({ env: process.env }), "extensions")) {
        try {
          await deps.extensionService.removeUnusedFolderSources(folderExtensions);
        } catch (error) {
          apiLogger.error(
            { err: error, event: "extension.project_source_cleanup.failed", projectId: id },
            "Extensions from the deleted project's folder stay installed",
          );
        }
      }
      try {
        await removeConnectionSecrets();
      } catch (error) {
        apiLogger.error(
          { err: error, event: "extension.project_secret_cleanup.deferred", projectId: id },
          "Project connection secret cleanup will retry at startup",
        );
      }
      return c.body(null, 204);
    });
  };
};
