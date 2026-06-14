import { existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { createRoute, z } from "@hono/zod-openapi";
import { enableInstalledExtensionRequestSchema, enableInstalledExtensionResponseSchema } from "pstdio-api-contracts";
import { ExtensionNameConflictError, ProjectNotFoundError } from "../../../services/extension-service";
import type { AppRouteHandler } from "../../../types";
import { installProjectSkillsToRepo } from "../../skills/install-skill-to-repo";
import type { ExtensionsRouteDeps } from "../deps";
import { resolvePstdioHome } from "../install-extension-source";
import { nameFromSource } from "../project-extension-instance";

const errorSchema = z.object({ error: z.string() });

export const enableInstalledExtensionRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/extensions/installed/{installName}/enable",
  description: "Enable an installed extension source for a project.",
  tags: ["Extensions"],
  request: {
    params: z
      .object({
        installName: z.string().openapi({ description: "Installed extension folder name" }),
        projectId: z.string().openapi({ description: "Project ID" }),
      })
      .strict(),
    body: {
      content: { "application/json": { schema: enableInstalledExtensionRequestSchema } },
    },
  },
  responses: {
    200: {
      description: "Extension enabled.",
      content: { "application/json": { schema: enableInstalledExtensionResponseSchema } },
    },
    404: {
      description: "Project not found.",
      content: { "application/json": { schema: errorSchema } },
    },
    409: {
      description: "Extension name conflict.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

// The client may run against a different PSTDIO_HOME than this host (e.g. pst with
// PSTDIO_HOME=~/.pstdio-dev talking to a ~/.pstdio serve). Registering that foreign
// path would make this host load extensions from another setup, so the host's own
// installed copy wins and managed sources from other homes are rejected.
const resolveOwnedSourcePath = (
  installName: string,
  requestedPath: string,
): { ok: true; sourcePath: string } | { ok: false; error: string } => {
  const home = resolve(resolvePstdioHome({ env: process.env }));
  const ownCopy = join(home, "extensions", installName);
  if (existsSync(join(ownCopy, "package.json"))) return { ok: true, sourcePath: ownCopy };

  const requested = resolve(requestedPath);
  const extensionsRoot = dirname(requested);
  const homeCandidate = dirname(extensionsRoot);
  const isForeignManagedSource =
    basename(extensionsRoot) === "extensions" && homeCandidate !== home && existsSync(join(homeCandidate, "pstdio.db"));

  if (isForeignManagedSource) {
    return {
      ok: false,
      error: `Extension source ${requested} belongs to a different PSTDIO_HOME (${homeCandidate}); this host uses ${home}. Install it with the host's PSTDIO_HOME first.`,
    };
  }

  return { ok: true, sourcePath: requested };
};

export const enableInstalledExtensionHandler = (
  deps: ExtensionsRouteDeps,
): AppRouteHandler<typeof enableInstalledExtensionRoute> => {
  return async (c) => {
    const { installName, projectId } = c.req.valid("param");
    const body = c.req.valid("json");

    const owned = resolveOwnedSourcePath(installName, body.sourcePath);
    if (!owned.ok) return c.json({ error: owned.error }, 409);

    try {
      const result = await deps.extensionService.enableInstalledSourceForProject({
        projectId,
        installName,
        displayName: body.displayName,
        extensionId: body.extensionId,
        manifest: body.manifest,
        name: body.name,
        sourceHash: body.sourceHash,
        sourceKind: body.sourceKind,
        sourcePath: owned.sourcePath,
        sourceRef: body.sourceRef,
        version: body.version,
      });

      const repos = await deps.repoService.listByProject(projectId);
      for (const repo of repos) {
        await installProjectSkillsToRepo(deps, { projectId, repoPath: repo.path });
      }

      return c.json(
        {
          enabled: true as const,
          installName,
          installedExtensionId: result.installedSource.id,
          instanceId: result.instance.id,
          name: nameFromSource(result.installedSource),
          projectId,
        },
        200,
      );
    } catch (error) {
      if (error instanceof ProjectNotFoundError) return c.json({ error: error.message }, 404);
      if (error instanceof ExtensionNameConflictError) return c.json({ error: error.message }, 409);
      throw error;
    }
  };
};
