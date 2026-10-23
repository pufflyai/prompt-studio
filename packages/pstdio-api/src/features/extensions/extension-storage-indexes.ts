import type { createExtensionStorageDBService } from "pstdio-db";
import type { ExtensionRuntime } from "pstdio-extensions";

export type ExtensionStorageIndexService = Pick<ReturnType<typeof createExtensionStorageDBService>, "installIndexes">;

/** Local indexes must exist before commands become visible, even after receiving a migration version. */
export const installExtensionStorageIndexes = async (
  service: ExtensionStorageIndexService | undefined,
  projectId: string,
  runtime: ExtensionRuntime,
  validate: () => void = () => {},
) => {
  if (!service) {
    if (runtime.extensions.some((extension) => extension.definition.storageIndexes?.length))
      throw new Error("Extension storage index installation is unavailable");
    validate();
    return;
  }
  await service.installIndexes(
    runtime.extensions.map((extension) => ({
      owner: { workbenchId: projectId, extensionId: extension.id },
      definitions: extension.definition.storageIndexes ?? [],
    })),
    validate,
  );
};
