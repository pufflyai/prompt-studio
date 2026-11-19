import { join, resolve } from "node:path";
import { resolvePstdioHome } from "pstdio-paths";
import type { RouteDeps } from "../features/deps";

/** The extracted tool replaces the default Terminal that existing projects already had. */
export const adoptTerminalTool = async (deps: RouteDeps, projectIds: string[], signal?: AbortSignal) => {
  if (!projectIds.length) return;
  const source = await deps.extensionService.getInstalledSource("pstdio-terminal");
  if (
    !source ||
    source.extension_id !== "pstdio.pstdio-terminal" ||
    resolve(source.source_path) !== join(resolvePstdioHome(), "extensions", "pstdio-terminal")
  )
    return;
  for (const projectId of projectIds) {
    signal?.throwIfAborted();
    await deps.extensionService.adoptDefaultSourceForProject(projectId, source.id);
  }
};
