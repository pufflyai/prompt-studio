import { resolveCollectionIndexes } from "pstdio-api-contracts";
import type { createExtensionStorageDBService } from "pstdio-db";
import type { ExtensionRuntime } from "pstdio-extensions";
import { activityStorageOwner, resourceActivityIndexes } from "../activity/resource-activity-store";

export type ExtensionStorageIndexService = Pick<ReturnType<typeof createExtensionStorageDBService>, "installIndexes">;

/** Register query definitions before exposing commands, including after receiving a migration version. */
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
    [
      ...runtime.extensions.map((extension) => ({
        owner: { workbenchId: projectId, extensionId: extension.id },
        definitions: resolveCollectionIndexes(extension.definition.storageIndexes ?? [], "project", projectId),
      })),
      ...(runtime.resourceKinds.some(({ contribution }) => Object.values(contribution.activity ?? {}).some(Boolean))
        ? [{ owner: activityStorageOwner(projectId), definitions: resourceActivityIndexes, hostManaged: true }]
        : []),
    ],
    validate,
  );
};
