import { boardDefaultSyncRow, boardViewSyncRow } from "pstdio-api-contracts";
import type {
  createExtensionInstancesDBService,
  createExtensionStorageDBService,
  createExtensionUserDataDBService,
  createInstalledExtensionSourcesDBService,
} from "pstdio-db";
import { runExtensionPreparation } from "../features/extensions/extension-preparation";

import type { EventBus } from "../features/sync/event-bus";

type UninstallProjectExtensionDeps = {
  extensionInstancesService: ReturnType<typeof createExtensionInstancesDBService>;
  installedExtensionSourcesService: ReturnType<typeof createInstalledExtensionSourcesDBService>;
  extensionUserDataService: ReturnType<typeof createExtensionUserDataDBService>;
  recovery: Pick<ReturnType<typeof createExtensionStorageDBService>["recovery"], "exclusive">;
  eventBus?: EventBus;
  notifyInstalledSourcesChanged: (sourcePath?: string) => Promise<void>;
};

type UninstallProjectExtensionInput = {
  instanceId: string;
  projectId: string;
  deleteUserData?: boolean;
};

const deleteInstanceData = async (deps: UninstallProjectExtensionDeps, instance: { id: string; scope_id: string }) => {
  // A restore running at the same time would write the deleted records back.
  const deleted = await deps.recovery.exclusive(instance.scope_id, () =>
    deps.extensionUserDataService.deleteForInstance(instance.id),
  );
  for (const row of deleted.boardViews) {
    deps.eventBus?.emit("board_views", "delete", boardViewSyncRow(row));
  }
  for (const row of deleted.boardDefaults)
    deps.eventBus?.emit("board_default_views", "delete", boardDefaultSyncRow(row));
};

export const uninstallProjectExtension = async (
  deps: UninstallProjectExtensionDeps,
  input: UninstallProjectExtensionInput,
) => {
  const instance = await deps.extensionInstancesService.get(input.instanceId);
  if (!instance) return null;
  if (instance.scope_type !== "project" || instance.scope_id !== input.projectId) return null;

  const installedSource = await deps.installedExtensionSourcesService.get(instance.installed_extension_id);
  if (!installedSource) return null;

  await runExtensionPreparation("source.remove", { sourcePath: installedSource.source_path });

  const instances = await deps.extensionInstancesService.list({ installed_extension_id: installedSource.id });
  let retainedData = false;
  for (const extensionInstance of instances) {
    if (extensionInstance.scope_type === "project")
      await deps.extensionInstancesService.recordProjectDefaultChoice(
        extensionInstance.scope_id,
        installedSource.extension_id,
      );
    if (input.deleteUserData) {
      await deleteInstanceData(deps, extensionInstance);
    } else if (await deps.extensionUserDataService.hasUserData(extensionInstance.id)) {
      // Preserve user data: keep a disabled instance so a reinstall to the same path restores it.
      const disabled = await deps.extensionInstancesService.update(extensionInstance.id, { enabled: false });
      if (disabled) deps.eventBus?.emit("extension_instances", "set", disabled);
      retainedData = true;
      continue;
    }

    const removed = await deps.extensionInstancesService.remove(extensionInstance.id);
    if (removed) {
      deps.eventBus?.emit("extension_instances", "delete", removed);
    }
  }

  // A retained instance still references the installed source, so it can only be removed once no
  // instance keeps user data behind.
  if (!retainedData && (await deps.installedExtensionSourcesService.remove(installedSource.id))) {
    deps.eventBus?.emit("installed_extension_sources", "delete", { id: installedSource.id });
  }
  await deps.notifyInstalledSourcesChanged();

  return { instance, installedSource, retainedData };
};
