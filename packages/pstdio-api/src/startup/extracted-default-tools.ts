import { join, resolve } from "node:path";
import { resolvePstdioHome } from "pstdio-paths";
import type { RouteDeps } from "../features/deps";

// Existing projects had these capabilities before they became installable extensions.
export const extractedDefaultTools = ["pstdio-terminal", "git-workspaces"] as const;

export const adoptExtractedDefaultTools = async (deps: RouteDeps, projectIds: string[], signal?: AbortSignal) => {
  if (!projectIds.length) return;
  for (const name of extractedDefaultTools) {
    const source = await deps.extensionService.getInstalledSource(name);
    if (
      !source ||
      source.extension_id !== `pstdio.${name}` ||
      resolve(source.source_path) !== join(resolvePstdioHome(), "extensions", name)
    )
      continue;
    for (const projectId of projectIds) {
      signal?.throwIfAborted();
      await deps.extensionService.adoptDefaultSourceForProject(projectId, source.id);
    }
  }
};
