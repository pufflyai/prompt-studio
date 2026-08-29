import type { createExtensionInstancesDBService } from "pstdio-db";

type ProjectInstanceRecord = {
  instance: { id: string; enabled: boolean };
  installedSource: { id: string; extension_id: string };
};

type ExtensionIdOwnershipDeps = {
  extensionInstancesService: Pick<ReturnType<typeof createExtensionInstancesDBService>, "update">;
  emitExtensionInstance: (instance: unknown) => void;
};

// A project runs one source per manifest extension id. Command execution, webview metadata and the
// extension panel all resolve an extension by that id, so a second enabled source claiming the same
// id lets them answer differently. Accepting a source takes the id from whoever held it before, which
// makes the source the project accepted last its only provider.
export const takeExtensionIdOwnership = async (
  deps: ExtensionIdOwnershipDeps,
  input: {
    extensionId: string;
    installedSourceId: string;
    projectInstances: readonly ProjectInstanceRecord[];
  },
) => {
  const displaced = input.projectInstances.filter(
    (record) =>
      record.instance.enabled &&
      record.installedSource.extension_id === input.extensionId &&
      record.installedSource.id !== input.installedSourceId,
  );

  for (const record of displaced) {
    const updated = await deps.extensionInstancesService.update(record.instance.id, { enabled: false });
    if (updated) deps.emitExtensionInstance(updated);
  }

  return displaced.map((record) => record.instance.id);
};
