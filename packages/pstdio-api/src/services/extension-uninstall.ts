import { rmSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import type {
  createExtensionInstancesDBService,
  createExtensionUserDataDBService,
  createInstalledExtensionSourcesDBService,
} from "pstdio-db";
import { resolvePstdioHome } from "../features/extensions/install-extension-source";
import type { EventBus } from "../features/sync/event-bus";

type UninstallProjectExtensionDeps = {
  extensionInstancesService: ReturnType<typeof createExtensionInstancesDBService>;
  installedExtensionSourcesService: ReturnType<typeof createInstalledExtensionSourcesDBService>;
  extensionUserDataService: ReturnType<typeof createExtensionUserDataDBService>;
  eventBus?: EventBus;
  notifyInstalledSourcesChanged: (sourcePath?: string) => Promise<void>;
};

type UninstallProjectExtensionInput = {
  instanceId: string;
  projectId: string;
  deleteUserData?: boolean;
};

const isManagedInstalledSourcePath = (sourcePath: string) => {
  const extensionsRoot = resolve(join(resolvePstdioHome({ env: process.env }), "extensions"));
  const resolvedSourcePath = resolve(sourcePath);
  const relativePath = relative(extensionsRoot, resolvedSourcePath);

  return relativePath.length > 0 && !relativePath.startsWith("..") && !isAbsolute(relativePath);
};

// Repo-local extensions live in `<repo>/.pstdio/extensions/<name>`; deleting the folder is the
// only removal that sticks, since repo sync re-registers any folder it finds there.
const isRepoLocalSourcePath = (sourcePath: string) => {
  const resolvedSourcePath = resolve(sourcePath);
  const marker = `${sep}.pstdio${sep}extensions${sep}`;
  const markerIndex = resolvedSourcePath.indexOf(marker);
  return markerIndex > 0 && resolvedSourcePath.length > markerIndex + marker.length;
};

const removeInstalledSourceFiles = (sourcePath: string) => {
  if (!isManagedInstalledSourcePath(sourcePath) && !isRepoLocalSourcePath(sourcePath)) return;
  rmSync(sourcePath, { recursive: true, force: true });
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

  removeInstalledSourceFiles(installedSource.source_path);

  const instances = await deps.extensionInstancesService.list({ installed_extension_id: installedSource.id });
  let retainedData = false;
  for (const extensionInstance of instances) {
    if (input.deleteUserData) {
      await deps.extensionUserDataService.deleteForInstance(extensionInstance.id);
    } else if (await deps.extensionUserDataService.hasUserData(extensionInstance.id)) {
      // Preserve user data: keep a disabled instance so a reinstall to the same path restores it.
      const disabled = await deps.extensionInstancesService.update(extensionInstance.id, { enabled: false });
      if (disabled) deps.eventBus?.emit("extension_instances", "set", disabled);
      retainedData = true;
      continue;
    }

    if (await deps.extensionInstancesService.remove(extensionInstance.id)) {
      deps.eventBus?.emit("extension_instances", "delete", { id: extensionInstance.id });
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
