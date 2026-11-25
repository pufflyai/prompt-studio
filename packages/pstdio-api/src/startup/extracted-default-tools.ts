import { join, resolve } from "node:path";
import { resolvePstdioHome } from "pstdio-paths";
import type { RouteDeps } from "../features/deps";
import { reconcileProviderWorkspaces } from "../features/workspaces/workspace-provider-reconciliation";
import { ProjectNotFoundError } from "../services/extension-service";

// Existing projects had these capabilities before they became installable extensions.
export const extractedDefaultTools = ["pstdio-terminal", "git-workspaces"] as const;

export const adoptExtractedDefaultTools = async (
  deps: RouteDeps,
  projectIds: string[],
  signal?: AbortSignal,
  tools: readonly (typeof extractedDefaultTools)[number][] = extractedDefaultTools,
) => {
  if (!projectIds.length) return;
  for (const name of tools) {
    const source = await deps.extensionService.getInstalledSource(name);
    if (
      !source ||
      source.extension_id !== `pstdio.${name}` ||
      resolve(source.source_path) !== join(resolvePstdioHome(), "extensions", name)
    )
      continue;
    for (const projectId of projectIds) {
      signal?.throwIfAborted();
      const adopted = await deps.extensionService.adoptDefaultSourceForProject(projectId, source.id).catch((error) => {
        if (error instanceof ProjectNotFoundError && error.projectId === projectId) return null;
        throw error;
      });
      // The first recovery pass can finish before the new provider is available.
      if (adopted && name === "git-workspaces") await reconcileProviderWorkspaces(deps, projectId, { signal });
    }
  }
};
