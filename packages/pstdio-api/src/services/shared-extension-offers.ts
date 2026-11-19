import { existsSync, lstatSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { createExtensionInstancesDBService, createInstalledExtensionSourcesDBService } from "pstdio-db";
import { resolvePstdioHome } from "pstdio-paths";
import type { createExtensionSourceMutations } from "./extension-source-mutations";

const isSharedDirectory = (source: { source_path: string; status: string }) => {
  if (source.status !== "loaded" || dirname(resolve(source.source_path)) !== resolve(resolvePstdioHome(), "extensions"))
    return false;
  try {
    return lstatSync(source.source_path).isDirectory() && !existsSync(join(source.source_path, ".pstdio-installing"));
  } catch (error) {
    if (["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) return false;
    throw error;
  }
};

export const createSharedExtensionOffers =
  (deps: {
    sources: ReturnType<typeof createInstalledExtensionSourcesDBService>;
    instances: ReturnType<typeof createExtensionInstancesDBService>;
    mutateSource: ReturnType<typeof createExtensionSourceMutations>;
    emit: (instance: Awaited<ReturnType<ReturnType<typeof createExtensionInstancesDBService>["create"]>>) => void;
  }) =>
  async (input: { projectId: string; installedSourceId: string; signal?: AbortSignal }) => {
    const source = await deps.sources.get(input.installedSourceId);
    if (!source) return null;
    return deps.mutateSource(source.source_path, async () => {
      input.signal?.throwIfAborted();
      const current = await deps.sources.get(source.id);
      if (!current || !isSharedDirectory(current)) return null;
      const offered = await deps.instances.createProjectOffer(input.projectId, current.id, input.signal);
      if (!offered) return null;
      if (offered.created) deps.emit(offered.instance);
      return { installedSource: current, instance: offered.instance };
    });
  };
