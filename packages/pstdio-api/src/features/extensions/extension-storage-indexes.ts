import type { createExtensionStorageDBService } from "pstdio-db";
import type { ExtensionRuntime } from "pstdio-extensions";

export type ExtensionStorageIndexService = Pick<ReturnType<typeof createExtensionStorageDBService>, "open">;

/** Local indexes must exist before commands become visible, even after receiving a migration version. */
export const installExtensionStorageIndexes = async (
  service: ExtensionStorageIndexService | undefined,
  projectId: string,
  runtime: ExtensionRuntime,
) => {
  for (const extension of runtime.extensions) {
    const definitions = extension.definition.storageIndexes;
    if (!service) {
      if (definitions?.length) throw new Error("Extension storage index installation is unavailable");
      continue;
    }
    const storage = await service.open({ owner: { workbenchId: projectId, extensionId: extension.id } });
    await storage.records.defineIndexes(definitions ?? []);
  }
};
